package com.simhadritransport

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.media.AudioAttributes
import android.net.Uri
import android.os.Build
import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactHost
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.defaults.DefaultReactHost.getDefaultReactHost

/** Must match `default_notification_channel_id` in the manifest. */
private const val DEFAULT_CHANNEL_ID = "smt_default"

/**
 * The halt channel — a lorry that has stood still too long.
 *
 * A separate channel because a channel's sound is fixed at creation: this one
 * plays the bundled alarm tone (`res/raw/halt_alarm`) so a "driver stopped"
 * alert is impossible to miss next to an ordinary update. The server names this
 * channel (`smt_halt`) on halt pushes; it must exist, or Android drops them.
 */
private const val HALT_CHANNEL_ID = "smt_halt"

class MainApplication : Application(), ReactApplication {

  override val reactHost: ReactHost by lazy {
    getDefaultReactHost(
      context = applicationContext,
      packageList =
        PackageList(this).packages.apply {
          // Packages that cannot be autolinked yet can be added manually here, for example:
          // add(MyReactNativePackage())
        },
    )
  }

  /**
   * The channel every push is delivered on.
   *
   * Android 8 made channels mandatory: a notification whose channel does not
   * exist is dropped by the system, silently and with nothing in logcat that
   * names the cause. FCM falls back to the id named in
   * `default_notification_channel_id` — and only shows anything if that
   * channel has actually been created, which is what this does.
   *
   * Created in `Application.onCreate` rather than from JavaScript, because the
   * app is not running when a notification arrives for a closed app. That is
   * precisely the case being fixed, so the channel has to exist from the last
   * time the app was launched, not from the next time.
   */
  private fun createNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
      return
    }
    val channel =
      NotificationChannel(
        DEFAULT_CHANNEL_ID,
        "Fleet alerts",
        // HIGH so a booking or a breakdown arrives as a heads-up notification
        // rather than a silent line in the shade.
        NotificationManager.IMPORTANCE_HIGH,
      ).apply {
        description = "Bookings, trips and driver alerts from the office"
        enableVibration(true)
      }

    // The alarm URI points at the bundled tone; the channel keeps this sound
    // for the life of the install, which is why a new tune means a new channel.
    val alarmUri =
      Uri.parse("android.resource://$packageName/${R.raw.halt_alarm}")
    val alarmAttributes =
      AudioAttributes.Builder()
        .setUsage(AudioAttributes.USAGE_NOTIFICATION_EVENT)
        .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
        .build()
    val haltChannel =
      NotificationChannel(
        HALT_CHANNEL_ID,
        "Halt alerts",
        NotificationManager.IMPORTANCE_HIGH,
      ).apply {
        description = "A driver has stopped too long on a trip"
        setSound(alarmUri, alarmAttributes)
        enableVibration(true)
        vibrationPattern = longArrayOf(0, 400, 200, 400, 200, 400)
      }

    val manager = getSystemService(NotificationManager::class.java)
    manager?.createNotificationChannel(channel)
    manager?.createNotificationChannel(haltChannel)
  }

  override fun onCreate() {
    super.onCreate()
    createNotificationChannel()
    loadReactNative(this)
  }
}
