package com.crisszollo.cartkey.net

import com.crisszollo.cartkey.model.Game
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.Response
import okhttp3.WebSocket
import okhttp3.WebSocketListener

sealed class ConnectionState {
    data object Disconnected : ConnectionState()
    data object Connecting : ConnectionState()
    data object Connected : ConnectionState()
    data class Failed(val reason: String) : ConnectionState()
}

private val json = Json {
    ignoreUnknownKeys = true
    encodeDefaults = true
}

/**
 * Owns the WSS link to a paired desktop. Card cryptography/IO never touches
 * this class — it only ever carries already-decoded results (see
 * src/shared/remoteProtocol.ts) and the synced library.
 */
class RemoteClient {
    private var webSocket: WebSocket? = null
    private var httpClient: OkHttpClient? = null

    private var deviceId: String? = null
    private var token: String? = null

    private val _connectionState = MutableStateFlow<ConnectionState>(ConnectionState.Disconnected)
    val connectionState: StateFlow<ConnectionState> = _connectionState.asStateFlow()

    private val _library = MutableStateFlow<List<Game>>(emptyList())
    val library: StateFlow<List<Game>> = _library.asStateFlow()

    private val _incoming = MutableSharedFlow<PcToPhone>(extraBufferCapacity = 16)
    val incoming: SharedFlow<PcToPhone> = _incoming

    /** Builds a pinned OkHttp client for the self-signed cert, with auth
     *  headers injected so image loads to the /art endpoint are authenticated.
     *  On fresh pair, [deviceId] and [token] come from the stored pairing;
     *  on reconnect, they may be null on the instance (only set on Paired, not
     *  AuthResult) so the caller passes them explicitly. */
    fun buildHttpClient(fingerprint: String, deviceId: String? = null, token: String? = null): OkHttpClient {
        val did = deviceId ?: this.deviceId
        val tok = token ?: this.token
        return pinnedOkHttpClientBuilder(fingerprint)
            .addInterceptor { chain ->
                val request = chain.request()
                if (did != null && tok != null) {
                    chain.proceed(
                        request.newBuilder()
                            .header("x-cartkey-device", did)
                            .header("x-cartkey-token", tok)
                            .build()
                    )
                } else {
                    chain.proceed(request)
                }
            }
            .build()
    }

    fun connect(host: String, port: Int, fingerprint: String) {
        closeSocket()
        _connectionState.value = ConnectionState.Connecting

        val client = buildHttpClient(fingerprint)
        httpClient = client

        val request = Request.Builder().url("wss://$host:$port/ws").build()
        webSocket = client.newWebSocket(request, object : WebSocketListener() {
            override fun onMessage(webSocket: WebSocket, text: String) {
                val message = runCatching { json.decodeFromString<PcToPhone>(text) }.getOrNull() ?: return
                handleMessage(message)
            }

            override fun onFailure(webSocket: WebSocket, t: Throwable, response: Response?) {
                _connectionState.value = ConnectionState.Failed(t.message ?: "Connection failed")
            }

            override fun onClosed(webSocket: WebSocket, code: Int, reason: String) {
                _connectionState.value = ConnectionState.Disconnected
            }
        })
    }

    private fun handleMessage(message: PcToPhone) {
        when (message) {
            is PcToPhone.Paired -> {
                _connectionState.value = ConnectionState.Connected
                deviceId = message.deviceId
                token = message.token
            }
            is PcToPhone.AuthResult ->
                _connectionState.value =
                    if (message.ok) ConnectionState.Connected else ConnectionState.Failed(message.reason ?: "Auth failed")
            is PcToPhone.Library -> _library.value = message.games
            is PcToPhone.Revoked -> {
                closeSocket()
                _connectionState.value = ConnectionState.Failed("Unpaired from PC")
            }
            else -> {}
        }
        _incoming.tryEmit(message)
    }

    fun send(message: PhoneToPc) {
        webSocket?.send(json.encodeToString(message))
    }

    fun disconnect() {
        closeSocket()
        deviceId = null
        token = null
        _connectionState.value = ConnectionState.Disconnected
    }

    private fun closeSocket() {
        webSocket?.close(1000, "client disconnect")
        webSocket = null
        httpClient?.dispatcher?.executorService?.shutdown()
        httpClient = null
    }
}
