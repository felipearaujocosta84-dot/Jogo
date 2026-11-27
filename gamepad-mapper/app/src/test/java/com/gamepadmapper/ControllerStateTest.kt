package com.gamepadmapper

import com.gamepadmapper.input.ControllerState
import com.gamepadmapper.input.PhysicalInput
import com.gamepadmapper.input.StickSource
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

class ControllerStateTest {
    @Test fun analogTriggersCountAsPressedAboveThreshold() {
        val s = ControllerState()
        s.lt = 0.3f
        assertFalse(s.isPressed(PhysicalInput.L2))
        s.lt = 0.8f
        assertTrue(s.isPressed(PhysicalInput.L2))
    }

    @Test fun hatAxesCountAsDpad() {
        val s = ControllerState()
        s.hatX = -1f; s.hatY = 1f
        assertTrue(s.isPressed(PhysicalInput.DPAD_LEFT))
        assertTrue(s.isPressed(PhysicalInput.DPAD_DOWN))
        assertFalse(s.isPressed(PhysicalInput.DPAD_UP))
    }

    @Test fun dpadAsStickIsNormalizedOnDiagonal() {
        val s = ControllerState()
        s.keysDown += PhysicalInput.DPAD_RIGHT; s.keysDown += PhysicalInput.DPAD_UP
        val (x, y) = s.stick(StickSource.DPAD)
        assertEquals(0.7071f, x, 1e-3f); assertEquals(-0.7071f, y, 1e-3f)
    }

    @Test fun copyIsIndependent() {
        val s = ControllerState(); s.keysDown += PhysicalInput.A; s.lx = 0.5f
        val c = s.copy(); s.keysDown.clear(); s.lx = 0f
        assertTrue(c.isPressed(PhysicalInput.A)); assertEquals(0.5f, c.lx, 0f)
    }
}
