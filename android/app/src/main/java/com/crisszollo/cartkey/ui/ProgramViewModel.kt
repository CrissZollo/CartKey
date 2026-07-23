package com.crisszollo.cartkey.ui

import android.app.Application
import android.nfc.Tag
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.crisszollo.cartkey.ActiveNfc
import com.crisszollo.cartkey.CartKeyApp
import com.crisszollo.cartkey.model.CardPayload
import com.crisszollo.cartkey.model.Game
import com.crisszollo.cartkey.net.PhoneToPc
import com.crisszollo.cartkey.nfc.MifareCardIO
import com.crisszollo.cartkey.nfc.MifareResult
import com.crisszollo.cartkey.nfc.NfcTapBus
import com.crisszollo.cartkey.nfc.decodeCardPayload
import com.crisszollo.cartkey.nfc.encodeCardPayload
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.launch

sealed class ProgramUiState {
    data class Armed(val game: Game) : ProgramUiState()
    data class Reading(val game: Game) : ProgramUiState()
    data class AlreadyLoaded(val game: Game) : ProgramUiState()
    data class ConfirmOverwrite(val game: Game, val existingTitle: String) : ProgramUiState()
    data class Writing(val game: Game) : ProgramUiState()
    data class Success(val game: Game) : ProgramUiState()
    data class Error(val message: String) : ProgramUiState()
}

private const val MIN_WRITING_MS = 800L

class ProgramViewModel(application: Application) : AndroidViewModel(application) {
    private val app = application as CartKeyApp
    private val client = app.remoteClient

    private val _uiState = MutableStateFlow<ProgramUiState>(ProgramUiState.Error("No game selected"))
    val uiState: StateFlow<ProgramUiState> = _uiState.asStateFlow()

    private var writeStartedAt = 0L

    /** Tag from the most recent NFC tap — cached so the write path (which may
     *  be invoked asynchronously after a confirmation dialog) still has a handle
     *  to it. Must be kept in the field while the user keeps the card against
     *  the phone. */
    @Volatile
    private var lastTag: Tag? = null

    init {
        val game = app.selectedGame.value
        if (game != null) {
            _uiState.value = ProgramUiState.Armed(game)
            app.setActiveNfc(ActiveNfc.PROGRAM)
        } else {
            _uiState.value = ProgramUiState.Error("No game selected — pick one from the library first")
        }

        viewModelScope.launch {
            NfcTapBus.taps.collect { tag ->
                if (app.activeNfc.value != ActiveNfc.PROGRAM) return@collect
                handleTap(tag)
            }
        }
    }

    override fun onCleared() {
        super.onCleared()
        app.setActiveNfc(null)
    }

    fun confirmOverwrite() {
        val state = _uiState.value
        if (state is ProgramUiState.ConfirmOverwrite) {
            writeCard(state.game)
        }
    }

    fun cancelOverwrite() {
        val state = _uiState.value
        if (state is ProgramUiState.ConfirmOverwrite) {
            _uiState.value = ProgramUiState.Armed(state.game)
        }
    }

    fun dismissResult() {
        val game = app.selectedGame.value
        if (game != null) {
            _uiState.value = ProgramUiState.Armed(game)
        }
    }

    private fun handleTap(tag: Tag) {
        val game = app.selectedGame.value ?: return
        lastTag = tag
        _uiState.value = ProgramUiState.Reading(game)

        when (val io = MifareCardIO.readAll(tag)) {
            is MifareResult.Success -> {
                val existing = decodeCardPayload(io.value)
                if (existing == null) {
                    writeCard(game)
                } else if (existing.platform == game.platform && existing.id == game.id) {
                    _uiState.value = ProgramUiState.AlreadyLoaded(game)
                } else {
                    _uiState.value = ProgramUiState.ConfirmOverwrite(game, existing.title)
                }
            }
            is MifareResult.NotMifareClassic,
            is MifareResult.AuthFailed,
            is MifareResult.IoError ->
                _uiState.value = ProgramUiState.Error("Couldn't read the card — try holding it steady")
        }
    }

    private fun writeCard(game: Game) {
        _uiState.value = ProgramUiState.Writing(game)
        writeStartedAt = System.currentTimeMillis()

        val payload = CardPayload(
            platform = game.platform,
            id = game.id,
            title = game.title,
            artUrl = game.art ?: game.artFallback
        )
        val data = encodeCardPayload(payload)

        val tag = lastTag
        if (tag == null) {
            _uiState.value = ProgramUiState.Error("Card was removed — try again")
            return
        }

        val writeResult = MifareCardIO.writeAll(tag, data)

        viewModelScope.launch {
            val elapsed = System.currentTimeMillis() - writeStartedAt
            if (elapsed < MIN_WRITING_MS) delay(MIN_WRITING_MS - elapsed)

            when (writeResult) {
                is MifareResult.Success -> {
                    client.send(PhoneToPc.Programmed(payload))
                    _uiState.value = ProgramUiState.Success(game)
                }
                is MifareResult.AuthFailed ->
                    _uiState.value = ProgramUiState.Error("Card authentication failed — is it a writable Mifare Classic?")
                is MifareResult.NotMifareClassic ->
                    _uiState.value = ProgramUiState.Error("That's not a Mifare Classic card")
                is MifareResult.IoError ->
                    _uiState.value = ProgramUiState.Error(writeResult.message)
            }
        }
    }
}
