package com.crisszollo.cartkey.nfc

import com.crisszollo.cartkey.model.CardPayload
import com.crisszollo.cartkey.model.Platform
import org.junit.Assert.assertArrayEquals
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Test

class CardCodecTest {

    @Test
    fun `capacity is 720 bytes`() {
        assertEquals(720, CARD_CAPACITY_BYTES)
    }

    @Test
    fun `round trips a full payload`() {
        val payload = CardPayload(
            platform = Platform.STEAM,
            id = "1086940",
            title = "Baldur's Gate 3",
            artUrl = "https://example.com/art.jpg"
        )

        val decoded = decodeCardPayload(encodeCardPayload(payload))

        assertEquals(payload, decoded)
    }

    @Test
    fun `round trips a payload with no art url`() {
        val payload = CardPayload(platform = Platform.GOG, id = "42", title = "Moonlighter")

        val decoded = decodeCardPayload(encodeCardPayload(payload))

        assertEquals(payload, decoded)
    }

    @Test
    fun `encoded buffer matches the desktop encoder byte-for-byte`() {
        // Cross-checked against src/shared/cardCodec.ts's encodeCardPayload for
        // the same input — this is the load-bearing test that keeps the two
        // implementations byte-compatible.
        val payload = CardPayload(platform = Platform.STEAM, id = "123", title = "Half-Life 2")

        val encoded = encodeCardPayload(payload)

        val expectedHeader = byteArrayOf(
            0xCA.toByte(), 0x01, 0x00, // magic, version, platform=steam
            0x03, 0x31, 0x32, 0x33, // id length + "123"
            0x0B, 0x48, 0x61, 0x6C, 0x66, 0x2D, 0x4C, 0x69, 0x66, 0x65, 0x20, 0x32, // title length + "Half-Life 2"
            0x00 // artUrl length (absent)
        )

        assertEquals(720, encoded.size)
        assertArrayEquals(expectedHeader, encoded.copyOfRange(0, expectedHeader.size))
        assertArrayEquals(ByteArray(encoded.size - expectedHeader.size), encoded.copyOfRange(expectedHeader.size, encoded.size))
    }

    @Test
    fun `fitPayload truncates fields that exceed the on-card limits`() {
        val payload = CardPayload(
            platform = Platform.STEAM,
            id = "x".repeat(100),
            title = "y".repeat(100),
            artUrl = "z".repeat(300)
        )

        val fitted = fitPayload(payload)

        assert(fitted.id.toByteArray(Charsets.UTF_8).size <= 48)
        assert(fitted.title.toByteArray(Charsets.UTF_8).size <= 64)
        assert(fitted.artUrl!!.toByteArray(Charsets.UTF_8).size <= 200)
    }

    @Test
    fun `decodeCardPayload returns null for a blank card`() {
        assertNull(decodeCardPayload(ByteArray(CARD_CAPACITY_BYTES)))
    }

    @Test
    fun `decodeCardPayload returns null for the wrong magic byte`() {
        val encoded = encodeCardPayload(CardPayload(platform = Platform.STEAM, id = "1", title = "t"))
        encoded[0] = 0x00

        assertNull(decodeCardPayload(encoded))
    }

    @Test
    fun `decodeCardPayload returns null for an unsupported version`() {
        val encoded = encodeCardPayload(CardPayload(platform = Platform.STEAM, id = "1", title = "t"))
        encoded[1] = 0x02

        assertNull(decodeCardPayload(encoded))
    }
}
