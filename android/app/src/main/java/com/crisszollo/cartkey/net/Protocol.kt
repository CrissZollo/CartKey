package com.crisszollo.cartkey.net

import com.crisszollo.cartkey.model.CardPayload
import com.crisszollo.cartkey.model.CardReadResult
import com.crisszollo.cartkey.model.CardTapEvent
import com.crisszollo.cartkey.model.Game
import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/**
 * Hand-mirrors src/shared/remoteProtocol.ts's `PhoneToPc`/`PcToPhone` unions —
 * there is no shared codegen across the TS/Kotlin boundary, so keep the two in
 * sync manually. Uses the default "type" discriminator on both sides.
 */
@Serializable
sealed class PhoneToPc {
    @Serializable
    @SerialName("pair")
    data class PairRequest(val code: String, val deviceName: String) : PhoneToPc()

    @Serializable
    @SerialName("auth")
    data class Auth(val deviceId: String, val token: String) : PhoneToPc()

    @Serializable
    @SerialName("tap")
    data class Tap(val uid: String, val result: CardReadResult) : PhoneToPc()

    @Serializable
    @SerialName("programmed")
    data class Programmed(val payload: CardPayload) : PhoneToPc()

    @Serializable
    @SerialName("erased")
    data class Erased(val payload: CardPayload) : PhoneToPc()

    @Serializable
    @SerialName("ping")
    data object Ping : PhoneToPc()
}

@Serializable
sealed class PcToPhone {
    @Serializable
    @SerialName("paired")
    data class Paired(val deviceId: String, val token: String, val pcName: String) : PcToPhone()

    @Serializable
    @SerialName("pairFailed")
    data class PairFailed(val reason: String) : PcToPhone()

    @Serializable
    @SerialName("authResult")
    data class AuthResult(val ok: Boolean, val reason: String? = null) : PcToPhone()

    @Serializable
    @SerialName("library")
    data class Library(val games: List<Game>) : PcToPhone()

    @Serializable
    @SerialName("tapResult")
    data class TapResult(val tap: CardTapEvent) : PcToPhone()

    @Serializable
    @SerialName("revoked")
    data object Revoked : PcToPhone()

    @Serializable
    @SerialName("pong")
    data object Pong : PcToPhone()
}
