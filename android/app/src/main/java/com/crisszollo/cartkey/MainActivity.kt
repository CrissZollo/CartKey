package com.crisszollo.cartkey

import android.content.Intent
import android.nfc.NfcAdapter
import android.nfc.Tag
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import com.crisszollo.cartkey.nfc.NfcTapBus
import com.crisszollo.cartkey.ui.CartKeyNavHost
import com.crisszollo.cartkey.ui.theme.CartKeyTheme

class MainActivity : ComponentActivity() {
    private var nfcAdapter: NfcAdapter? = null
    private var pendingDeepLinkUri by mutableStateOf<String?>(null)

    private val readerCallback = NfcAdapter.ReaderCallback { tag: Tag -> NfcTapBus.emit(tag) }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        nfcAdapter = NfcAdapter.getDefaultAdapter(this)
        pendingDeepLinkUri = intent?.data?.toString()

        val app = application as CartKeyApp
        setContent {
            CartKeyTheme {
                CartKeyNavHost(
                    isPaired = app.pairingStore.load() != null,
                    pendingDeepLinkUri = pendingDeepLinkUri,
                    onConsumedDeepLink = { pendingDeepLinkUri = null }
                )
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        setIntent(intent)
        pendingDeepLinkUri = intent.data?.toString()
    }

    override fun onResume() {
        super.onResume()
        nfcAdapter?.enableReaderMode(
            this,
            readerCallback,
            NfcAdapter.FLAG_READER_NFC_A or NfcAdapter.FLAG_READER_NFC_B or NfcAdapter.FLAG_READER_SKIP_NDEF_CHECK,
            null
        )
    }

    override fun onPause() {
        super.onPause()
        nfcAdapter?.disableReaderMode(this)
    }
}
