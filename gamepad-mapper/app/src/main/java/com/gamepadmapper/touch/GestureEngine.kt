package com.gamepadmapper.touch

import android.accessibilityservice.AccessibilityService
import android.accessibilityservice.GestureDescription
import android.graphics.Path
import android.os.Handler
import android.os.Looper
import android.util.Log

/**
 * Converte o conjunto de toques desejados em gestos reais via AccessibilityService.dispatchGesture.
 *
 * Restricoes do Android que este motor respeita:
 *  - Cada dispatchGesture cancela o gesto anterior do servico, entao todos os dedos ativos
 *    sao enviados juntos em um unico GestureDescription (multitoque).
 *  - Toques mantidos/arrastados usam StrokeDescription.continueStroke (API 26+): o dedo
 *    continua pressionado entre um gesto e o proximo.
 *  - No maximo [GestureDescription.getMaxStrokeCount] dedos simultaneos.
 *  - Um novo gesto so e enviado quando o anterior termina (encadeamento), o que limita a
 *    taxa de atualizacao a ~1 segmento a cada [SEGMENT_MS].
 */
class GestureEngine(private val service: AccessibilityService) {

    private class ActiveStroke(val generation: Int, val x: Float, val y: Float, val stroke: GestureDescription.StrokeDescription)

    private val handler = Handler(Looper.getMainLooper())
    private var active = HashMap<String, ActiveStroke>()
    private var pending: Map<String, TouchPoint>? = null
    private var inFlight = false
    private var dispatchSerial = 0
    private val maxStrokes = GestureDescription.getMaxStrokeCount()

    /** Modo compatibilidade: botoes viram toques curtos independentes (ver AppSettings.compatTaps). */
    var compatButtonTaps = false
    private var compatPressed: Set<String> = emptySet()

    /** Chamado (com atraso) depois que o sistema cancela um gesto, para o servico reenviar os toques. */
    var onCancelled: (() -> Unit)? = null

    /** Quantidade de dedos virtuais atualmente pressionados. */
    val activeCount: Int get() = active.size

    /** Ultimo erro (para exibir no diagnostico). */
    @Volatile var lastError: String? = null
        private set
    @Volatile var gesturesDispatched = 0L
        private set

    fun submit(desired: Map<String, TouchPoint>) {
        if (desired.isEmpty() && active.isEmpty() && !inFlight) { pending = null; compatPressed = emptySet(); return }
        pending = desired
        if (!inFlight) dispatchNext()
    }

    /** Solta todos os dedos imediatamente. */
    fun releaseAll() = submit(emptyMap())

    private fun dispatchNext() {
        val desired = pending ?: return
        pending = null

        val builder = GestureDescription.Builder()
        val next = HashMap<String, ActiveStroke>()
        var strokes = 0
        var restartLater = false

        // 1) Dedos ja pressionados: continuam (movendo) ou levantam.
        for ((id, a) in active) {
            val d = desired[id]
            val keep = d != null && d.generation == a.generation && !(compatButtonTaps && d.isButton)
            val tx = if (keep) d!!.x else a.x
            val ty = if (keep) d!!.y else a.y
            val path = Path().apply { moveTo(a.x, a.y); lineTo(tx, ty) }
            val stroke = try {
                a.stroke.continueStroke(path, 0, SEGMENT_MS, keep)
            } catch (e: Exception) {
                lastError = "continueStroke: ${e.message}"; null
            } ?: continue
            builder.addStroke(stroke); strokes++
            if (keep) next[id] = ActiveStroke(a.generation, tx, ty, stroke)
            else if (d != null) restartLater = true // mesma id com nova geracao: toca de novo no proximo ciclo
        }

        // 2) Novos dedos.
        val nowPressed = HashSet<String>()
        for ((id, d) in desired) {
            if (compatButtonTaps && d.isButton) {
                nowPressed += id
                if (id in compatPressed || strokes >= maxStrokes) continue
                val tap = try {
                    GestureDescription.StrokeDescription(Path().apply { moveTo(d.x, d.y) }, 0, COMPAT_TAP_MS, false)
                } catch (e: Exception) { lastError = "tap: ${e.message}"; null } ?: continue
                builder.addStroke(tap); strokes++
                continue
            }
            if (active.containsKey(id)) continue
            if (strokes >= maxStrokes) break
            val path = Path().apply { moveTo(d.downX, d.downY); lineTo(d.x, d.y) }
            val stroke = try {
                GestureDescription.StrokeDescription(path, 0, SEGMENT_MS, true)
            } catch (e: Exception) {
                lastError = "StrokeDescription: ${e.message}"; null
            } ?: continue
            builder.addStroke(stroke); strokes++
            next[id] = ActiveStroke(d.generation, d.x, d.y, stroke)
        }

        compatPressed = nowPressed
        if (strokes == 0) { active = HashMap(); return }

        val gesture = try { builder.build() } catch (e: Exception) {
            lastError = "build: ${e.message}"; active = HashMap(); return
        }
        val serial = ++dispatchSerial
        active = next
        inFlight = true
        val accepted = service.dispatchGesture(gesture, object : AccessibilityService.GestureResultCallback() {
            override fun onCompleted(g: GestureDescription?) = onFinished(serial, cancelled = false)
            override fun onCancelled(g: GestureDescription?) = onFinished(serial, cancelled = true)
        }, handler)
        if (!accepted) {
            inFlight = false
            active = HashMap()
            lastError = "dispatchGesture recusado pelo sistema"
            Log.w(TAG, lastError!!)
            return
        }
        gesturesDispatched++
        if (restartLater && pending == null) pending = desired
    }

    /**
     * Toque de teste isolado (diagnostico). Com [hold], usa o mesmo mecanismo de toque mantido
     * (continueStroke) dos botoes no modo "segurar".
     */
    fun test(x: Float, y: Float, hold: Boolean, onResult: (Boolean) -> Unit) {
        val path = Path().apply { moveTo(x, y) }
        fun send(stroke: GestureDescription.StrokeDescription, done: (Boolean) -> Unit) {
            val ok = service.dispatchGesture(GestureDescription.Builder().addStroke(stroke).build(),
                object : AccessibilityService.GestureResultCallback() {
                    override fun onCompleted(g: GestureDescription?) = done(true)
                    override fun onCancelled(g: GestureDescription?) = done(false)
                }, handler)
            if (!ok) done(false)
        }
        try {
            if (!hold) {
                send(GestureDescription.StrokeDescription(path, 0, 60, false), onResult)
            } else {
                val first = GestureDescription.StrokeDescription(path, 0, 80, true)
                send(first) { ok ->
                    if (!ok) onResult(false)
                    else send(first.continueStroke(Path().apply { moveTo(x, y) }, 0, 80, false), onResult)
                }
            }
        } catch (e: Exception) {
            lastError = "teste: ${e.message}"
            onResult(false)
        }
    }

    private fun onFinished(serial: Int, cancelled: Boolean) {
        if (serial != dispatchSerial) return
        inFlight = false
        if (cancelled) {
            // Gesto cancelado (ex.: usuario tocou a tela, troca de janela): todos os dedos sairam.
            active = HashMap()
            lastError = "gesto cancelado pelo sistema"
            if (pending == null) {
                handler.postDelayed({ onCancelled?.invoke() }, RETRY_AFTER_CANCEL_MS)
                return
            }
        }
        if (pending != null) dispatchNext()
    }

    companion object {
        private const val TAG = "GestureEngine"
        /** Duracao de cada segmento do gesto (ms). */
        const val SEGMENT_MS = 16L
        const val RETRY_AFTER_CANCEL_MS = 120L
        const val COMPAT_TAP_MS = 50L
    }
}
