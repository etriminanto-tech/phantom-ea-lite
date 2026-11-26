# Phantom EA Lite — Bitunix Spot Cloud Paper Engine

This Worker is a **paper-trading simulator only**. It reads public Bitunix Spot candles and never submits exchange orders. It does not need a Bitunix API key or secret.

## Free Cloudflare setup

1. Create a free Cloudflare account.
2. Create a Workers KV namespace named `PHANTOM_STATE`.
3. Replace `REPLACE_WITH_YOUR_KV_NAMESPACE_ID` in `wrangler.toml` with the namespace ID.
4. Install Wrangler locally: `npm install -g wrangler`, then run `wrangler login`.
5. Set a long random control token: `npx wrangler secret put CONTROL_TOKEN`.
6. Deploy from this directory: `npx wrangler deploy`.
7. The Worker runs every five minutes. It only evaluates markets when the user has issued the authenticated `start` command.

## API

All routes require `Authorization: Bearer YOUR_CONTROL_TOKEN`.

- `GET /status` — latest paper account state.
- `POST /command` with JSON `{"command":"start"}` — start scheduled paper simulation.
- `POST /command` with JSON `{"command":"stop"}` — stop new cycles.
- `POST /command` with JSON `{"command":"reset"}` — reset virtual balance to 50 USDT and stop.

## Current strategy and assumptions

- Pair: BTCUSDT Spot.
- Candle interval: 5 minutes.
- BUY only when EMA50 > EMA200, close > EMA50, and RSI14 is 50–68.
- Paper risk budget: 1% of available cash.
- Stop: 1.5 ATR; target: 3 ATR (2R).
- Exit also occurs when price falls below EMA50 or RSI14 < 45.
- Paper fee assumption: 0.10% per side. Actual exchange fees vary.
- Virtual starting cash: 50 USDT.
- SELL closes a virtual long position; the engine does not short Spot.

## Important free-tier limits

Cloudflare Workers Free currently documents 100,000 requests/day and 10 ms CPU time per Cron invocation. The 5-minute schedule is 288 scheduled invocations/day. Network wait time is not counted as CPU time, but computation is. Monitor Worker logs for CPU-limit or API errors.

Free services have no uptime guarantee. A scheduled run can fail because of provider maintenance, quota limits, Bitunix availability, or deployment/configuration errors. This is not a guaranteed 24/7 production trading server.

## Not yet included

- No live Bitunix order execution.
- No guarantee that the indicator strategy is profitable.
- No Android APK build or dashboard-to-Worker integration in this Worker scaffold.
- KV namespace and CONTROL_TOKEN must be configured by the account owner before deployment.
- Do not put the control token, Bitunix secrets, passwords, or recovery phrases in a public repository or chat.
