package expo.modules.scanpilotnative

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Matrix
import android.graphics.Paint
import java.io.File
import java.io.FileOutputStream
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow
import kotlin.math.roundToInt

/**
 * Native scan-page pipeline: decode → perspective warp → colour filter → JPEG.
 *
 * Mirrors src/services/scan/{warp,filters}.ts exactly, but runs as compiled
 * code instead of JavaScript (Hermes has no JIT, so per-pixel JS loops on a
 * 4–5 MP photo took 20–30 s on mid-range phones; this takes well under 1 s).
 */
object PageProcessor {
  private fun clamp(v: Double): Int = if (v < 0) 0 else if (v > 255) 255 else v.toInt()
  private fun luma(r: Int, g: Int, b: Int): Double = 0.299 * r + 0.587 * g + 0.114 * b
  private fun argb(r: Int, g: Int, b: Int): Int = (0xFF shl 24) or (r shl 16) or (g shl 8) or b

  fun decode(path: String): Bitmap {
    val options = BitmapFactory.Options().apply {
      inPreferredConfig = Bitmap.Config.ARGB_8888
      inMutable = false
    }
    return BitmapFactory.decodeFile(path, options) ?: throw IllegalArgumentException("Could not read the image.")
  }

  fun save(bitmap: Bitmap, path: String, quality: Int) {
    val file = File(path)
    file.parentFile?.mkdirs()
    FileOutputStream(file).use { bitmap.compress(Bitmap.CompressFormat.JPEG, quality.coerceIn(1, 100), it) }
  }

  /** Same as outputSizeForQuad: average opposite edge lengths, long edge capped at maxEdge. */
  fun outputSize(q: DoubleArray, maxEdge: Int): Pair<Int, Int> {
    val top = hypot(q[2] - q[0], q[3] - q[1])
    val bottom = hypot(q[4] - q[6], q[5] - q[7])
    val left = hypot(q[6] - q[0], q[7] - q[1])
    val right = hypot(q[4] - q[2], q[5] - q[3])
    var w = (top + bottom) / 2
    var h = (left + right) / 2
    val scale = min(1.0, maxEdge / max(w, h))
    w = max(1.0, (w * scale).roundToInt().toDouble())
    h = max(1.0, (h * scale).roundToInt().toDouble())
    return Pair(w.toInt(), h.toInt())
  }

  /** Perspective-corrects quad (TL, TR, BR, BL in pixels) into an upright page on white. */
  fun warp(src: Bitmap, q: DoubleArray, maxEdge: Int): Bitmap {
    val (w, h) = outputSize(q, maxEdge)
    val out = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    out.eraseColor(Color.WHITE)
    val matrix = Matrix()
    val from = floatArrayOf(q[0].toFloat(), q[1].toFloat(), q[2].toFloat(), q[3].toFloat(), q[4].toFloat(), q[5].toFloat(), q[6].toFloat(), q[7].toFloat())
    val to = floatArrayOf(0f, 0f, w.toFloat(), 0f, w.toFloat(), h.toFloat(), 0f, h.toFloat())
    if (!matrix.setPolyToPoly(from, 0, to, 0, 4)) throw IllegalArgumentException("Degenerate page outline.")
    Canvas(out).drawBitmap(src, matrix, Paint(Paint.FILTER_BITMAP_FLAG or Paint.ANTI_ALIAS_FLAG))
    return out
  }

  // ----- filters (ports of filters.ts) -------------------------------------

  private fun percentiles(px: IntArray, low: Double = 0.01, high: Double = 0.99): Pair<Int, Int> {
    val hist = IntArray(256)
    val step = if (px.size > 1_000_000) 4 else 1
    var count = 0
    var i = 0
    while (i < px.size) {
      val c = px[i]
      hist[luma((c shr 16) and 0xFF, (c shr 8) and 0xFF, c and 0xFF).toInt()]++
      count++
      i += step
    }
    var acc = 0
    var lo = 0
    for (v in 0..255) { acc += hist[v]; if (acc >= count * low) { lo = v; break } }
    acc = 0
    var hi = 255
    for (v in 255 downTo 0) { acc += hist[v]; if (acc >= count * (1 - high)) { hi = v; break } }
    return if (hi - lo < 16) Pair(0, 255) else Pair(lo, hi)
  }

  private fun stretch(px: IntArray, boost: Double): IntArray {
    val (lo, hi) = percentiles(px)
    val scale = 255.0 / (hi - lo) * boost
    val mid = (lo + hi) / 2.0
    return IntArray(px.size) { i ->
      val c = px[i]
      argb(clamp((((c shr 16) and 0xFF) - mid) * scale + 127.5), clamp((((c shr 8) and 0xFF) - mid) * scale + 127.5), clamp(((c and 0xFF) - mid) * scale + 127.5))
    }
  }

  private fun grayscale(px: IntArray): IntArray = IntArray(px.size) { i ->
    val c = px[i]
    val v = luma((c shr 16) and 0xFF, (c shr 8) and 0xFF, c and 0xFF).toInt()
    argb(v, v, v)
  }

  private fun adaptiveThreshold(px: IntArray, w: Int, h: Int, windowFraction: Double = 1.0 / 8, bias: Double = 12.0): IntArray {
    val (lo, hi) = percentiles(px)
    val globalDark = lo + (hi - lo) * 0.35
    val gray = IntArray(w * h) { i -> val c = px[i]; luma((c shr 16) and 0xFF, (c shr 8) and 0xFF, c and 0xFF).toInt() }
    val stride = w + 1
    val integral = LongArray(stride * (h + 1))
    for (y in 1..h) {
      var rowSum = 0L
      for (x in 1..w) {
        rowSum += gray[(y - 1) * w + (x - 1)]
        integral[y * stride + x] = integral[(y - 1) * stride + x] + rowSum
      }
    }
    val r = max(4, (max(w, h) * windowFraction).roundToInt() shr 1)
    val out = IntArray(w * h)
    for (y in 0 until h) {
      val y0 = max(0, y - r)
      val y1 = min(h, y + r + 1)
      for (x in 0 until w) {
        val x0 = max(0, x - r)
        val x1 = min(w, x + r + 1)
        val area = (x1 - x0) * (y1 - y0)
        val sum = integral[y1 * stride + x1] - integral[y0 * stride + x1] - integral[y1 * stride + x0] + integral[y0 * stride + x0]
        val g = gray[y * w + x]
        out[y * w + x] = if (g < globalDark || g < sum.toDouble() / area - bias) 0xFF000000.toInt() else -1
      }
    }
    return out
  }

  /** "Document": divide out a smooth paper-colour estimate (see filters.ts clarity). */
  private fun clarity(px: IntArray, w: Int, h: Int): IntArray {
    val block = max(8, (max(w, h) / 28.0).roundToInt())
    val bw = ceil(w / block.toDouble()).toInt()
    val bh = ceil(h / block.toDouble()).toInt()
    val bg = DoubleArray(bw * bh * 3)
    for (by in 0 until bh) for (bx in 0 until bw) {
      var best = -1
      var br = 255; var bgc = 255; var bb = 255
      val yEnd = min(h, (by + 1) * block)
      val xEnd = min(w, (bx + 1) * block)
      var y = by * block
      while (y < yEnd) {
        var x = bx * block
        while (x < xEnd) {
          val c = px[y * w + x]
          val r = (c shr 16) and 0xFF; val g = (c shr 8) and 0xFF; val b = c and 0xFF
          val l = r * 3 + g * 6 + b
          if (l > best) { best = l; br = r; bgc = g; bb = b }
          x += 2
        }
        y += 2
      }
      val i = (by * bw + bx) * 3
      bg[i] = max(br, 24).toDouble(); bg[i + 1] = max(bgc, 24).toDouble(); bg[i + 2] = max(bb, 24).toDouble()
    }
    val smooth = DoubleArray(bg.size)
    for (by in 0 until bh) for (bx in 0 until bw) for (c in 0 until 3) {
      var sum = 0.0; var mx = 0.0; var n = 0
      for (dy in -1..1) for (dx in -1..1) {
        val x = bx + dx; val y = by + dy
        if (x < 0 || y < 0 || x >= bw || y >= bh) continue
        val v = bg[(y * bw + x) * 3 + c]
        sum += v; if (v > mx) mx = v; n++
      }
      smooth[(by * bw + bx) * 3 + c] = (sum / n) * 0.5 + mx * 0.5
    }
    // t^1.6 lookup (t in 0..1) — avoids millions of pow() calls.
    val lutSize = 4096
    val lut = IntArray(lutSize + 1) { k -> clamp(255 * (k / lutSize.toDouble()).pow(1.6) * 1.04) }
    val out = IntArray(w * h)
    val ch = IntArray(3)
    for (y in 0 until h) {
      val fy = min((bh - 1).toDouble(), max(0.0, (y + 0.5) / block - 0.5))
      val y0 = floor(fy).toInt(); val y1 = min(bh - 1, y0 + 1); val ty = fy - y0
      for (x in 0 until w) {
        val fx = min((bw - 1).toDouble(), max(0.0, (x + 0.5) / block - 0.5))
        val x0 = floor(fx).toInt(); val x1 = min(bw - 1, x0 + 1); val tx = fx - x0
        val p = px[y * w + x]
        for (c in 0 until 3) {
          // Channel value without per-pixel allocation: c=0 red, 1 green, 2 blue.
          val value = (p shr (16 - 8 * c)) and 0xFF
          val a00 = smooth[(y0 * bw + x0) * 3 + c]; val a10 = smooth[(y0 * bw + x1) * 3 + c]
          val a01 = smooth[(y1 * bw + x0) * 3 + c]; val a11 = smooth[(y1 * bw + x1) * 3 + c]
          val background = (a00 * (1 - tx) + a10 * tx) * (1 - ty) + (a01 * (1 - tx) + a11 * tx) * ty
          val t = min(1.0, value / background)
          ch[c] = lut[(t * lutSize).toInt()]
        }
        out[y * w + x] = argb(ch[0], ch[1], ch[2])
      }
    }
    return out
  }

  private fun whiteboard(px: IntArray, w: Int, h: Int): IntArray {
    val flat = clarity(px, w, h)
    return IntArray(flat.size) { i ->
      val c = flat[i]
      val r = (c shr 16) and 0xFF; val g = (c shr 8) and 0xFF; val b = c and 0xFF
      val v = luma(r, g, b)
      if (v > 205) -1 else argb(clamp((v + (r - v) * 1.8) * 0.9), clamp((v + (g - v) * 1.8) * 0.9), clamp((v + (b - v) * 1.8) * 0.9))
    }
  }

  private fun saturate(px: IntArray, k: Double): IntArray = IntArray(px.size) { i ->
    val c = px[i]
    val r = (c shr 16) and 0xFF; val g = (c shr 8) and 0xFF; val b = c and 0xFF
    val v = luma(r, g, b)
    argb(clamp(v + (r - v) * k), clamp(v + (g - v) * k), clamp(v + (b - v) * k))
  }

  /** Returns a new bitmap with `filter` applied (same ids as FilterId in filters.ts). */
  fun filter(src: Bitmap, filter: String): Bitmap {
    val w = src.width
    val h = src.height
    val px = IntArray(w * h)
    src.getPixels(px, 0, w, 0, 0, w, h)
    val out = when (filter) {
      "auto" -> stretch(px, 1.05)
      "grayscale" -> grayscale(px)
      "bw" -> adaptiveThreshold(px, w, h)
      "contrast" -> stretch(grayscale(px), 1.35)
      "clarity" -> clarity(px, w, h)
      "whiteboard" -> whiteboard(px, w, h)
      "photo" -> saturate(stretch(px, 1.0), 1.25)
      else -> px
    }
    val bitmap = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
    bitmap.setPixels(out, 0, w, 0, 0, w, h)
    return bitmap
  }
}
