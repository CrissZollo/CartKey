package com.crisszollo.cartkey

import android.app.Application
import coil3.ImageLoader
import coil3.PlatformContext
import coil3.SingletonImageLoader
import com.crisszollo.cartkey.model.Game
import com.crisszollo.cartkey.net.RemoteClient
import com.crisszollo.cartkey.pairing.PairingStore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import java.security.SecureRandom
import java.security.cert.X509Certificate
import javax.net.ssl.SSLContext
import javax.net.ssl.TrustManager
import javax.net.ssl.X509TrustManager
import okhttp3.OkHttpClient
import android.util.Log

enum class ActiveNfc { HOME, PROGRAM, ERASE }

enum class MainTab { HOME, LIBRARY }

class CartKeyApp : Application(), SingletonImageLoader.Factory {
    lateinit var pairingStore: PairingStore
        private set
    lateinit var remoteClient: RemoteClient
        private set

    private val _activeNfc = MutableStateFlow<ActiveNfc?>(null)
    val activeNfc: StateFlow<ActiveNfc?> = _activeNfc.asStateFlow()

    private val _selectedTab = MutableStateFlow(MainTab.HOME)
    val selectedTab: StateFlow<MainTab> = _selectedTab.asStateFlow()

    private val _selectedGame = MutableStateFlow<Game?>(null)
    val selectedGame: StateFlow<Game?> = _selectedGame.asStateFlow()

    fun setActiveNfc(mode: ActiveNfc?) { _activeNfc.value = mode }
    fun setSelectedTab(tab: MainTab) { _selectedTab.value = tab }
    fun setSelectedGame(game: Game?) { _selectedGame.value = game }

    override fun onCreate() {
        super.onCreate()
        pairingStore = PairingStore(this)
        remoteClient = RemoteClient()
    }

    @Suppress("UNCHECKED_CAST")
    override fun newImageLoader(context: PlatformContext): ImageLoader {
        val trustAll = arrayOf<TrustManager>(object : X509TrustManager {
            override fun checkClientTrusted(chain: Array<out X509Certificate>?, authType: String?) {}
            override fun checkServerTrusted(chain: Array<out X509Certificate>?, authType: String?) {}
            override fun getAcceptedIssuers(): Array<X509Certificate> = arrayOf()
        })
        val sslContext = SSLContext.getInstance("TLS")
        sslContext.init(null, trustAll, SecureRandom())

        val client = OkHttpClient.Builder()
            .sslSocketFactory(sslContext.socketFactory, trustAll[0] as X509TrustManager)
            .hostnameVerifier { _, _ -> true }
            .build()

        val factory = try {
            val fetcherClass = Class.forName("coil3.network.okhttp.OkHttpNetworkFetcher")
            val factoryMethod = fetcherClass.getMethod("factory", okhttp3.Call.Factory::class.java)
            @Suppress("UNCHECKED_CAST")
            factoryMethod.invoke(null, client) as coil3.network.NetworkFetcher.Factory
        } catch (e: Exception) {
            Log.e("CartKey", "Failed to create OkHttp fetcher, falling back", e)
            return ImageLoader.Builder(context).build()
        }

        return ImageLoader.Builder(context)
            .components { add(factory) }
            .build()
    }
}
