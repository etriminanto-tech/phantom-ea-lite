export default async function handler(req, res) {
  res.setHeader("Cache-Control", "s-maxage=5, stale-while-revalidate=10");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ ok: false, error: "Method not allowed" });
  }

  const type = String(req.query.type || "ticker");
  const symbol = String(req.query.symbol || "BTCUSDT").toUpperCase();
  const allowedSymbols = new Set(["BTCUSDT", "ETHUSDT"]);
  if (!allowedSymbols.has(symbol)) {
    return res.status(400).json({ ok: false, error: "Symbol not allowed" });
  }

  let path;
  const params = new URLSearchParams({ symbol });
  if (type === "ticker") {
    path = "/api/v1/futures/market/tickers";
    params.set("symbols", symbol);
    params.delete("symbol");
  } else if (type === "kline") {
    const interval = String(req.query.interval || "15m");
    const allowedIntervals = new Set(["1m", "5m", "15m", "30m", "1h", "4h", "1d"]);
    if (!allowedIntervals.has(interval)) {
      return res.status(400).json({ ok: false, error: "Interval not allowed" });
    }
    const limit = Math.min(200, Math.max(10, Number.parseInt(req.query.limit || "100", 10) || 100));
    const endTime = Number.parseInt(req.query.endTime || "", 10);
    if (req.query.endTime && (!Number.isSafeInteger(endTime) || endTime <= 0)) {
      return res.status(400).json({ ok: false, error: "Invalid endTime" });
    }
    path = "/api/v1/futures/market/kline";
    params.set("interval", interval);
    params.set("limit", String(limit));
    if (Number.isSafeInteger(endTime) && endTime > 0) params.set("endTime", String(endTime));
  } else {
    return res.status(400).json({ ok: false, error: "Unknown market data type" });
  }

  try {
    const upstream = await fetch("https://fapi.bitunix.com" + path + "?" + params.toString(), {
      headers: { Accept: "application/json" }
    });
    const body = await upstream.json();
    if (!upstream.ok || Number(body.code) !== 0) {
      return res.status(502).json({ ok: false, error: "Bitunix market API error", upstreamStatus: upstream.status, detail: body.msg || "Unexpected response" });
    }
    return res.status(200).json({ ok: true, source: "Bitunix Futures public API", type, symbol, data: body.data, fetchedAt: new Date().toISOString() });
  } catch (error) {
    return res.status(502).json({ ok: false, error: "Could not reach Bitunix public API" });
  }
}