package com.crisszollo.cartkey.model

import kotlinx.serialization.Serializable

/** Mirrors `CardPayload` in src/shared/types.ts — the decoded contents of a
 * programmed card, independent of how it was read (phone NFC or PC/SC). */
@Serializable
data class CardPayload(
    val version: Int = 1,
    val platform: Platform,
    val id: String,
    val title: String,
    val artUrl: String? = null
)
