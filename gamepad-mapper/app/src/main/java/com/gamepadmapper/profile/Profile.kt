package com.gamepadmapper.profile

import com.gamepadmapper.input.PhysicalInput
import com.gamepadmapper.input.StickSource
import java.util.UUID

enum class ElementType { BUTTON, STICK }

enum class ButtonMode(val label: String) {
    HOLD("Segurar (toque mantido enquanto o botão está pressionado)"),
    TAP("Toque rápido (um toque por pressionamento)"),
    TOGGLE("Alternar (1º aperto segura, 2º solta)");

    companion object { fun fromName(n: String?) = entries.firstOrNull { it.name == n } ?: HOLD }
}

enum class StickMode(val label: String) {
    JOYSTICK("Joystick virtual (posição absoluta)"),
    CAMERA("Câmera / mira (arrasto contínuo)");

    companion object { fun fromName(n: String?) = entries.firstOrNull { it.name == n } ?: JOYSTICK }
}

enum class ScreenOrientation(val label: String) {
    LANDSCAPE("Horizontal"), PORTRAIT("Vertical");

    companion object { fun fromName(n: String?) = entries.firstOrNull { it.name == n } ?: LANDSCAPE }
}

/**
 * Elemento do layout. Coordenadas (x, y) sao o CENTRO normalizado (0..1) na tela;
 * [size] e o diametro como fracao do MENOR lado da tela.
 */
data class MappingElement(
    val id: String = newId(),
    val type: ElementType,
    val x: Float,
    val y: Float,
    val size: Float,
    val input: PhysicalInput? = null,
    val stick: StickSource? = null,
    val buttonMode: ButtonMode = ButtonMode.HOLD,
    val stickMode: StickMode = StickMode.JOYSTICK,
    val sensitivity: Float = 1f,
    val deadzone: Float = 0.15f,
    val invertY: Boolean = false,
    /** Nome da acao no jogo (ex.: "Atirar"), exibido no editor. Opcional. */
    val name: String? = null,
) {
    val shortLabel: String
        get() = when (type) {
            ElementType.BUTTON -> input?.shortLabel ?: "?"
            ElementType.STICK -> stick?.shortLabel ?: "?"
        }

    companion object {
        const val MIN_SIZE = 0.04f
        const val MAX_SIZE = 0.6f
        fun newId(): String = UUID.randomUUID().toString().substring(0, 8)
    }
}

data class Profile(
    val id: String = UUID.randomUUID().toString(),
    val name: String,
    val packageName: String? = null,
    val appLabel: String? = null,
    val orientation: ScreenOrientation = ScreenOrientation.LANDSCAPE,
    val globalSensitivity: Float = 1f,
    val backgroundUri: String? = null,
    val elements: List<MappingElement> = emptyList(),
    val createdAt: Long = System.currentTimeMillis(),
    val updatedAt: Long = System.currentTimeMillis(),
) {
    /** Botoes fisicos que este perfil usa (para decidir quais eventos consumir). */
    fun usedInputs(): Set<PhysicalInput> {
        val s = HashSet<PhysicalInput>()
        for (e in elements) {
            if (e.type == ElementType.BUTTON) e.input?.let { s += it }
            if (e.type == ElementType.STICK && e.stick == StickSource.DPAD) {
                s += PhysicalInput.DPAD_UP; s += PhysicalInput.DPAD_DOWN
                s += PhysicalInput.DPAD_LEFT; s += PhysicalInput.DPAD_RIGHT
            }
        }
        return s
    }

    companion object {
        /** Layout inicial tipico de jogos de acao em paisagem. */
        fun defaultElements(defaultDeadzone: Float = 0.15f, defaultSensitivity: Float = 1f): List<MappingElement> = listOf(
            MappingElement(type = ElementType.STICK, x = 0.16f, y = 0.70f, size = 0.36f, stick = StickSource.LEFT,
                deadzone = defaultDeadzone, sensitivity = defaultSensitivity),
            MappingElement(type = ElementType.STICK, x = 0.62f, y = 0.45f, size = 0.40f, stick = StickSource.RIGHT,
                stickMode = StickMode.CAMERA, deadzone = defaultDeadzone, sensitivity = defaultSensitivity),
            MappingElement(type = ElementType.BUTTON, x = 0.88f, y = 0.80f, size = 0.14f, input = PhysicalInput.A),
            MappingElement(type = ElementType.BUTTON, x = 0.95f, y = 0.62f, size = 0.12f, input = PhysicalInput.B),
            MappingElement(type = ElementType.BUTTON, x = 0.80f, y = 0.62f, size = 0.12f, input = PhysicalInput.X),
            MappingElement(type = ElementType.BUTTON, x = 0.88f, y = 0.45f, size = 0.12f, input = PhysicalInput.Y),
        )
    }
}
