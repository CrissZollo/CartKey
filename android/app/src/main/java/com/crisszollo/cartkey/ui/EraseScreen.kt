package com.crisszollo.cartkey.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
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

@Composable
fun EraseScreen(
    onNavigateBack: () -> Unit,
    viewModel: EraseViewModel = viewModel()
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
            Text("◀ Back")
        }

        Spacer(modifier = Modifier.height(32.dp))

        when (val s = state) {
            is EraseUiState.Armed -> ArmedContent()
            is EraseUiState.Reading -> ReadingContent()
            is EraseUiState.Empty -> EmptyContent(viewModel::dismiss)
            is EraseUiState.Erasing -> ErasingContent(s.title)
            is EraseUiState.Success -> SuccessContent(s.title, viewModel::dismiss)
            is EraseUiState.Error -> ErrorContent(s.message, onNavigateBack)
        }
    }
}

@Composable
private fun ArmedContent() {
    Text("Erase a card", style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.onBackground)
    Text(
        "Hold a card against the back of your phone — its data will be cleared",
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = TextAlign.Center,
        modifier = Modifier.padding(top = 8.dp)
    )
}

@Composable
private fun ReadingContent() {
    Text("Reading card…", style = MaterialTheme.typography.titleMedium, color = MaterialTheme.colorScheme.onBackground)
}

@Composable
private fun EmptyContent(onDismiss: () -> Unit) {
    Text("Nothing to erase", style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.onBackground)
    Text(
        "This card is blank — there's nothing to clear",
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = TextAlign.Center,
        modifier = Modifier.padding(top = 8.dp, bottom = 16.dp)
    )
    Button(onClick = onDismiss) { Text("Erase another card") }
}

@Composable
private fun ErasingContent(title: String) {
    CircularProgressIndicator(modifier = Modifier.size(48.dp))
    Text(
        "Erasing…",
        style = MaterialTheme.typography.titleMedium,
        color = MaterialTheme.colorScheme.onBackground,
        modifier = Modifier.padding(top = 16.dp)
    )
    Text(
        "\"$title\"",
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = Modifier.padding(top = 4.dp)
    )
}

@Composable
private fun SuccessContent(title: String, onDismiss: () -> Unit) {
    Text("Erased!", style = MaterialTheme.typography.headlineSmall, color = MaterialTheme.colorScheme.primary)
    Text(
        "\"$title\" has been cleared from the card",
        style = MaterialTheme.typography.bodyMedium,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = TextAlign.Center,
        modifier = Modifier.padding(top = 8.dp, bottom = 16.dp)
    )
    Button(onClick = onDismiss) { Text("Erase another card") }
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
    Button(onClick = onBack) { Text("Go back") }
}
