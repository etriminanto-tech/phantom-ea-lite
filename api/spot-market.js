// Public, read-only Bitunix Spot market proxy.
// This endpoint never accepts credentials and never places orders.
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

  const params = new URLSearchParams({ symbol });
  let path;
  if (type === "ticker") {
    path = "/api/spot/v1/market/last_price";
  } else if (type === "kline") {
    const interval = String(req.query.interval || "15");
    const allowedIntervals = new Set(["1", "3", "5", "15", "30", "60", "120", "240", "360", "720", "D", "W", "M"]);
    if (!allowedIntervals.has(interval)) {
      return res.status(400).json({ ok: false, error: "Interval not allowed" });
    }
    const limit = Math.min(200, Math.max(10, Number.parseInt(req.query.limit || "100", 10) || 100));
    params.set("interval", interval);
    params.set("limit", String(limit));
    path = "/api/spot/v1/market/kline";
  } else {
    return res.status(400).json({ ok: false, error: "Unknown market data type" });
  }

  try {
    const upstream = await fetch("https://openapi.bitunix.com" + path + "?" + params.toString(), {
      headers: { Accept: "application/json" }
    });
    const body = await upstream.json();
    if (!upstream.ok || Number(body.code) !== 0) {
      return res.status(502).json({
        ok: false,
        error: "Bitunix Spot market API error",
        upstreamStatus: upstream.status,
        detail: body.msg || "Unexpected response"
      });
    }
    return res.status(200).json({
      ok: true,
      source: "Bitunix Spot public API",
      type,
      symbol,
      data: body.data,
      fetchedAt: new Date().toISOString()
    });
  } catch {
    return res.status(502).json({ ok: false, error: "Could not reach Bitunix Spot public API" });
  }
}
