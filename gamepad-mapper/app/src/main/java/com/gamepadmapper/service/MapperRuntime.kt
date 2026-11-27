package com.gamepadmapper.service

import android.content.ComponentName
import android.content.Context
import android.provider.Settings
import android.text.TextUtils
import java.util.concurrent.CopyOnWriteArraySet

/** Ponte entre as telas e o servico de acessibilidade (mesmo processo). */
object MapperRuntime {
    @Volatile var service: GamepadAccessibilityService? = null
        internal set

    private val listeners = CopyOnWriteArraySet<() -> Unit>()
    fun addListener(l: () -> Unit) { listeners += l }
    fun removeListener(l: () -> Unit) { listeners -= l }
    internal fun notifyChanged() = listeners.forEach { it() }

    val isServiceRunning: Boolean get() = service != null

    /** Verifica nas configuracoes do sistema se o usuario ativou o servico. */
    fun isServiceEnabledInSettings(context: Context): Boolean {
        val expected = ComponentName(context, GamepadAccessibilityService::class.java)
        val enabled = Settings.Secure.getString(
            context.contentResolver, Settings.Secure.ENABLED_ACCESSIBILITY_SERVICES
        ) ?: return false
        val splitter = TextUtils.SimpleStringSplitter(':')
        splitter.setString(enabled)
        for (s in splitter) {
            if (ComponentName.unflattenFromString(s) == expected) return true
        }
        return false
    }
}
