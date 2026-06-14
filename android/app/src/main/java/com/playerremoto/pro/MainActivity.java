package com.playerremoto.pro;

import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import androidx.activity.OnBackPressedCallback;
import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // 1. Mantém a tela sempre ligada (Indispensável para Player)
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        // 2. Bloqueio profissional do botão "Voltar" (Modo Totem)
        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                // Apenas ignora para manter o player sempre focado
            }
        });
        
        hideSystemUI();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemUI();
            
            // 3. Configurações profissionais de Áudio e Visual de forma segura
            try {
                if (this.bridge != null) {
                    WebView webView = this.bridge.getWebView();
                    if (webView != null) {
                        WebSettings settings = webView.getSettings();
                        // Libera voz e som automático (Gongo/Voz)
                        settings.setMediaPlaybackRequiresUserGesture(false);
                        // Fundo preto absoluto (Evita clarão branco ao carregar)
                        webView.setBackgroundColor(0xFF000000);
                        
                        // Otimizações para Receptor Remoto
                        settings.setDomStorageEnabled(true);
                        settings.setLoadWithOverviewMode(true);
                        settings.setUseWideViewPort(true);
                    }
                }
            } catch (Exception e) {
                e.printStackTrace();
            }
        }
    }

    private void hideSystemUI() {
        try {
            View decorView = getWindow().getDecorView();
            decorView.setSystemUiVisibility(
                    View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                    | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                    | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                    | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_FULLSCREEN);
        } catch (Exception e) {
            e.printStackTrace();
        }
    }
}
