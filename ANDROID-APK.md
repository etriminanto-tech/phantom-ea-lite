# Phantom EA Lite Android APK

The project includes a native Android application shell (Java + Android WebView). It opens Phantom EA Lite directly as a standalone app from its Android launcher icon; it does not require the user to open a browser tab. The app loads its interface and market-data API from the HTTPS Vercel branch preview, so an internet connection is required.

## Build

GitHub Actions builds a debug APK on pushes to `bitunix-spot-demo` that change `android/**` or this workflow, or when manually started from Actions.

1. Open the repository's **Actions** tab.
2. Select **Build Phantom EA Lite Android APK**.
3. Open the newest successful run.
4. Download the artifact named `phantom-ea-lite-android-debug-apk`.
5. Extract the ZIP and install `app-debug.apk` on Android. Allow installation from the file manager when Android asks.

## Cloud robot first-time configuration

The APK contains the Android launcher app and dashboard WebView. Cloud automation requires the owner to deploy the Cloudflare Worker separately:

1. Create a Cloudflare Workers KV namespace named `PHANTOM_STATE`.
2. Set its ID in `cloudflare-worker/wrangler.toml`.
3. From the `cloudflare-worker` directory, install Wrangler, authenticate, and set a strong private token with `npx wrangler secret put CONTROL_TOKEN`.
4. Deploy the Worker using `npx wrangler deploy`.
5. In the app, open **Pengaturan** > **Mesin robot cloud Spot & Futures**.
6. Enter the Worker HTTPS URL and control token, then tap **Simpan koneksi**.
7. Use **Mulai Spot** and **Mulai Futures** independently.

The token is stored locally by the app so it can send authenticated start/stop/reset requests. Protect the phone with a screen lock and do not share the token. A production version should move this to Android Keystore-backed encrypted storage.

## Important

- This is a debug APK artifact, not a Play Store-signed release. Android may show a sideloading warning.
- The Android app opens in its own app window, not in the browser, but its dashboard is served from the Vercel HTTPS preview and requires internet.
- No Bitunix account API key is needed. No exchange orders are placed.
- Spot and Futures are separate paper accounts, each initialized at 50 virtual USDT.
- The cloud Worker runs scheduled evaluations every five minutes, subject to Cloudflare Free quotas and service availability.
- The APK and Worker have not yet been verified against live Bitunix API responses in this build pipeline. Validate the market-data response and cloud status after deployment before relying on displayed results.
- Cloudflare Worker URL and control token must be configured by the user. The app cannot automatically deploy into a Cloudflare account without account authorization.
- Never enter Bitunix passwords, API secrets with withdrawal permission, wallet recovery phrases, or OTP codes.
