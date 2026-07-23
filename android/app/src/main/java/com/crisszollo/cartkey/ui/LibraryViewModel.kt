package com.crisszollo.cartkey.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.crisszollo.cartkey.CartKeyApp
import com.crisszollo.cartkey.model.Game
import com.crisszollo.cartkey.net.ConnectionState
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn

class LibraryViewModel(application: Application) : AndroidViewModel(application) {
    private val app = application as CartKeyApp
    private val client = app.remoteClient

    val games: StateFlow<List<Game>> = client.library
        .stateIn(viewModelScope, SharingStarted.WhileSubscribed(5_000), emptyList())

    val connectionState: StateFlow<ConnectionState> = client.connectionState

    fun selectGame(game: Game) {
        app.setSelectedGame(game)
    }
}
