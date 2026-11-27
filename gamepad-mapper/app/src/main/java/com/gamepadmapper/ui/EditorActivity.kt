package com.gamepadmapper.ui

import android.app.AlertDialog
import android.content.Context
import android.content.Intent
import android.content.pm.ActivityInfo
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.View
import android.view.WindowInsets
import android.view.WindowInsetsController
import android.widget.Button
import android.widget.SeekBar
import android.widget.Switch
import android.widget.TextView
import android.widget.Toast
import com.gamepadmapper.R
import com.gamepadmapper.input.PhysicalInput
import com.gamepadmapper.input.StickSource
import com.gamepadmapper.profile.ButtonMode
import com.gamepadmapper.profile.ElementType
import com.gamepadmapper.profile.MappingElement
import com.gamepadmapper.profile.Profile
import com.gamepadmapper.profile.ProfileRepository
import com.gamepadmapper.profile.ScreenOrientation
import com.gamepadmapper.profile.StickMode
import com.gamepadmapper.settings.AppSettings
import kotlin.math.abs
import kotlin.math.hypot

/** Editor visual de mapeamento (tela cheia, na orientacao do jogo). */
class EditorActivity : BaseActivity(), EditorView.Listener {
    private lateinit var repo: ProfileRepository
    private lateinit var profile: Profile
    private lateinit var editor: EditorView
    private var dirty = false
    private var bindingFor: String? = null
    private var updatingPanel = false

    override val consumesGamepad = true

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        repo = ProfileRepository.get(this)
        val p = repo.get(intent.getStringExtra(EXTRA_PROFILE_ID))
        if (p == null) {
            Toast.makeText(this, "Perfil não encontrado", Toast.LENGTH_SHORT).show(); finish(); return
        }
        profile = p
        requestedOrientation = if (p.orientation == ScreenOrientation.PORTRAIT)
            ActivityInfo.SCREEN_ORIENTATION_SENSOR_PORTRAIT else ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        if (Build.VERSION.SDK_INT >= 28) {
            // Usa tambem a area do recorte da camera, como os jogos em tela cheia fazem,
            // para que as coordenadas do editor coincidam com as da tela real.
            window.attributes = window.attributes.apply {
                layoutInDisplayCutoutMode = android.view.WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES
            }
        }
        setContentView(R.layout.activity_editor)
        enterImmersive()

        editor = findViewById(R.id.editorView)
        editor.listener = this
        editor.setElements(savedInstanceState?.getString(STATE_ELEMENTS)?.let { restoreElements(it) } ?: p.elements)
        dirty = savedInstanceState?.getBoolean(STATE_DIRTY) ?: false
        loadBackground(p.backgroundUri)

        findViewById<Button>(R.id.btnAddButton).setOnClickListener { addButtonDialog() }
        findViewById<Button>(R.id.btnAddStick).setOnClickListener { addStickDialog() }
        findViewById<Button>(R.id.btnBackground).setOnClickListener { backgroundDialog() }
        findViewById<Button>(R.id.btnSave).setOnClickListener { save() }
        findViewById<Button>(R.id.btnExit).setOnClickListener { attemptExit() }
        findViewById<Button>(R.id.btnHideToolbar).setOnClickListener { setToolbarVisible(false) }
        findViewById<Button>(R.id.btnShowToolbar).setOnClickListener { setToolbarVisible(true) }
        setupPanel()
    }

    override fun onSaveInstanceState(outState: Bundle) {
        super.onSaveInstanceState(outState)
        if (!::editor.isInitialized) return
        val tmp = profile.copy(elements = editor.getElements())
        outState.putString(STATE_ELEMENTS, com.gamepadmapper.profile.ProfileJson.toJson(tmp).toString())
        outState.putBoolean(STATE_DIRTY, dirty)
    }

    private fun restoreElements(json: String): List<MappingElement>? = runCatching {
        com.gamepadmapper.profile.ProfileJson.fromJson(org.json.JSONObject(json)).elements
    }.getOrNull()

    override fun onWindowFocusChanged(hasFocus: Boolean) {
        super.onWindowFocusChanged(hasFocus)
        if (hasFocus) enterImmersive()
    }

    @Suppress("DEPRECATION")
    private fun enterImmersive() {
        if (Build.VERSION.SDK_INT >= 30) {
            window.insetsController?.let {
                it.hide(WindowInsets.Type.systemBars())
                it.systemBarsBehavior = WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
            }
        } else {
            window.decorView.systemUiVisibility = (View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY or
                View.SYSTEM_UI_FLAG_FULLSCREEN or View.SYSTEM_UI_FLAG_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_LAYOUT_STABLE or View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION or
                View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN)
        }
    }

    private fun setToolbarVisible(visible: Boolean) {
        findViewById<View>(R.id.toolbar).visibility = if (visible) View.VISIBLE else View.GONE
        findViewById<View>(R.id.btnShowToolbar).visibility = if (visible) View.GONE else View.VISIBLE
        findViewById<View>(R.id.editorHint).visibility = if (visible && editor.selected() == null) View.VISIBLE else View.GONE
    }

    // ------------------------------------------------------------------ adicionar elementos

    private fun addButtonDialog() {
        val inputs = PhysicalInput.entries
        val labels = arrayOf("🎮 Detectar pressionando no controle") + inputs.map { it.label }.toTypedArray()
        AlertDialog.Builder(this)
            .setTitle("Novo botão virtual")
            .setItems(labels) { _, which ->
                val input = if (which == 0) PhysicalInput.A else inputs[which - 1]
                val e = MappingElement(type = ElementType.BUTTON, x = 0.5f, y = 0.5f, size = 0.13f, input = input)
                editor.add(e)
                if (which == 0) startBinding(e.id)
            }
            .setNegativeButton(R.string.dialog_cancel, null)
            .show()
    }

    private fun addStickDialog() {
        val sources = StickSource.entries
        val settings = AppSettings.get(this)
        AlertDialog.Builder(this)
            .setTitle("Nova zona de analógico")
            .setItems(sources.map { it.label }.toTypedArray()) { _, which ->
                val src = sources[which]
                val e = MappingElement(
                    type = ElementType.STICK,
                    x = if (src == StickSource.RIGHT) 0.65f else 0.2f, y = 0.65f, size = 0.35f,
                    stick = src,
                    stickMode = if (src == StickSource.RIGHT) StickMode.CAMERA else StickMode.JOYSTICK,
                    deadzone = settings.defaultDeadzone, sensitivity = settings.defaultSensitivity,
                )
                editor.add(e)
            }
            .setNegativeButton(R.string.dialog_cancel, null)
            .show()
    }

    // ------------------------------------------------------------------ painel de propriedades

    private lateinit var propTitle: TextView
    private lateinit var propBind: Button
    private lateinit var propMode: Button
    private lateinit var propSizeLabel: TextView
    private lateinit var propSize: SeekBar
    private lateinit var propSensLabel: TextView
    private lateinit var propSens: SeekBar
    private lateinit var propDzLabel: TextView
    private lateinit var propDz: SeekBar
    private lateinit var propInvert: Switch

    private fun setupPanel() {
        propTitle = findViewById(R.id.propTitle)
        propBind = findViewById(R.id.propBind)
        propMode = findViewById(R.id.propMode)
        propSizeLabel = findViewById(R.id.propSizeLabel)
        propSize = findViewById(R.id.propSize)
        propSensLabel = findViewById(R.id.propSensLabel)
        propSens = findViewById(R.id.propSens)
        propDzLabel = findViewById(R.id.propDeadzoneLabel)
        propDz = findViewById(R.id.propDeadzone)
        propInvert = findViewById(R.id.propInvertY)

        propBind.setOnClickListener { editor.selected()?.let { showBindOptions(it) } }
        propMode.setOnClickListener { editor.selected()?.let { showModeDialog(it) } }
        propSize.setOnSeekBarChangeListener(SimpleSeek { fromUser ->
            if (fromUser && !updatingPanel) editor.selected()?.let { editor.replace(it.copy(size = (4 + propSize.progress) / 100f)) }
        })
        propSens.setOnSeekBarChangeListener(SimpleSeek { fromUser ->
            if (fromUser && !updatingPanel) editor.selected()?.let { editor.replace(it.copy(sensitivity = 0.1f + propSens.progress / 100f)) }
        })
        propDz.setOnSeekBarChangeListener(SimpleSeek { fromUser ->
            if (fromUser && !updatingPanel) editor.selected()?.let { editor.replace(it.copy(deadzone = propDz.progress / 100f)) }
        })
        propInvert.setOnCheckedChangeListener { _, checked ->
            if (!updatingPanel) editor.selected()?.let { editor.replace(it.copy(invertY = checked)) }
        }
        findViewById<Button>(R.id.propDelete).setOnClickListener { editor.selected()?.let { editor.remove(it.id) } }
        findViewById<Button>(R.id.propDuplicate).setOnClickListener {
            editor.selected()?.let {
                editor.add(it.copy(id = MappingElement.newId(), x = (it.x + 0.05f).coerceAtMost(1f), y = (it.y + 0.05f).coerceAtMost(1f)))
            }
        }
        findViewById<Button>(R.id.propClose).setOnClickListener { editor.select(null) }
        onSelectionChanged(null)
    }

    private fun showBindOptions(e: MappingElement) {
        if (e.type == ElementType.BUTTON) {
            val inputs = PhysicalInput.entries
            val labels = arrayOf("🎮 Detectar pressionando no controle") + inputs.map { it.label }.toTypedArray()
            AlertDialog.Builder(this).setTitle("Botão físico")
                .setItems(labels) { _, which ->
                    if (which == 0) startBinding(e.id) else editor.replace(e.copy(input = inputs[which - 1]))
                }.show()
        } else {
            val sources = StickSource.entries
            val labels = arrayOf("🎮 Detectar movendo no controle") + sources.map { it.label }.toTypedArray()
            AlertDialog.Builder(this).setTitle("Analógico físico")
                .setItems(labels) { _, which ->
                    if (which == 0) startBinding(e.id) else editor.replace(e.copy(stick = sources[which - 1]))
                }.show()
        }
    }

    private fun showModeDialog(e: MappingElement) {
        if (e.type == ElementType.BUTTON) {
            val modes = ButtonMode.entries
            AlertDialog.Builder(this).setTitle("Modo do botão")
                .setSingleChoiceItems(modes.map { it.label }.toTypedArray(), modes.indexOf(e.buttonMode)) { d, which ->
                    editor.replace(e.copy(buttonMode = modes[which])); d.dismiss()
                }.show()
        } else {
            val modes = StickMode.entries
            AlertDialog.Builder(this).setTitle("Modo do analógico")
                .setSingleChoiceItems(modes.map { it.label }.toTypedArray(), modes.indexOf(e.stickMode)) { d, which ->
                    editor.replace(e.copy(stickMode = modes[which])); d.dismiss()
                }.show()
        }
    }

    private fun startBinding(id: String) {
        bindingFor = id
        padState.reset()
        Toast.makeText(this, R.string.editor_bind_wait, Toast.LENGTH_LONG).show()
        refreshPanel()
    }

    override fun onSelectionChanged(element: MappingElement?) {
        if (element?.id != bindingFor) bindingFor = null
        val panel = findViewById<View>(R.id.propsPanel)
        panel.visibility = if (element == null) View.GONE else View.VISIBLE
        val toolbarVisible = findViewById<View>(R.id.toolbar).visibility == View.VISIBLE
        findViewById<View>(R.id.editorHint).visibility = if (element == null && toolbarVisible) View.VISIBLE else View.GONE
        refreshPanel()
    }

    override fun onElementsChanged() {
        dirty = true
        refreshPanel()
    }

    private fun refreshPanel() {
        val e = editor.selected() ?: return
        updatingPanel = true
        val isStick = e.type == ElementType.STICK
        propTitle.text = if (isStick) "Analógico: ${e.stick?.label}" else "Botão virtual: ${e.input?.label}"
        propBind.text = if (bindingFor == e.id) getString(R.string.editor_bind_wait)
        else if (isStick) "ANALÓGICO: ${e.stick?.label ?: "?"}" else "BOTÃO FÍSICO: ${e.input?.label ?: "?"}"
        propMode.text = "MODO: " + if (isStick) e.stickMode.label.substringBefore(" (") else e.buttonMode.label.substringBefore(" (")
        propSize.progress = (e.size * 100 - 4).toInt().coerceIn(0, 56)
        propSizeLabel.text = getString(R.string.editor_size, (e.size * 100).toInt())
        findViewById<View>(R.id.stickProps).visibility = if (isStick) View.VISIBLE else View.GONE
        propSens.progress = ((e.sensitivity - 0.1f) * 100).toInt().coerceIn(0, 290)
        propSensLabel.text = getString(R.string.editor_sensitivity, e.sensitivity)
        propDz.progress = (e.deadzone * 100).toInt().coerceIn(0, 90)
        propDzLabel.text = getString(R.string.editor_deadzone, (e.deadzone * 100).toInt())
        propInvert.isChecked = e.invertY
        updatingPanel = false
    }

    // ------------------------------------------------------------------ controle fisico no editor

    override fun onGamepadInput(input: PhysicalInput?, rawKeyCode: Int?, event: Any) {
        editor.liveState = padState.copy()
        val id = bindingFor ?: return
        val e = editor.getElements().firstOrNull { it.id == id } ?: run { bindingFor = null; return }
        if (e.type == ElementType.BUTTON) {
            val detected = input?.takeIf { padState.isPressed(it) }
                ?: when {
                    padState.lt > 0.6f -> PhysicalInput.L2
                    padState.rt > 0.6f -> PhysicalInput.R2
                    padState.hatY < -0.5f -> PhysicalInput.DPAD_UP
                    padState.hatY > 0.5f -> PhysicalInput.DPAD_DOWN
                    padState.hatX < -0.5f -> PhysicalInput.DPAD_LEFT
                    padState.hatX > 0.5f -> PhysicalInput.DPAD_RIGHT
                    else -> null
                }
            if (detected != null) finishBinding(e.copy(input = detected), detected.label)
        } else {
            val src = when {
                hypot(padState.lx, padState.ly) > 0.6f -> StickSource.LEFT
                hypot(padState.rx, padState.ry) > 0.6f -> StickSource.RIGHT
                input?.isDpad == true || abs(padState.hatX) > 0.5f || abs(padState.hatY) > 0.5f -> StickSource.DPAD
                else -> null
            }
            if (src != null) finishBinding(e.copy(stick = src), src.label)
        }
    }

    private fun finishBinding(updated: MappingElement, label: String) {
        bindingFor = null
        editor.replace(updated)
        Toast.makeText(this, "Associado: $label", Toast.LENGTH_SHORT).show()
    }

    // ------------------------------------------------------------------ fundo (captura do jogo)

    private fun backgroundDialog() {
        val opts = mutableListOf("Escolher captura de tela do jogo")
        if (profile.backgroundUri != null) opts += "Remover fundo"
        AlertDialog.Builder(this).setTitle("Imagem de fundo")
            .setItems(opts.toTypedArray()) { _, which ->
                if (which == 0) {
                    val i = Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE).setType("image/*")
                    startActivityForResult(i, REQ_BACKGROUND)
                } else {
                    profile = profile.copy(backgroundUri = null); dirty = true
                    editor.backgroundBitmap = null
                }
            }.show()
    }

    @Deprecated("Activity framework API")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        if (requestCode != REQ_BACKGROUND || resultCode != RESULT_OK) return
        val uri = data?.data ?: return
        runCatching { contentResolver.takePersistableUriPermission(uri, Intent.FLAG_GRANT_READ_URI_PERMISSION) }
        profile = profile.copy(backgroundUri = uri.toString())
        dirty = true
        loadBackground(uri.toString())
    }

    private fun loadBackground(uriString: String?) {
        if (uriString == null) { editor.backgroundBitmap = null; return }
        val bmp: Bitmap? = runCatching {
            val uri = Uri.parse(uriString)
            val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
            contentResolver.openInputStream(uri)?.use { BitmapFactory.decodeStream(it, null, bounds) }
            val maxSide = maxOf(resources.displayMetrics.widthPixels, resources.displayMetrics.heightPixels)
            var sample = 1
            while (maxOf(bounds.outWidth, bounds.outHeight) / (sample * 2) >= maxSide) sample *= 2
            contentResolver.openInputStream(uri)?.use {
                BitmapFactory.decodeStream(it, null, BitmapFactory.Options().apply { inSampleSize = sample })
            }
        }.getOrNull()
        if (bmp == null) Toast.makeText(this, "Não foi possível abrir a imagem de fundo", Toast.LENGTH_SHORT).show()
        editor.backgroundBitmap = bmp
    }

    // ------------------------------------------------------------------ salvar / sair

    private fun save() {
        profile = repo.save(profile.copy(elements = editor.getElements()))
        dirty = false
        Toast.makeText(this, R.string.editor_saved, Toast.LENGTH_SHORT).show()
    }

    private fun attemptExit() {
        if (!dirty) { finish(); return }
        AlertDialog.Builder(this)
            .setTitle(R.string.editor_unsaved_title)
            .setMessage(R.string.editor_unsaved_msg)
            .setPositiveButton(R.string.dialog_save) { _, _ -> save(); finish() }
            .setNegativeButton(R.string.dialog_discard) { _, _ -> finish() }
            .setNeutralButton(R.string.dialog_cancel, null)
            .show()
    }

    @Deprecated("Activity framework API")
    override fun onBackPressed() {
        when {
            bindingFor != null -> { bindingFor = null; refreshPanel() }
            editor.selected() != null -> editor.select(null)
            else -> attemptExit()
        }
    }

    companion object {
        private const val EXTRA_PROFILE_ID = "profile_id"
        private const val STATE_ELEMENTS = "elements"
        private const val STATE_DIRTY = "dirty"
        private const val REQ_BACKGROUND = 20
        fun intent(context: Context, profileId: String) =
            Intent(context, EditorActivity::class.java).putExtra(EXTRA_PROFILE_ID, profileId)
    }
}
