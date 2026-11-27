package com.gamepadmapper.touch

import kotlin.math.hypot
import kotlin.math.min

/** Matematica dos analogicos: zona morta radial e sensibilidade. */
object StickMath {
    /**
     * Aplica zona morta radial e reescala o restante para 0..1, preservando a direcao.
     * Retorna (0,0) dentro da zona morta.
     */
    fun applyDeadzone(x: Float, y: Float, deadzone: Float): Pair<Float, Float> {
        val mag = hypot(x, y)
        val dz = deadzone.coerceIn(0f, 0.95f)
        if (mag <= dz || mag == 0f) return 0f to 0f
        val scaled = min(1f, (mag - dz) / (1f - dz))
        return (x / mag * scaled) to (y / mag * scaled)
    }

    /** Aplica sensibilidade (ganho) limitando a magnitude a 1. */
    fun applySensitivity(x: Float, y: Float, sensitivity: Float): Pair<Float, Float> {
        val gx = x * sensitivity
        val gy = y * sensitivity
        val mag = hypot(gx, gy)
        return if (mag > 1f) (gx / mag) to (gy / mag) else gx to gy
    }
}
