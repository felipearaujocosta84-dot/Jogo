package com.gamepadmapper

import com.gamepadmapper.input.ControllerState
import com.gamepadmapper.input.PhysicalInput
import com.gamepadmapper.input.StickSource
import com.gamepadmapper.profile.ButtonMode
import com.gamepadmapper.profile.ElementType
import com.gamepadmapper.profile.MappingElement
import com.gamepadmapper.profile.Profile
import com.gamepadmapper.profile.StickMode
import com.gamepadmapper.touch.TouchPlanner
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

class TouchPlannerTest {
    private val W = 2000; private val H = 1000

    private fun button(mode: ButtonMode = ButtonMode.HOLD) =
        MappingElement(id = "btn", type = ElementType.BUTTON, x = 0.8f, y = 0.7f, size = 0.1f, input = PhysicalInput.A, buttonMode = mode)

    private fun stick(mode: StickMode, sens: Float = 1f, dz: Float = 0.1f) =
        MappingElement(id = "stk", type = ElementType.STICK, x = 0.2f, y = 0.6f, size = 0.4f,
            stick = StickSource.LEFT, stickMode = mode, sensitivity = sens, deadzone = dz)

    @Test fun holdButtonTouchesCenterWhilePressed() {
        val p = Profile(name = "t", elements = listOf(button()))
        val planner = TouchPlanner(); val s = ControllerState()
        assertTrue(planner.plan(p, s, W, H, 0, 16).isEmpty())
        s.keysDown += PhysicalInput.A
        val t = planner.plan(p, s, W, H, 16, 16)["btn"]
        assertNotNull(t); assertEquals(1600f, t!!.x, 0.01f); assertEquals(700f, t.y, 0.01f)
        s.keysDown.clear()
        assertTrue(planner.plan(p, s, W, H, 32, 16).isEmpty())
    }

    @Test fun tapButtonReleasesAfterTapDurationEvenIfHeld() {
        val p = Profile(name = "t", elements = listOf(button(ButtonMode.TAP)))
        val planner = TouchPlanner(); val s = ControllerState()
        s.keysDown += PhysicalInput.A
        assertNotNull(planner.plan(p, s, W, H, 1000, 16)["btn"])
        assertTrue(planner.needsTicks())
        assertNotNull(planner.plan(p, s, W, H, 1030, 16)["btn"])
        assertNull(planner.plan(p, s, W, H, 1000 + TouchPlanner.TAP_DURATION_MS + 1, 16)["btn"])
        assertNull(planner.plan(p, s, W, H, 2000, 16)["btn"]) // ainda segurando: nao repete
    }

    @Test fun toggleButtonFlipsOnEachPress() {
        val p = Profile(name = "t", elements = listOf(button(ButtonMode.TOGGLE)))
        val planner = TouchPlanner(); val s = ControllerState()
        s.keysDown += PhysicalInput.A
        assertNotNull(planner.plan(p, s, W, H, 0, 16)["btn"])
        s.keysDown.clear()
        assertNotNull(planner.plan(p, s, W, H, 16, 16)["btn"]) // continua tocado
        s.keysDown += PhysicalInput.A
        assertNull(planner.plan(p, s, W, H, 32, 16)["btn"])
    }

    @Test fun joystickMapsDeflectionToRadius() {
        val p = Profile(name = "t", elements = listOf(stick(StickMode.JOYSTICK, dz = 0f)))
        val planner = TouchPlanner(); val s = ControllerState()
        assertTrue(planner.plan(p, s, W, H, 0, 16).isEmpty())
        s.lx = 1f
        val t = planner.plan(p, s, W, H, 16, 16)["stk"]!!
        val radius = 0.4f * 1000 / 2
        assertEquals(400f, t.downX, 0.01f); assertEquals(600f, t.downY, 0.01f) // centro
        assertEquals(400f + radius, t.x, 0.5f); assertEquals(600f, t.y, 0.5f)
    }

    @Test fun joystickRespectsDeadzone() {
        val p = Profile(name = "t", elements = listOf(stick(StickMode.JOYSTICK, dz = 0.3f)))
        val planner = TouchPlanner(); val s = ControllerState()
        s.lx = 0.25f
        assertTrue(planner.plan(p, s, W, H, 0, 16).isEmpty())
    }

    @Test fun cameraModeDragsAndRestartsAtEdge() {
        val p = Profile(name = "t", elements = listOf(stick(StickMode.CAMERA, sens = 1f, dz = 0f)))
        val planner = TouchPlanner(); val s = ControllerState()
        s.lx = 1f
        var now = 0L
        val first = planner.plan(p, s, W, H, now, 16)["stk"]!!
        var last = first
        var lifted = false
        var restartedGen: Int? = null
        repeat(200) {
            now += 16
            val t = planner.plan(p, s, W, H, now, 16)["stk"]
            if (t == null) lifted = true
            else {
                if (lifted && restartedGen == null) restartedGen = t.generation
                if (!lifted) assertTrue(t.x >= last.x) // move para a direita continuamente
                last = t
            }
        }
        assertTrue("deveria levantar ao atingir a borda", lifted)
        assertNotNull(restartedGen)
        assertNotEquals(first.generation, restartedGen)
        s.lx = 0f
        assertNull(planner.plan(p, s, W, H, now + 16, 16)["stk"])
    }

    @Test fun touchesAreClampedToScreen() {
        val e = MappingElement(id = "e", type = ElementType.STICK, x = 0.99f, y = 0.99f, size = 0.6f,
            stick = StickSource.LEFT, deadzone = 0f)
        val p = Profile(name = "t", elements = listOf(e))
        val planner = TouchPlanner(); val s = ControllerState(); s.lx = 1f; s.ly = 1f
        val t = planner.plan(p, s, W, H, 0, 16)["e"]!!
        assertTrue(t.x <= W - 1 && t.y <= H - 1)
    }

    @Test fun neverExceedsMaxTouches() {
        val many = (0 until 15).map {
            MappingElement(id = "b$it", type = ElementType.BUTTON, x = it / 15f, y = 0.5f, size = 0.05f, input = PhysicalInput.A)
        }
        val planner = TouchPlanner(); val s = ControllerState(); s.keysDown += PhysicalInput.A
        assertEquals(TouchPlanner.MAX_TOUCHES, planner.plan(Profile(name = "t", elements = many), s, W, H, 0, 16).size)
    }

    @Test fun usedInputsIncludesDpadForDpadStick() {
        val e = MappingElement(type = ElementType.STICK, x = 0.5f, y = 0.5f, size = 0.3f, stick = StickSource.DPAD)
        val used = Profile(name = "t", elements = listOf(e, button())).usedInputs()
        assertTrue(PhysicalInput.DPAD_UP in used && PhysicalInput.A in used)
    }
}
