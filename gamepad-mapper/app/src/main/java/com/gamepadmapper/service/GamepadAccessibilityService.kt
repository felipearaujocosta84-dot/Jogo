package com.gamepadmapper.service

import android.accessibilityservice.AccessibilityService
import android.content.res.Configuration
import android.graphics.Point
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.os.SystemClock
import android.view.KeyEvent
import android.view.MotionEvent
import android.view.WindowManager
import android.view.accessibility.AccessibilityEvent
import com.gamepadmapper.input.ControllerState
import com.gamepadmapper.input.GamepadEventParser
import com.gamepadmapper.input.PhysicalInput
import com.gamepadmapper.profile.Profile
import com.gamepadmapper.profile.ProfileRepository
import com.gamepadmapper.settings.AppSettings
import com.gamepadmapper.touch.GestureEngine
import com.gamepadmapper.touch.TouchPlanner

/**
 * Nucleo do mapeamento em segundo plano.
 *
 * - Botoes: recebidos pelo filtro de teclas da acessibilidade (onKeyEvent), funciona com o jogo em foco.
 * - Analogicos: MotionEvent NAO passa pelo filtro de acessibilidade. Sao recebidos por uma pequena
 *   janela de sobreposicao focavel ([InputCaptureOverlay]); ver limitacoes no README.
 * - Toques: [GestureEngine] usa dispatchGesture (requer canPerformGestures).
 */
class GamepadAccessibilityService : AccessibilityService() {

    private val handler = Handler(Looper.getMainLooper())
    private lateinit var settings: AppSettings
    private lateinit var repo: ProfileRepository
    private lateinit var engine: GestureEngine
    private val planner = TouchPlanner()
    private val state = ControllerState()
    private var overlay: InputCaptureOverlay? = null

    private var profile: Profile? = null
    private var usedInputs: Set<PhysicalInput> = emptySet()
    private var screenW = 0
    private var screenH = 0
    private var lastPlanAt = 0L
    private var tickScheduled = false

    /** Pacote em primeiro plano (via TYPE_WINDOW_STATE_CHANGED). */
    @Volatile var foregroundPackage: String? = null
        private set
    @Volatile var paused = false
        private set

    val activeProfile: Profile? get() = profile
    val engineError: String? get() = if (::engine.isInitialized) engine.lastError else null
    val gesturesDispatched: Long get() = if (::engine.isInitialized) engine.gesturesDispatched else 0
    val isCapturingAnalogs: Boolean get() = overlay?.isFocusableMode == true

    private val profileListener: () -> Unit = { handler.post { reloadProfile() } }
    private val settingsListener: () -> Unit = { handler.post { applySettings() } }

    override fun onServiceConnected() {
        super.onServiceConnected()
        settings = AppSettings.get(this)
        repo = ProfileRepository.get(this)
        engine = GestureEngine(this)
        engine.onCancelled = { refresh() }
        updateScreenSize()
        repo.addListener(profileListener)
        settings.addListener(settingsListener)
        reloadProfile()
        applySettings()
        MapperRuntime.service = this
        MapperRuntime.notifyChanged()
    }

    override fun onDestroy() {
        teardown()
        super.onDestroy()
    }

    override fun onUnbind(intent: android.content.Intent?): Boolean {
        teardown()
        return super.onUnbind(intent)
    }

    private fun teardown() {
        if (MapperRuntime.service === this) MapperRuntime.service = null
        if (::repo.isInitialized) repo.removeListener(profileListener)
        if (::settings.isInitialized) settings.removeListener(settingsListener)
        if (::engine.isInitialized) engine.releaseAll()
        overlay?.remove(); overlay = null
        handler.removeCallbacksAndMessages(null)
        MapperRuntime.notifyChanged()
    }

    override fun onInterrupt() {
        if (::engine.isInitialized) engine.releaseAll()
    }

    override fun onConfigurationChanged(newConfig: Configuration) {
        super.onConfigurationChanged(newConfig)
        updateScreenSize()
        planner.reset()
        refresh()
    }

    @Suppress("DEPRECATION")
    private fun updateScreenSize() {
        val wm = getSystemService(WINDOW_SERVICE) as WindowManager
        if (Build.VERSION.SDK_INT >= 30) {
            val b = wm.currentWindowMetrics.bounds
            screenW = b.width(); screenH = b.height()
        } else {
            val p = Point(); wm.defaultDisplay.getRealSize(p)
            screenW = p.x; screenH = p.y
        }
    }

    // ---------------------------------------------------------------- perfis / configuracoes

    private fun reloadProfile() {
        profile = repo.activeProfile
        usedInputs = profile?.usedInputs() ?: emptySet()
        planner.reset()
        updateOverlay()
        refresh()
        MapperRuntime.notifyChanged()
    }

    private fun applySettings() {
        paused = !settings.mappingEnabled
        engine.compatButtonTaps = settings.compatTaps
        updateOverlay()
        refresh()
        MapperRuntime.notifyChanged()
    }

    /**
     * Ativo = perfil carregado, nao pausado, fora do proprio app e — se o perfil estiver vinculado
     * a um jogo — somente com esse jogo em primeiro plano (evita toques no launcher/outros apps).
     */
    private fun isMappingActive(): Boolean {
        val p = profile ?: return false
        if (paused || foregroundPackage == packageName) return false
        return p.packageName == null || p.packageName == foregroundPackage
    }

    private fun updateOverlay() {
        val wantFocus = settings.captureAnalogs && isMappingActive()
        val wantVisible = settings.showIndicator || wantFocus
        if (!wantVisible) { overlay?.remove(); overlay = null; return }
        val ov = overlay ?: InputCaptureOverlay(this) { e -> onCapturedMotion(e) }.also { overlay = it }
        ov.show(focusable = wantFocus, text = indicatorText(), visibleIndicator = settings.showIndicator)
    }

    private fun indicatorText(): String = when {
        profile == null -> "GM · sem perfil"
        paused -> "GM ❚❚ pausado"
        !isMappingActive() -> "GM · ${profile!!.name} (aguardando o jogo)"
        else -> "GM ● ${profile!!.name}"
    }

    // ---------------------------------------------------------------- eventos

    override fun onAccessibilityEvent(event: AccessibilityEvent?) {
        if (event?.eventType != AccessibilityEvent.TYPE_WINDOW_STATE_CHANGED) return
        val pkg = event.packageName?.toString() ?: return
        if (pkg in IGNORED_PACKAGES) return
        // So uma Activity muda o app em primeiro plano. Paineis flutuantes (Game Booster da Samsung,
        // pop-up do Play Games, teclado, nossa propria sobreposicao) NAO podem desligar o mapeamento.
        val cls = event.className?.toString() ?: return
        if (!isActivity(pkg, cls)) return
        if (pkg == foregroundPackage) return
        foregroundPackage = pkg
        if (settings.autoSwitchProfile && pkg != packageName) {
            val match = repo.findByPackage(pkg)
            if (match != null && match.id != profile?.id) {
                repo.activeProfileId = match.id // dispara reloadProfile via listener
            }
        }
        state.reset()
        planner.reset()
        engine.releaseAll()
        updateOverlay()
        MapperRuntime.notifyChanged()
    }

    private val activityCache = HashMap<String, Boolean>()

    private fun isActivity(pkg: String, cls: String): Boolean = activityCache.getOrPut("$pkg/$cls") {
        try {
            packageManager.getActivityInfo(android.content.ComponentName(pkg, cls), 0)
            true
        } catch (e: Exception) {
            false
        }
    }

    /** Diagnostico exibido em Configuracoes. */
    @Volatile var keysReceived = 0L
        private set
    @Volatile var lastKey: String? = null
        private set
    val mappingActiveNow: Boolean get() = isMappingActive()

    override fun onKeyEvent(event: KeyEvent): Boolean {
        if (!GamepadEventParser.isGamepadKey(event)) return false
        if (event.action == KeyEvent.ACTION_DOWN && event.repeatCount == 0) {
            keysReceived++
            lastKey = GamepadEventParser.keyName(event.keyCode)
            MapperRuntime.notifyChanged()
        }
        val input = GamepadEventParser.keyToInput(event.keyCode) ?: return false
        if (event.repeatCount > 0) return isMappingActive() && input in usedInputs

        // Atalho global: SELECT + START pausa/retoma o mapeamento.
        if (event.action == KeyEvent.ACTION_DOWN &&
            ((input == PhysicalInput.START && state.isPressed(PhysicalInput.SELECT)) ||
                (input == PhysicalInput.SELECT && state.isPressed(PhysicalInput.START)))
        ) {
            if (foregroundPackage != packageName) {
                settings.mappingEnabled = !settings.mappingEnabled
                state.reset(); planner.reset(); engine.releaseAll()
                return true
            }
        }

        GamepadEventParser.handleKey(event, state)
        if (!isMappingActive()) return false
        val consume = input in usedInputs || !settings.passUnmappedButtons
        refresh()
        return consume
    }

    private fun onCapturedMotion(event: MotionEvent): Boolean {
        if (!GamepadEventParser.handleMotion(event, state)) return false
        if (isMappingActive()) refresh()
        return true
    }

    /**
     * Teste de diagnostico: toca em (x, y) da tela usando o mesmo mecanismo do mapeamento.
     * [hold] = usa toque mantido (continueStroke), como os botoes no modo "segurar".
     */
    fun testTouch(x: Float, y: Float, hold: Boolean, onResult: (Boolean) -> Unit) {
        engine.test(x, y, hold, onResult)
    }

    // ---------------------------------------------------------------- planejamento

    private fun refresh() {
        if (!::engine.isInitialized) return
        val p = profile
        if (p == null || !isMappingActive()) { engine.releaseAll(); return }
        val now = SystemClock.uptimeMillis()
        val dt = if (lastPlanAt == 0L) 16L else now - lastPlanAt
        lastPlanAt = now
        engine.submit(planner.plan(p, state, screenW, screenH, now, dt))
        if (planner.needsTicks() && !tickScheduled) {
            tickScheduled = true
            handler.postDelayed(tick, TICK_MS)
        }
    }

    private val tick = Runnable {
        tickScheduled = false
        refresh()
    }

    companion object {
        private const val TICK_MS = 16L
        private val IGNORED_PACKAGES = setOf(
            "com.android.systemui", "android",
        )
    }
}
