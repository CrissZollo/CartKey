package com.crisszollo.cartkey.ui

import android.app.Application
import android.nfc.Tag
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.crisszollo.cartkey.ActiveNfc
import com.crisszollo.cartkey.CartKeyApp
import com.crisszollo.cartkey.model.CardReadResult
import com.crisszollo.cartkey.model.CardTapEvent
import com.crisszollo.cartkey.net.ConnectionState
import com.crisszollo.cartkey.net.PcToPhone
import com.crisszollo.cartkey.net.PhoneToPc
import com.crisszollo.cartkey.nfc.MifareCardIO
import com.crisszollo.cartkey.nfc.MifareResult
import com.crisszollo.cartkey.nfc.NfcTapBus
import com.crisszollo.cartkey.nfc.decodeCardPayload
import com.crisszollo.cartkey.pairing.StoredPairing
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class TapUiState {
    data object Idle : TapUiState()
    data object Reading : TapUiState()
    data class Result(val tap: CardTapEvent) : TapUiState()
}

class HomeViewModel(application: Application) : AndroidViewModel(application) {
    private val app = application as CartKeyApp
    private val client = app.remoteClient

    val connectionState: StateFlow<ConnectionState> = client.connectionState
    val pairing: StoredPairing? get() = app.pairingStore.load()

    private val _tapState = MutableStateFlow<TapUiState>(TapUiState.Idle)
    val tapState: StateFlow<TapUiState> = _tapState.asStateFlow()

    init {
        val stored = app.pairingStore.load()
        if (stored != null) {
            client.connect(stored.host, stored.port, stored.fingerprint)
            client.send(PhoneToPc.Auth(stored.deviceId, stored.token))
        }

        app.setActiveNfc(ActiveNfc.HOME)

        viewModelScope.launch {
            NfcTapBus.taps.collect { tag ->
                if (app.activeNfc.value != ActiveNfc.HOME) return@collect
                handleTap(tag)
            }
        }

        viewModelScope.launch {
            client.incoming.collect { message ->
                if (message is PcToPhone.TapResult) _tapState.value = TapUiState.Result(message.tap)
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        app.setActiveNfc(null)
    }

    fun dismissTapResult() {
        _tapState.value = TapUiState.Idle
    }

    fun forgetPc() {
        client.disconnect()
        app.pairingStore.clear()
    }

    private fun handleTap(tag: Tag) {
        _tapState.value = TapUiState.Reading
        val uid = tag.id.joinToString("") { "%02x".format(it) }

        val result: CardReadResult = when (val io = MifareCardIO.readAll(tag)) {
            is MifareResult.Success ->
                decodeCardPayload(io.value)?.let { CardReadResult.Data(it) } ?: CardReadResult.Empty
            is MifareResult.NotMifareClassic,
            is MifareResult.AuthFailed,
            is MifareResult.IoError -> CardReadResult.Unreadable
        }

        client.send(PhoneToPc.Tap(uid, result))
    }
}
