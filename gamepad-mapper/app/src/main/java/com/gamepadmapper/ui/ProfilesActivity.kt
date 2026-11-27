package com.gamepadmapper.ui

import android.app.AlertDialog
import android.content.Intent
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.widget.Button
import android.widget.ImageView
import android.widget.LinearLayout
import android.widget.TextView
import android.widget.Toast
import com.gamepadmapper.R
import com.gamepadmapper.profile.ElementType
import com.gamepadmapper.profile.Profile
import com.gamepadmapper.profile.ProfileRepository

/** "Meus jogos": lista, ativa, edita, duplica, exporta/importa e exclui perfis. */
class ProfilesActivity : BaseActivity() {
    private lateinit var repo: ProfileRepository
    private val listener: () -> Unit = { runOnUiThread { render() } }
    private var exportingId: String? = null

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_profiles)
        bindBackButton()
        repo = ProfileRepository.get(this)
        findViewById<Button>(R.id.btnNewProfile).setOnClickListener {
            ProfileForm.showCreate(this) { startActivity(EditorActivity.intent(this, it.id)) }
        }
        findViewById<Button>(R.id.btnImport).setOnClickListener {
            val i = Intent(Intent.ACTION_OPEN_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                .setType("*/*")
                .putExtra(Intent.EXTRA_MIME_TYPES, arrayOf("application/json", "text/plain", "application/octet-stream"))
            startActivityForResult(i, REQ_IMPORT)
        }
    }

    override fun onResume() {
        super.onResume()
        repo.addListener(listener)
        render()
    }

    override fun onPause() {
        super.onPause()
        repo.removeListener(listener)
    }

    private fun render() {
        val list = repo.list()
        val activeId = repo.activeProfileId
        val container = findViewById<LinearLayout>(R.id.profileList)
        container.removeAllViews()
        findViewById<View>(R.id.profilesEmpty).visibility = if (list.isEmpty()) View.VISIBLE else View.GONE
        val inflater = LayoutInflater.from(this)
        for (p in list) {
            val item = inflater.inflate(R.layout.item_profile, container, false)
            val isActive = p.id == activeId
            item.findViewById<TextView>(R.id.profileName).text = p.name
            val buttons = p.elements.count { it.type == ElementType.BUTTON }
            val sticks = p.elements.count { it.type == ElementType.STICK }
            item.findViewById<TextView>(R.id.profileDetails).text = buildString {
                append(p.appLabel ?: "Sem jogo vinculado")
                append(" · ").append(p.orientation.label)
                append("\n$buttons botões · $sticks analógicos · sens. ").append(String.format("%.2fx", p.globalSensitivity))
            }
            val icon = item.findViewById<ImageView>(R.id.profileIcon)
            p.packageName?.let { pkg -> runCatching { icon.setImageDrawable(packageManager.getApplicationIcon(pkg)) } }
            item.findViewById<View>(R.id.profileBadge).visibility = if (isActive) View.VISIBLE else View.GONE

            val activate = item.findViewById<Button>(R.id.profileActivate)
            activate.text = if (isActive) "DESATIVAR" else getString(R.string.profile_activate)
            activate.setOnClickListener {
                repo.activeProfileId = if (isActive) null else p.id
                Toast.makeText(this, if (isActive) "Perfil desativado" else "Perfil \"${p.name}\" ativado", Toast.LENGTH_SHORT).show()
            }
            item.findViewById<Button>(R.id.profileEdit).setOnClickListener {
                startActivity(EditorActivity.intent(this, p.id))
            }
            val play = item.findViewById<Button>(R.id.profilePlay)
            val launch = p.packageName?.let { packageManager.getLaunchIntentForPackage(it) }
            play.isEnabled = launch != null
            play.alpha = if (launch != null) 1f else 0.4f
            play.setOnClickListener {
                if (launch == null) return@setOnClickListener
                repo.activeProfileId = p.id
                startActivity(launch)
            }
            item.findViewById<Button>(R.id.profileMore).setOnClickListener { showMore(p) }
            container.addView(item)
        }
    }

    private fun showMore(p: Profile) {
        val options = arrayOf("Configurações do perfil", "Duplicar", "Exportar (arquivo JSON)", "Excluir")
        AlertDialog.Builder(this)
            .setTitle(p.name)
            .setItems(options) { _, which ->
                when (which) {
                    0 -> ProfileForm.showEdit(this, p) { Toast.makeText(this, "Perfil salvo", Toast.LENGTH_SHORT).show() }
                    1 -> repo.duplicate(p.id)?.let { Toast.makeText(this, "Criado: ${it.name}", Toast.LENGTH_SHORT).show() }
                    2 -> {
                        exportingId = p.id
                        val i = Intent(Intent.ACTION_CREATE_DOCUMENT).addCategory(Intent.CATEGORY_OPENABLE)
                            .setType("application/json")
                            .putExtra(Intent.EXTRA_TITLE, p.name.replace(Regex("[^A-Za-z0-9_-]+"), "_") + ".gpmap.json")
                        startActivityForResult(i, REQ_EXPORT)
                    }
                    3 -> AlertDialog.Builder(this)
                        .setTitle("Excluir \"${p.name}\"?")
                        .setMessage("O layout será apagado deste aparelho.")
                        .setPositiveButton(R.string.dialog_delete) { _, _ -> repo.delete(p.id) }
                        .setNegativeButton(R.string.dialog_cancel, null)
                        .show()
                }
            }
            .show()
    }

    @Deprecated("Activity framework API")
    override fun onActivityResult(requestCode: Int, resultCode: Int, data: Intent?) {
        super.onActivityResult(requestCode, resultCode, data)
        val uri = data?.data
        if (resultCode != RESULT_OK || uri == null) return
        when (requestCode) {
            REQ_IMPORT -> try {
                val text = contentResolver.openInputStream(uri)!!.use { it.readBytes().toString(Charsets.UTF_8) }
                val p = repo.importJson(text)
                Toast.makeText(this, "Importado: ${p.name}", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Toast.makeText(this, "Arquivo inválido: ${e.message}", Toast.LENGTH_LONG).show()
            }
            REQ_EXPORT -> try {
                val json = exportingId?.let { repo.exportJson(it) } ?: return
                contentResolver.openOutputStream(uri)!!.use { it.write(json.toByteArray(Charsets.UTF_8)) }
                Toast.makeText(this, "Perfil exportado", Toast.LENGTH_SHORT).show()
            } catch (e: Exception) {
                Toast.makeText(this, "Falha ao exportar: ${e.message}", Toast.LENGTH_LONG).show()
            }
        }
    }

    companion object {
        private const val REQ_IMPORT = 10
        private const val REQ_EXPORT = 11
    }
}
