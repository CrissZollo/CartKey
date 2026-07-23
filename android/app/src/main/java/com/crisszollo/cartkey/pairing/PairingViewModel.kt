package com.crisszollo.cartkey.pairing

import android.app.Application
import android.os.Build
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.crisszollo.cartkey.CartKeyApp
import com.crisszollo.cartkey.net.ConnectionState
import com.crisszollo.cartkey.net.PcToPhone
import com.crisszollo.cartkey.net.PhoneToPc
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class PairingUiState {
    data object Idle : PairingUiState()
    data object Connecting : PairingUiState()
    data object Success : PairingUiState()
    data class Error(val message: String) : PairingUiState()
}

class PairingViewModel(application: Application) : AndroidViewModel(application) {
    private val app = application as CartKeyApp

    private val _uiState = MutableStateFlow<PairingUiState>(PairingUiState.Idle)
    val uiState: StateFlow<PairingUiState> = _uiState.asStateFlow()

    /** Scanned (or deep-linked) QR contents in, pairing handshake out. */
    fun pairFrom(uri: String) {
        if (_uiState.value is PairingUiState.Connecting) return

        val payload = parsePairingUri(uri)
        if (payload == null) {
            _uiState.value = PairingUiState.Error("That QR code isn't a CartKey pairing code")
            return
        }
        if (System.currentTimeMillis() > payload.expiresAt) {
            _uiState.value = PairingUiState.Error("This code has expired — generate a new one on your PC")
            return
        }

        _uiState.value = PairingUiState.Connecting
        val client = app.remoteClient

        viewModelScope.launch {
            client.incoming.collect { message ->
                when (message) {
                    is PcToPhone.Paired -> {
                        app.pairingStore.save(
                            StoredPairing(
                                host = payload.host,
                                port = payload.port,
                                fingerprint = payload.fingerprint,
                                deviceId = message.deviceId,
                                token = message.token,
                                pcName = message.pcName
                            )
                        )
                        _uiState.value = PairingUiState.Success
                    }
                    is PcToPhone.PairFailed -> _uiState.value = PairingUiState.Error(message.reason)
                    else -> {}
                }
            }
        }

        viewModelScope.launch {
            client.connectionState.collect { state ->
                if (state is ConnectionState.Failed) _uiState.value = PairingUiState.Error(state.reason)
            }
        }

        client.connect(payload.host, payload.port, payload.fingerprint)
        val deviceName = "${Build.MANUFACTURER} ${Build.MODEL}".trim().ifBlank { "Android phone" }
        client.send(PhoneToPc.PairRequest(code = payload.code, deviceName = deviceName))
    }

    fun dismissError() {
        _uiState.value = PairingUiState.Idle
    }
}
