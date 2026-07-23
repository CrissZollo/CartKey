package com.crisszollo.cartkey.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/** Mirrors the `Platform` union in src/shared/types.ts. */
@Serializable
enum class Platform {
    @SerialName("steam") STEAM,
    @SerialName("gog") GOG
}
