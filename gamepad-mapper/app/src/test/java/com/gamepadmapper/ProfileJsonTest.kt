package com.gamepadmapper

import com.gamepadmapper.input.PhysicalInput
import com.gamepadmapper.input.StickSource
import com.gamepadmapper.profile.ButtonMode
import com.gamepadmapper.profile.ElementType
import com.gamepadmapper.profile.MappingElement
import com.gamepadmapper.profile.Profile
import com.gamepadmapper.profile.ProfileJson
import com.gamepadmapper.profile.ScreenOrientation
import com.gamepadmapper.profile.StickMode
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Test

class ProfileJsonTest {
    @Test fun roundTripPreservesEverything() {
        val p = Profile(
            name = "Corrida", packageName = "com.example.game", appLabel = "Game",
            orientation = ScreenOrientation.PORTRAIT, globalSensitivity = 1.5f,
            elements = listOf(
                MappingElement(type = ElementType.BUTTON, x = 0.1f, y = 0.2f, size = 0.12f,
                    input = PhysicalInput.R2, buttonMode = ButtonMode.TOGGLE),
                MappingElement(type = ElementType.STICK, x = 0.3f, y = 0.4f, size = 0.3f,
                    stick = StickSource.RIGHT, stickMode = StickMode.CAMERA, sensitivity = 2f, deadzone = 0.25f, invertY = true),
            ),
        )
        val back = ProfileJson.fromJson(JSONObject(ProfileJson.toJson(p).toString()))
        assertEquals(p.copy(), back.copy(createdAt = p.createdAt, updatedAt = p.updatedAt))
    }

    @Test fun invalidElementsAreDroppedAndValuesClamped() {
        val json = JSONObject("""
            {"name":"X","elements":[
              {"type":"BUTTON","x":0.5,"y":0.5,"size":0.1},
              {"type":"ALIEN","x":0.5,"y":0.5},
              {"type":"STICK","stick":"LEFT","x":5,"y":-1,"size":9,"deadzone":3,"sensitivity":100}
            ]}""")
        val p = ProfileJson.fromJson(json)
        assertEquals(1, p.elements.size)
        val e = p.elements[0]
        assertEquals(1f, e.x, 0f); assertEquals(0f, e.y, 0f)
        assertEquals(MappingElement.MAX_SIZE, e.size, 0f)
        assertEquals(0.9f, e.deadzone, 0f); assertEquals(3f, e.sensitivity, 0f)
    }

    @Test(expected = IllegalArgumentException::class)
    fun profileWithoutNameIsRejected() {
        ProfileJson.fromJson(JSONObject("{\"elements\":[]}"))
    }
}
