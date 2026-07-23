package com.crisszollo.cartkey.model

import kotlinx.serialization.ExperimentalSerializationApi
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonClassDiscriminator

/** Mirrors `CardReadResult` in src/shared/types.ts. Uses `kind` (not the
 * library default `type`) as the discriminator to match the TS shape exactly. */
@OptIn(ExperimentalSerializationApi::class)
@JsonClassDiscriminator("kind")
@Serializable
sealed class CardReadResult {
    @Serializable
    @SerialName("empty")
    data object Empty : CardReadResult()

    @Serializable
    @SerialName("unreadable")
    data object Unreadable : CardReadResult()

    @Serializable
    @SerialName("data")
    data class Data(val payload: CardPayload) : CardReadResult()
}

/** Mirrors `CardTapEvent` in src/shared/types.ts. */
@Serializable
data class CardTapEvent(
    val uid: String,
    val result: CardReadResult,
    val localMatch: Game? = null
)
