package com.crisszollo.cartkey.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.crisszollo.cartkey.model.Game

@Composable
fun ProgramScreen(
    onNavigateBack: () -> Unit,
    viewModel: ProgramViewModel = viewModel()
) {
    val state by viewModel.uiState.collectAsStateWithLifecycle()

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(24.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        TextButton(onClick = onNavigateBack, modifier = Modifier.align(Alignment.Start)) {
            Text("\u25C0 Library")
        }

        Spacer(modifier = Modifier.height(32.dp))

        when (val s = state) {
            is ProgramUiState.Armed -> ArmedContent(s.game)
            is ProgramUiState.Reading -> ReadingContent(s.game)
            is ProgramUiState.AlreadyLoaded -> AlreadyLoadedContent(s, viewModel::dismissResult)
            is ProgramUiState.ConfirmOverwrite -> ConfirmOverwriteContent(
                s, viewModel::confirmOverwrite, viewModel::cancelOverwrite
            )
            is ProgramUiState.Writing -> WritingContent(s.game)
            is ProgramUiState.Success -> SuccessContent(s, viewModel::dismissResult)
            is ProgramUiState.Error -> ErrorContent(s.message, onNavigateBack)
        }
    }
}

@Composable
private fun ArmedContent(game: Game) {
    Text("Program a card with", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onBackground)
    Text(
        game.title,
        style = MaterialTheme.typography.headlineSmall,
        color = MaterialTheme.colorScheme.onBackground,
        textAlign = TextAlign.Center,
        modifier = Modifier.padding(top = 4.dp)
    )
    Text(
        "Hold a blank card against the back of your phone",
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = TextAlign.Center,
        modifier = Modifier.padding(top = 16.dp)
    )
}

@Composable
private fun ReadingContent(game: Game) {
    Text("Reading card\u2026", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onBackground)
    Text(
        game.title,
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(top = 4.dp)
    )
}

@Composable
private fun AlreadyLoadedContent(state: ProgramUiState.AlreadyLoaded, onDismiss: () -> Unit) {
    Text("Already loaded!", style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.onBackground)
    Text(
        "This card already has ${state.game.title} on it",
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = TextAlign.Center,
        modifier = Modifier.padding(top = 8.dp, bottom = 16.dp)
    )
    Button(onClick = onDismiss) { Text("Program another card") }
}

@Composable
private fun ConfirmOverwriteContent(
    state: ProgramUiState.ConfirmOverwrite,
    onConfirm: () -> Unit,
    onCancel: () -> Unit
) {
    Text("Card already has a game", style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.onBackground)
    Text(
        "\"${state.existingTitle}\" is on this card. Overwrite with \"${state.game.title}\"?",
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = TextAlign.Center,
        modifier = Modifier.padding(top = 8.dp, bottom = 16.dp)
    )
    Button(onClick = onConfirm) { Text("Overwrite") }
    OutlinedButton(onClick = onCancel, modifier = Modifier.padding(top = 8.dp)) {
        Text("Cancel")
    }
}

@Composable
private fun WritingContent(game: Game) {
    CircularProgressIndicator(modifier = Modifier.size(48.dp))
    Text(
        "Writing\u2026",
        style = MaterialTheme.typography.titleMedium,
        color = MaterialTheme.colorScheme.onBackground,
        modifier = Modifier.padding(top = 16.dp)
    )
    Text(
        game.title,
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(top = 4.dp)
    )
}

@Composable
private fun SuccessContent(state: ProgramUiState.Success, onDismiss: () -> Unit) {
    Text("Programmed!", style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.primary)
    Text(
        "\"${state.game.title}\" is now on the card",
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = TextAlign.Center,
        modifier = Modifier.padding(top = 8.dp, bottom = 16.dp)
    )
    Button(onClick = onDismiss) { Text("Program another card") }
}

@Composable
private fun ErrorContent(message: String, onBack: () -> Unit) {
    Text("Something went wrong", style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.error)
    Text(
        message,
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = TextAlign.Center,
        modifier = Modifier.padding(top = 8.dp, bottom = 16.dp)
    )
    Button(onClick = onBack) { Text("Back to Library") }
}
