package com.gamepadmapper

import com.gamepadmapper.profile.ElementType
import com.gamepadmapper.profile.Profile
import com.gamepadmapper.profile.ProfileJson
import com.gamepadmapper.profile.ProfileTemplate
import com.gamepadmapper.profile.ScreenOrientation
import org.json.JSONObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class ProfileTemplatesTest {
    @Test fun freeFireTemplateIsValid() {
        val els = ProfileTemplate.FREE_FIRE.elements(ScreenOrientation.LANDSCAPE, 0.15f, 1f)
        assertEquals(16, els.size)
        for (e in els) {
            assertTrue(e.x in 0f..1f && e.y in 0f..1f)
            assertTrue(e.name != null)
            if (e.type == ElementType.BUTTON) assertTrue(e.input != null) else assertTrue(e.stick != null)
        }
        val inputs = els.mapNotNull { it.input }
        assertEquals("cada botão físico só uma vez", inputs.size, inputs.toSet().size)
        assertEquals(els.size, els.map { it.id }.toSet().size)
    }

    @Test fun freeFirePackagesAreRecognized() {
        assertEquals(ProfileTemplate.FREE_FIRE, ProfileTemplate.forPackage("com.dts.freefireth"))
        assertEquals(ProfileTemplate.FREE_FIRE, ProfileTemplate.forPackage("com.dts.freefiremax"))
        assertEquals(null, ProfileTemplate.forPackage("com.example"))
    }

    @Test fun namesSurviveJsonRoundTrip() {
        val p = Profile(name = "FF", elements = ProfileTemplate.FREE_FIRE.elements(ScreenOrientation.LANDSCAPE, 0.15f, 1f))
        val back = ProfileJson.fromJson(JSONObject(ProfileJson.toJson(p).toString()))
        assertEquals(p.elements, back.elements)
    }
}
