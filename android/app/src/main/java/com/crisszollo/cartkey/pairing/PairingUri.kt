package com.crisszollo.cartkey.pairing

import android.net.Uri

/** Mirrors `PairingPayload`/`buildPairingUri` in src/shared/remoteProtocol.ts —
 * this is the parser for the `cartkey://pair?...` URI the desktop's QR encodes. */
data class PairingPayload(
    val host: String,
    val port: Int,
    val fingerprint: String,
    val code: String,
    val expiresAt: Long
)

fun parsePairingUri(uri: String): PairingPayload? {
    val parsed = runCatching { Uri.parse(uri) }.getOrNull() ?: return null
    if (parsed.scheme != "cartkey" || parsed.host != "pair") return null

    val host = parsed.getQueryParameter("host") ?: return null
    val port = parsed.getQueryParameter("port")?.toIntOrNull() ?: return null
    val fingerprint = parsed.getQueryParameter("fp") ?: return null
    val code = parsed.getQueryParameter("code") ?: return null
    val expiresAt = parsed.getQueryParameter("exp")?.toLongOrNull() ?: return null

    return PairingPayload(host, port, fingerprint, code, expiresAt)
}
