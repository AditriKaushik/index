package org.mahendras.guardian;

import android.app.Application;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.os.Build;

/**
 * Creates the one notification channel the app uses. The channel is deliberately
 * low importance but not silent-and-hidden: the notification is the app's promise
 * that sharing can never run without the phone saying so.
 */
public class GuardianApp extends Application {

    public static final String CHANNEL_SHARING = "guardian_sharing";

    @Override
    public void onCreate() {
        super.onCreate();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_SHARING,
                    getString(R.string.channel_sharing),
                    NotificationManager.IMPORTANCE_LOW);
            channel.setDescription(getString(R.string.channel_sharing_description));
            channel.setShowBadge(true);
            NotificationManager manager = getSystemService(NotificationManager.class);
            if (manager != null) {
                manager.createNotificationChannel(channel);
            }
        }
    }
}
