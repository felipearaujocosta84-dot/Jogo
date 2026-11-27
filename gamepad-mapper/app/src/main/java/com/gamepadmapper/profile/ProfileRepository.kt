package com.gamepadmapper.profile

import android.content.Context
import org.json.JSONObject
import java.io.File
import java.util.concurrent.CopyOnWriteArraySet

/**
 * Armazena cada perfil como um arquivo JSON em files/profiles/<id>.json.
 * Escrita atomica (arquivo temporario + rename) para nao corromper perfis.
 */
class ProfileRepository private constructor(context: Context) {
    private val appContext = context.applicationContext
    private val dir = File(appContext.filesDir, "profiles").apply { mkdirs() }
    private val prefs = appContext.getSharedPreferences("profiles_meta", Context.MODE_PRIVATE)
    private val listeners = CopyOnWriteArraySet<() -> Unit>()
    private var cache: MutableMap<String, Profile>? = null

    fun addListener(l: () -> Unit) { listeners += l }
    fun removeListener(l: () -> Unit) { listeners -= l }
    private fun notifyChanged() = listeners.forEach { it() }

    @Synchronized
    private fun all(): MutableMap<String, Profile> {
        cache?.let { return it }
        val map = LinkedHashMap<String, Profile>()
        dir.listFiles { f -> f.name.endsWith(".json") }?.forEach { f ->
            runCatching { ProfileJson.fromJson(JSONObject(f.readText())) }
                .onSuccess { map[it.id] = it }
        }
        cache = map
        return map
    }

    @Synchronized
    fun list(): List<Profile> = all().values.sortedByDescending { it.updatedAt }

    @Synchronized
    fun get(id: String?): Profile? = id?.let { all()[it] }

    @Synchronized
    fun findByPackage(pkg: String): Profile? =
        all().values.filter { it.packageName == pkg }.maxByOrNull { it.updatedAt }

    fun save(profile: Profile): Profile {
        val p = profile.copy(updatedAt = System.currentTimeMillis())
        synchronized(this) {
            val tmp = File(dir, "${p.id}.json.tmp")
            tmp.writeText(ProfileJson.toJson(p).toString(2))
            val target = File(dir, "${p.id}.json")
            if (!tmp.renameTo(target)) { target.writeText(tmp.readText()); tmp.delete() }
            all()[p.id] = p
        }
        notifyChanged()
        return p
    }

    fun delete(id: String) {
        synchronized(this) {
            File(dir, "$id.json").delete()
            all().remove(id)
            if (activeProfileId == id) prefs.edit().remove(KEY_ACTIVE).apply()
        }
        notifyChanged()
    }

    fun duplicate(id: String): Profile? {
        val src = get(id) ?: return null
        val now = System.currentTimeMillis()
        return save(src.copy(
            id = java.util.UUID.randomUUID().toString(),
            name = src.name + " (cópia)",
            elements = src.elements.map { it.copy(id = MappingElement.newId()) },
            createdAt = now,
        ))
    }

    /** Importa um JSON exportado; sempre cria um novo id para nao sobrescrever perfis existentes. */
    fun importJson(text: String): Profile {
        val parsed = ProfileJson.fromJson(JSONObject(text))
        return save(parsed.copy(id = java.util.UUID.randomUUID().toString(), backgroundUri = null))
    }

    fun exportJson(id: String): String? = get(id)?.let { ProfileJson.toJson(it).toString(2) }

    var activeProfileId: String?
        get() = prefs.getString(KEY_ACTIVE, null)?.takeIf { get(it) != null }
        set(value) {
            prefs.edit().putString(KEY_ACTIVE, value).apply()
            notifyChanged()
        }

    val activeProfile: Profile? get() = get(activeProfileId)

    companion object {
        private const val KEY_ACTIVE = "active_profile_id"
        @Volatile private var instance: ProfileRepository? = null
        fun get(context: Context): ProfileRepository =
            instance ?: synchronized(this) { instance ?: ProfileRepository(context).also { instance = it } }
    }
}
