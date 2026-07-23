package com.crisszollo.cartkey.ui

import androidx.compose.foundation.layout.padding
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.automirrored.filled.List
import androidx.compose.material.icons.filled.Home
import androidx.compose.material3.Icon
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.navigation.NavHostController
import androidx.navigation.compose.NavHost
import androidx.navigation.compose.composable
import androidx.navigation.compose.currentBackStackEntryAsState
import androidx.navigation.compose.rememberNavController
import com.crisszollo.cartkey.ActiveNfc
import com.crisszollo.cartkey.CartKeyApp
import com.crisszollo.cartkey.MainTab
import com.crisszollo.cartkey.pairing.PairingScreen

private const val ROUTE_PAIRING = "pairing"
private const val ROUTE_MAIN = "main"
private const val ROUTE_PROGRAM = "program"
private const val ROUTE_ERASE = "erase"

@Composable
fun CartKeyNavHost(isPaired: Boolean, pendingDeepLinkUri: String?, onConsumedDeepLink: () -> Unit) {
    val app = LocalContext.current.applicationContext as CartKeyApp
    val navController = rememberNavController()
    val startDestination = remember(isPaired) { if (isPaired) ROUTE_MAIN else ROUTE_PAIRING }
    val currentBackStackEntry by navController.currentBackStackEntryAsState()
    val currentRoute = currentBackStackEntry?.destination?.route

    val selectedTab by app.selectedTab.collectAsStateWithLifecycle()

    // Coordinate which screen handles NFC taps based on current route + tab.
    LaunchedEffect(currentRoute, selectedTab) {
        app.setActiveNfc(
            when (currentRoute) {
                ROUTE_PROGRAM -> ActiveNfc.PROGRAM
                ROUTE_ERASE -> ActiveNfc.ERASE
                ROUTE_MAIN -> if (selectedTab == MainTab.HOME) ActiveNfc.HOME else null
                else -> null
            }
        )
    }

    NavHost(navController = navController, startDestination = startDestination) {
        composable(ROUTE_PAIRING) {
            PairingScreen(
                pendingDeepLinkUri = pendingDeepLinkUri,
                onConsumedDeepLink = onConsumedDeepLink,
                onPaired = {
                    navController.navigate(ROUTE_MAIN) {
                        popUpTo(ROUTE_PAIRING) { inclusive = true }
                    }
                }
            )
        }

        composable(ROUTE_MAIN) {
            MainScreen(
                onNavigateToProgram = {
                    navController.navigate(ROUTE_PROGRAM)
                },
                onNavigateToErase = {
                    navController.navigate(ROUTE_ERASE)
                },
                onForgetPc = {
                    navController.navigate(ROUTE_PAIRING) {
                        popUpTo(ROUTE_MAIN) { inclusive = true }
                    }
                }
            )
        }

        composable(ROUTE_PROGRAM) {
            ProgramScreen(
                onNavigateBack = {
                    navController.popBackStack()
                }
            )
        }

        composable(ROUTE_ERASE) {
            EraseScreen(
                onNavigateBack = {
                    navController.popBackStack()
                }
            )
        }
    }
}

@Composable
private fun MainScreen(
    onNavigateToProgram: () -> Unit,
    onNavigateToErase: () -> Unit,
    onForgetPc: () -> Unit
) {
    val app = LocalContext.current.applicationContext as CartKeyApp
    var selectedTab by remember { mutableStateOf(MainTab.HOME) }

    LaunchedEffect(selectedTab) {
        app.setSelectedTab(selectedTab)
    }

    Scaffold(
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = selectedTab == MainTab.HOME,
                    onClick = { selectedTab = MainTab.HOME },
                    icon = { Icon(Icons.Default.Home, contentDescription = "Home") },
                    label = { Text("Home") }
                )
                NavigationBarItem(
                    selected = selectedTab == MainTab.LIBRARY,
                    onClick = { selectedTab = MainTab.LIBRARY },
                    icon = { Icon(Icons.AutoMirrored.Filled.List, contentDescription = "Library") },
                    label = { Text("Library") }
                )
            }
        }
    ) { padding ->
        when (selectedTab) {
            MainTab.HOME -> HomeScreen(
                onNavigateToErase = onNavigateToErase,
                onForgetPc = onForgetPc,
                modifier = Modifier.padding(padding)
            )
            MainTab.LIBRARY -> LibraryScreen(
                onNavigateToProgram = onNavigateToProgram,
                modifier = Modifier.padding(padding)
            )
        }
    }
}
