# Phantom EA Lite Android APK

The Android package is built with Capacitor. The resulting debug APK is installable on Android, but it is not a Play Store-signed release.

## Build

A GitHub Actions workflow builds the APK on pushes to `bitunix-spot-demo` that change the app or workflow, or when manually started from Actions.

1. Open the repository's **Actions** tab.
2. Select **Build Phantom EA Lite Android APK**.
3. Open the newest successful run.
4. Download the artifact named `phantom-ea-lite-android-debug-apk`.
5. Extract the ZIP and install `app-debug.apk` on Android. Allow installation from the file manager when Android asks.

## Cloud robot first-time configuration

The APK contains the Android dashboard and public market-data client. Cloud automation requires the owner to deploy the Cloudflare Worker separately:

1. Create a Cloudflare Workers KV namespace and put its ID into `cloudflare-worker/wrangler.toml`.
2. Create a strong private control token using `npx wrangler secret put CONTROL_TOKEN`.
3. Deploy the Worker using Wrangler.
4. In the app, open **Pengaturan** > **Mesin robot cloud Spot & Futures**.
5. Enter the Worker HTTPS URL and control token, then tap **Simpan koneksi**.
6. Use **Mulai Spot** and **Mulai Futures** independently.

The token is stored locally by the app so it can send authenticated start/stop/reset requests. Protect the phone with a screen lock and do not share the token. A later production version should use Android Keystore-backed encrypted storage.

## Important

- This is a debug APK artifact, not a Play Store release. Android may show a sideloading warning.
- No Bitunix account API key is needed. No exchange orders are placed.
- Spot and Futures are separate paper accounts, each initialized at 50 virtual USDT.
- The cloud Worker runs scheduled evaluations every five minutes, subject to Cloudflare Free limits and service availability.
- The APK and Worker have not been verified against live Bitunix API responses in this build pipeline. Validate the market-data response and cloud status after deployment before relying on displayed results.
- Cloudflare Worker URL and control token must be configured by the user. The app cannot automatically deploy into a Cloudflare account without account authorization.
- Never enter Bitunix passwords, API secrets with withdrawal permission, wallet recovery phrases, or OTP codes.
