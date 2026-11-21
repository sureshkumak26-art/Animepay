import express, { Request, Response, NextFunction } from "express";
import path from "node:path";
import { createHmac, timingSafeEqual, randomUUID } from "node:crypto";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import helmet from "helmet";

const app = express();
app.set("trust proxy", 1);
app.use(helmet());
type RawRequest = Request & { rawBody?: Buffer };
app.use(express.json({ limit: "64kb", verify: (req, _res, buf) => { (req as RawRequest).rawBody = Buffer.from(buf); } }));
const port = Number(process.env.PORT || 4000);
const currencies = ["usdttrc20", "usdterc20", "btc", "eth", "usdc"];
const SESSION_COOKIE = "animepay_admin";
const SESSION_SECONDS = 8 * 60 * 60;
type AdminClaims = { sub: string; role: "admin"; iat: number; exp: number };

function signToken(email: string) {
  const now = Math.floor(Date.now() / 1000);
  const head = Buffer.from(JSON.stringify({ alg: "HS256", typ: "JWT" })).toString("base64url");
  const body = Buffer.from(JSON.stringify({ sub: email, role: "admin", iat: now, exp: now + SESSION_SECONDS })).toString("base64url");
  const input = head + "." + body;
  return input + "." + createHmac("sha256", process.env.SESSION_SECRET!).update(input).digest("base64url");
}
function readCookie(req: Request, name: string) {
  const item = (req.headers.cookie || "").split(";").map(x => x.trim()).find(x => x.startsWith(name + "="));
  try { return item ? decodeURIComponent(item.slice(name.length + 1)) : ""; } catch { return ""; }
}
function verifyToken(token: string): AdminClaims | null {
  try {
    const parts = token.split(".");
    if (parts.length !== 3 || !process.env.SESSION_SECRET) return null;
    const input = parts[0] + "." + parts[1];
    const expected = createHmac("sha256", process.env.SESSION_SECRET).update(input).digest();
    const actual = Buffer.from(parts[2], "base64url");
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) return null;
    const claims = JSON.parse(Buffer.from(parts[1], "base64url").toString()) as AdminClaims;
    return claims.role === "admin" && claims.sub && claims.exp > Math.floor(Date.now() / 1000) ? claims : null;
  } catch { return null; }
}
function setAdminCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/", maxAge: SESSION_SECONDS * 1000 });
}
function requireSameOrigin(req: Request, res: Response, next: NextFunction) {
  const origin = req.get("origin");
  if (origin) {
    try { if (new URL(origin).host !== req.get("host")) return res.status(403).json({ error: "Cross-origin request blocked." }); }
    catch { return res.status(403).json({ error: "Invalid request origin." }); }
  }
  next();
}
function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const claims = verifyToken(readCookie(req, SESSION_COOKIE));
  if (!claims) return res.status(401).json({ error: "Admin authentication required." });
  res.locals.admin = claims; next();
}
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false, message: { error: "Too many login attempts. Try again later." } });

const supabaseUrl = () => (process.env.SUPABASE_URL || "").replace(/\/$/, "");
const supabaseKey = () => process.env.SUPABASE_SERVICE_ROLE_KEY || "";
async function db(pathname: string, init: RequestInit = {}) {
  if (!supabaseUrl() || !supabaseKey()) throw new Error("Supabase server credentials are not configured.");
  const headers = new Headers(init.headers);
  headers.set("apikey", supabaseKey());
  headers.set("Authorization", "Bearer " + supabaseKey());
  headers.set("Content-Type", "application/json");
  const response = await fetch(supabaseUrl() + "/rest/v1/" + pathname, { ...init, headers });
  const body = await response.text();
  if (!response.ok) throw new Error("Database request failed (" + response.status + "): " + body.slice(0, 300));
  return body ? JSON.parse(body) : null;
}
function sortKeys(value: any): any {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") return Object.keys(value).sort().reduce((out: any, key) => { out[key] = sortKeys(value[key]); return out; }, {});
  return value;
}
function validIpnSignature(payload: any, signature: string, secret: string) {
  const expected = createHmac("sha512", secret).update(JSON.stringify(sortKeys(payload))).digest();
  let actual: Buffer;
  try { actual = Buffer.from(signature, "hex"); } catch { return false; }
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
async function providerPayment(paymentId: string) {
  const key = process.env.NOWPAYMENTS_API_KEY || "";
  if (!key) throw new Error("NOWPayments API key is not configured.");
  const response = await fetch("https://api.nowpayments.io/v1/payment/" + encodeURIComponent(paymentId), { headers: { "x-api-key": key } });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("NOWPayments verification failed (" + response.status + ").");
  return data;
}
async function recordIpn(payload: any, signatureVerified: boolean, providerVerified: boolean) {
  await db("animepay_webhook_events", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({
    payment_id: String(payload.payment_id || ""), payment_status: String(payload.payment_status || "unknown"),
    signature_verified: signatureVerified, provider_verified: providerVerified, payload
  }) });
}
app.get("/api/health", (_req, res) => res.json({ ok: true, service: "animepay-api", mode: "production" }));
app.get("/api/currencies", (_req, res) => res.json({ currencies, source: process.env.NOWPAYMENTS_API_KEY ? "provider-configured" : "demo" }));

app.get("/api/admin/readiness", requireAdmin, async (_req, res) => {
  let database = false;
  if (supabaseUrl() && supabaseKey()) {
    try { await db("animepay_payments?select=id&limit=1"); database = true; } catch { database = false; }
  }
  const nowpayments = Boolean(process.env.NOWPAYMENTS_API_KEY && process.env.NOWPAYMENTS_IPN_SECRET);
  res.json({ adminAuthentication: true, paymentDatabase: database, nowpayments, withdrawals: false });
});
app.get("/api/merchant/summary", async (_req, res) => {
  try {
    const rows: any[] = await db("animepay_payments?select=order_id,payment_id,pay_currency,price_amount,price_currency,payment_status,created_at&order=created_at.desc&limit=10");
    const successful = rows.filter(x => x.payment_status === "finished");
    const total = successful.reduce((sum, x) => sum + Number(x.price_amount || 0), 0);
    return res.json({ mode: "live", availableBalance: total.toFixed(2), pendingBalance: rows.filter(x => !["finished","failed","expired","refunded"].includes(x.payment_status)).reduce((s,x)=>s+Number(x.price_amount||0),0).toFixed(2), totalPayments: rows.length, successfulPayments: successful.length, volumeUsd: total.toFixed(2), recentPayments: rows.map(x=>({id:x.order_id,customer:"Customer",asset:String(x.pay_currency).toUpperCase(),amount:String(x.price_amount),status:x.payment_status,date:x.created_at})) });
  } catch {
    return res.json({ mode: "demo", availableBalance: "0.00", pendingBalance: "0.00", totalPayments: 0, successfulPayments: 0, volumeUsd: "0.00", recentPayments: [] });
  }
});

app.post("/api/admin/login", requireSameOrigin, loginLimiter, async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const adminEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const passwordHash = process.env.ADMIN_PASSWORD_HASH || "";
  if (!adminEmail || !passwordHash || !process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) return res.status(503).json({ error: "Admin login is not configured. Set ADMIN_EMAIL, ADMIN_PASSWORD_HASH and a 32+ character SESSION_SECRET." });
  if (!email || !password || email !== adminEmail || !(await bcrypt.compare(password, passwordHash))) return res.status(401).json({ error: "Invalid email or password." });
  setAdminCookie(res, signToken(adminEmail));
  return res.json({ ok: true, admin: { email: adminEmail, role: "admin" } });
});
app.get("/api/admin/me", requireAdmin, (_req, res) => res.json({ authenticated: true, admin: { email: res.locals.admin.sub, role: "admin" } }));
app.post("/api/admin/logout", requireSameOrigin, (_req, res) => { res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict", path: "/" }); res.json({ ok: true }); });
app.get("/api/admin/overview", requireAdmin, async (_req, res) => {
  try {
    const payments = await db("animepay_payments?select=*&order=created_at.desc&limit=100");
    const withdrawals: any[] = [];
    return res.json({ dataConnected: true, payments, merchants: [], withdrawals, auditEvents: [] });
  } catch (error) {
    return res.json({ dataConnected: false, message: error instanceof Error ? error.message : "Database unavailable", payments: [], merchants: [], withdrawals: [], auditEvents: [] });
  }
});

app.post("/api/checkout", async (req, res) => {
  const apiKey = process.env.NOWPAYMENTS_API_KEY || "";
  if (!apiKey || !process.env.NOWPAYMENTS_IPN_SECRET) return res.status(503).json({ error: "NOWPayments credentials are not configured yet." });
  const amount = Number(req.body?.price_amount);
  const currency = String(req.body?.price_currency || "usd").toLowerCase();
  const payCurrency = String(req.body?.pay_currency || "").toLowerCase();
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000 || currency !== "usd" || !currencies.includes(payCurrency)) return res.status(400).json({ error: "Invalid amount or unsupported currency." });
  const orderId = "AP-" + randomUUID();
  try {
    await db("animepay_payments", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ order_id: orderId, price_amount: amount, price_currency: currency, pay_currency: payCurrency, payment_status: "creating" }) });
    const response = await fetch("https://api.nowpayments.io/v1/payment", {
      method: "POST", headers: { "x-api-key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ price_amount: amount, price_currency: currency, pay_currency: payCurrency, order_id: orderId, order_description: "AnimePay merchant payment " + orderId, ipn_callback_url: "https://animepay.vercel.app/api/nowpayments/ipn" })
    });
    const data: any = await response.json().catch(() => ({}));
    if (!response.ok || !data.payment_id) throw new Error(data.message || "NOWPayments could not create this payment.");
    await db("animepay_payments?order_id=eq." + encodeURIComponent(orderId), { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ payment_id: String(data.payment_id), pay_amount: data.pay_amount ?? null, pay_address: data.pay_address ?? null, invoice_url: data.invoice_url ?? null, payment_status: data.payment_status || "waiting", provider_payload: data }) });
    return res.status(201).json({ ok: true, order_id: orderId, payment_id: data.payment_id, pay_address: data.pay_address, pay_amount: data.pay_amount, pay_currency: data.pay_currency || payCurrency, payment_status: data.payment_status || "waiting", invoice_url: data.invoice_url });
  } catch (error) {
    return res.status(502).json({ error: error instanceof Error ? error.message : "Payment creation failed." });
  }
});

app.post("/api/nowpayments/ipn", async (req: RawRequest, res) => {
  const secret = process.env.NOWPAYMENTS_IPN_SECRET || "";
  const signature = String(req.get("x-nowpayments-sig") || "");
  const payload: any = req.body;
  if (!secret || !signature || !payload || typeof payload !== "object" || !validIpnSignature(payload, signature, secret)) return res.status(401).json({ error: "Invalid IPN signature." });
  const paymentId = String(payload.payment_id || "");
  if (!paymentId) return res.status(400).json({ error: "Missing payment_id." });
  try {
    const verified = await providerPayment(paymentId);
    if (String(verified.payment_id) !== paymentId || String(verified.order_id || "") !== String(payload.order_id || "") || String(verified.payment_status || "") !== String(payload.payment_status || "")) {
      await recordIpn(payload, true, false);
      return res.status(409).json({ error: "IPN does not match provider payment record." });
    }
    const matches: any[] = await db("animepay_payments?select=order_id,price_amount,price_currency,payment_id&payment_id=eq." + encodeURIComponent(paymentId) + "&limit=1");
    const intent = matches[0];
    if (!intent || intent.order_id !== String(verified.order_id) || Number(intent.price_amount) !== Number(verified.price_amount) || String(intent.price_currency).toLowerCase() !== String(verified.price_currency).toLowerCase()) {
      await recordIpn(payload, true, false);
      return res.status(409).json({ error: "Payment does not match stored checkout intent." });
    }
    await recordIpn(payload, true, true);
    await db("rpc/animepay_apply_verified_payment", { method: "POST", body: JSON.stringify({ p_payment_id: paymentId, p_status: String(verified.payment_status), p_actually_paid: verified.actually_paid ?? null, p_payload: verified }) });
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("NOWPayments IPN processing error:", error);
    return res.status(500).json({ error: "IPN processing failed; provider may retry." });
  }
});
app.post("/api/withdrawals", (_req, res) => res.status(501).json({ error: "Withdrawals remain disabled until a separate secure payout workflow, compliance checks, limits and admin approval are implemented." }));

app.use(express.static(path.resolve("dist")));
app.get("*", (_req, res) => res.sendFile(path.resolve("dist/index.html")));
if (process.env.VERCEL !== "1") app.listen(port, "0.0.0.0", () => console.log(`AnimePay API listening on ${port}`));
export default app;
