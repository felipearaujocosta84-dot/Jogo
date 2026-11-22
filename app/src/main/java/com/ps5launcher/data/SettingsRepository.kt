package com.ps5launcher.data

import android.content.Context
import android.content.SharedPreferences
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow

data class AppUsage(val count: Int, val lastLaunched: Long)

/** Tudo o que o launcher guarda: perfil, preferências, capas e histórico de uso. */
data class LauncherSettings(
    val firstRunDone: Boolean = false,
    val userName: String = "Jogador",
    val avatarPath: String? = null,
    val soundsEnabled: Boolean = true,
    val startupSound: Boolean = true,
    val animatedBackground: Boolean = true,
    val fullscreen: Boolean = true,
    val orientation: Int = SettingsRepository.ORIENTATION_LANDSCAPE,
    val bootScreen: Boolean = true,
    val accentIndex: Int = 0,
    val forcedGames: Set<String> = emptySet(),
    val forcedNotGames: Set<String> = emptySet(),
    val forcedMedia: Set<String> = emptySet(),
    val forcedNotMedia: Set<String> = emptySet(),
    val hidden: Set<String> = emptySet(),
    val covers: Map<String, String> = emptyMap(),
    val usage: Map<String, AppUsage> = emptyMap(),
)

/** Salva as configurações no próprio celular (SharedPreferences). Nada vai para a internet. */
class SettingsRepository(context: Context) {

    private val prefs = context.getSharedPreferences("settings", Context.MODE_PRIVATE)
    private val coverPrefs = context.getSharedPreferences("covers", Context.MODE_PRIVATE)
    private val usagePrefs = context.getSharedPreferences("usage", Context.MODE_PRIVATE)

    private val _state = MutableStateFlow(read())
    val state: StateFlow<LauncherSettings> = _state.asStateFlow()

    // Precisa ficar guardado em um campo, senão o Android descarta o "ouvinte".
    private val listener = SharedPreferences.OnSharedPreferenceChangeListener { _, _ ->
        _state.value = read()
    }

    init {
        prefs.registerOnSharedPreferenceChangeListener(listener)
        coverPrefs.registerOnSharedPreferenceChangeListener(listener)
        usagePrefs.registerOnSharedPreferenceChangeListener(listener)
    }

    private fun set(key: String): Set<String> = (prefs.getStringSet(key, null) ?: emptySet()).toSet()

    private fun read(): LauncherSettings = LauncherSettings(
        firstRunDone = prefs.getBoolean(K_FIRST_RUN, false),
        userName = prefs.getString(K_NAME, null)?.takeIf { it.isNotBlank() } ?: "Jogador",
        avatarPath = prefs.getString(K_AVATAR, null),
        soundsEnabled = prefs.getBoolean(K_SOUNDS, true),
        startupSound = prefs.getBoolean(K_STARTUP_SOUND, true),
        animatedBackground = prefs.getBoolean(K_ANIMATED_BG, true),
        fullscreen = prefs.getBoolean(K_FULLSCREEN, true),
        orientation = prefs.getInt(K_ORIENTATION, ORIENTATION_LANDSCAPE),
        bootScreen = prefs.getBoolean(K_BOOT_SCREEN, true),
        accentIndex = prefs.getInt(K_ACCENT, 0),
        forcedGames = set(K_FORCED_GAMES),
        forcedNotGames = set(K_FORCED_NOT_GAMES),
        forcedMedia = set(K_FORCED_MEDIA),
        forcedNotMedia = set(K_FORCED_NOT_MEDIA),
        hidden = set(K_HIDDEN),
        covers = coverPrefs.all.mapNotNull { (k, v) -> (v as? String)?.let { k to it } }.toMap(),
        usage = usagePrefs.all.mapNotNull { (k, v) -> parseUsage(v as? String)?.let { k to it } }.toMap(),
    )

    private fun parseUsage(raw: String?): AppUsage? {
        val parts = raw?.split(";") ?: return null
        if (parts.size != 2) return null
        val count = parts[0].toIntOrNull() ?: return null
        val time = parts[1].toLongOrNull() ?: return null
        return AppUsage(count, time)
    }

    fun setFirstRunDone() = prefs.edit().putBoolean(K_FIRST_RUN, true).apply()
    fun setUserName(name: String) = prefs.edit().putString(K_NAME, name.trim()).apply()
    fun setAvatar(path: String?) = prefs.edit().putString(K_AVATAR, path).apply()
    fun setBoolean(key: String, value: Boolean) = prefs.edit().putBoolean(key, value).apply()
    fun setOrientation(value: Int) = prefs.edit().putInt(K_ORIENTATION, value).apply()
    fun setAccent(index: Int) = prefs.edit().putInt(K_ACCENT, index).apply()

    /** Adiciona ou remove um item de uma lista salva (ex.: jogos marcados manualmente). */
    fun setMembership(setKey: String, item: String, member: Boolean) {
        val current = set(setKey).toMutableSet()
        if (member) current.add(item) else current.remove(item)
        prefs.edit().putStringSet(setKey, current).apply()
    }

    fun setCover(appKey: String, path: String?) {
        if (path == null) coverPrefs.edit().remove(appKey).apply()
        else coverPrefs.edit().putString(appKey, path).apply()
    }

    fun recordLaunch(appKey: String) {
        val old = parseUsage(usagePrefs.getString(appKey, null))
        val count = (old?.count ?: 0) + 1
        usagePrefs.edit().putString(appKey, "$count;${System.currentTimeMillis()}").apply()
    }

    companion object {
        const val ORIENTATION_AUTO = 0
        const val ORIENTATION_LANDSCAPE = 1
        const val ORIENTATION_PORTRAIT = 2

        const val K_FIRST_RUN = "first_run_done"
        const val K_NAME = "user_name"
        const val K_AVATAR = "avatar_path"
        const val K_SOUNDS = "sounds_enabled"
        const val K_STARTUP_SOUND = "startup_sound"
        const val K_ANIMATED_BG = "animated_background"
        const val K_FULLSCREEN = "fullscreen"
        const val K_ORIENTATION = "orientation"
        const val K_BOOT_SCREEN = "boot_screen"
        const val K_ACCENT = "accent_index"
        const val K_FORCED_GAMES = "forced_games"
        const val K_FORCED_NOT_GAMES = "forced_not_games"
        const val K_FORCED_MEDIA = "forced_media"
        const val K_FORCED_NOT_MEDIA = "forced_not_media"
        const val K_HIDDEN = "hidden_apps"
    }
}
