const BASE_SPOT = "https://openapi.bitunix.com";
const BASE_FUTURES = "https://fapi.bitunix.com";
const SYMBOL = "BTCUSDT";
const FEE_SPOT = 0.001;
const FEE_FUTURES = 0.0006;
const START_BALANCE = 50;
const LEVERAGE = 1;

function json(data, status = 200, origin = "*") {
  return new Response(JSON.stringify(data), {
    status, headers: {
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "Authorization, Content-Type",
      "vary": "Origin"
    }
  });
}
function authorized(request, env) {
  return Boolean(env.CONTROL_TOKEN && request.headers.get("authorization") === `Bearer ${env.CONTROL_TOKEN}`);
}
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : NaN; }
function timeValue(v) { const n = Number(v); return Number.isFinite(n) ? n : Date.parse(v); }
function keyFor(market) { return `phantom-${market}-state-v1`; }
function freshState(market) {
  return { marketType: market, enabled: false, initialCash: START_BALANCE, cash: START_BALANCE,
    equity: START_BALANCE, leverage: market === "futures" ? LEVERAGE : null,
    position: null, trades: [], lastCandle: null, lastRun: null, status: "Berhenti" };
}
function ema(values, period) {
  if (values.length < period) return NaN;
  const k = 2 / (period + 1);
  let v = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) v = values[i] * k + v * (1 - k);
  return v;
}
function rsi(values, period = 14) {
  if (values.length <= period) return NaN;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d > 0) gain += d; else loss -= d;
  }
  let ag = gain / period, al = loss / period;
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    ag = (ag * (period - 1) + Math.max(d, 0)) / period;
    al = (al * (period - 1) + Math.max(-d, 0)) / period;
  }
  return al === 0 ? 100 : 100 - 100 / (1 + ag / al);
}
async function getCandles(market) {
  const futures = market === "futures";
  const base = futures ? BASE_FUTURES : BASE_SPOT;
  const path = futures ? "/api/v1/futures/market/kline" : "/api/spot/v1/market/kline";
  const url = new URL(path, base);
  url.searchParams.set("symbol", SYMBOL);
  url.searchParams.set("interval", "5m" && futures ? "5m" : "5");
  url.searchParams.set("limit", "200");
  if (futures) url.searchParams.set("type", "MARK_PRICE");
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Bitunix ${market} HTTP ${response.status}`);
  const body = await response.json();
  if (Number(body.code) !== 0) throw new Error(body.msg || `Bitunix ${market} API error`);
  const rows = Array.isArray(body.data) ? body.data : (body.data?.list || body.data?.data || []);
  const candles = rows.map(c => ({
    open: num(c.open), high: num(c.high), low: num(c.low), close: num(c.close),
    ts: c.time ?? c.ts ?? c.timestamp
  })).filter(c => [c.open, c.high, c.low, c.close].every(Number.isFinite))
    .sort((a, b) => timeValue(a.ts) - timeValue(b.ts));
  if (candles.length < 200) throw new Error(`Data candle ${market} valid kurang dari 200`);
  return candles;
}
function metrics(candles) {
  const closes = candles.map(c => c.close);
  const last = candles[candles.length - 1];
  const fast = ema(closes, 50), slow = ema(closes, 200), strength = rsi(closes, 14);
  const recent = candles.slice(-15);
  let tr = 0;
  for (let i = 1; i < recent.length; i++) {
    const c = recent[i], prev = recent[i - 1].close;
    tr += Math.max(c.high - c.low, Math.abs(c.high - prev), Math.abs(c.low - prev));
  }
  const atr = tr / (recent.length - 1);
  if (![fast, slow, strength, atr].every(Number.isFinite) || atr <= 0) throw new Error("Indikator tidak valid");
  return { last, fast, slow, strength, atr, recent };
}
async function cycle(market, env) {
  const key = keyFor(market);
  const state = await env.STATE.get(key, "json") || freshState(market);
  if (!state.enabled) return;
  const candles = await getCandles(market);
  const { last, fast, slow, strength, atr, recent } = metrics(candles);
  const price = last.close, candleKey = String(last.ts);
  let event = "Tidak ada transaksi virtual";
  if (market === "spot") {
    if (state.position) {
      const p = state.position;
      const reason = price <= p.stop ? "STOP_LOSS" : price >= p.target ? "TAKE_PROFIT" :
        (price < fast || strength < 45 ? "SIGNAL_EXIT" : null);
      if (reason) {
        const proceeds = p.qty * price, fee = proceeds * FEE_SPOT, pnl = proceeds - fee - p.cost;
        state.cash += proceeds - fee;
        state.trades.unshift({ side: "SELL", price, qty: p.qty, pnl, reason, at: new Date().toISOString() });
        state.trades = state.trades.slice(0, 100); state.position = null;
        event = `Spot ditutup: ${reason}; P/L ${pnl.toFixed(4)} USDT`;
      } else event = "Posisi Spot BUY virtual masih terbuka";
    } else if (state.lastCandle !== candleKey && fast > slow && price > fast && strength >= 50 && strength <= 68) {
      const riskBudget = state.cash * 0.01, stopDistance = atr * 1.5;
      const qty = Math.min(riskBudget / stopDistance, state.cash / (price * (1 + FEE_SPOT)));
      if (qty > 0 && qty * price >= 1) {
        const cost = qty * price, fee = cost * FEE_SPOT;
        state.cash -= cost + fee;
        state.position = { side: "BUY", entry: price, qty, cost: cost + fee,
          stop: price - stopDistance, target: price + stopDistance * 2, openedAt: new Date().toISOString() };
        state.trades.unshift({ side: "BUY", price, qty, reason: "EMA50>EMA200 + RSI", at: new Date().toISOString() });
        state.trades = state.trades.slice(0, 100);
        event = `Spot BUY virtual; entry ${price}; SL ${state.position.stop}; TP ${state.position.target}`;
      } else event = "Sinyal Spot BUY, ukuran di bawah minimum simulasi";
      state.lastCandle = candleKey;
    } else {
      state.lastCandle = candleKey;
      event = fast <= slow ? "Spot menunggu tren bullish" : "Spot menunggu konfirmasi BUY";
    }
    state.equity = state.cash + (state.position ? state.position.qty * price : 0);
  } else {
    if (state.position) {
      const p = state.position, direction = p.side === "LONG" ? 1 : -1;
      const unrealized = (price - p.entry) * p.qty * direction;
      const liquidationGuard = unrealized <= -(p.margin * 0.9);
      const reason = liquidationGuard ? "SIMULATED_MARGIN_GUARD" :
        (p.side === "LONG" ? (price <= p.stop ? "STOP_LOSS" : price >= p.target ? "TAKE_PROFIT" : (price < fast || strength < 45 ? "SIGNAL_EXIT" : null))
          : (price >= p.stop ? "STOP_LOSS" : price <= p.target ? "TAKE_PROFIT" : (price > fast || strength > 55 ? "SIGNAL_EXIT" : null)));
      if (reason) {
        const pnl = unrealized, exitFee = p.qty * price * FEE_FUTURES;
        state.cash += p.margin + pnl - exitFee;
        state.trades.unshift({ side: p.side === "LONG" ? "CLOSE_LONG" : "CLOSE_SHORT", price, qty: p.qty,
          pnl: pnl - p.entry * p.qty * FEE_FUTURES - exitFee, reason, at: new Date().toISOString() });
        state.trades = state.trades.slice(0, 100); state.position = null;
        event = `Futures ${p.side} ditutup: ${reason}; P/L bersih ${(pnl - p.entry * p.qty * FEE_FUTURES - exitFee).toFixed(4)} USDT`;
      } else event = `Futures ${p.side} virtual masih terbuka`;
    } else if (state.lastCandle !== candleKey) {
      const side = fast > slow && price > fast && strength >= 50 && strength <= 68 ? "LONG" :
        (fast < slow && price < fast && strength >= 32 && strength <= 50 ? "SHORT" : null);
      if (side) {
        const direction = side === "LONG" ? 1 : -1;
        const stopDistance = atr * 1.5, riskBudget = state.cash * 0.01;
        const qtyByRisk = riskBudget / stopDistance;
        const qtyByMarginCap = (state.cash * 0.25 * LEVERAGE) / price;
        const qty = Math.min(qtyByRisk, qtyByMarginCap);
        const notional = qty * price, margin = notional / LEVERAGE;
        const entryFee = notional * FEE_FUTURES;
        if (qty > 0 && notional >= 1 && margin + entryFee <= state.cash) {
          state.cash -= margin + entryFee;
          state.position = { side, entry: price, qty, margin, leverage: LEVERAGE,
            stop: price - direction * stopDistance,
            target: price + direction * stopDistance * 2, openedAt: new Date().toISOString() };
          state.trades.unshift({ side, price, qty, leverage: LEVERAGE, reason: "EMA50/200 + RSI", at: new Date().toISOString() });
          state.trades = state.trades.slice(0, 100);
          event = `Futures ${side} virtual dibuka @ ${price}; leverage 1x; SL ${state.position.stop}; TP ${state.position.target}`;
        } else event = "Sinyal Futures ada, tetapi margin/ukuran di bawah minimum";
      } else event = "Futures menunggu sinyal LONG/SHORT";
      state.lastCandle = candleKey;
    }
    const p = state.position;
    state.equity = state.cash + (p ? p.margin + (price - p.entry) * p.qty * (p.side === "LONG" ? 1 : -1) : 0);
  }
  state.market = { symbol: SYMBOL, price, ema50: fast, ema200: slow, rsi14: strength,
    support: Math.min(...recent.map(c => c.low)), resistance: Math.max(...recent.map(c => c.high)),
    candle: candleKey, priceType: market === "futures" ? "MARK_PRICE" : "LAST_PRICE",
    source: `Bitunix ${market} public API` };
  state.lastRun = new Date().toISOString(); state.lastEvent = event;
  state.status = `Berjalan • ${market.toUpperCase()} simulasi saja`;
  await env.STATE.put(key, JSON.stringify(state));
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = request.headers.get("origin") || "*";
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: {
      "access-control-allow-origin": origin,
      "access-control-allow-methods": "GET, POST, OPTIONS",
      "access-control-allow-headers": "Authorization, Content-Type",
      "access-control-max-age": "86400",
      "vary": "Origin"
    }});
    if (!authorized(request, env)) return json({ ok: false, error: "Unauthorized" }, 401, origin);
    if (request.method === "GET" && url.pathname === "/status") {
      const spot = await env.STATE.get(keyFor("spot"), "json") || freshState("spot");
      const futures = await env.STATE.get(keyFor("futures"), "json") || freshState("futures");
      return json({ ok: true, mode: "PAPER_TRADING_ONLY", spot, futures }, 200, origin);
    }
    if (request.method === "POST" && url.pathname === "/command") {
      let body;
      try { body = await request.json(); } catch { return json({ ok: false, error: "Invalid JSON" }, 400, origin); }
      const market = body.market === "futures" ? "futures" : body.market === "spot" ? "spot" : null;
      if (!market) return json({ ok: false, error: "market must be spot or futures" }, 400, origin);
      const key = keyFor(market), state = await env.STATE.get(key, "json") || freshState(market);
      if (body.command === "start") { state.enabled = true; state.status = "Menunggu siklus Cron berikutnya"; }
      else if (body.command === "stop") { state.enabled = false; state.status = "Dihentikan"; }
      else if (body.command === "reset") Object.assign(state, freshState(market), { status: "Reset • berhenti" });
      else return json({ ok: false, error: "command must be start, stop, or reset" }, 400, origin);
      await env.STATE.put(key, JSON.stringify(state));
      return json({ ok: true, mode: "PAPER_TRADING_ONLY", state }, 200, origin);
    }
    return json({ ok: false, error: "Not found" }, 404, origin);
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(Promise.all(["spot", "futures"].map(market =>
      cycle(market, env).catch(async error => {
        const key = keyFor(market), state = await env.STATE.get(key, "json") || freshState(market);
        state.lastError = String(error.message || error);
        state.lastRun = new Date().toISOString();
        state.status = "Kesalahan siklus; periksa log";
        await env.STATE.put(key, JSON.stringify(state));
      })
    )));
  }
};
