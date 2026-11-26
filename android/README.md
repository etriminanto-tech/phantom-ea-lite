# Phantom EA Lite Android app

This repository contains an installable Android APK project. The current Android shell is a WebView-based hybrid app that loads the Phantom EA Lite interface from:

`https://phantom-ea-lite.vercel.app/`

It is an Android package, but the interface and market API still depend on the hosted Vercel service and an internet connection. It is not a fully native Android trading engine.

GitHub Actions builds a debug APK at `android/app/build/outputs/apk/debug/app-debug.apk` and uploads it as the `Phantom-EA-Lite-Android-debug` workflow artifact.

The current implementation reads public Bitunix Futures market data and supports local paper-trading simulation only. It does not send orders to Bitunix and does not connect to an MT5 terminal or Expert Advisor. A successful APK build does not, by itself, prove the hosted service or in-app market commands work.
