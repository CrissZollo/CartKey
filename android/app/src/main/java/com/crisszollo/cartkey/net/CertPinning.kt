package com.crisszollo.cartkey.net

import java.security.MessageDigest
import java.security.SecureRandom
import java.security.cert.CertificateException
import java.security.cert.X509Certificate
import javax.net.ssl.SSLContext
import javax.net.ssl.X509TrustManager
import okhttp3.OkHttpClient

private fun sha256Hex(bytes: ByteArray): String =
    MessageDigest.getInstance("SHA-256").digest(bytes).joinToString("") { "%02x".format(it) }

/**
 * Trusts exactly one certificate — the one pinned at pairing time — instead of
 * the system trust store. This is what lets the desktop use a locally
 * generated self-signed cert safely: the fingerprint was exchanged over the
 * pairing QR (an out-of-band channel), not over the network connection itself.
 */
private class PinnedTrustManager(private val expectedFingerprint: String) : X509TrustManager {
    override fun checkClientTrusted(chain: Array<out X509Certificate>, authType: String) {
        throw CertificateException("Client certificates are not used")
    }

    override fun checkServerTrusted(chain: Array<out X509Certificate>, authType: String) {
        val leaf = chain.firstOrNull() ?: throw CertificateException("No certificate presented")
        val actual = sha256Hex(leaf.encoded)
        if (!actual.equals(expectedFingerprint, ignoreCase = true)) {
            throw CertificateException("Certificate fingerprint mismatch: expected $expectedFingerprint, got $actual")
        }
    }

    override fun getAcceptedIssuers(): Array<X509Certificate> = arrayOf()
}

/** The desktop's cert has no real DNS name matching the LAN IP the phone
 * connects to — hostname verification is skipped because identity is already
 * proven by the exact fingerprint pin, which is the stronger check. */
fun pinnedOkHttpClientBuilder(fingerprint: String): OkHttpClient.Builder {
    val trustManager = PinnedTrustManager(fingerprint)
    val sslContext = SSLContext.getInstance("TLS").apply {
        init(null, arrayOf(trustManager), SecureRandom())
    }
    return OkHttpClient.Builder()
        .sslSocketFactory(sslContext.socketFactory, trustManager)
        .hostnameVerifier { _, _ -> true }
}
