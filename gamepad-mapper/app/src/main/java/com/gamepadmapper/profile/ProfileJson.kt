package com.gamepadmapper.profile

import com.gamepadmapper.input.PhysicalInput
import com.gamepadmapper.input.StickSource
import org.json.JSONArray
import org.json.JSONObject

/** Serializacao dos perfis em JSON (formato versionado para futuras migracoes). */
object ProfileJson {
    const val FORMAT_VERSION = 1

    fun toJson(p: Profile): JSONObject = JSONObject().apply {
        put("format", FORMAT_VERSION)
        put("id", p.id)
        put("name", p.name)
        p.packageName?.let { put("packageName", it) }
        p.appLabel?.let { put("appLabel", it) }
        put("orientation", p.orientation.name)
        put("globalSensitivity", p.globalSensitivity.toDouble())
        p.backgroundUri?.let { put("backgroundUri", it) }
        put("createdAt", p.createdAt)
        put("updatedAt", p.updatedAt)
        put("elements", JSONArray().apply { p.elements.forEach { put(elementToJson(it)) } })
    }

    fun elementToJson(e: MappingElement): JSONObject = JSONObject().apply {
        put("id", e.id)
        put("type", e.type.name)
        put("x", e.x.toDouble()); put("y", e.y.toDouble()); put("size", e.size.toDouble())
        e.input?.let { put("input", it.name) }
        e.stick?.let { put("stick", it.name) }
        put("buttonMode", e.buttonMode.name)
        put("stickMode", e.stickMode.name)
        put("sensitivity", e.sensitivity.toDouble())
        put("deadzone", e.deadzone.toDouble())
        put("invertY", e.invertY)
        e.name?.let { put("name", it) }
    }

    /** @throws IllegalArgumentException se o JSON nao for um perfil valido. */
    fun fromJson(o: JSONObject): Profile {
        val name = o.optString("name", "").ifBlank { throw IllegalArgumentException("Perfil sem nome") }
        val arr = o.optJSONArray("elements") ?: JSONArray()
        val elements = ArrayList<MappingElement>()
        for (i in 0 until arr.length()) elementFromJson(arr.getJSONObject(i))?.let { elements += it }
        return Profile(
            id = o.optString("id", "").ifBlank { java.util.UUID.randomUUID().toString() },
            name = name,
            packageName = o.optString("packageName", "").ifBlank { null },
            appLabel = o.optString("appLabel", "").ifBlank { null },
            orientation = ScreenOrientation.fromName(o.optString("orientation")),
            globalSensitivity = o.optDouble("globalSensitivity", 1.0).toFloat().coerceIn(0.1f, 3f),
            backgroundUri = o.optString("backgroundUri", "").ifBlank { null },
            elements = elements,
            createdAt = o.optLong("createdAt", System.currentTimeMillis()),
            updatedAt = o.optLong("updatedAt", System.currentTimeMillis()),
        )
    }

    /** Elementos invalidos (tipo desconhecido, sem associacao) sao descartados. */
    fun elementFromJson(o: JSONObject): MappingElement? {
        val type = runCatching { ElementType.valueOf(o.getString("type")) }.getOrNull() ?: return null
        val input = PhysicalInput.fromName(o.optString("input"))
        val stick = StickSource.fromName(o.optString("stick"))
        if (type == ElementType.BUTTON && input == null) return null
        if (type == ElementType.STICK && stick == null) return null
        return MappingElement(
            id = o.optString("id", "").ifBlank { MappingElement.newId() },
            type = type,
            x = o.optDouble("x", 0.5).toFloat().coerceIn(0f, 1f),
            y = o.optDouble("y", 0.5).toFloat().coerceIn(0f, 1f),
            size = o.optDouble("size", 0.12).toFloat().coerceIn(MappingElement.MIN_SIZE, MappingElement.MAX_SIZE),
            input = input,
            stick = stick,
            buttonMode = ButtonMode.fromName(o.optString("buttonMode")),
            stickMode = StickMode.fromName(o.optString("stickMode")),
            sensitivity = o.optDouble("sensitivity", 1.0).toFloat().coerceIn(0.1f, 3f),
            deadzone = o.optDouble("deadzone", 0.15).toFloat().coerceIn(0f, 0.9f),
            invertY = o.optBoolean("invertY", false),
            name = o.optString("name", "").trim().take(24).ifBlank { null },
        )
    }
}
