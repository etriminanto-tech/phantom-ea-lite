# Phantom EA Lite

Aplikasi web/PWA berbahasa Indonesia untuk analisis pasar, simulasi trading, pengelolaan risiko, dan pencatatan hasil. Proyek ini merupakan implementasi independen; bukan salinan kode, backend, atau lisensi Phantom EA.

## Status kemampuan saat ini

- Dashboard responsif untuk Android dan desktop melalui HTTPS.
- Pusat perintah Android: perintah teks untuk mengambil harga BTCUSDT, menjalankan analisis indikator, dan memulai/menghentikan pemantauan berkala.
- Pemantauan otomatis memperbarui data setiap 60 detik selama PWA tetap terbuka di layar; pemantauan berhenti saat pengguna menghentikannya atau aplikasi ditutup.
- Aplikasi Android native menggunakan Java WebView dan dibangun sebagai APK debug melalui GitHub Actions; APK belum dinyatakan siap sampai workflow berhasil.
- Modal simulasi awal 50 USDT; risiko awal 1% per transaksi (pengaturan dibatasi 0,1–2%).
- Instrumen kalkulator/simulasi: EURUSD, XAUUSD, BTCUSDT.
- Pencatatan transaksi simulasi; data lokal tersimpan di browser.
- Jika pengguna masuk, snapshot pengaturan dan riwayat simulasi disinkronkan ke Supabase `user_app_state` dalam payload JSON. RLS membatasi setiap pengguna pada baris miliknya.
- Cadangan lokal dapat diekspor dan dipulihkan melalui JSON.
- Analisis BTCUSDT 15m: EMA 9/21, RSI 14, MACD, EMA 50/200 sebagai filter tren, dan support/resistance dari 20 candle.
- Backtest historis Bitunix Futures publik, dengan fee, slippage, ATR stop, target berbasis R, dan filter EMA 50/200.
- Proxy Vercel `/api/market` hanya membaca data publik Bitunix Futures; simbol BTCUSDT/ETHUSDT dan interval yang diizinkan dibatasi di server.

## Hasil audit strategi

Audit historis sebelumnya menggunakan 5.000 candle per timeframe (5m, 15m, 1h), modal 50 USDT, risiko 1%, fee 0,06% dan slippage 0,02% per sisi. Semua 15 varian yang diuji pada audit itu menghasilkan P/L bersih negatif. Varian dengan kerugian paling kecil adalah EMA 50/200 + ADX 25 pada 15m, hasil -1,80 USDT dan profit factor 0,93. Ini bukan bukti profitabilitas dan tidak boleh dipakai sebagai dasar live trading.

Backtest di aplikasi dan audit CI adalah simulasi historis, bukan jaminan hasil masa depan. Funding, spread dinamis, likuidasi, latensi, partial fills, dan seluruh aturan kontrak belum tentu dimodelkan.

## Arsitektur

- Frontend: `index.html`, `manifest.json`, `sw.js`, `icon.svg`; Android wrapper: `android/` native Java WebView app.
- Market proxy: `api/market.js` (Futures) dan `api/spot-market.js` (Spot) pada Vercel.
- Cloud paper engine: `cloudflare-worker/src/index.js` untuk Spot dan Futures terpisah; tombol kontrol tersedia di Pengaturan aplikasi.
- Android build: `.github/workflows/android-apk.yml`; lihat `ANDROID-APK.md`.
- Cloud state: Supabase Auth dan tabel `public.user_app_state`.
- RLS pada tabel pengguna menggunakan `auth.uid() = user_id`.
- Tidak ada API key Bitunix di frontend; endpoint market saat ini tidak menerima kredensial dan tidak memiliki endpoint order.

## Batasan yang belum selesai

- Tidak ada eksekusi order Bitunix, baik demo maupun live.
- Ketersediaan demo di aplikasi Bitunix tidak berarti tersedia API order demo eksternal. Jangan menganggap endpoint market publik sebagai koneksi trading.
- Belum ada Expert Advisor MT5/bridge Windows atau VPS.
- Proyek kini memiliki aplikasi Android Java WebView dan workflow build APK debug; APK belum diverifikasi/ditandatangani sebagai rilis Play Store.
- Email pemulihan password memerlukan SMTP/domain terverifikasi agar pengiriman dapat diandalkan.
- Sinkronisasi cloud harus tetap diuji dengan sesi pengguna dan pemeriksaan RLS; keberhasilan satu sesi bukan jaminan untuk semua kondisi jaringan/perangkat.
- Strategi belum lolos audit profitabilitas; live trading dinonaktifkan/tidak disediakan.

## Keamanan

- Jangan masukkan API secret, password broker, seed phrase, atau recovery phrase ke aplikasi maupun chat.
- Jangan menaruh Supabase service-role key atau Bitunix secret di browser.
- Hanya gunakan publishable/anon key dengan RLS di frontend.
- Backup JSON dapat berisi riwayat simulasi pribadi; simpan di tempat aman.
- Gunakan akun demo/simulasi. Jangan gunakan uang sungguhan dengan strategi yang belum tervalidasi.

## Menjalankan dan instalasi PWA

1. Buka domain produksi Vercel melalui HTTPS.
2. Di Android Chrome, buka menu ⋮ lalu pilih **Instal aplikasi** atau **Tambahkan ke layar utama** jika tersedia.
3. Untuk sinkronisasi cloud, masuk dengan akun Supabase.
4. Jika halaman lama masih tampil setelah deployment, tutup tab aplikasi, buka ulang, dan lakukan refresh. Service worker menggunakan versi cache berversi.

## Audit otomatis

Laporan CI dan artefak audit historis tersedia di:
https://github.com/etriminanto-tech/phantom-ea-lite/actions

## Dokumentasi API pasar

Proxy mengacu pada dokumentasi resmi Bitunix Futures market:
- https://www.bitunix.com/api-docs/futures/market/get_kline
- https://www.bitunix.com/api-docs/futures/market/get_tickers.html

Endpoint ini hanya untuk data publik read-only. Tidak boleh digunakan sebagai bukti bahwa order trading otomatis telah tersedia.


## Android APK build

The `bitunix-spot-demo` branch includes a Capacitor Android wrapper and a GitHub Actions workflow. On a successful workflow run, download the `phantom-ea-lite-android-debug-apk` artifact. The debug APK is sideloadable but is not a Play Store release. See [ANDROID-APK.md](./ANDROID-APK.md).

## Cloud Spot and Futures controls

The settings screen includes independent start/stop/reset controls for Spot and Futures. Configure the deployed Cloudflare Worker URL and private control token there. Each market uses a separate virtual 50 USDT account. The Worker has a five-minute Cron schedule and is limited by Cloudflare Free quotas. It does not submit Bitunix orders.
