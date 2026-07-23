package com.crisszollo.cartkey.pairing

import android.content.Context
import androidx.security.crypto.EncryptedSharedPreferences
import androidx.security.crypto.MasterKey

private const val PREFS_NAME = "cartkey_pairing"
private const val KEY_HOST = "host"
private const val KEY_PORT = "port"
private const val KEY_FINGERPRINT = "fingerprint"
private const val KEY_DEVICE_ID = "device_id"
private const val KEY_TOKEN = "token"
private const val KEY_PC_NAME = "pc_name"

data class StoredPairing(
    val host: String,
    val port: Int,
    val fingerprint: String,
    val deviceId: String,
    val token: String,
    val pcName: String
)

/** Holds the one PC this phone is paired with. EncryptedSharedPreferences is
 * deprecated in favor of DataStore+Tink as of security-crypto 1.1.0, but is
 * still fully functional — a fine v1 choice for a single small secret; worth
 * migrating later, not a blocker now. */
class PairingStore(context: Context) {
    private val masterKey = MasterKey.Builder(context)
        .setKeyScheme(MasterKey.KeyScheme.AES256_GCM)
        .build()

    private val prefs = EncryptedSharedPreferences.create(
        context,
        PREFS_NAME,
        masterKey,
        EncryptedSharedPreferences.PrefKeyEncryptionScheme.AES256_SIV,
        EncryptedSharedPreferences.PrefValueEncryptionScheme.AES256_GCM
    )

    fun load(): StoredPairing? {
        val host = prefs.getString(KEY_HOST, null) ?: return null
        val port = prefs.getInt(KEY_PORT, -1).takeIf { it > 0 } ?: return null
        val fingerprint = prefs.getString(KEY_FINGERPRINT, null) ?: return null
        val deviceId = prefs.getString(KEY_DEVICE_ID, null) ?: return null
        val token = prefs.getString(KEY_TOKEN, null) ?: return null
        val pcName = prefs.getString(KEY_PC_NAME, null) ?: return null
        return StoredPairing(host, port, fingerprint, deviceId, token, pcName)
    }

    fun save(pairing: StoredPairing) {
        prefs.edit()
            .putString(KEY_HOST, pairing.host)
            .putInt(KEY_PORT, pairing.port)
            .putString(KEY_FINGERPRINT, pairing.fingerprint)
            .putString(KEY_DEVICE_ID, pairing.deviceId)
            .putString(KEY_TOKEN, pairing.token)
            .putString(KEY_PC_NAME, pairing.pcName)
            .apply()
    }

    fun clear() {
        prefs.edit().clear().apply()
    }
}
