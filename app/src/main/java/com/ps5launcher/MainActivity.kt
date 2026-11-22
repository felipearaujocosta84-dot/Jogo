package com.ps5launcher

import android.app.role.RoleManager
import android.content.Intent
import android.content.pm.ActivityInfo
import android.os.Build
import android.os.Bundle
import android.view.KeyEvent
import androidx.activity.ComponentActivity
import androidx.activity.SystemBarStyle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.ps5launcher.data.SettingsRepository
import com.ps5launcher.system.DefaultLauncher
import com.ps5launcher.ui.LauncherRoot
import com.ps5launcher.ui.LauncherViewModel
import com.ps5launcher.ui.Screen
import com.ps5launcher.ui.theme.PS5Theme

/**
 * A única tela (Activity) do launcher. O Android a abre quando você aperta "Início".
 * Também traduz os botões do controle Bluetooth para ações do launcher.
 */
class MainActivity : ComponentActivity() {

    private val vm: LauncherViewModel by viewModels()

    // Resultado do pedido "usar como tela inicial" (Android 10 ou superior).
    private val roleRequest = registerForActivityResult(ActivityResultContracts.StartActivityForResult()) {
        vm.refreshDefaultStatus()
        if (!vm.isDefaultLauncher) DefaultLauncher.openHomeSettings(this)
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge(
            statusBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
            navigationBarStyle = SystemBarStyle.dark(android.graphics.Color.TRANSPARENT),
        )

        // Pede a horizontal antes mesmo de desenhar a primeira tela.
        applyOrientation(vm.settings.value.orientation)

        setContent {
            val settings by vm.settings.collectAsStateWithLifecycle()

            LaunchedEffect(settings.orientation, vm.resumeTick) {
                applyOrientation(settings.orientation)
            }
            LaunchedEffect(settings.fullscreen, vm.resumeTick) {
                applyFullscreen(settings.fullscreen)
            }

            PS5Theme(accentIndex = settings.accentIndex) {
                LauncherRoot(vm = vm, onRequestDefault = ::requestDefaultLauncher)
            }
        }
    }

    /** Horizontal sempre, a não ser que o usuário escolha "Vertical" nas configurações. */
    private fun applyOrientation(orientation: Int) {
        val wanted = if (orientation == SettingsRepository.ORIENTATION_PORTRAIT) {
            ActivityInfo.SCREEN_ORIENTATION_PORTRAIT
        } else {
            ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        }
        if (requestedOrientation != wanted) requestedOrientation = wanted
    }

    private fun applyFullscreen(enabled: Boolean) {
        val controller = WindowCompat.getInsetsController(window, window.decorView)
        controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        // Modo console: esconde as barras do Android. Deslize da borda para mostrá-las.
        if (enabled) controller.hide(WindowInsetsCompat.Type.systemBars())
        else controller.show(WindowInsetsCompat.Type.systemBars())
    }

    /** Pede ao Android para usar o PS5 Launcher como tela inicial padrão. */
    private fun requestDefaultLauncher() {
        if (Build.VERSION.SDK_INT >= 29) {
            val rm = getSystemService(RoleManager::class.java)
            if (rm != null && rm.isRoleAvailable(RoleManager.ROLE_HOME) && !rm.isRoleHeld(RoleManager.ROLE_HOME)) {
                try {
                    roleRequest.launch(rm.createRequestRoleIntent(RoleManager.ROLE_HOME))
                    return
                } catch (_: Exception) {
                }
            }
        }
        DefaultLauncher.openHomeSettings(this)
    }

    override fun onResume() {
        super.onResume()
        vm.onResume()
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        // Apertou "Início" estando no launcher: volta para o começo da tela inicial.
        if (intent.action == Intent.ACTION_MAIN && intent.hasCategory(Intent.CATEGORY_HOME)) {
            vm.onHomePressed()
        }
    }

    /**
     * Mapeamento do controle Bluetooth (padrão Android, funciona com controles de PS4/PS5/Xbox):
     * A/Cruz = confirmar, B/Círculo = voltar, X/Quadrado = opções, Y/Triângulo = biblioteca,
     * L1/R1 = trocar aba, Start/Options ou botão central = central de controle, Select = configurações.
     * O direcional e o analógico esquerdo movem a seleção.
     */
    override fun dispatchKeyEvent(event: KeyEvent): Boolean {
        // Se a tela está girada manualmente, o direcional precisa girar junto.
        if (vm.rotatedUi) {
            val rotated = when (event.keyCode) {
                KeyEvent.KEYCODE_DPAD_RIGHT -> KeyEvent.KEYCODE_DPAD_DOWN
                KeyEvent.KEYCODE_DPAD_LEFT -> KeyEvent.KEYCODE_DPAD_UP
                KeyEvent.KEYCODE_DPAD_UP -> KeyEvent.KEYCODE_DPAD_RIGHT
                KeyEvent.KEYCODE_DPAD_DOWN -> KeyEvent.KEYCODE_DPAD_LEFT
                else -> null
            }
            if (rotated != null) return super.dispatchKeyEvent(remap(event, rotated))
        }
        val up = event.action == KeyEvent.ACTION_UP
        when (event.keyCode) {
            KeyEvent.KEYCODE_BUTTON_A ->
                return super.dispatchKeyEvent(remap(event, KeyEvent.KEYCODE_DPAD_CENTER))
            KeyEvent.KEYCODE_BUTTON_B -> {
                if (up) onBackPressedDispatcher.onBackPressed()
                return true
            }
            KeyEvent.KEYCODE_BUTTON_X -> {
                if (up) vm.openOptionsForFocused()
                return true
            }
            KeyEvent.KEYCODE_BUTTON_Y -> {
                if (up && vm.settings.value.firstRunDone) vm.navigate(Screen.LIBRARY)
                return true
            }
            KeyEvent.KEYCODE_BUTTON_L1 -> {
                if (up) vm.switchTab(-1)
                return true
            }
            KeyEvent.KEYCODE_BUTTON_R1 -> {
                if (up) vm.switchTab(1)
                return true
            }
            KeyEvent.KEYCODE_BUTTON_START, KeyEvent.KEYCODE_BUTTON_MODE -> {
                if (up) vm.toggleControlCenter()
                return true
            }
            KeyEvent.KEYCODE_BUTTON_SELECT -> {
                if (up && vm.settings.value.firstRunDone) vm.navigate(Screen.SETTINGS)
                return true
            }
        }
        return super.dispatchKeyEvent(event)
    }

    private fun remap(e: KeyEvent, newCode: Int) = KeyEvent(
        e.downTime, e.eventTime, e.action, newCode, e.repeatCount,
        e.metaState, e.deviceId, e.scanCode, e.flags, e.source,
    )
}
