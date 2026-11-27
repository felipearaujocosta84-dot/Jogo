package com.gamepadmapper.profile

import com.gamepadmapper.input.PhysicalInput
import com.gamepadmapper.input.StickSource

/** Layouts iniciais para novos perfis. Posicoes aproximadas: ajuste no editor com uma captura do jogo. */
enum class ProfileTemplate(val label: String, val packages: Set<String> = emptySet()) {
    BLANK("Em branco"),
    DEFAULT("Padrão (analógicos + A/B/X/Y)"),
    FREE_FIRE("Free Fire", setOf("com.dts.freefireth", "com.dts.freefiremax"));

    fun elements(orientation: ScreenOrientation, deadzone: Float, sensitivity: Float): List<MappingElement> = when (this) {
        BLANK -> emptyList()
        DEFAULT -> Profile.defaultElements(deadzone, sensitivity).let { base ->
            if (orientation == ScreenOrientation.PORTRAIT) base.map { it.copy(y = 0.55f + it.y * 0.45f) } else base
        }
        FREE_FIRE -> freeFire(deadzone, sensitivity)
    }

    companion object {
        fun forPackage(pkg: String?): ProfileTemplate? = entries.firstOrNull { pkg != null && pkg in it.packages }

        private fun btn(input: PhysicalInput, x: Float, y: Float, size: Float, name: String, mode: ButtonMode = ButtonMode.TAP) =
            MappingElement(type = ElementType.BUTTON, x = x, y = y, size = size, input = input, buttonMode = mode, name = name)

        /** HUD padrao do Free Fire em paisagem (aproximado). */
        private fun freeFire(deadzone: Float, sensitivity: Float): List<MappingElement> = listOf(
            MappingElement(type = ElementType.STICK, x = 0.15f, y = 0.68f, size = 0.36f, stick = StickSource.LEFT,
                stickMode = StickMode.JOYSTICK, deadzone = deadzone, sensitivity = sensitivity, name = "Andar"),
            MappingElement(type = ElementType.STICK, x = 0.60f, y = 0.40f, size = 0.34f, stick = StickSource.RIGHT,
                stickMode = StickMode.CAMERA, deadzone = maxOf(deadzone, 0.18f), sensitivity = sensitivity * 1.2f, name = "Câmera/mira"),
            btn(PhysicalInput.R2, 0.86f, 0.60f, 0.16f, "Atirar", ButtonMode.HOLD),
            btn(PhysicalInput.L2, 0.93f, 0.40f, 0.11f, "Mira"),
            btn(PhysicalInput.A, 0.93f, 0.78f, 0.11f, "Pular"),
            btn(PhysicalInput.B, 0.86f, 0.90f, 0.10f, "Agachar"),
            btn(PhysicalInput.R3, 0.77f, 0.92f, 0.09f, "Deitar"),
            btn(PhysicalInput.X, 0.76f, 0.72f, 0.10f, "Recarregar"),
            btn(PhysicalInput.Y, 0.62f, 0.64f, 0.10f, "Pegar/abrir"),
            btn(PhysicalInput.L1, 0.80f, 0.40f, 0.10f, "Gel"),
            btn(PhysicalInput.R1, 0.50f, 0.90f, 0.10f, "Arma 2"),
            btn(PhysicalInput.DPAD_LEFT, 0.42f, 0.90f, 0.10f, "Arma 1"),
            btn(PhysicalInput.DPAD_UP, 0.33f, 0.88f, 0.09f, "Kit médico"),
            btn(PhysicalInput.DPAD_RIGHT, 0.72f, 0.28f, 0.09f, "Granada"),
            btn(PhysicalInput.DPAD_DOWN, 0.92f, 0.22f, 0.09f, "Mochila"),
            btn(PhysicalInput.SELECT, 0.94f, 0.08f, 0.08f, "Mapa"),
        )
    }
}
