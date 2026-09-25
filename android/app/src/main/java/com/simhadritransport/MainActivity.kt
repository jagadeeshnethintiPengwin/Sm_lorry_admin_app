package com.simhadritransport

import android.os.Bundle
import com.facebook.react.ReactActivity
import com.facebook.react.ReactActivityDelegate
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint.fabricEnabled
import com.facebook.react.defaults.DefaultReactActivityDelegate

class MainActivity : ReactActivity() {

  /**
   * Starts fresh instead of restoring the previous screens.
   *
   * Android kills the app when a permission is changed in Settings (and under
   * memory pressure), then relaunches it with the old screen state. The
   * navigation screens (react-native-screens) cannot be rebuilt from that
   * state, so the relaunch crashed with "Unable to instantiate fragment
   * ScreenStackFragment" — a driver who granted location in Settings and came
   * back found the app closing. Passing null is the library's documented fix;
   * the JS side restores its own state (session, trip) on start.
   */
  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(null)
  }

  /**
   * Returns the name of the main component registered from JavaScript. This is used to schedule
   * rendering of the component.
   */
  override fun getMainComponentName(): String = "SimhadriTransportAdmin"

  /**
   * Returns the instance of the [ReactActivityDelegate]. We use [DefaultReactActivityDelegate]
   * which allows you to enable New Architecture with a single boolean flags [fabricEnabled]
   */
  override fun createReactActivityDelegate(): ReactActivityDelegate =
      DefaultReactActivityDelegate(this, mainComponentName, fabricEnabled)
}
