package com.gamepadmapper.input

import kotlin.math.abs
import kotlin.math.hypot

/**
 * Estado instantaneo de um controle: botoes digitais pressionados + eixos analogicos.
 * Classe pura (sem dependencias Android) para poder ser testada na JVM.
 */
class ControllerState {
    /** Botoes reportados como KeyEvent. */
    val keysDown: MutableSet<PhysicalInput> = LinkedHashSet()

    var lx = 0f; var ly = 0f
    var rx = 0f; var ry = 0f
    /** Gatilhos analogicos 0..1. */
    var lt = 0f; var rt = 0f
    /** Direcional reportado como eixo HAT (-1, 0, 1). */
    var hatX = 0f; var hatY = 0f

    fun isPressed(input: PhysicalInput): Boolean = when (input) {
        PhysicalInput.L2 -> input in keysDown || lt > TRIGGER_THRESHOLD
        PhysicalInput.R2 -> input in keysDown || rt > TRIGGER_THRESHOLD
        PhysicalInput.DPAD_UP -> input in keysDown || hatY < -HAT_THRESHOLD
        PhysicalInput.DPAD_DOWN -> input in keysDown || hatY > HAT_THRESHOLD
        PhysicalInput.DPAD_LEFT -> input in keysDown || hatX < -HAT_THRESHOLD
        PhysicalInput.DPAD_RIGHT -> input in keysDown || hatX > HAT_THRESHOLD
        else -> input in keysDown
    }

    fun pressedInputs(): List<PhysicalInput> = PhysicalInput.entries.filter { isPressed(it) }

    /** Vetor (x, y) da fonte, com magnitude limitada a 1. Y positivo = para baixo (igual a tela). */
    fun stick(source: StickSource): Pair<Float, Float> {
        val (x, y) = when (source) {
            StickSource.LEFT -> lx to ly
            StickSource.RIGHT -> rx to ry
            StickSource.DPAD -> {
                val dx = (if (isPressed(PhysicalInput.DPAD_RIGHT)) 1f else 0f) - (if (isPressed(PhysicalInput.DPAD_LEFT)) 1f else 0f)
                val dy = (if (isPressed(PhysicalInput.DPAD_DOWN)) 1f else 0f) - (if (isPressed(PhysicalInput.DPAD_UP)) 1f else 0f)
                dx to dy
            }
        }
        val m = hypot(x, y)
        return if (m > 1f) (x / m) to (y / m) else x to y
    }

    fun isIdle(): Boolean = pressedInputs().isEmpty() &&
        abs(lx) < IDLE && abs(ly) < IDLE && abs(rx) < IDLE && abs(ry) < IDLE

    fun reset() {
        keysDown.clear()
        lx = 0f; ly = 0f; rx = 0f; ry = 0f; lt = 0f; rt = 0f; hatX = 0f; hatY = 0f
    }

    fun copy(): ControllerState = ControllerState().also {
        it.keysDown.addAll(keysDown)
        it.lx = lx; it.ly = ly; it.rx = rx; it.ry = ry
        it.lt = lt; it.rt = rt; it.hatX = hatX; it.hatY = hatY
    }

    companion object {
        const val TRIGGER_THRESHOLD = 0.5f
        const val HAT_THRESHOLD = 0.5f
        private const val IDLE = 0.08f
    }
}
