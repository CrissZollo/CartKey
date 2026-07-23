package com.crisszollo.cartkey.model

import kotlinx.serialization.Serializable

/** Mirrors `Game` in src/shared/types.ts, as sent down in a `library` message.
 * `art`/`artFallback` are always fetchable URLs by the time the phone sees them
 * — the PC rewrites any local `file://` path to its own `/art` endpoint before
 * sending (see RemoteService.remoteLibrary in remoteServer.ts). */
@Serializable
data class Game(
    val platform: Platform,
    val id: String,
    val title: String,
    val art: String? = null,
    val artFallback: String? = null,
    val installed: Boolean
)
