package com.gamepadmapper.input

/** Botoes fisicos que podem ser associados a botoes virtuais. */
enum class PhysicalInput(val label: String, val shortLabel: String) {
    A("Botão A", "A"),
    B("Botão B", "B"),
    X("Botão X", "X"),
    Y("Botão Y", "Y"),
    L1("L1 / LB", "L1"),
    R1("R1 / RB", "R1"),
    L2("L2 / LT (gatilho)", "L2"),
    R2("R2 / RT (gatilho)", "R2"),
    L3("L3 (clique analógico esq.)", "L3"),
    R3("R3 (clique analógico dir.)", "R3"),
    START("Start / Options / Menu", "ST"),
    SELECT("Select / Share / View", "SE"),
    DPAD_UP("Direcional ↑", "↑"),
    DPAD_DOWN("Direcional ↓", "↓"),
    DPAD_LEFT("Direcional ←", "←"),
    DPAD_RIGHT("Direcional →", "→");

    val isDpad: Boolean get() = this == DPAD_UP || this == DPAD_DOWN || this == DPAD_LEFT || this == DPAD_RIGHT

    companion object {
        fun fromName(name: String?): PhysicalInput? = entries.firstOrNull { it.name == name }
    }
}

/** Fontes de movimento que podem controlar uma zona de analogico virtual. */
enum class StickSource(val label: String, val shortLabel: String) {
    LEFT("Analógico esquerdo", "L"),
    RIGHT("Analógico direito", "R"),
    DPAD("Direcional digital (como analógico)", "D");

    companion object {
        fun fromName(name: String?): StickSource? = entries.firstOrNull { it.name == name }
    }
}
