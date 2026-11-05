package expo.modules.scanpilotnative

import android.app.Activity
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import com.google.mlkit.vision.documentscanner.GmsDocumentScannerOptions
import com.google.mlkit.vision.documentscanner.GmsDocumentScanning
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.documentscanner.GmsDocumentScanningResult
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.devanagari.DevanagariTextRecognizerOptions
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import expo.modules.kotlin.records.Field
import expo.modules.kotlin.records.Record
import java.io.File
import java.io.FileOutputStream
import kotlin.math.max
import kotlin.math.roundToInt

class ScanOptions : Record {
  @Field val pageLimit: Int = 0
  @Field val galleryImport: Boolean = true
  /** "base": camera + crop/rotate only (ScanPilot applies filters in its own review screen); "full": Google's enhance/filter UI too. */
  @Field val mode: String = "base"
}

class PdfException(code: String, message: String, cause: Throwable? = null) : CodedException(code, message, cause)

/**
 * ScanPilot's own native bridge (Android):
 *  - scanDocument: Google ML Kit Document Scanner. Uses Expo's activity provider and
 *    OnActivityResult, so it does not depend on ReactContext.getCurrentActivity()
 *    (which returned null with React Native's bridgeless mode in the previous plugin).
 *  - renderPdfPage / getPdfInfo: android.graphics.pdf.PdfRenderer at any DPI, used for
 *    compression and page thumbnails. Files never leave the device.
 */
class ScanPilotNativeModule : Module() {
  private var pendingScan: Promise? = null

  override fun definition() = ModuleDefinition {
    Name("ScanPilotNative")

    // Live document camera: continuous frame analysis + full-resolution capture (CameraX).
    View(DocumentCameraView::class) {
      Events("onCameraReady", "onFrame", "onCameraError")
      Prop("flash") { view: DocumentCameraView, mode: String? -> view.setFlash(mode ?: "off") }
      Prop("analysis") { view: DocumentCameraView, enabled: Boolean? -> view.analysisEnabled = enabled ?: true }
      AsyncFunction("takePicture") { view: DocumentCameraView, promise: Promise -> view.takePicture(promise) }
      OnViewDestroys { view: DocumentCameraView -> view.release() }
    }

    AsyncFunction("scanDocument") { options: ScanOptions, promise: Promise ->
      if (pendingScan != null) {
        promise.reject("ERR_SCAN_IN_PROGRESS", "A scan is already in progress.", null)
        return@AsyncFunction
      }
      val activity = appContext.currentActivity
      if (activity == null) {
        promise.reject("ERR_NO_ACTIVITY", "ScanPilot is not in the foreground. Please try again.", null)
        return@AsyncFunction
      }
      val builder = GmsDocumentScannerOptions.Builder()
        .setResultFormats(GmsDocumentScannerOptions.RESULT_FORMAT_JPEG)
        .setScannerMode(
          if (options.mode == "full") GmsDocumentScannerOptions.SCANNER_MODE_FULL else GmsDocumentScannerOptions.SCANNER_MODE_BASE,
        )
        .setGalleryImportAllowed(options.galleryImport)
      if (options.pageLimit > 0) builder.setPageLimit(options.pageLimit)

      pendingScan = promise
      try {
        GmsDocumentScanning.getClient(builder.build())
          .getStartScanIntent(activity)
          .addOnSuccessListener { intentSender ->
            try {
              activity.startIntentSenderForResult(intentSender, SCAN_REQUEST_CODE, null, 0, 0, 0)
            } catch (e: Exception) {
              finishScanWithError("ERR_SCAN_START", e)
            }
          }
          .addOnFailureListener { e -> finishScanWithError("ERR_SCANNER_UNAVAILABLE", e) }
      } catch (e: Exception) {
        finishScanWithError("ERR_SCANNER_UNAVAILABLE", e)
      }
    }.runOnQueue(Queues.MAIN)

    OnActivityResult { _, payload ->
      if (payload.requestCode != SCAN_REQUEST_CODE) return@OnActivityResult
      val promise = pendingScan ?: return@OnActivityResult
      pendingScan = null
      if (payload.resultCode != Activity.RESULT_OK) {
        promise.resolve(mapOf("status" to "cancel", "pages" to emptyList<String>()))
        return@OnActivityResult
      }
      try {
        val result = GmsDocumentScanningResult.fromActivityResultIntent(payload.data)
        val pages = result?.pages?.map { it.imageUri.toString() } ?: emptyList()
        promise.resolve(mapOf("status" to "success", "pages" to pages))
      } catch (e: Exception) {
        promise.reject("ERR_SCAN_RESULT", e.message ?: "Could not read the scanned pages.", e)
      }
    }

    /**
     * On-device text recognition. `script` is "latin" or "devanagari" (Devanagari
     * also reads Latin text). Line boxes are in pixels of the upright input image.
     */
    AsyncFunction("recognizeText") { uri: String, script: String, promise: Promise ->
      val context = appContext.reactContext
      if (context == null) {
        promise.reject("ERR_CONTEXT", "The app is not ready. Please try again.", null)
        return@AsyncFunction
      }
      val image = try {
        InputImage.fromFilePath(context, Uri.parse(uri))
      } catch (e: Exception) {
        promise.reject("ERR_OCR_IMAGE", "Could not read the image for text recognition.", e)
        return@AsyncFunction
      }
      val recognizer = if (script == "devanagari") {
        TextRecognition.getClient(DevanagariTextRecognizerOptions.Builder().build())
      } else {
        TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)
      }
      val upright = image.rotationDegrees % 180 == 0
      val width = if (upright) image.width else image.height
      val height = if (upright) image.height else image.width
      recognizer.process(image)
        .addOnSuccessListener { result ->
          val lines = result.textBlocks.flatMap { block ->
            block.lines.map { line ->
              val box = line.boundingBox
              mapOf(
                "text" to line.text,
                "left" to (box?.left ?: 0),
                "top" to (box?.top ?: 0),
                "width" to (box?.width() ?: 0),
                "height" to (box?.height() ?: 0),
              )
            }
          }
          recognizer.close()
          promise.resolve(mapOf("text" to result.text, "width" to width, "height" to height, "lines" to lines))
        }
        .addOnFailureListener { e ->
          recognizer.close()
          promise.reject("ERR_OCR", e.message ?: "Text recognition failed.", e)
        }
    }

    AsyncFunction("getPdfInfo") { uri: String ->
      openRenderer(uri).use { (renderer, _) ->
        val sizes = (0 until renderer.pageCount).map { index ->
          renderer.openPage(index).use { page -> listOf(page.width, page.height) }
        }
        mapOf("pageCount" to renderer.pageCount, "pageSizes" to sizes)
      }
    }

    /**
     * Renders one zero-based page to a JPEG at `dpi` (white background).
     * The long edge is capped at `maxEdge` pixels to bound memory.
     */
    AsyncFunction("renderPdfPage") { uri: String, pageIndex: Int, dpi: Double, quality: Int, maxEdge: Int, outputUri: String ->
      openRenderer(uri).use { (renderer, _) ->
        if (pageIndex < 0 || pageIndex >= renderer.pageCount) {
          throw PdfException("ERR_PDF_PAGE", "Page ${pageIndex + 1} does not exist.")
        }
        val out = fileFor(outputUri)
        out.parentFile?.mkdirs()
        val result = renderer.openPage(pageIndex).use { page ->
          var scale = dpi / 72.0
          val longEdge = max(page.width, page.height) * scale
          if (maxEdge > 0 && longEdge > maxEdge) scale *= maxEdge / longEdge
          val width = max(1, (page.width * scale).roundToInt())
          val height = max(1, (page.height * scale).roundToInt())
          val bitmap = try {
            Bitmap.createBitmap(width, height, Bitmap.Config.ARGB_8888)
          } catch (e: OutOfMemoryError) {
            throw PdfException("ERR_OUT_OF_MEMORY", "Not enough memory to render this page.")
          }
          try {
            bitmap.eraseColor(Color.WHITE)
            page.render(bitmap, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
            FileOutputStream(out).use { stream ->
              bitmap.compress(Bitmap.CompressFormat.JPEG, quality.coerceIn(1, 100), stream)
            }
          } finally {
            bitmap.recycle()
          }
          mapOf(
            "uri" to Uri.fromFile(out).toString(),
            "width" to width,
            "height" to height,
            "pageWidth" to page.width,
            "pageHeight" to page.height,
            "bytes" to out.length().toDouble(),
          )
        }
        result
      }
    }
  }

  private fun finishScanWithError(code: String, error: Throwable) {
    val promise = pendingScan ?: return
    pendingScan = null
    promise.reject(code, error.message ?: error.javaClass.simpleName, error)
  }

  private data class OpenRenderer(val renderer: PdfRenderer, val pfd: ParcelFileDescriptor) : AutoCloseable {
    override fun close() {
      try { renderer.close() } catch (_: Exception) {}
      try { pfd.close() } catch (_: Exception) {}
    }
  }

  private fun fileFor(uri: String): File {
    val path = if (uri.startsWith("file:")) Uri.parse(uri).path else uri
    if (path.isNullOrEmpty()) throw PdfException("ERR_PDF_URI", "Unsupported file location: $uri")
    return File(path)
  }

  private fun openRenderer(uri: String): OpenRenderer {
    val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
    val pfd = try {
      if (uri.startsWith("content:")) {
        context.contentResolver.openFileDescriptor(Uri.parse(uri), "r")
          ?: throw PdfException("ERR_PDF_OPEN", "Could not open the PDF.")
      } else {
        ParcelFileDescriptor.open(fileFor(uri), ParcelFileDescriptor.MODE_READ_ONLY)
      }
    } catch (e: CodedException) {
      throw e
    } catch (e: Exception) {
      throw PdfException("ERR_PDF_OPEN", "Could not open the PDF: ${e.message}", e)
    }
    return try {
      OpenRenderer(PdfRenderer(pfd), pfd)
    } catch (e: SecurityException) {
      pfd.close()
      throw PdfException("ERR_PDF_PASSWORD", "This PDF is password-protected.", e)
    } catch (e: Exception) {
      pfd.close()
      throw PdfException("ERR_PDF_INVALID", "This file is not a readable PDF.", e)
    }
  }

  companion object {
    private const val SCAN_REQUEST_CODE = 46_201
  }
}
