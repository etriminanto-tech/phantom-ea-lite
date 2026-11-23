# Phantom EA Lite

Dashboard PWA berbahasa Indonesia untuk latihan dan simulasi manajemen risiko.

## Status rilis awal
- Dashboard ramah Android.
- Modal simulasi awal 50 USDT.
- Risiko awal 1% per transaksi (batas simulasi 2%).
- Instrumen latihan EURUSD, XAUUSD, BTCUSDT.
- Pencatatan transaksi simulasi manual.
- Tidak terhubung ke broker atau exchange dan tidak mengirim order.

## Menjalankan
Buka `index.html` melalui server HTTPS atau aktifkan GitHub Pages dari Settings → Pages → Deploy from a branch → main → /(root). Setelah situs aktif, buka URL Pages di Android Chrome dan pilih Tambahkan ke layar utama.

## Peringatan dan batasan
Semua transaksi yang dicatat di versi ini adalah simulasi lokal di browser. Data belum disimpan ke server dan dapat hilang ketika data browser dibersihkan. Jangan masukkan API key, password broker, seed phrase, atau recovery phrase.

Integrasi Bitunix harus dibangun dan diuji pada demo/testnet terlebih dahulu dengan backend aman. Otomasi MetaTrader 5 memerlukan terminal MT5 desktop yang berjalan pada Windows/VPS; aplikasi MT5 Android tidak menjalankan Expert Advisor. Live trading tidak disediakan pada versi ini.
