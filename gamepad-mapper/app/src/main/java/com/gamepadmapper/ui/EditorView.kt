package com.gamepadmapper.ui

import android.content.Context
import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.DashPathEffect
import android.graphics.Paint
import android.graphics.Rect
import android.graphics.RectF
import android.util.AttributeSet
import android.view.MotionEvent
import android.view.ScaleGestureDetector
import android.view.View
import com.gamepadmapper.input.ControllerState
import com.gamepadmapper.profile.ButtonMode
import com.gamepadmapper.profile.ElementType
import com.gamepadmapper.profile.MappingElement
import com.gamepadmapper.profile.StickMode
import com.gamepadmapper.touch.StickMath
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min

/**
 * Tela de edicao: mostra os botoes virtuais e zonas de analogico sobre a imagem do jogo.
 * Toque seleciona, arrastar move, alca/pinca redimensiona. Coordenadas normalizadas (0..1).
 */
class EditorView @JvmOverloads constructor(ctx: Context, attrs: AttributeSet? = null) : View(ctx, attrs) {

    interface Listener {
        fun onSelectionChanged(element: MappingElement?)
        fun onElementsChanged()
    }

    var listener: Listener? = null
    private val elements = ArrayList<MappingElement>()
    var selectedId: String? = null
        private set
    var backgroundBitmap: Bitmap? = null
        set(value) { field = value; invalidate() }
    var liveState: ControllerState? = null
        set(value) { field = value; invalidate() }

    private val density = resources.displayMetrics.density
    private val neon = 0xFF00D4FF.toInt()
    private val purple = 0xFF7C4DFF.toInt()
    private val gridPaint = Paint().apply { color = 0x1400D4FF; strokeWidth = 1f }
    private val fillPaint = Paint(Paint.ANTI_ALIAS_FLAG)
    private val strokePaint = Paint(Paint.ANTI_ALIAS_FLAG).apply { style = Paint.Style.STROKE; strokeWidth = 2.5f * density }
    private val dashPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        style = Paint.Style.STROKE; strokeWidth = 2f * density; color = neon
        pathEffect = DashPathEffect(floatArrayOf(10f * density, 6f * density), 0f)
    }
    private val textPaint = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFFFFFFFF.toInt(); textAlign = Paint.Align.CENTER; isFakeBoldText = true
    }
    private val smallText = Paint(Paint.ANTI_ALIAS_FLAG).apply {
        color = 0xFFB8D8FF.toInt(); textAlign = Paint.Align.CENTER; textSize = 10f * density
    }
    private val handleRadius = 14f * density

    private enum class Drag { NONE, MOVE, RESIZE }
    private var drag = Drag.NONE
    private var dragDx = 0f
    private var dragDy = 0f
    private var changedDuringGesture = false

    private val scaleDetector = ScaleGestureDetector(ctx, object : ScaleGestureDetector.SimpleOnScaleGestureListener() {
        override fun onScale(detector: ScaleGestureDetector): Boolean {
            val e = selected() ?: return false
            replace(e.copy(size = (e.size * detector.scaleFactor).coerceIn(MappingElement.MIN_SIZE, MappingElement.MAX_SIZE)))
            drag = Drag.NONE
            changedDuringGesture = true
            return true
        }
    })

    fun setElements(list: List<MappingElement>) {
        elements.clear(); elements.addAll(list); invalidate()
    }

    fun getElements(): List<MappingElement> = ArrayList(elements)

    fun selected(): MappingElement? = elements.firstOrNull { it.id == selectedId }

    fun select(id: String?) {
        selectedId = id
        listener?.onSelectionChanged(selected())
        invalidate()
    }

    /** Substitui um elemento (mesmo id) e notifica alteracao. */
    fun replace(e: MappingElement) {
        val i = elements.indexOfFirst { it.id == e.id }
        if (i >= 0) elements[i] = e else elements += e
        invalidate()
        listener?.onElementsChanged()
    }

    fun add(e: MappingElement) {
        elements += e
        select(e.id)
        listener?.onElementsChanged()
    }

    fun remove(id: String) {
        elements.removeAll { it.id == id }
        if (selectedId == id) select(null)
        invalidate()
        listener?.onElementsChanged()
    }

    private fun minSide() = min(width, height).toFloat()
    private fun cx(e: MappingElement) = e.x * width
    private fun cy(e: MappingElement) = e.y * height
    private fun radius(e: MappingElement) = e.size * minSide() / 2f
    private fun handlePos(e: MappingElement): Pair<Float, Float> {
        val r = radius(e) * 0.7071f
        return (cx(e) + r) to (cy(e) + r)
    }

    override fun onDraw(canvas: Canvas) {
        val bg = backgroundBitmap
        if (bg != null) {
            // center-crop para preencher a tela como o jogo faria
            val scale = max(width / bg.width.toFloat(), height / bg.height.toFloat())
            val sw = width / scale; val sh = height / scale
            val src = Rect(((bg.width - sw) / 2).toInt(), ((bg.height - sh) / 2).toInt(),
                ((bg.width + sw) / 2).toInt(), ((bg.height + sh) / 2).toInt())
            canvas.drawBitmap(bg, src, RectF(0f, 0f, width.toFloat(), height.toFloat()), null)
            canvas.drawColor(0x55000000)
        } else {
            val step = 32f * density
            var x = 0f
            while (x < width) { canvas.drawLine(x, 0f, x, height.toFloat(), gridPaint); x += step }
            var y = 0f
            while (y < height) { canvas.drawLine(0f, y, width.toFloat(), y, gridPaint); y += step }
        }
        for (e in elements) drawElement(canvas, e)
    }

    private fun drawElement(c: Canvas, e: MappingElement) {
        val x = cx(e); val y = cy(e); val r = radius(e)
        val sel = e.id == selectedId
        val state = liveState
        when (e.type) {
            ElementType.BUTTON -> {
                val pressed = e.input != null && state?.isPressed(e.input) == true
                fillPaint.color = if (pressed) 0xCC00D4FF.toInt() else 0x6600D4FF
                c.drawCircle(x, y, r, fillPaint)
                strokePaint.color = if (sel) 0xFFFFFFFF.toInt() else neon
                c.drawCircle(x, y, r, strokePaint)
                textPaint.textSize = max(12f * density, r * 0.7f)
                c.drawText(e.shortLabel, x, y + textPaint.textSize / 3, textPaint)
                val modeTag = when (e.buttonMode) { ButtonMode.HOLD -> null; ButtonMode.TAP -> "toque"; ButtonMode.TOGGLE -> "alternar" }
                modeTag?.let { c.drawText(it, x, y + r + 12f * density, smallText) }
            }
            ElementType.STICK -> {
                fillPaint.color = 0x2200D4FF
                c.drawCircle(x, y, r, fillPaint)
                strokePaint.color = if (sel) 0xFFFFFFFF.toInt() else neon
                c.drawCircle(x, y, r, if (sel) strokePaint else dashPaint)
                // zona morta
                fillPaint.color = 0x337C4DFF
                c.drawCircle(x, y, r * e.deadzone, fillPaint)
                var kx = x; var ky = y
                if (state != null && e.stick != null) {
                    val (sx, sy0) = state.stick(e.stick)
                    val sy = if (e.invertY) -sy0 else sy0
                    val (dx, dy) = StickMath.applyDeadzone(sx, sy, e.deadzone)
                    val (gx, gy) = StickMath.applySensitivity(dx, dy, e.sensitivity)
                    kx += gx * r; ky += gy * r
                }
                fillPaint.color = if (kx != x || ky != y) neon else purple
                c.drawCircle(kx, ky, r * 0.3f, fillPaint)
                textPaint.textSize = max(12f * density, r * 0.25f)
                c.drawText(e.shortLabel, kx, ky + textPaint.textSize / 3, textPaint)
                val tag = if (e.stickMode == StickMode.CAMERA) "câmera" else "joystick"
                c.drawText(tag, x, y + r + 12f * density, smallText)
            }
        }
        if (sel) {
            val (hx, hy) = handlePos(e)
            fillPaint.color = 0xFFFFFFFF.toInt()
            c.drawCircle(hx, hy, handleRadius * 0.75f, fillPaint)
            fillPaint.color = neon
            c.drawCircle(hx, hy, handleRadius * 0.45f, fillPaint)
        }
    }

    override fun onTouchEvent(event: MotionEvent): Boolean {
        scaleDetector.onTouchEvent(event)
        if (scaleDetector.isInProgress) return true
        when (event.actionMasked) {
            MotionEvent.ACTION_DOWN -> {
                changedDuringGesture = false
                val sel = selected()
                if (sel != null) {
                    val (hx, hy) = handlePos(sel)
                    if (hypot(event.x - hx, event.y - hy) <= handleRadius * 1.6f) {
                        drag = Drag.RESIZE; return true
                    }
                }
                val hit = elements.lastOrNull { hypot(event.x - cx(it), event.y - cy(it)) <= max(radius(it), 24f * density) }
                if (hit != null) {
                    if (hit.id != selectedId) select(hit.id)
                    drag = Drag.MOVE
                    dragDx = event.x - cx(hit); dragDy = event.y - cy(hit)
                } else {
                    drag = Drag.NONE
                    select(null)
                }
                return true
            }
            MotionEvent.ACTION_MOVE -> {
                val e = selected() ?: return true
                when (drag) {
                    Drag.MOVE -> {
                        val nx = ((event.x - dragDx) / width).coerceIn(0f, 1f)
                        val ny = ((event.y - dragDy) / height).coerceIn(0f, 1f)
                        replaceQuiet(e.copy(x = nx, y = ny))
                    }
                    Drag.RESIZE -> {
                        val d = hypot(event.x - cx(e), event.y - cy(e))
                        val size = (2f * d / minSide()).coerceIn(MappingElement.MIN_SIZE, MappingElement.MAX_SIZE)
                        replaceQuiet(e.copy(size = size))
                    }
                    Drag.NONE -> {}
                }
                return true
            }
            MotionEvent.ACTION_UP, MotionEvent.ACTION_CANCEL -> {
                drag = Drag.NONE
                if (changedDuringGesture) {
                    listener?.onElementsChanged()
                    listener?.onSelectionChanged(selected())
                }
                if (event.actionMasked == MotionEvent.ACTION_UP) performClick()
                return true
            }
        }
        return true
    }

    override fun performClick(): Boolean = super.performClick()

    private fun replaceQuiet(e: MappingElement) {
        val i = elements.indexOfFirst { it.id == e.id }
        if (i >= 0) elements[i] = e
        changedDuringGesture = true
        invalidate()
    }
}
