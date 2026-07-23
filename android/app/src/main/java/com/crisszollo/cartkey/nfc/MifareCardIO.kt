package com.crisszollo.cartkey.nfc

import android.nfc.Tag
import android.nfc.tech.MifareClassic
import java.io.ByteArrayOutputStream
import java.io.IOException

private val DEFAULT_KEY =
    byteArrayOf(0xFF.toByte(), 0xFF.toByte(), 0xFF.toByte(), 0xFF.toByte(), 0xFF.toByte(), 0xFF.toByte())
private const val SECTORS = 16
private const val DATA_BLOCKS_PER_SECTOR = 3

sealed class MifareResult<out T> {
    data class Success<T>(val value: T) : MifareResult<T>()
    data object NotMifareClassic : MifareResult<Nothing>()
    data class AuthFailed(val sector: Int) : MifareResult<Nothing>()
    data class IoError(val message: String) : MifareResult<Nothing>()
}

/**
 * Mirrors the sector-authenticate-then-read/write loop in
 * src/main/pcscService.ts (`readAllBlocks`/`writeAllBlocks`), using the
 * phone's own NFC radio instead of a PC/SC reader. Each physical tap yields a
 * fresh `Tag` from reader-mode, so unlike `PcscService` there's no persistent
 * "reader handle" to keep alive between taps — the whole operation happens
 * synchronously within one callback.
 */
object MifareCardIO {
    fun readAll(tag: Tag): MifareResult<ByteArray> {
        val mifare = MifareClassic.get(tag) ?: return MifareResult.NotMifareClassic
        return try {
            mifare.connect()
            val out = ByteArrayOutputStream()
            for (sector in 1 until SECTORS) {
                if (!mifare.authenticateSectorWithKeyA(sector, DEFAULT_KEY)) {
                    return MifareResult.AuthFailed(sector)
                }
                val firstBlock = mifare.sectorToBlock(sector)
                for (b in 0 until DATA_BLOCKS_PER_SECTOR) {
                    out.write(mifare.readBlock(firstBlock + b))
                }
            }
            MifareResult.Success(out.toByteArray())
        } catch (e: IOException) {
            MifareResult.IoError(e.message ?: "I/O error reading card")
        } finally {
            closeQuietly(mifare)
        }
    }

    /** `data` must be exactly CARD_CAPACITY_BYTES — pass an all-zero buffer to erase. */
    fun writeAll(tag: Tag, data: ByteArray): MifareResult<Unit> {
        require(data.size == CARD_CAPACITY_BYTES) { "expected $CARD_CAPACITY_BYTES bytes, got ${data.size}" }

        val mifare = MifareClassic.get(tag) ?: return MifareResult.NotMifareClassic
        return try {
            mifare.connect()
            var offset = 0
            for (sector in 1 until SECTORS) {
                if (!mifare.authenticateSectorWithKeyA(sector, DEFAULT_KEY)) {
                    return MifareResult.AuthFailed(sector)
                }
                val firstBlock = mifare.sectorToBlock(sector)
                for (b in 0 until DATA_BLOCKS_PER_SECTOR) {
                    mifare.writeBlock(firstBlock + b, data.copyOfRange(offset, offset + BLOCK_SIZE))
                    offset += BLOCK_SIZE
                }
            }
            MifareResult.Success(Unit)
        } catch (e: IOException) {
            MifareResult.IoError(e.message ?: "I/O error writing card")
        } finally {
            closeQuietly(mifare)
        }
    }

    private fun closeQuietly(mifare: MifareClassic) {
        try {
            mifare.close()
        } catch (_: IOException) {
            // Already gone (card lifted mid-operation) — nothing to do.
        }
    }
}
