package org.mahendras.guardian;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.GeolocationPermissions;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.core.content.ContextCompat;
import androidx.webkit.WebViewAssetLoader;

import java.util.ArrayList;
import java.util.List;

/**
 * The whole app: one WebView showing the Guardian page that ships inside the APK.
 *
 * Loading from the APK rather than from the network matters for something people
 * open in an emergency - it starts instantly, works with no signal, and cannot be
 * broken by a site being down. WebViewAssetLoader serves those files over https
 * from a virtual host, which is what makes geolocation, the camera, the
 * microphone and WebCrypto available at all: browsers refuse them otherwise.
 */
public class MainActivity extends Activity {

    public static final String ACTION_STOP_SHARING = "org.mahendras.guardian.action.STOP_SHARING";

    private static final String APP_HOST = "appassets.androidplatform.net";
    private static final String APP_URL = "https://" + APP_HOST + "/liveshare/index.html";

    private static final int REQ_STARTUP = 10;
    private static final int REQ_MEDIA = 11;

    private WebView webView;
    private WebViewAssetLoader assetLoader;
    private boolean sharing;

    @Nullable
    private PermissionRequest pendingMediaRequest;

    @Override
    protected void onCreate(@Nullable Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.activity_main);

        assetLoader = new WebViewAssetLoader.Builder()
                .addPathHandler("/", new WebViewAssetLoader.AssetsPathHandler(this))
                .build();

        webView = findViewById(R.id.webview);
        configureWebView();
        webView.addJavascriptInterface(new GuardianHost(), "LiveShareHost");
        webView.loadUrl(startUrlFor(getIntent()));

        askForStartupPermissions();
    }

    @SuppressWarnings("deprecation")
    private void configureWebView() {
        WebSettings settings = webView.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setGeolocationEnabled(true);
        // Voice and video have to be able to start from the page's own logic;
        // the user has already tapped a button by the time it does.
        settings.setMediaPlaybackRequiresUserGesture(false);
        settings.setSupportMultipleWindows(false);
        settings.setJavaScriptCanOpenWindowsAutomatically(false);
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        settings.setCacheMode(WebSettings.LOAD_DEFAULT);

        if (BuildConfig.DEBUG) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        webView.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                return assetLoader.shouldInterceptRequest(request.getUrl());
            }

            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                return handleUrl(request.getUrl());
            }
        });

        webView.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(() -> grantMedia(request));
            }

            @Override
            public void onGeolocationPermissionsShowPrompt(String origin, GeolocationPermissions.Callback callback) {
                callback.invoke(origin, granted(Manifest.permission.ACCESS_FINE_LOCATION), false);
            }
        });
    }

    /**
     * Links out of the app - WhatsApp, SMS, the dialler, a map - belong to the
     * system. Only our own pages stay inside the WebView.
     */
    private boolean handleUrl(Uri url) {
        if (APP_HOST.equals(url.getHost())) {
            return false;
        }
        try {
            startActivity(new Intent(Intent.ACTION_VIEW, url).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        } catch (Exception e) {
            Toast.makeText(this, getString(R.string.app_name), Toast.LENGTH_SHORT).show();
        }
        return true;
    }

    /**
     * A share link opened from WhatsApp arrives here. The key lives in the
     * fragment, so it has to be carried across to the local copy of the page
     * verbatim - dropping it would leave a link that cannot be decrypted.
     */
    private String startUrlFor(@Nullable Intent intent) {
        Uri data = intent == null ? null : intent.getData();
        if (data == null) {
            return APP_URL;
        }
        StringBuilder url = new StringBuilder(APP_URL);
        String query = data.getEncodedQuery();
        if (query != null && !query.isEmpty()) {
            url.append('?').append(query);
        }
        String fragment = data.getEncodedFragment();
        if (fragment != null && !fragment.isEmpty()) {
            url.append('#').append(fragment);
        }
        return url.toString();
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);

        if (ACTION_STOP_SHARING.equals(intent.getAction())) {
            // The Stop button on the notification. The page owns the session, so
            // it does the stopping - this only asks.
            webView.evaluateJavascript("window.__liveShareStop && window.__liveShareStop();", null);
            return;
        }
        if (intent.getData() != null) {
            webView.loadUrl(startUrlFor(intent));
        }
    }

    // ---- Permissions ------------------------------------------------------

    private boolean granted(String permission) {
        return ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED;
    }

    private void askForStartupPermissions() {
        List<String> wanted = new ArrayList<>();
        if (!granted(Manifest.permission.ACCESS_FINE_LOCATION)) {
            wanted.add(Manifest.permission.ACCESS_FINE_LOCATION);
            wanted.add(Manifest.permission.ACCESS_COARSE_LOCATION);
        }
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU
                && !granted(Manifest.permission.POST_NOTIFICATIONS)) {
            wanted.add(Manifest.permission.POST_NOTIFICATIONS);
        }
        if (!wanted.isEmpty()) {
            requestPermissions(wanted.toArray(new String[0]), REQ_STARTUP);
        }
    }

    /**
     * The page asking for the microphone or camera is the user having tapped a
     * tile. If Android has not been asked yet, ask now and answer the page once
     * the system dialog comes back - rather than refusing and making them hunt
     * through settings.
     */
    private void grantMedia(PermissionRequest request) {
        List<String> needed = new ArrayList<>();
        for (String resource : request.getResources()) {
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)
                    && !granted(Manifest.permission.RECORD_AUDIO)) {
                needed.add(Manifest.permission.RECORD_AUDIO);
            } else if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)
                    && !granted(Manifest.permission.CAMERA)) {
                needed.add(Manifest.permission.CAMERA);
            }
        }

        if (!needed.isEmpty()) {
            if (pendingMediaRequest != null) {
                pendingMediaRequest.deny();
            }
            pendingMediaRequest = request;
            requestPermissions(needed.toArray(new String[0]), REQ_MEDIA);
            return;
        }

        answerMediaRequest(request);
    }

    private void answerMediaRequest(PermissionRequest request) {
        List<String> allow = new ArrayList<>();
        for (String resource : request.getResources()) {
            if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)
                    && granted(Manifest.permission.RECORD_AUDIO)) {
                allow.add(resource);
            } else if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)
                    && granted(Manifest.permission.CAMERA)) {
                allow.add(resource);
            }
        }
        if (allow.isEmpty()) {
            request.deny();
        } else {
            request.grant(allow.toArray(new String[0]));
        }
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, @NonNull String[] permissions,
                                           @NonNull int[] results) {
        super.onRequestPermissionsResult(requestCode, permissions, results);
        if (requestCode == REQ_MEDIA && pendingMediaRequest != null) {
            PermissionRequest request = pendingMediaRequest;
            pendingMediaRequest = null;
            answerMediaRequest(request);
        }
    }

    // ---- Lifecycle --------------------------------------------------------

    @Override
    protected void onPause() {
        super.onPause();
        // While sharing, the page must keep running: pausing the WebView stops
        // its timers, which stops the position updates the whole app is for.
        if (!sharing) {
            webView.onPause();
            webView.pauseTimers();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        webView.resumeTimers();
        webView.onResume();
    }

    @Override
    public void onBackPressed() {
        if (webView.canGoBack()) {
            webView.goBack();
        } else {
            moveTaskToBack(true);
        }
    }

    @Override
    protected void onDestroy() {
        if (sharing) {
            startService(new Intent(this, SharingService.class).setAction(SharingService.ACTION_STOP));
        }
        webView.destroy();
        super.onDestroy();
    }

    // ---- The bridge the page talks to -------------------------------------

    public class GuardianHost {

        /** Lets the page know it can rely on the native behaviour below. */
        @JavascriptInterface
        public boolean isNativeApp() {
            return true;
        }

        /**
         * The page is served from inside the APK, so its own address is useless
         * to anyone else. Share links are built from this public address instead.
         */
        @JavascriptInterface
        public String publicBase() {
            return BuildConfig.PUBLIC_BASE;
        }

        @JavascriptInterface
        public void setSharing(final boolean active, final boolean location,
                               final boolean microphone, final String summary) {
            runOnUiThread(() -> {
                sharing = active;
                if (active) {
                    getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                    Intent start = new Intent(MainActivity.this, SharingService.class)
                            .setAction(SharingService.ACTION_START)
                            .putExtra(SharingService.EXTRA_LOCATION, location)
                            .putExtra(SharingService.EXTRA_MICROPHONE, microphone)
                            .putExtra(SharingService.EXTRA_SUMMARY, summary);
                    ContextCompat.startForegroundService(MainActivity.this, start);
                } else {
                    getWindow().clearFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
                    startService(new Intent(MainActivity.this, SharingService.class)
                            .setAction(SharingService.ACTION_STOP));
                }
            });
        }
    }
}
