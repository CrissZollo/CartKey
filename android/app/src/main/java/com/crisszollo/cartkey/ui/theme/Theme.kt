package com.crisszollo.cartkey.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

// Fixed dark palette (no dynamic color, no light variant) — this app is a
// companion to a dark-only desktop UI, and a stable brand look matters more
// here than following the device's system theme.
private val CartKeyColorScheme = darkColorScheme(
    primary = Accent,
    onPrimary = Color.White,
    background = Ink,
    onBackground = Color.White,
    surface = InkSoft,
    onSurface = Color.White,
    surfaceVariant = InkSoft,
    onSurfaceVariant = OnInkMuted,
    error = Color(0xFFEF4444)
)

@Composable
fun CartKeyTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = CartKeyColorScheme, content = content)
}
