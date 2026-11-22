package com.ps5launcher.data

import android.content.ComponentName
import android.content.Context
import android.content.Intent
import android.content.pm.ApplicationInfo
import android.content.pm.LauncherActivityInfo
import android.content.pm.LauncherApps
import android.graphics.Bitmap
import android.graphics.Color
import android.graphics.Rect
import android.os.Handler
import android.os.Looper
import android.os.Process
import android.os.UserHandle
import android.util.LruCache
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.core.graphics.drawable.toBitmap
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import java.util.concurrent.ConcurrentHashMap

/** Um app que pode ser aberto pelo launcher. */
data class InstalledApp(
    val key: String,
    val component: ComponentName,
    val label: String,
    val user: UserHandle,
    val detectedGame: Boolean,
    val detectedMedia: Boolean,
) {
    val packageName: String get() = component.packageName
}

/**
 * Lê os apps instalados usando a API oficial de launchers do Android (LauncherApps).
 * Atualiza a lista sozinho quando você instala, atualiza ou remove um app.
 * Nunca altera nenhum app: só lê nome, ícone e categoria.
 */
class AppRepository(private val context: Context) {

    private val launcherApps = context.getSystemService(LauncherApps::class.java)
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Default)
    private val loadMutex = Mutex()
    private val density = context.resources.displayMetrics.density

    private val _apps = MutableStateFlow<List<InstalledApp>>(emptyList())
    val apps: StateFlow<List<InstalledApp>> = _apps.asStateFlow()

    private val _loaded = MutableStateFlow(false)
    val loaded: StateFlow<Boolean> = _loaded.asStateFlow()

    // Cache de ícones limitado por memória (~18 MB) para não pesar em celulares simples.
    private val iconCache = object : LruCache<String, ImageBitmap>(18 * 1024 * 1024) {
        override fun sizeOf(key: String, value: ImageBitmap): Int = value.width * value.height * 4
    }
    private val colorCache = ConcurrentHashMap<String, Int>()
    private val infoCache = ConcurrentHashMap<String, LauncherActivityInfo>()

    private val callback = object : LauncherApps.Callback() {
        override fun onPackageRemoved(packageName: String, user: UserHandle) = invalidatePackage(packageName)
        override fun onPackageAdded(packageName: String, user: UserHandle) = invalidatePackage(packageName)
        override fun onPackageChanged(packageName: String, user: UserHandle) = invalidatePackage(packageName)
        override fun onPackagesAvailable(packageNames: Array<out String>, user: UserHandle, replacing: Boolean) = refresh()
        override fun onPackagesUnavailable(packageNames: Array<out String>, user: UserHandle, replacing: Boolean) = refresh()
    }

    init {
        launcherApps.registerCallback(callback, Handler(Looper.getMainLooper()))
        refresh()
    }

    private fun invalidatePackage(packageName: String) {
        val prefix = "$packageName/"
        iconCache.snapshot().keys.filter { it.startsWith(prefix) }.forEach { iconCache.remove(it) }
        colorCache.keys.removeAll { it.startsWith(prefix) }
        refresh()
    }

    fun refresh() {
        scope.launch { loadMutex.withLock { load() } }
    }

    private fun load() {
        val user = Process.myUserHandle()
        val infos: List<LauncherActivityInfo> = try {
            launcherApps.getActivityList(null, user)
        } catch (e: Exception) {
            emptyList()
        }
        infoCache.clear()
        val list = infos.asSequence()
            .filter { it.componentName.packageName != context.packageName }
            .map { info ->
                val cn = info.componentName
                val key = cn.flattenToShortString()
                infoCache[key] = info
                val ai = info.applicationInfo
                @Suppress("DEPRECATION")
                val gameFlag = (ai.flags and ApplicationInfo.FLAG_IS_GAME) != 0
                InstalledApp(
                    key = key,
                    component = cn,
                    label = info.label?.toString()?.trim().orEmpty().ifEmpty { cn.packageName },
                    user = user,
                    detectedGame = ai.category == ApplicationInfo.CATEGORY_GAME || gameFlag,
                    detectedMedia = ai.category in MEDIA_CATEGORIES || cn.packageName in KNOWN_MEDIA,
                )
            }
            .distinctBy { it.key }
            .sortedBy { it.label.lowercase() }
            .toList()
        _apps.value = list
        _loaded.value = true
    }

    fun cachedIcon(key: String, sizeDp: Int): ImageBitmap? = iconCache.get("$key@$sizeDp")

    /** Carrega o ícone do app no tamanho pedido (em dp), fora da tela principal para não travar. */
    suspend fun icon(app: InstalledApp, sizeDp: Int): ImageBitmap? = withContext(Dispatchers.IO) {
        val cacheKey = "${app.key}@$sizeDp"
        iconCache.get(cacheKey)?.let { return@withContext it }
        val info = infoCache[app.key] ?: return@withContext null
        val px = (sizeDp * density).toInt().coerceAtLeast(48)
        val bitmap = try {
            info.getIcon(0).toBitmap(px, px, Bitmap.Config.ARGB_8888)
        } catch (e: Exception) {
            null
        } ?: return@withContext null
        if (!colorCache.containsKey(app.key)) colorCache[app.key] = tintFrom(bitmap)
        bitmap.asImageBitmap().also { iconCache.put(cacheKey, it) }
    }

    fun cachedColor(key: String): Int? = colorCache[key]?.takeIf { it != NO_TINT }

    /** Cor predominante do ícone, usada para tingir o fundo quando o app é selecionado. */
    suspend fun color(app: InstalledApp): Int? {
        colorCache[app.key]?.let { return it.takeIf { c -> c != NO_TINT } }
        icon(app, TILE_ICON_DP)
        return cachedColor(app.key)
    }

    private fun tintFrom(bitmap: Bitmap): Int {
        val small = Bitmap.createScaledBitmap(bitmap, 8, 8, true)
        var r = 0.0
        var g = 0.0
        var b = 0.0
        var total = 0.0
        val hsv = FloatArray(3)
        for (x in 0 until 8) for (y in 0 until 8) {
            val c = small.getPixel(x, y)
            if (Color.alpha(c) < 128) continue
            Color.colorToHSV(c, hsv)
            val weight = 1.0 + 4.0 * hsv[1] * hsv[2]
            r += Color.red(c) * weight
            g += Color.green(c) * weight
            b += Color.blue(c) * weight
            total += weight
        }
        if (small !== bitmap) small.recycle()
        if (total == 0.0) return NO_TINT
        val avg = Color.rgb((r / total).toInt(), (g / total).toInt(), (b / total).toInt())
        Color.colorToHSV(avg, hsv)
        if (hsv[1] < 0.15f) return NO_TINT
        hsv[1] = hsv[1].coerceAtLeast(0.55f)
        hsv[2] = 0.8f
        return Color.HSVToColor(hsv)
    }

    /** Abre o app. Retorna false se o Android não permitir. */
    fun launch(app: InstalledApp, bounds: Rect? = null): Boolean {
        return try {
            launcherApps.startMainActivity(app.component, app.user, bounds, null)
            true
        } catch (e: Exception) {
            try {
                val intent = context.packageManager.getLaunchIntentForPackage(app.packageName)
                if (intent != null) {
                    context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                    true
                } else {
                    false
                }
            } catch (e2: Exception) {
                false
            }
        }
    }

    /** Abre a tela oficial "Informações do app" do Android. */
    fun openAppInfo(app: InstalledApp): Boolean {
        return try {
            launcherApps.startAppDetailsActivity(app.component, app.user, null, null)
            true
        } catch (e: Exception) {
            false
        }
    }

    companion object {
        const val TILE_ICON_DP = 72
        const val HERO_ICON_DP = 160
        private const val NO_TINT = 0

        private val MEDIA_CATEGORIES = setOf(
            ApplicationInfo.CATEGORY_VIDEO,
            ApplicationInfo.CATEGORY_AUDIO,
            ApplicationInfo.CATEGORY_IMAGE,
        )

        // Apps de vídeo/música populares que às vezes não declaram categoria.
        private val KNOWN_MEDIA = setOf(
            "com.google.android.youtube",
            "com.google.android.apps.youtube.music",
            "com.netflix.mediaclient",
            "com.spotify.music",
            "com.amazon.avod.thirdpartyclient",
            "com.disney.disneyplus",
            "com.wbd.stream",
            "com.hbo.hbonow",
            "com.globo.globotv",
            "tv.twitch.android.app",
            "deezer.android.app",
            "com.crunchyroll.crunchyroid",
            "com.apple.android.music",
            "com.kick.mobile",
        )
    }
}
