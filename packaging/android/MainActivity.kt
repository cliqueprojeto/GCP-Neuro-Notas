package br.com.gestaoculturalpro.notas

import android.os.Bundle
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.graphics.Color
import androidx.core.view.WindowCompat
import androidx.core.view.ViewCompat
import androidx.core.view.WindowInsetsCompat

/**
 * Atividade principal do GCP Notas no Android.
 * - Ignora a escala de fonte do sistema (textZoom 100): a interface já é responsiva e
 *   o tamanho do texto é ajustado dentro do app (Configurações › Editor).
 * - Desenha de ponta a ponta e informa ao CSS as áreas da barra de status, da barra de
 *   gestos, do entalhe e do teclado (--safe-t/-b/-l/-r e --kb), em pixels CSS.
 */
class MainActivity : TauriActivity() {
  private var webView: WebView? = null
  private var lastJs = ""

  override fun onCreate(savedInstanceState: Bundle?) {
    super.onCreate(savedInstanceState)
    WindowCompat.setDecorFitsSystemWindows(window, false)
    @Suppress("DEPRECATION")
    window.statusBarColor = Color.TRANSPARENT
    @Suppress("DEPRECATION")
    window.navigationBarColor = Color.TRANSPARENT
    val root = findViewById<android.view.View>(android.R.id.content)
    ViewCompat.setOnApplyWindowInsetsListener(root) { _, insets ->
      val d = resources.displayMetrics.density
      val bars = insets.getInsets(WindowInsetsCompat.Type.systemBars() or WindowInsetsCompat.Type.displayCutout())
      val ime = insets.getInsets(WindowInsetsCompat.Type.ime())
      fun px(v: Int) = "${(v / d).toInt()}px"
      lastJs = "(function(s){s.setProperty('--safe-t','${px(bars.top)}');s.setProperty('--safe-b','${px(bars.bottom)}');" +
        "s.setProperty('--safe-l','${px(bars.left)}');s.setProperty('--safe-r','${px(bars.right)}');" +
        "s.setProperty('--kb','${px(maxOf(0, ime.bottom - bars.bottom))}');" +
        "document.documentElement.classList.toggle('kb-open',${ime.bottom > bars.bottom});" +
        "document.documentElement.classList.add('native-insets');})(document.documentElement.style)"
      push()
      insets
    }
  }

  override fun onWebViewCreate(webView: WebView) {
    this.webView = webView
    webView.settings.textZoom = 100
    // Tema claro/escuro do app → cor dos ícones da barra de status e de navegação.
    webView.addJavascriptInterface(object {
      @JavascriptInterface
      fun setLightBars(light: Boolean) {
        runOnUiThread {
          val c = WindowCompat.getInsetsController(window, window.decorView)
          c.isAppearanceLightStatusBars = light
          c.isAppearanceLightNavigationBars = light
        }
      }
    }, "GcpNative")
    // A página carrega depois da criação da WebView: reaplica algumas vezes.
    for (delay in longArrayOf(400, 1500, 4000)) webView.postDelayed({ push() }, delay)
  }

  private fun push() {
    val wv = webView ?: return
    if (lastJs.isNotEmpty()) wv.post { wv.evaluateJavascript(lastJs, null) }
  }
}
