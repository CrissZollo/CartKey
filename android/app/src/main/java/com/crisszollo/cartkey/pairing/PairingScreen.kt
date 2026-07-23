package com.crisszollo.cartkey.pairing

import androidx.compose.animation.AnimatedVisibility
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.lifecycle.viewmodel.compose.viewModel
import com.crisszollo.cartkey.ui.InAppQrScanner

@Composable
fun PairingScreen(
    pendingDeepLinkUri: String?,
    onConsumedDeepLink: () -> Unit,
    onPaired: () -> Unit,
    viewModel: PairingViewModel = viewModel()
) {
    val uiState by viewModel.uiState.collectAsStateWithLifecycle()
    var showScanner by remember { mutableStateOf(false) }
    var hasScanned by remember { mutableStateOf(false) }

    LaunchedEffect(pendingDeepLinkUri) {
        if (pendingDeepLinkUri != null) {
            viewModel.pairFrom(pendingDeepLinkUri)
            onConsumedDeepLink()
        }
    }

    LaunchedEffect(uiState) {
        if (uiState is PairingUiState.Success) onPaired()
    }

    if (showScanner) {
        Column(modifier = Modifier.fillMaxSize()) {
            OutlinedButton(
                onClick = { showScanner = false },
                modifier = Modifier.padding(16.dp)
            ) {
                Text("Cancel")
            }
            InAppQrScanner(
                onQrCodeScanned = { raw ->
                    if (hasScanned) return@InAppQrScanner
                    hasScanned = true
                    viewModel.pairFrom(raw)
                    showScanner = false
                },
                modifier = Modifier.fillMaxSize()
            )
        }
        return
    }

    Column(
        modifier = Modifier
            .fillMaxSize()
            .padding(32.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center
    ) {
        Text("CartKey", style = MaterialTheme.typography.headlineMedium, color = MaterialTheme.colorScheme.onBackground)
        Text(
            "Open CartKey on your PC, click \"Pair a phone\", and scan the code it shows",
            style = MaterialTheme.typography.bodyMedium,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            textAlign = TextAlign.Center,
            modifier = Modifier.padding(top = 8.dp, bottom = 24.dp)
        )

        when (val state = uiState) {
            is PairingUiState.Connecting ->
                CircularProgressIndicator(modifier = Modifier.padding(bottom = 16.dp))
            is PairingUiState.Error -> {
                Text(
                    state.message,
                    color = MaterialTheme.colorScheme.error,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(bottom = 16.dp)
                )
                Button(
                    onClick = { viewModel.dismissError(); showScanner = false },
                    modifier = Modifier.padding(bottom = 8.dp)
                ) { Text("Try again") }
            }
            else -> {}
        }

        Button(onClick = {
            viewModel.dismissError()
            hasScanned = false
            showScanner = true
        }) {
            Text("Scan QR code")
        }
    }
}
