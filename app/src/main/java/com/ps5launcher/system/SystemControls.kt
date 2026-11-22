package com.ps5launcher.system

import android.app.role.RoleManager
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.hardware.camera2.CameraCharacteristics
import android.hardware.camera2.CameraManager
import android.media.AudioManager
import android.net.Uri
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import androidx.compose.runtime.mutableStateOf
import kotlin.math.roundToInt

/** Verifica e pede para o PS5 Launcher ser a tela inicial padrão. */
object DefaultLauncher {

    fun isDefault(context: Context): Boolean {
        if (Build.VERSION.SDK_INT >= 29) {
            val rm = context.getSystemService(RoleManager::class.java)
            if (rm != null && rm.isRoleAvailable(RoleManager.ROLE_HOME)) {
                return rm.isRoleHeld(RoleManager.ROLE_HOME)
            }
        }
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_HOME)
        @Suppress("DEPRECATION")
        val info = context.packageManager.resolveActivity(intent, PackageManager.MATCH_DEFAULT_ONLY)
        return info?.activityInfo?.packageName == context.packageName
    }

    /** Abre a tela do Android "Apps padrão > Tela inicial". */
    fun openHomeSettings(context: Context) {
        val candidates = listOf(
            Intent(Settings.ACTION_HOME_SETTINGS),
            Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS),
            Intent(Settings.ACTION_SETTINGS),
        )
        for (intent in candidates) {
            try {
                context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
                return
            } catch (_: Exception) {
            }
        }
    }
}

/**
 * Atalhos para as telas e painéis oficiais do Android. O Android não deixa apps comuns
 * ligarem Wi-Fi, Bluetooth ou modo avião sozinhos, então abrimos o painel do sistema.
 */
object SystemPanels {

    private fun open(context: Context, intent: Intent): Boolean = try {
        context.startActivity(intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK))
        true
    } catch (e: Exception) {
        false
    }

    private fun open(context: Context, action: String): Boolean = open(context, Intent(action))

    fun wifi(context: Context): Boolean =
        if (Build.VERSION.SDK_INT >= 29) {
            open(context, Settings.Panel.ACTION_WIFI) || open(context, Settings.ACTION_WIFI_SETTINGS)
        } else {
            open(context, Settings.ACTION_WIFI_SETTINGS)
        }

    fun internet(context: Context): Boolean =
        if (Build.VERSION.SDK_INT >= 29) {
            open(context, Settings.Panel.ACTION_INTERNET_CONNECTIVITY) || open(context, Settings.ACTION_WIRELESS_SETTINGS)
        } else {
            open(context, Settings.ACTION_WIRELESS_SETTINGS)
        }

    fun bluetooth(context: Context) = open(context, Settings.ACTION_BLUETOOTH_SETTINGS)
    fun airplane(context: Context) = open(context, Settings.ACTION_AIRPLANE_MODE_SETTINGS)
    fun display(context: Context) = open(context, Settings.ACTION_DISPLAY_SETTINGS)
    fun sound(context: Context) = open(context, Settings.ACTION_SOUND_SETTINGS)
    fun androidSettings(context: Context) = open(context, Settings.ACTION_SETTINGS)
    fun battery(context: Context) =
        open(context, Intent.ACTION_POWER_USAGE_SUMMARY) || open(context, Settings.ACTION_SETTINGS)

    /** Tela onde você autoriza o launcher a mudar o brilho. */
    fun writeSettingsPermission(context: Context) = open(
        context,
        Intent(Settings.ACTION_MANAGE_WRITE_SETTINGS, Uri.parse("package:${context.packageName}"))
    )
}

/** Volume de mídia (música, vídeos e jogos). Não precisa de permissão. */
object Volume {
    private fun am(context: Context) = context.getSystemService(AudioManager::class.java)
    fun max(context: Context): Int = am(context).getStreamMaxVolume(AudioManager.STREAM_MUSIC)
    fun get(context: Context): Int = am(context).getStreamVolume(AudioManager.STREAM_MUSIC)
    fun set(context: Context, value: Int) {
        try {
            am(context).setStreamVolume(AudioManager.STREAM_MUSIC, value, 0)
        } catch (_: SecurityException) {
            // Alguns modos "Não perturbe" bloqueiam a mudança. Nesse caso, ignoramos.
        }
    }
}

/** Brilho da tela. Só funciona depois que você der a permissão "Modificar configurações do sistema". */
object Brightness {
    fun canWrite(context: Context): Boolean = Settings.System.canWrite(context)

    fun get(context: Context): Float = try {
        Settings.System.getInt(context.contentResolver, Settings.System.SCREEN_BRIGHTNESS, 128) / 255f
    } catch (e: Exception) {
        0.5f
    }

    fun set(context: Context, fraction: Float) {
        if (!canWrite(context)) return
        try {
            val cr = context.contentResolver
            Settings.System.putInt(
                cr,
                Settings.System.SCREEN_BRIGHTNESS_MODE,
                Settings.System.SCREEN_BRIGHTNESS_MODE_MANUAL
            )
            Settings.System.putInt(
                cr,
                Settings.System.SCREEN_BRIGHTNESS,
                (fraction * 255).roundToInt().coerceIn(1, 255)
            )
        } catch (_: Exception) {
        }
    }
}

/** Lanterna. O Android permite ligar/desligar sem pedir permissão de câmera. */
class TorchController(context: Context) {
    private val cm = context.getSystemService(CameraManager::class.java)

    val cameraId: String? = try {
        cm.cameraIdList.firstOrNull {
            cm.getCameraCharacteristics(it).get(CameraCharacteristics.FLASH_INFO_AVAILABLE) == true
        }
    } catch (e: Exception) {
        null
    }

    val isOn = mutableStateOf(false)
    val available: Boolean get() = cameraId != null

    private val callback = object : CameraManager.TorchCallback() {
        override fun onTorchModeChanged(id: String, enabled: Boolean) {
            if (id == cameraId) isOn.value = enabled
        }
    }

    init {
        try {
            cm.registerTorchCallback(callback, Handler(Looper.getMainLooper()))
        } catch (_: Exception) {
        }
    }

    fun toggle() {
        val id = cameraId ?: return
        try {
            cm.setTorchMode(id, !isOn.value)
        } catch (_: Exception) {
        }
    }
}
