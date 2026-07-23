package com.crisszollo.cartkey.ui

import android.app.Application
import android.nfc.Tag
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.crisszollo.cartkey.ActiveNfc
import com.crisszollo.cartkey.CartKeyApp
import com.crisszollo.cartkey.model.CardPayload
import com.crisszollo.cartkey.net.PhoneToPc
import com.crisszollo.cartkey.nfc.MifareCardIO
import com.crisszollo.cartkey.nfc.MifareResult
import com.crisszollo.cartkey.nfc.NfcTapBus
import com.crisszollo.cartkey.nfc.decodeCardPayload
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class EraseUiState {
    /** Waiting for a card tap. */
    data object Armed : EraseUiState()
    /** Reading the tapped card before erasing. */
    data object Reading : EraseUiState()
    /** Card is blank — nothing to erase. */
    data object Empty : EraseUiState()
    /** Erasing in progress. */
    data class Erasing(val title: String) : EraseUiState()
    /** Erase succeeded. */
    data class Success(val title: String) : EraseUiState()
    data class Error(val message: String) : EraseUiState()
}

private const val MIN_ERASING_MS = 800L

class EraseViewModel(application: Application) : AndroidViewModel(application) {
    private val app = application as CartKeyApp
    private val client = app.remoteClient

    private val _uiState = MutableStateFlow<EraseUiState>(EraseUiState.Armed)
    val uiState: StateFlow<EraseUiState> = _uiState.asStateFlow()

    private var eraseStartedAt = 0L

    @Volatile
    private var lastTag: Tag? = null

    init {
        app.setActiveNfc(ActiveNfc.ERASE)

        viewModelScope.launch {
            NfcTapBus.taps.collect { tag ->
                if (app.activeNfc.value != ActiveNfc.ERASE) return@collect
                handleTap(tag)
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        app.setActiveNfc(null)
    }

    fun dismiss() {
        _uiState.value = EraseUiState.Armed
    }

    private fun handleTap(tag: Tag) {
        lastTag = tag
        _uiState.value = EraseUiState.Reading

        when (val io = MifareCardIO.readAll(tag)) {
            is MifareResult.Success -> {
                val existing = decodeCardPayload(io.value)
                if (existing == null) {
                    _uiState.value = EraseUiState.Empty
                } else {
                    eraseCard(existing)
                }
            }
            is MifareResult.NotMifareClassic,
            is MifareResult.AuthFailed,
            is MifareResult.IoError ->
                _uiState.value = EraseUiState.Error("Couldn't read the card — try holding it steady")
        }
    }

    private fun eraseCard(payload: CardPayload) {
        _uiState.value = EraseUiState.Erasing(payload.title)
        eraseStartedAt = System.currentTimeMillis()

        val tag = lastTag
        if (tag == null) {
            _uiState.value = EraseUiState.Error("Card was removed — try again")
            return
        }

        val zeroData = ByteArray(com.crisszollo.cartkey.nfc.CARD_CAPACITY_BYTES)
        val writeResult = MifareCardIO.writeAll(tag, zeroData)

        viewModelScope.launch {
            val elapsed = System.currentTimeMillis() - eraseStartedAt
            if (elapsed < MIN_ERASING_MS) delay(MIN_ERASING_MS - elapsed)

            when (writeResult) {
                is MifareResult.Success -> {
                    client.send(PhoneToPc.Erased(payload))
                    _uiState.value = EraseUiState.Success(payload.title)
                }
                is MifareResult.AuthFailed ->
                    _uiState.value = EraseUiState.Error("Card authentication failed — is it a writable Mifare Classic?")
                is MifareResult.NotMifareClassic ->
                    _uiState.value = EraseUiState.Error("That's not a Mifare Classic card")
                is MifareResult.IoError ->
                    _uiState.value = EraseUiState.Error(writeResult.message)
            }
        }
    }
}
