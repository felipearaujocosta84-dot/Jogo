package com.gamepadmapper

import com.gamepadmapper.touch.StickMath
import org.junit.Assert.assertEquals
import org.junit.Test
import kotlin.math.hypot

class StickMathTest {
    @Test fun insideDeadzoneIsZero() {
        assertEquals(0f to 0f, StickMath.applyDeadzone(0.1f, 0.05f, 0.2f))
    }

    @Test fun outsideDeadzoneRescalesToFullRange() {
        val (x, y) = StickMath.applyDeadzone(1f, 0f, 0.2f)
        assertEquals(1f, x, 1e-4f); assertEquals(0f, y, 1e-4f)
        val (hx, _) = StickMath.applyDeadzone(0.6f, 0f, 0.2f)
        assertEquals(0.5f, hx, 1e-4f) // (0.6-0.2)/(1-0.2)
    }

    @Test fun deadzonePreservesDirection() {
        val (x, y) = StickMath.applyDeadzone(0.5f, 0.5f, 0.1f)
        assertEquals(x, y, 1e-5f)
    }

    @Test fun sensitivityClampsToUnitCircle() {
        val (x, y) = StickMath.applySensitivity(0.8f, 0.8f, 3f)
        assertEquals(1f, hypot(x, y), 1e-4f)
        val (sx, _) = StickMath.applySensitivity(0.25f, 0f, 2f)
        assertEquals(0.5f, sx, 1e-5f)
    }
}
