package com.gamepadmapper.ui

import android.app.Activity
import android.app.AlertDialog
import android.content.Intent
import android.graphics.drawable.Drawable
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.BaseAdapter
import android.widget.Button
import android.widget.CheckBox
import android.widget.EditText
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.RadioButton
import android.widget.SeekBar
import android.widget.TextView
import android.widget.Toast
import com.gamepadmapper.R
import com.gamepadmapper.profile.Profile
import com.gamepadmapper.profile.ProfileRepository
import com.gamepadmapper.profile.ScreenOrientation
import com.gamepadmapper.settings.AppSettings

/** Dialogos de criacao/edicao de perfil e seletor de jogos instalados. */
object ProfileForm {

    data class AppEntry(val label: String, val packageName: String, val icon: Drawable?)

    fun showCreate(activity: Activity, onCreated: (Profile) -> Unit) = show(activity, null, onCreated)

    fun showEdit(activity: Activity, profile: Profile, onSaved: (Profile) -> Unit) = show(activity, profile, onSaved)

    private fun show(activity: Activity, existing: Profile?, onDone: (Profile) -> Unit) {
        val view = LayoutInflater.from(activity).inflate(R.layout.dialog_profile_form, null)
        val name = view.findViewById<EditText>(R.id.formName)
        val pick = view.findViewById<Button>(R.id.formPickGame)
        val landscape = view.findViewById<RadioButton>(R.id.formLandscape)
        val portrait = view.findViewById<RadioButton>(R.id.formPortrait)
        val sensLabel = view.findViewById<TextView>(R.id.formSensLabel)
        val sens = view.findViewById<SeekBar>(R.id.formSens)
        val template = view.findViewById<CheckBox>(R.id.formTemplate)

        var pkg: String? = existing?.packageName
        var appLabel: String? = existing?.appLabel
        fun updatePick() { pick.text = appLabel?.let { "JOGO: $it" } ?: "ESCOLHER JOGO INSTALADO (opcional)" }
        updatePick()

        name.setText(existing?.name ?: "")
        if ((existing?.orientation ?: ScreenOrientation.LANDSCAPE) == ScreenOrientation.LANDSCAPE) landscape.isChecked = true
        else portrait.isChecked = true
        val initialSens = existing?.globalSensitivity ?: 1f
        sens.progress = ((initialSens - 0.1f) * 100).toInt().coerceIn(0, 290)
        fun updateSens() { sensLabel.text = String.format("Sensibilidade geral do perfil: %.2fx", 0.1f + sens.progress / 100f) }
        updateSens()
        sens.setOnSeekBarChangeListener(SimpleSeek { updateSens() })
        template.visibility = if (existing == null) View.VISIBLE else View.GONE

        pick.setOnClickListener {
            pickApp(activity) { entry ->
                pkg = entry?.packageName; appLabel = entry?.label
                if (entry != null && name.text.isBlank()) name.setText(entry.label)
                updatePick()
            }
        }

        val dialog = AlertDialog.Builder(activity)
            .setTitle(if (existing == null) "Novo mapeamento" else "Configurações do perfil")
            .setView(view)
            .setPositiveButton(if (existing == null) "Criar e editar" else "Salvar", null)
            .setNegativeButton(R.string.dialog_cancel, null)
            .create()
        dialog.setOnShowListener {
            dialog.getButton(AlertDialog.BUTTON_POSITIVE).setOnClickListener {
                val n = name.text.toString().trim()
                if (n.isEmpty()) { name.error = "Informe um nome"; return@setOnClickListener }
                val repo = ProfileRepository.get(activity)
                val settings = AppSettings.get(activity)
                val orientation = if (portrait.isChecked) ScreenOrientation.PORTRAIT else ScreenOrientation.LANDSCAPE
                val gs = 0.1f + sens.progress / 100f
                val saved = if (existing == null) {
                    val elements = if (template.isChecked) {
                        val base = Profile.defaultElements(settings.defaultDeadzone, settings.defaultSensitivity)
                        if (orientation == ScreenOrientation.PORTRAIT) base.map { it.copy(x = it.x, y = 0.55f + it.y * 0.45f) } else base
                    } else emptyList()
                    val p = repo.save(Profile(name = n, packageName = pkg, appLabel = appLabel,
                        orientation = orientation, globalSensitivity = gs, elements = elements))
                    if (repo.activeProfileId == null) repo.activeProfileId = p.id
                    p
                } else {
                    repo.save(existing.copy(name = n, packageName = pkg, appLabel = appLabel,
                        orientation = orientation, globalSensitivity = gs))
                }
                dialog.dismiss()
                onDone(saved)
            }
        }
        dialog.show()
    }

    fun loadLaunchableApps(activity: Activity): List<AppEntry> {
        val pm = activity.packageManager
        val intent = Intent(Intent.ACTION_MAIN).addCategory(Intent.CATEGORY_LAUNCHER)
        return pm.queryIntentActivities(intent, 0)
            .filter { it.activityInfo.packageName != activity.packageName }
            .map { AppEntry(it.loadLabel(pm).toString(), it.activityInfo.packageName, runCatching { it.loadIcon(pm) }.getOrNull()) }
            .distinctBy { it.packageName }
            .sortedBy { it.label.lowercase() }
    }

    /** Seletor de app instalado. Retorna null em "Nenhum (sem vínculo)". */
    fun pickApp(activity: Activity, onPicked: (AppEntry?) -> Unit) {
        val apps = loadLaunchableApps(activity)
        if (apps.isEmpty()) {
            Toast.makeText(activity, "Nenhum app encontrado", Toast.LENGTH_SHORT).show(); return
        }
        val items = listOf<AppEntry?>(null) + apps
        val density = activity.resources.displayMetrics.density
        val adapter = object : BaseAdapter() {
            override fun getCount() = items.size
            override fun getItem(position: Int) = items[position]
            override fun getItemId(position: Int) = position.toLong()
            override fun getView(position: Int, convertView: View?, parent: ViewGroup?): View {
                val row = (convertView as? LinearLayout) ?: LinearLayout(activity).apply {
                    orientation = LinearLayout.HORIZONTAL
                    val p = (12 * density).toInt(); setPadding(p * 2, p, p, p)
                    gravity = android.view.Gravity.CENTER_VERTICAL
                    addView(ImageView(activity), LinearLayout.LayoutParams((36 * density).toInt(), (36 * density).toInt()))
                    addView(TextView(activity).apply {
                        textSize = 16f; setTextColor(activity.getColor(R.color.text_primary))
                        setPadding((14 * density).toInt(), 0, 0, 0)
                    })
                }
                val e = items[position]
                (row.getChildAt(0) as ImageView).setImageDrawable(e?.icon)
                (row.getChildAt(1) as TextView).text = e?.label ?: "Nenhum (sem vínculo)"
                return row
            }
        }
        AlertDialog.Builder(activity)
            .setTitle("Escolha o jogo")
            .setAdapter(adapter) { _, which -> onPicked(items[which]) }
            .setNegativeButton(R.string.dialog_cancel, null)
            .show()
    }
}

/** Listener de SeekBar que so reage a mudancas. */
class SimpleSeek(private val onChange: (fromUser: Boolean) -> Unit) : SeekBar.OnSeekBarChangeListener {
    override fun onProgressChanged(seekBar: SeekBar?, progress: Int, fromUser: Boolean) = onChange(fromUser)
    override fun onStartTrackingTouch(seekBar: SeekBar?) {}
    override fun onStopTrackingTouch(seekBar: SeekBar?) {}
}
