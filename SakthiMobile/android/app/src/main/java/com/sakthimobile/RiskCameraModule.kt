package com.sakthimobile

import android.annotation.SuppressLint
import android.app.Activity
import android.content.Context
import android.content.Intent
import android.graphics.SurfaceTexture
import android.graphics.ImageFormat
import android.hardware.camera2.CameraAccessException
import android.hardware.camera2.CameraCaptureSession
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraDevice
import android.hardware.camera2.CameraManager
import android.hardware.camera2.CaptureRequest
import android.media.ImageReader
import android.net.Uri
import android.os.Handler
import android.os.HandlerThread
import android.provider.MediaStore
import android.view.Surface
import android.telephony.SmsManager
import android.util.Base64
import androidx.core.content.FileProvider
import com.facebook.react.bridge.ActivityEventListener
import com.facebook.react.bridge.BaseActivityEventListener
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableNativeMap
import java.io.File
import java.io.FileOutputStream
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class RiskCameraModule(private val reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {

  private var capturePromise: Promise? = null
  private var currentPhotoFile: File? = null
  private var currentPhotoContentUri: Uri? = null
  private var autoCapturePromise: Promise? = null
  private var autoPhotoFile: File? = null
  private var cameraDevice: CameraDevice? = null
  private var captureSession: CameraCaptureSession? = null
  private var imageReader: ImageReader? = null
  private var previewTexture: SurfaceTexture? = null
  private var previewSurface: Surface? = null
  private var cameraThread: HandlerThread? = null
  private var cameraHandler: Handler? = null

  private val activityEventListener: ActivityEventListener = object : BaseActivityEventListener() {
    override fun onActivityResult(activity: Activity, requestCode: Int, resultCode: Int, data: Intent?) {
      if (requestCode != REQUEST_CAPTURE_PHOTO) {
        return
      }

      val promise = capturePromise ?: return
      capturePromise = null

      if (resultCode != Activity.RESULT_OK) {
        cleanupCapture()
        promise.reject("CAPTURE_CANCELLED", "Photo capture was cancelled.")
        return
      }

      val file = currentPhotoFile
      val contentUri = currentPhotoContentUri
      if (file == null || !file.exists()) {
        cleanupCapture()
        promise.reject("CAPTURE_FAILED", "Camera did not return a saved photo.")
        return
      }

      val result = WritableNativeMap()
      result.putString("uri", "file://${file.absolutePath}")
      result.putString("contentUri", contentUri?.toString())
      result.putString("path", file.absolutePath)
      result.putString("fileName", file.name)
      result.putString("type", "image/jpeg")
      cleanupCapture()
      promise.resolve(result)
    }
  }

  init {
    reactContext.addActivityEventListener(activityEventListener)
  }

  override fun getName(): String = "RiskCamera"

  @ReactMethod
  fun openCamera(promise: Promise) {
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "Camera cannot open because the app activity is not active.")
      return
    }

    val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
    if (intent.resolveActivity(activity.packageManager) == null) {
      promise.reject("NO_CAMERA", "No camera app is available on this device.")
      return
    }

    activity.startActivity(intent)
    promise.resolve(true)
  }

  @ReactMethod
  fun capturePhoto(promise: Promise) {
    val activity = reactContext.currentActivity
    if (activity == null) {
      promise.reject("NO_ACTIVITY", "Camera cannot open because the app activity is not active.")
      return
    }

    if (capturePromise != null) {
      promise.reject("CAPTURE_IN_PROGRESS", "A photo capture is already in progress.")
      return
    }

    val intent = Intent(MediaStore.ACTION_IMAGE_CAPTURE)
    if (intent.resolveActivity(activity.packageManager) == null) {
      promise.reject("NO_CAMERA", "No camera app is available on this device.")
      return
    }

    try {
      val photoFile = createImageFile()
      val photoUri = FileProvider.getUriForFile(
        reactContext,
        "${reactContext.packageName}.fileprovider",
        photoFile
      )

      currentPhotoFile = photoFile
      currentPhotoContentUri = photoUri
      capturePromise = promise

      intent.putExtra(MediaStore.EXTRA_OUTPUT, photoUri)
      intent.addFlags(Intent.FLAG_GRANT_WRITE_URI_PERMISSION or Intent.FLAG_GRANT_READ_URI_PERMISSION)
      activity.startActivityForResult(intent, REQUEST_CAPTURE_PHOTO)
    } catch (exc: Exception) {
      cleanupCapture()
      promise.reject("CAPTURE_FAILED", exc.message ?: "Unable to start camera capture.")
    }
  }

  @SuppressLint("MissingPermission")
  @ReactMethod
  fun captureEvidencePhoto(promise: Promise) {
    if (autoCapturePromise != null) {
      promise.reject("CAPTURE_IN_PROGRESS", "Automatic evidence capture is already in progress.")
      return
    }

    try {
      val cameraManager = reactContext.getSystemService(Context.CAMERA_SERVICE) as CameraManager
      val cameraId = findCameraId(cameraManager)
      if (cameraId == null) {
        promise.reject("NO_CAMERA", "No camera is available for automatic evidence capture.")
        return
      }

      val characteristics = cameraManager.getCameraCharacteristics(cameraId)
      val sizes = characteristics.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
        ?.getOutputSizes(ImageFormat.JPEG)
      val size = sizes
        ?.filter { it.width <= 1920 && it.height <= 1080 }
        ?.maxByOrNull { it.width * it.height }
        ?: sizes?.maxByOrNull { it.width * it.height }

      if (size == null) {
        promise.reject("NO_CAMERA_SIZE", "Camera does not expose a JPEG capture size.")
        return
      }

      startCameraThread()
      autoCapturePromise = promise
      autoPhotoFile = createImageFile()
      imageReader = ImageReader.newInstance(size.width, size.height, ImageFormat.JPEG, 1)
      imageReader?.setOnImageAvailableListener({ reader ->
        val image = reader.acquireLatestImage()
        if (image == null) {
          rejectAutoCapture("CAPTURE_FAILED", "Automatic camera did not return an image.")
          return@setOnImageAvailableListener
        }

        try {
          val buffer = image.planes[0].buffer
          val bytes = ByteArray(buffer.remaining())
          buffer.get(bytes)
          val file = autoPhotoFile ?: createImageFile()
          FileOutputStream(file).use { it.write(bytes) }
          resolveAutoCapture(file)
        } catch (exc: Exception) {
          rejectAutoCapture("CAPTURE_FAILED", exc.message ?: "Unable to save automatic evidence photo.")
        } finally {
          image.close()
        }
      }, cameraHandler)

      cameraManager.openCamera(cameraId, object : CameraDevice.StateCallback() {
        override fun onOpened(camera: CameraDevice) {
          cameraDevice = camera
          createAutoCaptureSession(camera)
        }

        override fun onDisconnected(camera: CameraDevice) {
          camera.close()
          rejectAutoCapture("CAMERA_DISCONNECTED", "Camera disconnected during evidence capture.")
        }

        override fun onError(camera: CameraDevice, error: Int) {
          camera.close()
          rejectAutoCapture("CAMERA_ERROR", "Camera failed during evidence capture.")
        }
      }, cameraHandler)
    } catch (exc: SecurityException) {
      cleanupAutoCapture()
      promise.reject("CAMERA_PERMISSION", "Camera permission is required for automatic evidence capture.")
    } catch (exc: Exception) {
      cleanupAutoCapture()
      promise.reject("CAPTURE_FAILED", exc.message ?: "Unable to start automatic evidence capture.")
    }
  }

  @ReactMethod
  fun sendSms(phoneNumber: String, message: String, promise: Promise) {
    try {
      val sms = SmsManager.getDefault()
      val parts = sms.divideMessage(message)
      sms.sendMultipartTextMessage(phoneNumber, null, parts, null, null)
      promise.resolve(true)
    } catch (exc: Exception) {
      promise.reject("SMS_FAILED", exc.message ?: "SMS failed.")
    }
  }

  @ReactMethod
  fun readFileBase64(path: String, promise: Promise) {
    try {
      val cleanPath = path.removePrefix("file://")
      val bytes = File(cleanPath).readBytes()
      promise.resolve(Base64.encodeToString(bytes, Base64.NO_WRAP))
    } catch (exc: Exception) {
      promise.reject("READ_FAILED", exc.message ?: "Unable to read evidence photo.")
    }
  }

  @ReactMethod
  fun deleteLocalFile(path: String, promise: Promise) {
    try {
      val cleanPath = path.removePrefix("file://")
      val file = File(cleanPath)
      val riskPhotoDir = File(reactContext.cacheDir, "risk_photos").canonicalFile
      val target = file.canonicalFile

      if (!target.path.startsWith(riskPhotoDir.path)) {
        promise.reject("DELETE_BLOCKED", "Only cached risk photos can be deleted.")
        return
      }

      promise.resolve(!target.exists() || target.delete())
    } catch (exc: Exception) {
      promise.reject("DELETE_FAILED", exc.message ?: "Unable to delete local evidence photo.")
    }
  }

  private fun createImageFile(): File {
    val timestamp = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
    val storageDir = File(reactContext.cacheDir, "risk_photos")
    if (!storageDir.exists()) {
      storageDir.mkdirs()
    }
    return File.createTempFile("SOS_${timestamp}_", ".jpg", storageDir)
  }

  private fun cleanupCapture() {
    capturePromise = null
    currentPhotoFile = null
    currentPhotoContentUri = null
  }

  private fun startCameraThread() {
    cameraThread = HandlerThread("SakthiEvidenceCamera").also { it.start() }
    cameraHandler = Handler(cameraThread!!.looper)
  }

  private fun findCameraId(cameraManager: CameraManager): String? {
    var fallback: String? = null
    for (cameraId in cameraManager.cameraIdList) {
      val characteristics = cameraManager.getCameraCharacteristics(cameraId)
      val facing = characteristics.get(CameraCharacteristics.LENS_FACING)
      val hasJpeg = characteristics.get(CameraCharacteristics.SCALER_STREAM_CONFIGURATION_MAP)
        ?.getOutputSizes(ImageFormat.JPEG)
        ?.isNotEmpty() == true

      if (!hasJpeg) {
        continue
      }

      if (fallback == null) {
        fallback = cameraId
      }
      if (facing == CameraCharacteristics.LENS_FACING_BACK) {
        return cameraId
      }
    }
    return fallback
  }

  private fun createAutoCaptureSession(camera: CameraDevice) {
    val reader = imageReader
    if (reader == null) {
      rejectAutoCapture("CAPTURE_FAILED", "Camera image reader was not initialized.")
      return
    }

    try {
      previewTexture = SurfaceTexture(0).apply {
        setDefaultBufferSize(640, 480)
      }
      previewSurface = Surface(previewTexture)
      val preview = previewSurface
      if (preview == null) {
        rejectAutoCapture("CAPTURE_FAILED", "Camera preview surface was not initialized.")
        return
      }

      camera.createCaptureSession(listOf(preview, reader.surface), object : CameraCaptureSession.StateCallback() {
        override fun onConfigured(session: CameraCaptureSession) {
          captureSession = session
          try {
            val previewRequest = camera.createCaptureRequest(CameraDevice.TEMPLATE_PREVIEW).apply {
              addTarget(preview)
              set(CaptureRequest.CONTROL_MODE, CaptureRequest.CONTROL_MODE_AUTO)
              set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE)
              set(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_ON)
            }
            session.setRepeatingRequest(previewRequest.build(), null, cameraHandler)

            cameraHandler?.postDelayed({
              try {
                val request = camera.createCaptureRequest(CameraDevice.TEMPLATE_STILL_CAPTURE).apply {
                  addTarget(reader.surface)
                  set(CaptureRequest.CONTROL_MODE, CaptureRequest.CONTROL_MODE_AUTO)
                  set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE)
                  set(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_ON)
                  set(CaptureRequest.JPEG_QUALITY, 88.toByte())
                }
                session.capture(request.build(), null, cameraHandler)
              } catch (exc: CameraAccessException) {
                rejectAutoCapture("CAPTURE_FAILED", exc.message ?: "Unable to capture evidence photo.")
              }
            }, 900)
          } catch (exc: CameraAccessException) {
            rejectAutoCapture("CAPTURE_FAILED", exc.message ?: "Unable to start camera preview.")
          }
        }

        override fun onConfigureFailed(session: CameraCaptureSession) {
          rejectAutoCapture("CAPTURE_FAILED", "Unable to configure camera for evidence capture.")
        }
      }, cameraHandler)
    } catch (exc: Exception) {
      rejectAutoCapture("CAPTURE_FAILED", exc.message ?: "Unable to configure camera.")
    }
  }

  private fun legacyCreateAutoCaptureSession(camera: CameraDevice) {
    val reader = imageReader
    if (reader == null) {
      rejectAutoCapture("CAPTURE_FAILED", "Camera image reader was not initialized.")
      return
    }

    try {
      camera.createCaptureSession(listOf(reader.surface), object : CameraCaptureSession.StateCallback() {
        override fun onConfigured(session: CameraCaptureSession) {
          captureSession = session
          try {
            val request = camera.createCaptureRequest(CameraDevice.TEMPLATE_STILL_CAPTURE).apply {
              addTarget(reader.surface)
              set(CaptureRequest.CONTROL_MODE, CaptureRequest.CONTROL_MODE_AUTO)
              set(CaptureRequest.CONTROL_AF_MODE, CaptureRequest.CONTROL_AF_MODE_CONTINUOUS_PICTURE)
              set(CaptureRequest.CONTROL_AE_MODE, CaptureRequest.CONTROL_AE_MODE_ON)
            }
            session.capture(request.build(), null, cameraHandler)
          } catch (exc: CameraAccessException) {
            rejectAutoCapture("CAPTURE_FAILED", exc.message ?: "Unable to capture evidence photo.")
          }
        }

        override fun onConfigureFailed(session: CameraCaptureSession) {
          rejectAutoCapture("CAPTURE_FAILED", "Unable to configure camera for evidence capture.")
        }
      }, cameraHandler)
    } catch (exc: Exception) {
      rejectAutoCapture("CAPTURE_FAILED", exc.message ?: "Unable to configure camera.")
    }
  }

  private fun resolveAutoCapture(file: File) {
    val promise = autoCapturePromise ?: return
    val result = WritableNativeMap()
    result.putString("uri", "file://${file.absolutePath}")
    result.putString("path", file.absolutePath)
    result.putString("fileName", file.name)
    result.putString("type", "image/jpeg")
    cleanupAutoCapture()
    promise.resolve(result)
  }

  private fun rejectAutoCapture(code: String, message: String) {
    val promise = autoCapturePromise
    cleanupAutoCapture()
    promise?.reject(code, message)
  }

  private fun cleanupAutoCapture() {
    try {
      captureSession?.close()
    } catch (_: Exception) {
    }
    try {
      cameraDevice?.close()
    } catch (_: Exception) {
    }
    try {
      imageReader?.close()
    } catch (_: Exception) {
    }
    try {
      previewSurface?.release()
    } catch (_: Exception) {
    }
    try {
      previewTexture?.release()
    } catch (_: Exception) {
    }
    cameraThread?.quitSafely()
    autoCapturePromise = null
    autoPhotoFile = null
    captureSession = null
    cameraDevice = null
    imageReader = null
    previewSurface = null
    previewTexture = null
    cameraThread = null
    cameraHandler = null
  }

  companion object {
    private const val REQUEST_CAPTURE_PHOTO = 8801
  }
}
