import express from "express";
import { createHmac, timingSafeEqual } from "node:crypto";

const app = express();
app.use(express.json({ limit: "32kb" }));
const port = Number(process.env.PORT || 4000);
const currencies = ["usdttrc20", "usdterc20", "btc", "eth", "usdc"];

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "animepay-api", mode: "demo" }));
app.get("/api/currencies", (_req, res) => res.json({ currencies, source: "demo", note: "Replace with provider account's live currency endpoint." }));
app.get("/api/merchant/summary", (_req, res) => res.json({
  mode: "demo",
  availableBalance: "0.00",
  pendingBalance: "0.00",
  totalPayments: 1284,
  successfulPayments: 1198,
  volumeUsd: "24850.00",
  recentPayments: [
    { id: "AP-2048", customer: "Customer A", asset: "USDT TRC20", amount: "125.00", status: "confirmed", date: "Today, 10:42" },
    { id: "AP-2047", customer: "Customer B", asset: "ETH", amount: "0.042", status: "pending", date: "Today, 09:18" },
    { id: "AP-2046", customer: "Customer C", asset: "BTC", amount: "0.0018", status: "confirmed", date: "Yesterday" }
  ]
}));
app.post("/api/checkout", (_req, res) => res.status(501).json({ error: "Checkout is disabled. Configure and test a payment provider integration before enabling live payments." }));
app.post("/api/withdrawals", (_req, res) => res.status(501).json({ error: "Withdrawals are disabled until authentication, custody, ledger, compliance checks, and approval controls are implemented." }));

// Example signature helper for future provider webhook integration. Do not enable crediting
// until the provider's exact signing scheme and raw-body handling are implemented and tested.
export function verifyHmacSha512(rawBody: string, signature: string, secret: string) {
  if (!secret || !signature) return false;
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

app.listen(port, "0.0.0.0", () => console.log(`AnimePay API listening on ${port} (demo mode)`));
