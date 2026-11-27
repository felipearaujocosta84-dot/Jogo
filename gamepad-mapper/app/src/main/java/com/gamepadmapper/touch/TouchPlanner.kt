package com.gamepadmapper.touch

import com.gamepadmapper.input.ControllerState
import com.gamepadmapper.profile.ButtonMode
import com.gamepadmapper.profile.ElementType
import com.gamepadmapper.profile.MappingElement
import com.gamepadmapper.profile.Profile
import com.gamepadmapper.profile.StickMode
import kotlin.math.hypot
import kotlin.math.min

/**
 * Ponto de toque desejado. [downX]/[downY] e onde o dedo virtual encosta ao iniciar;
 * [x]/[y] e a posicao atual. Mudanca de [generation] obriga a levantar e tocar de novo.
 */
data class TouchPoint(
    val x: Float,
    val y: Float,
    val downX: Float = x,
    val downY: Float = y,
    val generation: Int = 0,
    /** true para botoes virtuais (pontos fixos); false para analogicos. */
    val isButton: Boolean = false,
)

/**
 * Converte o estado do controle + perfil em um conjunto de toques desejados (id do elemento -> ponto).
 * Logica pura (sem Android) — o [com.gamepadmapper.touch.GestureEngine] transforma isso em gestos reais.
 */
class TouchPlanner {
    private val prevPressed = HashMap<String, Boolean>()
    private val toggled = HashSet<String>()
    private val tapUntil = HashMap<String, Long>()
    private val cameras = HashMap<String, CameraState>()

    private class CameraState(var x: Float, var y: Float, var generation: Int, var restarting: Boolean = false)

    fun reset() {
        prevPressed.clear(); toggled.clear(); tapUntil.clear(); cameras.clear()
    }

    /** true enquanto houver algo que muda com o tempo (camera em movimento, toque rapido pendente). */
    fun needsTicks(): Boolean = tapUntil.isNotEmpty() || cameras.isNotEmpty()

    fun plan(
        profile: Profile,
        state: ControllerState,
        screenW: Int,
        screenH: Int,
        nowMs: Long,
        dtMs: Long,
    ): Map<String, TouchPoint> {
        val out = LinkedHashMap<String, TouchPoint>()
        val minSide = min(screenW, screenH).toFloat()
        val maxX = (screenW - 1).toFloat().coerceAtLeast(0f)
        val maxY = (screenH - 1).toFloat().coerceAtLeast(0f)
        val dt = dtMs.coerceIn(0L, 50L) / 1000f
        val liveIds = HashSet<String>()

        for (e in profile.elements) {
            liveIds += e.id
            val cx = e.x * screenW
            val cy = e.y * screenH
            val radius = e.size * minSide / 2f
            when (e.type) {
                ElementType.BUTTON -> planButton(e, state, nowMs)?.let {
                    out[e.id] = TouchPoint(cx.clamp(maxX), cy.clamp(maxY), isButton = true)
                }
                ElementType.STICK -> planStick(e, profile, state, cx, cy, radius, dt)?.let { p ->
                    out[e.id] = p.copy(
                        x = p.x.clamp(maxX), y = p.y.clamp(maxY),
                        downX = p.downX.clamp(maxX), downY = p.downY.clamp(maxY),
                    )
                }
            }
            if (out.size >= MAX_TOUCHES) break
        }
        // Limpa estados de elementos removidos do perfil.
        prevPressed.keys.retainAll(liveIds); toggled.retainAll(liveIds)
        tapUntil.keys.retainAll(liveIds); cameras.keys.retainAll(liveIds)
        return out
    }

    /** @return Unit (marcador) se o botao virtual deve estar tocado agora, ou null. */
    private fun planButton(e: MappingElement, state: ControllerState, nowMs: Long): Unit? {
        val input = e.input ?: return null
        val pressed = state.isPressed(input)
        val wasPressed = prevPressed[e.id] ?: false
        prevPressed[e.id] = pressed
        val edgeDown = pressed && !wasPressed
        return when (e.buttonMode) {
            ButtonMode.HOLD -> if (pressed) Unit else null
            ButtonMode.TAP -> {
                if (edgeDown) tapUntil[e.id] = nowMs + TAP_DURATION_MS
                val until = tapUntil[e.id]
                when {
                    until == null -> null
                    nowMs < until -> Unit
                    else -> { tapUntil.remove(e.id); null }
                }
            }
            ButtonMode.TOGGLE -> {
                if (edgeDown) { if (!toggled.remove(e.id)) toggled += e.id }
                if (e.id in toggled) Unit else null
            }
        }
    }

    private fun planStick(
        e: MappingElement, profile: Profile, state: ControllerState,
        cx: Float, cy: Float, radius: Float, dt: Float,
    ): TouchPoint? {
        val source = e.stick ?: return null
        val (rawX, rawY0) = state.stick(source)
        val rawY = if (e.invertY) -rawY0 else rawY0
        val (dx, dy) = StickMath.applyDeadzone(rawX, rawY, e.deadzone)
        val active = dx != 0f || dy != 0f
        val sens = (e.sensitivity * profile.globalSensitivity).coerceIn(0.05f, 6f)

        return when (e.stickMode) {
            StickMode.JOYSTICK -> {
                if (!active) return null
                val (sx, sy) = StickMath.applySensitivity(dx, dy, sens)
                TouchPoint(cx + sx * radius, cy + sy * radius, downX = cx, downY = cy)
            }
            StickMode.CAMERA -> {
                if (!active) { cameras.remove(e.id); return null }
                val cam = cameras.getOrPut(e.id) { CameraState(cx, cy, 0) }
                if (cam.restarting) {
                    // Um quadro sem toque ja foi enviado: recomeca o arrasto no centro.
                    cam.restarting = false
                    cam.x = cx; cam.y = cy; cam.generation++
                }
                val speed = sens * radius * CAMERA_SPEED_RADII_PER_SEC
                cam.x += dx * speed * dt
                cam.y += dy * speed * dt
                if (hypot(cam.x - cx, cam.y - cy) > radius) {
                    // Chegou na borda da zona: levanta o dedo neste quadro.
                    cam.restarting = true
                    return null
                }
                TouchPoint(cam.x, cam.y, downX = cx, downY = cy, generation = cam.generation)
            }
        }
    }

    private fun Float.clamp(max: Float) = coerceIn(0f, max)

    companion object {
        /** Limite de toques simultaneos do GestureDescription (getMaxStrokeCount = 10 no AOSP). */
        const val MAX_TOUCHES = 10
        const val TAP_DURATION_MS = 60L
        /** Em sensibilidade 1, o dedo percorre 2.5 raios por segundo com o analogico no maximo. */
        const val CAMERA_SPEED_RADII_PER_SEC = 2.5f
    }
}
