package com.crisszollo.cartkey.nfc

import android.nfc.Tag
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow

/** Bridges `NfcAdapter.ReaderCallback` (registered once at the Activity level
 * in `MainActivity`) to whichever screen/ViewModel is currently on top — the
 * Android analogue of `PcscService`'s `Mode` dispatch, except here "mode" is
 * just "which screen is listening" rather than main-process state. */
object NfcTapBus {
    private val _taps = MutableSharedFlow<Tag>(extraBufferCapacity = 1)
    val taps: SharedFlow<Tag> = _taps

    fun emit(tag: Tag) {
        _taps.tryEmit(tag)
    }
}
