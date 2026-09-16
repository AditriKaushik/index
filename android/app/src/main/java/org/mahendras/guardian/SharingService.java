package org.mahendras.guardian;

import android.Manifest;
import android.app.Notification;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import android.os.PowerManager;

import androidx.annotation.Nullable;
import androidx.core.app.NotificationCompat;
import androidx.core.app.ServiceCompat;
import androidx.core.content.ContextCompat;

/**
 * Runs for exactly as long as a sharing session does.
 *
 * This service is the reason the APK is worth having over the website. A browser
 * tab gets throttled to a stop once the screen goes off, which is precisely when
 * someone walking home alone needs their position to keep moving. A foreground
 * service with the location type keeps the process alive and keeps the WebView's
 * JavaScript - and therefore the encryption and the sending - running.
 *
 * It holds no location itself and knows nothing about the session. It only keeps
 * the lights on for the page that does.
 */
public class SharingService extends Service {

    public static final String ACTION_START = "org.mahendras.guardian.action.START";
    public static final String ACTION_STOP = "org.mahendras.guardian.action.STOP";
    public static final String EXTRA_LOCATION = "sharing_location";
    public static final String EXTRA_MICROPHONE = "sharing_microphone";
    public static final String EXTRA_SUMMARY = "sharing_summary";

    private static final int NOTIFICATION_ID = 4711;
    private static final long MAX_HOLD_MS = 12L * 60L * 60L * 1000L;

    @Nullable
    private PowerManager.WakeLock wakeLock;

    @Nullable
    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        String action = intent == null ? null : intent.getAction();

        if (ACTION_STOP.equals(action)) {
            stopEverything();
            return START_NOT_STICKY;
        }

        boolean location = intent != null && intent.getBooleanExtra(EXTRA_LOCATION, true);
        boolean microphone = intent != null && intent.getBooleanExtra(EXTRA_MICROPHONE, false);
        String summary = intent == null ? null : intent.getStringExtra(EXTRA_SUMMARY);

        int types = foregroundTypes(location, microphone);
        if (types == 0) {
            // Nothing here qualifies to run in the background - starting anyway
            // would either be refused by the system or quietly do nothing.
            stopEverything();
            return START_NOT_STICKY;
        }

        try {
            ServiceCompat.startForeground(this, NOTIFICATION_ID, buildNotification(summary), types);
        } catch (Exception e) {
            stopEverything();
            return START_NOT_STICKY;
        }

        acquireWakeLock();
        // Restarting without the WebView that was doing the sharing would be a
        // notification promising something that is not happening.
        return START_NOT_STICKY;
    }

    private int foregroundTypes(boolean location, boolean microphone) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.Q) {
            // Older releases take the types from the manifest.
            return ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION;
        }
        int types = 0;
        if (location && granted(Manifest.permission.ACCESS_FINE_LOCATION)) {
            types |= ServiceInfo.FOREGROUND_SERVICE_TYPE_LOCATION;
        }
        if (microphone
                && Build.VERSION.SDK_INT >= Build.VERSION_CODES.R
                && granted(Manifest.permission.RECORD_AUDIO)) {
            types |= ServiceInfo.FOREGROUND_SERVICE_TYPE_MICROPHONE;
        }
        return types;
    }

    private boolean granted(String permission) {
        return ContextCompat.checkSelfPermission(this, permission) == PackageManager.PERMISSION_GRANTED;
    }

    private Notification buildNotification(@Nullable String summary) {
        Intent open = new Intent(this, MainActivity.class)
                .setAction(Intent.ACTION_MAIN)
                .addCategory(Intent.CATEGORY_LAUNCHER)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent openIntent = PendingIntent.getActivity(this, 0, open, pendingFlags());

        Intent stop = new Intent(this, MainActivity.class)
                .setAction(MainActivity.ACTION_STOP_SHARING)
                .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        PendingIntent stopIntent = PendingIntent.getActivity(this, 1, stop, pendingFlags());

        return new NotificationCompat.Builder(this, GuardianApp.CHANNEL_SHARING)
                .setSmallIcon(R.drawable.ic_notification)
                .setContentTitle(getString(R.string.notification_title))
                .setContentText(summary == null || summary.isEmpty() ? getString(R.string.app_name) : summary)
                .setContentIntent(openIntent)
                .addAction(0, getString(R.string.notification_stop), stopIntent)
                .setOngoing(true)
                .setShowWhen(true)
                .setCategory(NotificationCompat.CATEGORY_SERVICE)
                .setPriority(NotificationCompat.PRIORITY_LOW)
                .setVisibility(NotificationCompat.VISIBILITY_PUBLIC)
                .build();
    }

    private int pendingFlags() {
        return Build.VERSION.SDK_INT >= Build.VERSION_CODES.M
                ? PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
                : PendingIntent.FLAG_UPDATE_CURRENT;
    }

    private void acquireWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) {
            return;
        }
        PowerManager power = (PowerManager) getSystemService(POWER_SERVICE);
        if (power == null) {
            return;
        }
        wakeLock = power.newWakeLock(PowerManager.PARTIAL_WAKE_LOCK, "Guardian::sharing");
        wakeLock.setReferenceCounted(false);
        wakeLock.acquire(MAX_HOLD_MS);
    }

    private void releaseWakeLock() {
        if (wakeLock != null && wakeLock.isHeld()) {
            wakeLock.release();
        }
        wakeLock = null;
    }

    private void stopEverything() {
        releaseWakeLock();
        ServiceCompat.stopForeground(this, ServiceCompat.STOP_FOREGROUND_REMOVE);
        stopSelf();
    }

    @Override
    public void onDestroy() {
        releaseWakeLock();
        super.onDestroy();
    }
}
