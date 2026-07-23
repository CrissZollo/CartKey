package com.crisszollo.cartkey.nfc

import com.crisszollo.cartkey.model.CardPayload
import com.crisszollo.cartkey.model.Platform
import java.io.ByteArrayOutputStream
import java.nio.charset.StandardCharsets

/**
 * Direct Kotlin port of src/shared/cardCodec.ts — keep the two in sync by
 * hand. Mifare Classic 1K layout: 16 sectors x 4 blocks x 16 bytes. Sector 0
 * holds manufacturer data (never touched); the last block of every sector is
 * the sector trailer (keys/access bits, never usable for data).
 */
private const val SECTORS = 16
private const val BLOCKS_PER_SECTOR = 4
const val BLOCK_SIZE = 16

/** Absolute block numbers safe to read/write data into, in write order. */
fun dataBlockNumbers(): List<Int> {
    val blocks = mutableListOf<Int>()
    for (sector in 1 until SECTORS) {
        for (block in 0 until BLOCKS_PER_SECTOR - 1) {
            blocks += sector * BLOCKS_PER_SECTOR + block
        }
    }
    return blocks
}

val CARD_CAPACITY_BYTES = dataBlockNumbers().size * BLOCK_SIZE // 720

private const val MAGIC = 0xCA
private const val VERSION = 1
private val PLATFORM_CODES = mapOf(Platform.STEAM to 0, Platform.GOG to 1)
private val PLATFORM_FROM_CODE = mapOf(0 to Platform.STEAM, 1 to Platform.GOG)

private const val MAX_ID_BYTES = 48
private const val MAX_TITLE_BYTES = 64
private const val MAX_ART_URL_BYTES = 200

private fun truncateUtf8(input: String, maxBytes: Int): ByteArray {
    var text = input
    var bytes = text.toByteArray(StandardCharsets.UTF_8)
    while (bytes.size > maxBytes) {
        text = text.dropLast(1)
        bytes = text.toByteArray(StandardCharsets.UTF_8)
    }
    return bytes
}

/** Clamp a payload's variable-length fields so it is guaranteed to fit on the card. */
fun fitPayload(payload: CardPayload): CardPayload = CardPayload(
    version = 1,
    platform = payload.platform,
    id = String(truncateUtf8(payload.id, MAX_ID_BYTES), StandardCharsets.UTF_8),
    title = String(truncateUtf8(payload.title, MAX_TITLE_BYTES), StandardCharsets.UTF_8),
    artUrl = payload.artUrl?.let { String(truncateUtf8(it, MAX_ART_URL_BYTES), StandardCharsets.UTF_8) }
)

/** Encode a payload into a full CARD_CAPACITY_BYTES buffer, zero-padded. */
fun encodeCardPayload(rawPayload: CardPayload): ByteArray {
    val payload = fitPayload(rawPayload)
    val idBytes = payload.id.toByteArray(StandardCharsets.UTF_8)
    val titleBytes = payload.title.toByteArray(StandardCharsets.UTF_8)
    val artUrlBytes = payload.artUrl?.toByteArray(StandardCharsets.UTF_8) ?: ByteArray(0)

    val body = ByteArrayOutputStream().apply {
        write(byteArrayOf(MAGIC.toByte(), VERSION.toByte(), PLATFORM_CODES.getValue(payload.platform).toByte()))
        write(idBytes.size)
        write(idBytes)
        write(titleBytes.size)
        write(titleBytes)
        write(artUrlBytes.size)
        write(artUrlBytes)
    }.toByteArray()

    require(body.size <= CARD_CAPACITY_BYTES) {
        "Encoded payload (${body.size}B) exceeds card capacity ($CARD_CAPACITY_BYTES B)"
    }

    val out = ByteArray(CARD_CAPACITY_BYTES)
    body.copyInto(out)
    return out
}

/** Decode a full card dump back into a payload. Returns null for blank/foreign cards. */
fun decodeCardPayload(data: ByteArray): CardPayload? {
    if (data.size < 4 || (data[0].toInt() and 0xFF) != MAGIC || data[1].toInt() != VERSION) return null
    val platform = PLATFORM_FROM_CODE[data[2].toInt() and 0xFF] ?: return null

    var offset = 3
    fun readField(): String? {
        if (offset >= data.size) return null
        val len = data[offset].toInt() and 0xFF
        offset += 1
        if (offset + len > data.size) return null
        val str = String(data, offset, len, StandardCharsets.UTF_8)
        offset += len
        return str
    }

    val id = readField() ?: return null
    val title = readField() ?: return null
    val artUrl = readField()

    return CardPayload(version = 1, platform = platform, id = id, title = title, artUrl = artUrl?.takeIf { it.isNotEmpty() })
}
