package com.crisszollo.cartkey.ui

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.crisszollo.cartkey.model.CardReadResult
import com.crisszollo.cartkey.net.ConnectionState

@Composable
fun HomeScreen(
    onNavigateToErase: () -> Unit,
    onForgetPc: () -> Unit,
    modifier: Modifier = Modifier,
    viewModel: HomeViewModel = viewModel()
) {
    val connectionState by viewModel.connectionState.collectAsStateWithLifecycle()
    val tapState by viewModel.tapState.collectAsStateWithLifecycle()
    val pcName = viewModel.pairing?.pcName ?: "your PC"

    Column(modifier = modifier.fillMaxSize().padding(16.dp)) {
        Row(
            modifier = Modifier.fillMaxWidth(),
            horizontalArrangement = Arrangement.SpaceBetween,
            verticalAlignment = Alignment.CenterVertically
        ) {
            ConnectionPill(connectionState, pcName)
            TextButton(onClick = {
                viewModel.forgetPc()
                onForgetPc()
            }) {
                Text("Forget PC")
            }
        }

        Box(modifier = Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
            Column(horizontalAlignment = Alignment.CenterHorizontally) {
                when (val state = tapState) {
                    is TapUiState.Idle -> IdlePrompt()
                    is TapUiState.Reading -> Text("Reading card…", style = MaterialTheme.typography.bodyLarge, color = MaterialTheme.colorScheme.onBackground)
                    is TapUiState.Result -> TapResultView(state, onDismiss = viewModel::dismissTapResult)
                }

                Spacer(modifier = Modifier.height(24.dp))

                OutlinedButton(onClick = onNavigateToErase) {
                    Text("Erase a card")
                }
            }
        }
    }
}

@Composable
private fun IdlePrompt() {
    Column(horizontalAlignment = Alignment.CenterHorizontally) {
        Text("Tap a card", style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.onBackground)
        Text(
            "Hold a programmed card against the back of your phone",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp)
        )
    }
}

@Composable
private fun TapResultView(state: TapUiState.Result, onDismiss: () -> Unit) {
    val result = state.tap.result
    val (title, subtitle) = when (result) {
        is CardReadResult.Empty -> "Blank card" to "Pick a game in the library to program it"
        is CardReadResult.Unreadable -> "Couldn't read that card" to "Try holding it steady against the back of your phone"
        is CardReadResult.Data -> {
            val match = state.tap.localMatch
            val name = match?.title ?: result.payload.title
            if (match != null && match.installed) {
                name to "Found it — launching on your PC"
            } else {
                name to "Not installed on your PC"
            }
        }
    }

    AnimatedVisibility(visible = true) {
        Column(horizontalAlignment = Alignment.CenterHorizontally) {
            Text(title, style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.onBackground, textAlign = TextAlign.Center)
            Text(
                subtitle,
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
                modifier = Modifier.padding(top = 8.dp, bottom = 16.dp)
            )
            TextButton(onClick = onDismiss) { Text("Tap another card") }
        }
    }
}

@Composable
private fun ConnectionPill(state: ConnectionState, pcName: String) {
    val (color, label) = when (state) {
        is ConnectionState.Connected -> Color(0xFF22C55E) to "Connected to $pcName"
        is ConnectionState.Connecting -> Color(0xFFFACC15) to "Connecting…"
        is ConnectionState.Disconnected -> Color(0xFF6B7280) to "Disconnected"
        is ConnectionState.Failed -> Color(0xFFEF4444) to state.reason
    }

    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(
            modifier = Modifier
                .size(8.dp)
                .clip(CircleShape)
                .background(color)
        )
        Text(
            label,
            style = MaterialTheme.typography.labelMedium,
            modifier = Modifier
                .padding(start = 8.dp)
                .clip(RoundedCornerShape(50))
        )
    }
}
