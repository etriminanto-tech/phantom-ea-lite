# Phantom EA Lite — Bitunix Spot + Futures Cloud Paper Engine

**Simulation only. No real orders are sent.** Both modules use public Bitunix market data and do not require Bitunix API keys or secrets.

## Cloudflare free deployment

1. Create a free Cloudflare account.
2. Create a Workers KV namespace named `PHANTOM_STATE`.
3. Copy the namespace ID into `wrangler.toml` (replace the placeholder).
4. Install Wrangler: `npm install -g wrangler`; authenticate with `wrangler login`.
5. Set a long random token: `npx wrangler secret put CONTROL_TOKEN`.
6. Deploy: `npx wrangler deploy`.
7. Cron runs every five minutes; each market only runs after its own start command.

## Authenticated API

Every request requires `Authorization: Bearer YOUR_CONTROL_TOKEN`.

- `GET /status` — both Spot and Futures states.
- `POST /command` JSON `{"market":"spot","command":"start"}`
- `POST /command` JSON `{"market":"futures","command":"start"}`
- Stop either independently using `{"market":"futures","command":"stop"}` (or spot).
- Reset either independently using `{"market":"futures","command":"reset"}` (or spot).

## Strategy

Both use BTCUSDT 5-minute candles, EMA50/EMA200, RSI14, 15-candle ATR, and recent support/resistance. Each paper account starts separately with 50 USDT.

### Spot
- BUY only when EMA50 > EMA200, close > EMA50, RSI 50–68.
- Risk budget 1% of available cash; stop 1.5 ATR; target 3 ATR.
- Exit on stop, target, close below EMA50, or RSI below 45.
- Assumed fee 0.10% each side.

### Futures
- LONG when EMA50 > EMA200, close > EMA50, RSI 50–68.
- SHORT when EMA50 < EMA200, close < EMA50, RSI 32–50.
- Fixed isolated-style simulation at **1x leverage**; position margin capped at 25% of account cash; risk budget 1%.
- Stop 1.5 ATR; target 3 ATR; signal exit on EMA/RSI reversal.
- Uses public MARK_PRICE candles. Assumed taker fee 0.06% each side.
- A conservative 90%-of-position-margin loss guard forces a simulated close. This is **not** Bitunix's exact liquidation engine. Funding payments, maintenance margin tiers, slippage, partial fills and exchange-specific liquidation fees are not modeled.

## Important limitations

- No live trading, no API key, no account balance sync, and no order placement.
- Paper results are approximate and do not guarantee profitability.
- The Spot and Futures balances are independent virtual balances, not the Bitunix exchange demo account.
- Cloudflare Workers Free currently documents 100,000 requests/day and a 10 ms CPU limit per Cron invocation. The schedule is 288 invocations/day; the two market cycles are executed in the same scheduled event. Provider quotas and Bitunix API availability may interrupt runs.
- Free services have no uptime SLA. Logs and quota should be checked regularly.
- This Worker is a backend scaffold. The Android interface is not yet connected to these endpoints and no APK has been built.
- Keep CONTROL_TOKEN private. Never put it in public source code, chat, or a client-side APK.
