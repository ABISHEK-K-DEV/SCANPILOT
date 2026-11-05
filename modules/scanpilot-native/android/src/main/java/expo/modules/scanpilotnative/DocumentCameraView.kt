package expo.modules.scanpilotnative

import android.Manifest
import android.annotation.SuppressLint
import android.content.Context
import android.content.pm.PackageManager
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Matrix
import android.os.Handler
import android.os.Looper
import android.util.Log
import android.util.Base64
import android.util.Size
import android.view.View
import android.view.ViewGroup
import androidx.camera.core.CameraSelector
import androidx.camera.core.ImageAnalysis
import androidx.camera.core.ImageCapture
import androidx.camera.core.ImageCaptureException
import androidx.camera.core.ImageProxy
import androidx.camera.core.Preview
import androidx.camera.core.resolutionselector.AspectRatioStrategy
import androidx.camera.core.resolutionselector.ResolutionSelector
import androidx.camera.core.resolutionselector.ResolutionStrategy
import androidx.camera.lifecycle.ProcessCameraProvider
import androidx.camera.view.PreviewView
import androidx.core.content.ContextCompat
import androidx.lifecycle.LifecycleOwner
import expo.modules.kotlin.AppContext
import expo.modules.kotlin.Promise
import expo.modules.kotlin.viewevent.EventDispatcher
import expo.modules.kotlin.views.ExpoView
import java.io.File
import java.io.FileOutputStream
import java.util.concurrent.ExecutorService
import java.util.concurrent.Executors
import java.util.concurrent.atomic.AtomicBoolean
import kotlin.math.max

/**
 * ScanPilot's document camera (Android, CameraX).
 *
 * Unlike polling with still photos, the live video stream is analysed
 * continuously: an ImageAnalysis use case delivers frames, each is reduced
 * to a small, upright greyscale image (the luma plane, ≈256 px long edge) and
 * sent to JavaScript (`onFrame`), where the tested edge detector runs. The
 * preview never freezes. `takePicture` captures one full-resolution photo,
 * applies the sensor rotation and writes an upright JPEG.
 * Frames and photos never leave the device.
 */
@SuppressLint("ViewConstructor")
class DocumentCameraView(context: Context, appContext: AppContext) : ExpoView(context, appContext) {
  private val onCameraReady by EventDispatcher<Map<String, Any>>()
  private val onFrame by EventDispatcher<Map<String, Any>>()
  private val onCameraError by EventDispatcher<Map<String, Any>>()

  private val previewView = PreviewView(context).apply {
    scaleType = PreviewView.ScaleType.FILL_CENTER
    implementationMode = PreviewView.ImplementationMode.COMPATIBLE
  }
  private val analysisExecutor: ExecutorService = Executors.newSingleThreadExecutor()
  private val captureExecutor: ExecutorService = Executors.newSingleThreadExecutor()
  private var provider: ProcessCameraProvider? = null
  private var imageCapture: ImageCapture? = null
  private var bound = false
  private var released = false

  @Volatile var analysisEnabled: Boolean = true
  @Volatile private var lastFrameAt = 0L
  private var flashMode = ImageCapture.FLASH_MODE_OFF

  init {
    addView(previewView, ViewGroup.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT))
  }

  override fun onMeasure(widthMeasureSpec: Int, heightMeasureSpec: Int) {
    measureChild(previewView, widthMeasureSpec, heightMeasureSpec)
    setMeasuredDimension(
      View.resolveSize(previewView.measuredWidth, widthMeasureSpec),
      View.resolveSize(previewView.measuredHeight, heightMeasureSpec),
    )
  }

  override fun onLayout(changed: Boolean, left: Int, top: Int, right: Int, bottom: Int) {
    previewView.layout(0, 0, right - left, bottom - top)
  }

  override fun onAttachedToWindow() {
    super.onAttachedToWindow()
    start()
  }

  override fun onDetachedFromWindow() {
    super.onDetachedFromWindow()
    unbind()
  }

  fun setFlash(mode: String) {
    flashMode = when (mode) {
      "on" -> ImageCapture.FLASH_MODE_ON
      "auto" -> ImageCapture.FLASH_MODE_AUTO
      else -> ImageCapture.FLASH_MODE_OFF
    }
    imageCapture?.flashMode = flashMode
  }

  private fun fourThree(target: Size?): ResolutionSelector {
    val builder = ResolutionSelector.Builder().setAspectRatioStrategy(AspectRatioStrategy.RATIO_4_3_FALLBACK_AUTO_STRATEGY)
    if (target != null) builder.setResolutionStrategy(ResolutionStrategy(target, ResolutionStrategy.FALLBACK_RULE_CLOSEST_HIGHER_THEN_LOWER))
    else builder.setResolutionStrategy(ResolutionStrategy.HIGHEST_AVAILABLE_STRATEGY)
    return builder.build()
  }

  private fun start() {
    if (bound || released) return
    if (ContextCompat.checkSelfPermission(context, Manifest.permission.CAMERA) != PackageManager.PERMISSION_GRANTED) {
      onCameraError(mapOf("message" to "Camera permission is not granted."))
      return
    }
    val owner = appContext.currentActivity as? LifecycleOwner
    if (owner == null) {
      onCameraError(mapOf("message" to "The camera needs the app in the foreground."))
      return
    }
    val future = ProcessCameraProvider.getInstance(context)
    future.addListener({
      try {
        if (released || !isAttachedToWindow) return@addListener
        val cameraProvider = future.get()
        provider = cameraProvider
        // Full set first; devices (and emulators) that cannot run all three
        // streams at these sizes get lighter configurations.
        val attempts = listOf(
          Triple(fourThree(Size(4032, 3024)), fourThree(Size(640, 480)), true),
          Triple(fourThree(Size(1920, 1440)), fourThree(Size(320, 240)), true),
          Triple(fourThree(Size(1920, 1440)), null, false),
        )
        var lastError: Exception? = null
        for ((captureRes, analysisRes, withAnalysis) in attempts) {
          try {
            val preview = Preview.Builder().setResolutionSelector(fourThree(null)).build().also {
              it.surfaceProvider = previewView.surfaceProvider
            }
            val capture = ImageCapture.Builder()
              .setResolutionSelector(captureRes)
              .setCaptureMode(ImageCapture.CAPTURE_MODE_MINIMIZE_LATENCY)
              .setFlashMode(flashMode)
              .build()
            cameraProvider.unbindAll()
            if (withAnalysis && analysisRes != null) {
              val analysis = ImageAnalysis.Builder()
                .setResolutionSelector(analysisRes)
                .setBackpressureStrategy(ImageAnalysis.STRATEGY_KEEP_ONLY_LATEST)
                .build()
              analysis.setAnalyzer(analysisExecutor) { image -> analyse(image) }
              cameraProvider.bindToLifecycle(owner, CameraSelector.DEFAULT_BACK_CAMERA, preview, capture, analysis)
            } else {
              cameraProvider.bindToLifecycle(owner, CameraSelector.DEFAULT_BACK_CAMERA, preview, capture)
            }
            imageCapture = capture
            lastError = null
            break
          } catch (e: Exception) {
            Log.w(TAG, "Camera configuration failed, trying a lighter one", e)
            lastError = e
          }
        }
        lastError?.let { throw it }
        bound = true
        onCameraReady(mapOf("ready" to true))
      } catch (e: Exception) {
        Log.e(TAG, "Camera could not start", e)
        onCameraError(mapOf("message" to (e.message ?: "The camera could not start.")))
      }
    }, ContextCompat.getMainExecutor(context))
  }

  private fun unbind() {
    try {
      provider?.unbindAll()
    } catch (_: Exception) {
    }
    bound = false
  }

  fun release() {
    released = true
    unbind()
    analysisExecutor.shutdown()
    captureExecutor.shutdown()
  }

  /** Luma plane → small upright greyscale frame, at most ~8 per second. */
  private fun analyse(image: ImageProxy) {
    try {
      val now = System.currentTimeMillis()
      if (!analysisEnabled || now - lastFrameAt < FRAME_INTERVAL_MS) return
      lastFrameAt = now
      val plane = image.planes[0]
      val buffer = plane.buffer
      val rowStride = plane.rowStride
      val pixelStride = plane.pixelStride
      val srcW = image.width
      val srcH = image.height
      val step = max(1, (max(srcW, srcH) + TARGET_EDGE - 1) / TARGET_EDGE)
      val w = srcW / step
      val h = srcH / step
      val small = ByteArray(w * h)
      for (y in 0 until h) {
        val row = y * step * rowStride
        for (x in 0 until w) small[y * w + x] = buffer.get(row + x * step * pixelStride)
      }
      val rotation = image.imageInfo.rotationDegrees
      val (out, outW, outH) = rotate(small, w, h, rotation)
      val gray = Base64.encodeToString(out, Base64.NO_WRAP)
      post { onFrame(mapOf("width" to outW, "height" to outH, "gray" to gray)) }
    } catch (_: Exception) {
      // Skip this frame.
    } finally {
      image.close()
    }
  }

  private fun rotate(src: ByteArray, w: Int, h: Int, degrees: Int): Triple<ByteArray, Int, Int> {
    if (degrees % 360 == 0) return Triple(src, w, h)
    val dst = ByteArray(w * h)
    return when ((degrees % 360 + 360) % 360) {
      90 -> {
        // dst(dx, dy) = src(dy, h - 1 - dx); dst is h × w
        for (dy in 0 until w) for (dx in 0 until h) dst[dy * h + dx] = src[(h - 1 - dx) * w + dy]
        Triple(dst, h, w)
      }
      180 -> {
        for (i in src.indices) dst[i] = src[src.size - 1 - i]
        Triple(dst, w, h)
      }
      else -> {
        // 270: dst(dx, dy) = src(w - 1 - dy, dx); dst is h × w
        for (dy in 0 until w) for (dx in 0 until h) dst[dy * h + dx] = src[dx * w + (w - 1 - dy)]
        Triple(dst, h, w)
      }
    }
  }

  /**
   * One full-resolution photo, rotated upright, saved as JPEG in the cache.
   * If the capture does not finish in time (some devices and emulators stall),
   * the current preview frame is saved instead so the shutter never hangs.
   */
  fun takePicture(promise: Promise) {
    val capture = imageCapture
    if (capture == null) {
      promise.reject("ERR_CAMERA_NOT_READY", "The camera is not ready yet.", null)
      return
    }
    val settled = AtomicBoolean(false)
    val main = Handler(Looper.getMainLooper())
    val fallback = Runnable {
      if (!settled.compareAndSet(false, true)) return@Runnable
      Log.w(TAG, "Capture timed out; saving the preview frame")
      val bitmap = previewView.bitmap
      if (bitmap == null) {
        promise.reject("ERR_CAPTURE", "The photo could not be taken.", null)
        return@Runnable
      }
      captureExecutor.execute {
        try {
          promise.resolve(saveJpeg(bitmap))
        } catch (e: Exception) {
          promise.reject("ERR_CAPTURE", e.message ?: "The photo could not be saved.", e)
        }
      }
    }
    main.postDelayed(fallback, CAPTURE_TIMEOUT_MS)
    try {
      capture.takePicture(captureExecutor, object : ImageCapture.OnImageCapturedCallback() {
        override fun onCaptureSuccess(image: ImageProxy) {
          if (settled.getAndSet(true)) {
            image.close()
            return
          }
          main.removeCallbacks(fallback)
          try {
            val buffer = image.planes[0].buffer
            val bytes = ByteArray(buffer.remaining()).also { buffer.get(it) }
            val rotation = image.imageInfo.rotationDegrees
            image.close()
            // Decode at up to ~3200 px (pages are stored at 2480 px), rotate upright.
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
            var sample = 1
            while (max(bounds.outWidth, bounds.outHeight) / (sample * 2) >= MAX_PHOTO_EDGE) sample *= 2
            val decoded = BitmapFactory.decodeByteArray(bytes, 0, bytes.size, BitmapFactory.Options().apply { inSampleSize = sample })
              ?: throw IllegalStateException("The photo could not be decoded.")
            val upright = if (rotation % 360 != 0) {
              val m = Matrix().apply { postRotate(rotation.toFloat()) }
              Bitmap.createBitmap(decoded, 0, 0, decoded.width, decoded.height, m, true).also { if (it != decoded) decoded.recycle() }
            } else decoded
            promise.resolve(saveJpeg(upright))
          } catch (e: Exception) {
            Log.e(TAG, "Photo could not be saved", e)
            promise.reject("ERR_CAPTURE", e.message ?: "The photo could not be saved.", e)
          }
        }

        override fun onError(exception: ImageCaptureException) {
          Log.w(TAG, "Capture failed; using the preview frame", exception)
          // Let the preview fallback answer straight away.
          main.removeCallbacks(fallback)
          main.post(fallback)
        }
      })
    } catch (e: Exception) {
      Log.w(TAG, "Capture could not start; using the preview frame", e)
      main.removeCallbacks(fallback)
      main.post(fallback)
    }
  }

  private fun saveJpeg(bitmap: Bitmap): Map<String, Any> {
    val file = File(context.cacheDir, "scanpilot-capture-${System.currentTimeMillis()}.jpg")
    FileOutputStream(file).use { bitmap.compress(Bitmap.CompressFormat.JPEG, 92, it) }
    val result = mapOf("uri" to "file://${file.absolutePath}", "width" to bitmap.width, "height" to bitmap.height)
    bitmap.recycle()
    return result
  }

  companion object {
    private const val TARGET_EDGE = 256
    private const val FRAME_INTERVAL_MS = 120L
    private const val MAX_PHOTO_EDGE = 3200
    private const val CAPTURE_TIMEOUT_MS = 6000L
    private const val TAG = "ScanPilotCamera"
  }
}
