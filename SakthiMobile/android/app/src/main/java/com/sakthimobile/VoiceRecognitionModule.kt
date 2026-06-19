package com.sakthimobile

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.speech.RecognitionListener
import android.speech.RecognizerIntent
import android.speech.SpeechRecognizer
import androidx.core.content.ContextCompat
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.modules.core.DeviceEventManagerModule
import java.util.Locale

class VoiceRecognitionModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private val mainHandler = Handler(Looper.getMainLooper())
  private var speechRecognizer: SpeechRecognizer? = null
  private var isListening = false

  override fun getName(): String = "VoiceRecognition"

  @ReactMethod
  fun start(localeTag: String?, promise: Promise) {
    mainHandler.post {
      try {
        if (ContextCompat.checkSelfPermission(reactContext, Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
          promise.reject("MIC_PERMISSION", "Microphone permission is required for Voice SOS.")
          return@post
        }

        if (!SpeechRecognizer.isRecognitionAvailable(reactContext)) {
          promise.reject("VOICE_UNAVAILABLE", "Speech recognition is not available on this device.")
          return@post
        }

        stopInternal()
        speechRecognizer = SpeechRecognizer.createSpeechRecognizer(reactContext).apply {
          setRecognitionListener(listener)
        }

        val locale = localeTag?.takeIf { it.isNotBlank() } ?: Locale.getDefault().toLanguageTag()
        val intent = Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH).apply {
          putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM)
          putExtra(RecognizerIntent.EXTRA_LANGUAGE, locale)
          putExtra(RecognizerIntent.EXTRA_PARTIAL_RESULTS, true)
          putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 5)
          putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS, 2500L)
          putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_POSSIBLY_COMPLETE_SILENCE_LENGTH_MILLIS, 2500L)
          putExtra(RecognizerIntent.EXTRA_SPEECH_INPUT_MINIMUM_LENGTH_MILLIS, 6000L)
          putExtra(RecognizerIntent.EXTRA_CALLING_PACKAGE, reactContext.packageName)
        }

        isListening = true
        speechRecognizer?.startListening(intent)
        promise.resolve(true)
      } catch (exc: Exception) {
        isListening = false
        promise.reject("VOICE_START_FAILED", exc.message ?: "Unable to start speech recognition.")
      }
    }
  }

  @ReactMethod
  fun stop(promise: Promise) {
    mainHandler.post {
      stopInternal()
      promise.resolve(true)
    }
  }

  @ReactMethod
  fun destroy(promise: Promise) {
    mainHandler.post {
      stopInternal()
      speechRecognizer?.destroy()
      speechRecognizer = null
      promise.resolve(true)
    }
  }

  @ReactMethod
  fun addListener(eventName: String) {
    // Required by React Native NativeEventEmitter.
  }

  @ReactMethod
  fun removeListeners(count: Int) {
    // Required by React Native NativeEventEmitter.
  }

  private val listener = object : RecognitionListener {
    override fun onReadyForSpeech(params: Bundle?) {
      sendStatus("ready")
    }

    override fun onBeginningOfSpeech() {
      sendStatus("speaking")
    }

    override fun onRmsChanged(rmsdB: Float) {}

    override fun onBufferReceived(buffer: ByteArray?) {}

    override fun onEndOfSpeech() {
      sendStatus("ended")
      sendEvent("VoiceEnd", Arguments.createMap())
    }

    override fun onError(error: Int) {
      isListening = false
      val payload = Arguments.createMap().apply {
        putInt("code", error)
        putString("message", errorMessage(error))
      }
      sendEvent("VoiceError", payload)
    }

    override fun onResults(results: Bundle?) {
      isListening = false
      sendSpeechResults("VoiceResults", results)
    }

    override fun onPartialResults(partialResults: Bundle?) {
      sendSpeechResults("VoicePartialResults", partialResults)
    }

    override fun onEvent(eventType: Int, params: Bundle?) {}
  }

  private fun stopInternal() {
    try {
      speechRecognizer?.stopListening()
    } catch (_: Exception) {
    }
    try {
      speechRecognizer?.cancel()
    } catch (_: Exception) {
    }
    // Fully release the recognizer instead of reusing it. Reusing a recognizer
    // across sessions (or creating a new one while the old one is still alive)
    // is the common trigger for ERROR_CLIENT on continuous listening.
    try {
      speechRecognizer?.destroy()
    } catch (_: Exception) {
    }
    speechRecognizer = null
    isListening = false
  }

  private fun sendSpeechResults(eventName: String, bundle: Bundle?) {
    val matches = bundle?.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION) ?: arrayListOf()
    val values = Arguments.createArray()
    matches.forEach { values.pushString(it) }
    val payload = Arguments.createMap().apply {
      putArray("value", values)
    }
    sendEvent(eventName, payload)
  }

  private fun sendStatus(status: String) {
    val payload = Arguments.createMap().apply {
      putString("status", status)
      putBoolean("listening", isListening)
    }
    sendEvent("VoiceStatus", payload)
  }

  private fun sendEvent(eventName: String, payload: com.facebook.react.bridge.WritableMap) {
    reactContext
      .getJSModule(DeviceEventManagerModule.RCTDeviceEventEmitter::class.java)
      .emit(eventName, payload)
  }

  private fun errorMessage(error: Int): String =
    when (error) {
      SpeechRecognizer.ERROR_AUDIO -> "Audio recording error."
      SpeechRecognizer.ERROR_CLIENT -> "Speech client error."
      SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS -> "Microphone permission is missing."
      SpeechRecognizer.ERROR_NETWORK -> "Network error during speech recognition."
      SpeechRecognizer.ERROR_NETWORK_TIMEOUT -> "Speech recognition network timed out."
      SpeechRecognizer.ERROR_NO_MATCH -> "No matching speech detected."
      SpeechRecognizer.ERROR_RECOGNIZER_BUSY -> "Speech recognizer is busy."
      SpeechRecognizer.ERROR_SERVER -> "Speech recognition server error."
      SpeechRecognizer.ERROR_SPEECH_TIMEOUT -> "No speech heard."
      else -> "Speech recognition error."
    }
}
