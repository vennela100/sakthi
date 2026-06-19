package com.sakthimobile

import android.speech.tts.TextToSpeech
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.Locale

class SafetySpeechModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext), TextToSpeech.OnInitListener {

  private var tts: TextToSpeech? = null
  private var ready = false
  private var pendingText: String? = null

  override fun getName(): String = "SafetySpeech"

  @ReactMethod
  fun speak(text: String, promise: Promise) {
    if (text.isBlank()) {
      promise.reject("EMPTY_TEXT", "No speech text was provided.")
      return
    }

    try {
      pendingText = text
      if (tts == null) {
        tts = TextToSpeech(reactContext, this)
      } else {
        speakNow(text)
      }
      promise.resolve(true)
    } catch (exc: Exception) {
      promise.reject("TTS_FAILED", exc.message ?: "Unable to speak route guidance.")
    }
  }

  @ReactMethod
  fun stop(promise: Promise) {
    try {
      tts?.stop()
      promise.resolve(true)
    } catch (exc: Exception) {
      promise.reject("TTS_STOP_FAILED", exc.message ?: "Unable to stop speech.")
    }
  }

  override fun onInit(status: Int) {
    if (status == TextToSpeech.SUCCESS) {
      val engine = tts ?: return
      val languageStatus = engine.setLanguage(Locale.getDefault())
      ready = languageStatus != TextToSpeech.LANG_MISSING_DATA && languageStatus != TextToSpeech.LANG_NOT_SUPPORTED
      pendingText?.let { speakNow(it) }
      pendingText = null
    } else {
      ready = false
    }
  }

  private fun speakNow(text: String) {
    val engine = tts ?: return
    if (!ready) {
      engine.setLanguage(Locale.US)
      ready = true
    }
    engine.setPitch(1.0f)
    engine.setSpeechRate(0.92f)
    engine.speak(text, TextToSpeech.QUEUE_FLUSH, null, "safe-route-guidance")
  }

  override fun invalidate() {
    tts?.stop()
    tts?.shutdown()
    tts = null
    super.invalidate()
  }
}
