package com.ps5launcher.data

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.ImageDecoder
import android.net.Uri
import android.os.Build
import android.util.LruCache
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.File
import java.io.FileOutputStream

/**
 * Guarda cópias reduzidas das imagens que você escolhe (avatar e capas de jogos)
 * dentro da pasta privada do launcher. Assim não é preciso permissão de armazenamento
 * e a imagem continua funcionando mesmo se a original for apagada da galeria.
 */
class ImageStore(private val context: Context) {

    private val dir = File(context.filesDir, "images").apply { mkdirs() }

    private val cache = object : LruCache<String, ImageBitmap>(16 * 1024 * 1024) {
        override fun sizeOf(key: String, value: ImageBitmap): Int = value.width * value.height * 4
    }

    suspend fun import(uri: Uri, prefix: String, maxSize: Int): String? = withContext(Dispatchers.IO) {
        try {
            val bitmap = decode(uri, maxSize) ?: return@withContext null
            val safe = prefix.replace(Regex("[^A-Za-z0-9]"), "_").take(60)
            val file = File(dir, "${safe}_${System.currentTimeMillis()}.jpg")
            FileOutputStream(file).use { bitmap.compress(Bitmap.CompressFormat.JPEG, 90, it) }
            bitmap.recycle()
            file.absolutePath
        } catch (e: Exception) {
            null
        }
    }

    private fun decode(uri: Uri, maxSize: Int): Bitmap? {
        val resolver = context.contentResolver
        return if (Build.VERSION.SDK_INT >= 28) {
            // ImageDecoder já corrige a rotação das fotos tiradas com a câmera.
            val source = ImageDecoder.createSource(resolver, uri)
            ImageDecoder.decodeBitmap(source) { decoder, info, _ ->
                val w = info.size.width
                val h = info.size.height
                var sample = 1
                while (w / (sample * 2) >= maxSize && h / (sample * 2) >= maxSize) sample *= 2
                decoder.setTargetSampleSize(sample)
                decoder.allocator = ImageDecoder.ALLOCATOR_SOFTWARE
            }
        } else {
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            resolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
            val sample = sampleSize(bounds.outWidth, bounds.outHeight, maxSize)
            resolver.openInputStream(uri)?.use {
                BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample })
            }
        }
    }

    private fun sampleSize(w: Int, h: Int, maxSize: Int): Int {
        var sample = 1
        while (w / (sample * 2) >= maxSize && h / (sample * 2) >= maxSize) sample *= 2
        return sample
    }

    fun cached(path: String, maxSize: Int): ImageBitmap? = cache.get("$path@$maxSize")

    suspend fun load(path: String, maxSize: Int): ImageBitmap? = withContext(Dispatchers.IO) {
        val key = "$path@$maxSize"
        cache.get(key)?.let { return@withContext it }
        try {
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            BitmapFactory.decodeFile(path, bounds)
            val opts = BitmapFactory.Options().apply {
                inSampleSize = sampleSize(bounds.outWidth, bounds.outHeight, maxSize)
            }
            BitmapFactory.decodeFile(path, opts)?.asImageBitmap()?.also { cache.put(key, it) }
        } catch (e: Exception) {
            null
        }
    }

    /** Apaga apenas imagens que o próprio launcher criou. */
    fun delete(path: String?) {
        if (path == null) return
        cache.snapshot().keys.filter { it.startsWith("$path@") }.forEach { cache.remove(it) }
        runCatching {
            val file = File(path)
            if (file.parentFile?.absolutePath == dir.absolutePath) file.delete()
        }
    }
}
