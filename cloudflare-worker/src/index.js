const KEY = "phantom-spot-state-v1";
const BASE = "https://openapi.bitunix.com";
const SYMBOL = "BTCUSDT";
const FEE = 0.001; // conservative paper-trading assumption: 0.10% per side

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" }
  });
}
function authorized(request, env) {
  const expected = env.CONTROL_TOKEN;
  return Boolean(expected && request.headers.get("authorization") === `Bearer ${expected}`);
}
function num(v) { const n = Number(v); return Number.isFinite(n) ? n : NaN; }
function ema(values, period) {
  if (values.length < period) return NaN;
  const k = 2 / (period + 1);
  let value = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  for (let i = period; i < values.length; i++) value = values[i] * k + value * (1 - k);
  return value;
}
function rsi(values, period = 14) {
  if (values.length <= period) return NaN;
  let gain = 0, loss = 0;
  for (let i = 1; i <= period; i++) {
    const d = values[i] - values[i - 1];
    if (d > 0) gain += d; else loss -= d;
  }
  let avgGain = gain / period, avgLoss = loss / period;
  for (let i = period + 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    avgGain = (avgGain * (period - 1) + Math.max(d, 0)) / period;
    avgLoss = (avgLoss * (period - 1) + Math.max(-d, 0)) / period;
  }
  return avgLoss === 0 ? 100 : 100 - 100 / (1 + avgGain / avgLoss);
}
async function getCandles() {
  const url = new URL("/api/spot/v1/market/kline", BASE);
  url.searchParams.set("symbol", SYMBOL);
  url.searchParams.set("interval", "5");
  url.searchParams.set("limit", "200");
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Bitunix HTTP ${response.status}`);
  const body = await response.json();
  if (Number(body.code) !== 0) throw new Error(body.msg || "Bitunix API returned an error");
  const rows = Array.isArray(body.data) ? body.data : (body.data?.list || body.data?.data || []);
  const candles = rows.map(c => ({
    open: num(c.open), high: num(c.high), low: num(c.low), close: num(c.close),
    ts: c.ts ?? c.time ?? c.timestamp
  })).filter(c => [c.open, c.high, c.low, c.close].every(Number.isFinite))
    .sort((a, b) => String(a.ts).localeCompare(String(b.ts)));
  if (candles.length < 200) throw new Error("Belum menerima 200 candle Spot yang valid");
  return candles;
}
async function cycle(env) {
  const state = await env.STATE.get(KEY, "json") || {
    enabled: false, initialCash: 50, cash: 50, position: null,
    trades: [], lastCandle: null, lastRun: null, status: "Berhenti"
  };
  if (!state.enabled) return;
  const candles = await getCandles();
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
  const price = last.close;
  const candleKey = String(last.ts);
  let event = "Tidak ada transaksi virtual";
  if (state.position) {
    const p = state.position;
    const exitReason = price <= p.stop ? "STOP_LOSS" : price >= p.target ? "TAKE_PROFIT" :
      (price < fast || strength < 45 ? "SIGNAL_EXIT" : null);
    if (exitReason) {
      const proceeds = p.qty * price;
      const fee = proceeds * FEE;
      const pnl = proceeds - fee - p.cost;
      state.cash += proceeds - fee;
      state.trades.unshift({ side: "SELL", price, qty: p.qty, pnl, reason: exitReason, at: new Date().toISOString() });
      state.trades = state.trades.slice(0, 100);
      state.position = null;
      event = `Posisi ditutup: ${exitReason}; P/L ${pnl.toFixed(4)} USDT`;
    } else event = "Posisi BUY virtual masih terbuka";
  } else if (state.lastCandle !== candleKey && fast > slow && price > fast && strength >= 50 && strength <= 68) {
    const riskBudget = Math.max(0, state.cash) * 0.01;
    const stopDistance = atr * 1.5;
    const qtyByRisk = riskBudget / stopDistance;
    const qtyByCash = state.cash / (price * (1 + FEE));
    const qty = Math.min(qtyByRisk, qtyByCash);
    if (qty > 0 && qty * price >= 1) {
      const cost = qty * price, fee = cost * FEE;
      state.cash -= cost + fee;
      state.position = { side: "BUY", entry: price, qty, cost: cost + fee,
        stop: price - stopDistance, target: price + stopDistance * 2, openedAt: new Date().toISOString() };
      state.trades.unshift({ side: "BUY", price, qty, pnl: null, reason: "EMA50>EMA200 + RSI", at: new Date().toISOString() });
      state.trades = state.trades.slice(0, 100);
      event = `BUY virtual dibuka; entry ${price}; SL ${state.position.stop}; TP ${state.position.target}`;
    } else event = "Sinyal BUY ada, tetapi ukuran posisi di bawah minimum simulasi";
    state.lastCandle = candleKey;
  } else {
    state.lastCandle = candleKey;
    event = fast <= slow ? "Tidak BUY: tren EMA belum bullish" : "Menunggu konfirmasi BUY";
  }
  const equity = state.cash + (state.position ? state.position.qty * price : 0);
  state.market = { symbol: SYMBOL, price, ema50: fast, ema200: slow, rsi14: strength,
    support: Math.min(...recent.map(c => c.low)), resistance: Math.max(...recent.map(c => c.high)),
    candle: candleKey, source: "Bitunix Spot public API" };
  state.equity = equity;
  state.lastRun = new Date().toISOString();
  state.lastEvent = event;
  state.status = "Berjalan • simulasi saja";
  await env.STATE.put(KEY, JSON.stringify(state));
}
export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!authorized(request, env)) return json({ ok: false, error: "Unauthorized" }, 401);
    if (request.method === "GET" && url.pathname === "/status") {
      const state = await env.STATE.get(KEY, "json") || { enabled: false, status: "Belum dikonfigurasi" };
      return json({ ok: true, mode: "PAPER_TRADING_ONLY", state });
    }
    if (request.method === "POST" && url.pathname === "/command") {
      let body;
      try { body = await request.json(); } catch { return json({ ok: false, error: "Invalid JSON" }, 400); }
      const state = await env.STATE.get(KEY, "json") || {
        enabled: false, initialCash: 50, cash: 50, position: null, trades: [],
        lastCandle: null, lastRun: null, status: "Berhenti"
      };
      if (body.command === "start") { state.enabled = true; state.status = "Menunggu siklus Cron berikutnya"; }
      else if (body.command === "stop") { state.enabled = false; state.status = "Dihentikan"; }
      else if (body.command === "reset") {
        Object.assign(state, { enabled: false, initialCash: 50, cash: 50, position: null, trades: [], lastCandle: null, equity: 50, status: "Reset • berhenti" });
      } else return json({ ok: false, error: "Command must be start, stop, or reset" }, 400);
      await env.STATE.put(KEY, JSON.stringify(state));
      return json({ ok: true, mode: "PAPER_TRADING_ONLY", state });
    }
    return json({ ok: false, error: "Not found" }, 404);
  },
  async scheduled(controller, env, ctx) {
    ctx.waitUntil(cycle(env).catch(async error => {
      const state = await env.STATE.get(KEY, "json") || { enabled: false };
      state.lastError = String(error.message || error);
      state.lastRun = new Date().toISOString();
      state.status = "Kesalahan siklus; periksa log";
      await env.STATE.put(KEY, JSON.stringify(state));
    }));
  }
};
