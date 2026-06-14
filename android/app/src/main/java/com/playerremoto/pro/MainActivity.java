package com.playerremoto.pro;

import android.os.Bundle;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 1. Mantém a tela sempre ligada (Indispensável para Player)
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            // Aplicamos as configurações de áudio de forma segura quando a tela ganha foco
            try {
                if (this.bridge != null && this.bridge.getWebView() != null) {
                    WebView webView = this.bridge.getWebView();
                    WebSettings settings = webView.getSettings();
                    
                    // Libera voz e som automático (Gongo/Voz) sem toque na tela
                    settings.setMediaPlaybackRequiresUserGesture(false);
                    
                    // Fundo preto absoluto (Evita clarão branco ao carregar)
                    webView.setBackgroundColor(0xFF000000);
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }
}
