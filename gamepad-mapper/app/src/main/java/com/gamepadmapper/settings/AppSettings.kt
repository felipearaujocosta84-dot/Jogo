package com.gamepadmapper.settings

import android.content.Context
import android.content.SharedPreferences
import java.util.concurrent.CopyOnWriteArraySet

/** Preferencias globais do app (SharedPreferences). */
class AppSettings private constructor(context: Context) {
    private val prefs: SharedPreferences =
        context.applicationContext.getSharedPreferences("settings", Context.MODE_PRIVATE)
    private val listeners = CopyOnWriteArraySet<() -> Unit>()

    fun addListener(l: () -> Unit) { listeners += l }
    fun removeListener(l: () -> Unit) { listeners -= l }

    private fun bool(key: String, def: Boolean) = prefs.getBoolean(key, def)
    private fun setBool(key: String, v: Boolean) { prefs.edit().putBoolean(key, v).apply(); listeners.forEach { it() } }
    private fun float(key: String, def: Float) = prefs.getFloat(key, def)
    private fun setFloat(key: String, v: Float) { prefs.edit().putFloat(key, v).apply(); listeners.forEach { it() } }

    /** Interruptor geral do mapeamento (tambem alternado por SELECT + START no controle). */
    var mappingEnabled: Boolean
        get() = bool("mapping_enabled", true)
        set(v) = setBool("mapping_enabled", v)

    /**
     * Alternativa para Android < 14: janela focavel para receber os analogicos.
     * Desligada por padrao: tira o foco do jogo e alguns jogos ficam com tela preta.
     * (Chave nova para que a opcao antiga, ligada por padrao na 1.0/1.1, nao continue ativa.)
     */
    var captureAnalogs: Boolean
        get() = bool("capture_focus_window", false)
        set(v) = setBool("capture_focus_window", v)

    var showIndicator: Boolean
        get() = bool("show_indicator", true)
        set(v) = setBool("show_indicator", v)

    var autoSwitchProfile: Boolean
        get() = bool("auto_switch", true)
        set(v) = setBool("auto_switch", v)

    /** Se true, botoes que o perfil nao usa continuam chegando ao jogo/sistema. */
    var passUnmappedButtons: Boolean
        get() = bool("pass_unmapped", true)
        set(v) = setBool("pass_unmapped", v)

    /**
     * Compatibilidade: botoes viram toques curtos independentes (sem toque mantido/continueStroke).
     * Para jogos ou aparelhos que ignoram toques mantidos injetados. "Segurar" deixa de segurar.
     */
    var compatTaps: Boolean
        get() = bool("compat_taps", false)
        set(v) = setBool("compat_taps", v)

    var defaultDeadzone: Float
        get() = float("default_deadzone", 0.15f)
        set(v) = setFloat("default_deadzone", v)

    var defaultSensitivity: Float
        get() = float("default_sensitivity", 1f)
        set(v) = setFloat("default_sensitivity", v)

    companion object {
        @Volatile private var instance: AppSettings? = null
        fun get(context: Context): AppSettings =
            instance ?: synchronized(this) { instance ?: AppSettings(context).also { instance = it } }
    }
}
