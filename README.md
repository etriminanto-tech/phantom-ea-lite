# Phantom EA Lite

Dashboard PWA berbahasa Indonesia untuk latihan dan simulasi manajemen risiko.

## Status rilis simulasi v1.1
- Dashboard ramah Android.
- Modal simulasi awal 50 USDT.
- Risiko awal 1% per transaksi (batas simulasi 2%).
- Instrumen latihan EURUSD, XAUUSD, BTCUSDT.
- Pencatatan transaksi simulasi manual.
- Tidak terhubung ke broker atau exchange dan tidak mengirim order.
- Audit strategi otomatis tersedia melalui GitHub Actions.
- Hasil audit terakhir: seluruh 15 kombinasi timeframe/varian menghasilkan P/L bersih negatif; varian terbaik adalah EMA 50/200 + ADX 25 pada 15m dengan hasil -1,80 USDT dan profit factor 0,93 dari modal 50 USDT.

## Audit otomatis terakhir
Laporan dijalankan pada 23 November 2026 dengan 5.000 candle untuk setiap timeframe (5m, 15m, 1h), risiko 1%, fee 0,06% dan slippage 0,02% per sisi. Hasil lengkap dan artefak: https://github.com/etriminanto-tech/phantom-ea-lite/actions/runs/45098396703

## Menjalankan
Buka `index.html` melalui server HTTPS atau aktifkan GitHub Pages dari Settings → Pages → Deploy from a branch → main → /(root). Setelah situs aktif, buka URL Pages di Android Chrome dan pilih Tambahkan ke layar utama.

## Peringatan dan batasan
Semua transaksi yang dicatat di versi ini adalah simulasi lokal di browser. Data belum disimpan ke server dan dapat hilang ketika data browser dibersihkan. Jangan masukkan API key, password broker, seed phrase, atau recovery phrase.

Integrasi Bitunix harus dibangun dan diuji pada demo/testnet terlebih dahulu dengan backend aman. Otomasi MetaTrader 5 memerlukan terminal MT5 desktop yang berjalan pada Windows/VPS; aplikasi MT5 Android tidak menjalankan Expert Advisor. Live trading tidak disediakan pada versi ini.

## Deploy dengan Vercel untuk proxy API publik

GitHub Pages hanya menyajikan file statis dan tidak menjalankan `api/market.js`. Untuk tombol harga Bitunix, impor repositori ini ke Vercel dan deploy sebagai project dari root repository. Vercel akan menjalankan fungsi serverless `/api/market` yang hanya meneruskan permintaan data publik ticker/kline dengan daftar simbol dan interval yang dibatasi. Fungsi ini tidak menerima API key dan tidak memiliki endpoint order.

Setelah deploy, gunakan domain Vercel project sebagai alamat aplikasi. GitHub Pages tetap dapat dipakai untuk versi dashboard statis, tetapi tombol data pasar memerlukan domain Vercel.
