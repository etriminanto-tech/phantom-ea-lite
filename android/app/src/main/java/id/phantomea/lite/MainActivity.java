package id.phantomea.lite;

import android.app.Activity;
import android.os.Bundle;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.view.View;
import android.widget.TextView;
import android.widget.FrameLayout;

public class MainActivity extends Activity {
    private static final String APP_URL = "https://etriminanto-tech.github.io/phantom-ea-lite/";
    @Override public void onCreate(Bundle state) {
        super.onCreate(state);
        FrameLayout root = new FrameLayout(this);
        WebView web = new WebView(this);
        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setDatabaseEnabled(true);
        settings.setLoadsImagesAutomatically(true);
        settings.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient());
        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        root.addView(web, new FrameLayout.LayoutParams(-1, -1));
        setContentView(root);
        web.loadUrl(APP_URL);
    }
    @Override public void onBackPressed() {
        View v = ((FrameLayout)findViewById(android.R.id.content).getChildAt(0)).getChildAt(0);
        if (v instanceof WebView && ((WebView)v).canGoBack()) ((WebView)v).goBack();
        else super.onBackPressed();
    }
}
