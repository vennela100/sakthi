package com.sakthimobile

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.os.Build
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule

class PowerButtonTriggerModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private var receiver: BroadcastReceiver? = null
  private val recentPresses = mutableListOf<Long>()

  override fun getName(): String = "PowerButtonTrigger"

  @ReactMethod
  fun startMonitoring(promise: Promise) {
    if (receiver != null) {
      promise.resolve(true)
      return
    }

    receiver = object : BroadcastReceiver() {
      override fun onReceive(context: Context?, intent: Intent?) {
        val action = intent?.action ?: return
        if (action == Intent.ACTION_SCREEN_OFF || action == Intent.ACTION_SCREEN_ON) {
          recordPowerTransition(action)
        }
      }
    }

    val filter = IntentFilter().apply {
      addAction(Intent.ACTION_SCREEN_OFF)
      addAction(Intent.ACTION_SCREEN_ON)
    }

    try {
      if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU) {
        reactContext.registerReceiver(receiver, filter, Context.RECEIVER_NOT_EXPORTED)
      } else {
        reactContext.registerReceiver(receiver, filter)
      }
      promise.resolve(true)
    } catch (exc: Exception) {
      receiver = null
      promise.reject("POWER_MONITOR_FAILED", exc.message ?: "Unable to monitor power button presses.")
    }
  }

  @ReactMethod
  fun stopMonitoring(promise: Promise) {
    stopInternal()
    promise.resolve(true)
  }

  @ReactMethod
  fun addListener(eventName: String) {
    // Required by React Native NativeEventEmitter.
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    // Required by React Native NativeEventEmitter.
  }

  private fun recordPowerTransition(action: String) {
    val now = System.currentTimeMillis()
    recentPresses.add(now)
    recentPresses.removeAll { now - it > PRESS_WINDOW_MS }

    if (recentPresses.size >= REQUIRED_PRESSES) {
      recentPresses.clear()
      val payload = Arguments.createMap().apply {
        putString("action", action)
        putInt("presses", REQUIRED_PRESSES)
      }
      reactContext
        .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
        .emit("PowerButtonTriplePress", payload)
    }
  }

  private fun stopInternal() {
    val activeReceiver = receiver ?: return
    try {
      reactContext.unregisterReceiver(activeReceiver)
    } catch (_: Exception) {
    }
    receiver = null
    recentPresses.clear()
  }

  override fun invalidate() {
    stopInternal()
    super.invalidate()
  }

  companion object {
    private const val REQUIRED_PRESSES = 3
    private const val PRESS_WINDOW_MS = 4000L
  }
}
