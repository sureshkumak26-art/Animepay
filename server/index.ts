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
const MERCHANT_COOKIE = "animepay_merchant";
const MERCHANT_SESSION_MAX_AGE = 30 * 24 * 60 * 60 * 1000;
type MerchantSession = { access_token: string; refresh_token: string; expires_at?: number };
type MerchantUser = { id: string; email?: string; user_metadata?: { full_name?: string; company?: string } };
function supabasePublicKey() { return process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_PUBLISHABLE_KEY || ""; }
function readMerchantSession(req: Request): MerchantSession | null {
  try {
    const raw = readCookie(req, MERCHANT_COOKIE);
    if (!raw) return null;
    const value = JSON.parse(Buffer.from(raw, "base64url").toString("utf8"));
    return value?.access_token && value?.refresh_token ? value as MerchantSession : null;
  } catch { return null; }
}
function setMerchantCookie(res: Response, session: MerchantSession) {
  const value = Buffer.from(JSON.stringify(session)).toString("base64url");
  res.cookie(MERCHANT_COOKIE, value, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: MERCHANT_SESSION_MAX_AGE });
}
function clearMerchantCookie(res: Response) {
  res.clearCookie(MERCHANT_COOKIE, { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/" });
}
async function authRequest(pathname: string, body: any) {
  const key = supabasePublicKey();
  if (!supabaseUrl() || !key) throw new Error("Merchant authentication is not configured. Add SUPABASE_ANON_KEY (or SUPABASE_PUBLISHABLE_KEY) to Vercel Production.");
  const response = await fetch(supabaseUrl() + "/auth/v1/" + pathname, { method: "POST", headers: { apikey: key, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  const data: any = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = String(data.msg || data.message || data.error_description || data.error || "Authentication request failed.");
    const error = new Error(message) as Error & { status?: number };
    error.status = response.status;
    throw error;
  }
  return data;
}
async function ensureMerchantForUser(user: MerchantUser) {
  const email = String(user.email || "").trim().toLowerCase();
  if (!email) throw new Error("Your verified account does not include an email address.");
  const existing: any[] = await db("animepay_merchant_memberships?select=id,merchant_id,email,role,status&email=eq." + encodeURIComponent(email) + "&limit=1");
  if (existing.length) {
    const membership = existing[0];
    if (membership.status === "suspended") throw new Error("This merchant membership is suspended. Contact AnimePay support.");
    if (membership.status === "invited") await db("animepay_merchant_memberships?id=eq." + encodeURIComponent(membership.id), { method: "PATCH", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ status: "active", updated_at: new Date().toISOString() }) });
    const merchants: any[] = await db("animepay_merchants?select=id,name,slug,status&id=eq." + encodeURIComponent(membership.merchant_id) + "&limit=1");
    if (!merchants.length || merchants[0].status !== "active") throw new Error("This merchant workspace is unavailable.");
    return { merchant: merchants[0], role: membership.role };
  }
  const fullName = String(user.user_metadata?.company || user.user_metadata?.full_name || email.split("@")[0]).trim().slice(0, 100);
  const slug = fullName.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 55) + "-" + randomUUID().slice(0, 8);
  const created: any[] = await db("animepay_merchants", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ name: fullName.length >= 2 ? fullName : "New Merchant", slug, contact_email: email, status: "active" }) });
  const merchant = created[0];
  if (!merchant?.id) throw new Error("Could not create your merchant workspace.");
  await db("animepay_merchant_memberships", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ merchant_id: merchant.id, email, role: "owner", status: "active" }) });
  return { merchant: { id: merchant.id, name: merchant.name, slug: merchant.slug, status: merchant.status }, role: "owner" };
}
async function requireMerchant(req: Request, res: Response, next: NextFunction) {
  try {
    let session = readMerchantSession(req);
    if (!session) return res.status(401).json({ error: "Please sign in to your merchant account." });
    const key = supabasePublicKey();
    if (!key) return res.status(503).json({ error: "Merchant authentication is not configured on the server." });
    let response = await fetch(supabaseUrl() + "/auth/v1/user", { headers: { apikey: key, Authorization: "Bearer " + session.access_token } });
    if (!response.ok && session.refresh_token) {
      try {
        const refreshed = await authRequest("token?grant_type=refresh_token", { refresh_token: session.refresh_token });
        session = { access_token: refreshed.access_token, refresh_token: refreshed.refresh_token || session.refresh_token, expires_at: refreshed.expires_at };
        setMerchantCookie(res, session);
        response = await fetch(supabaseUrl() + "/auth/v1/user", { headers: { apikey: key, Authorization: "Bearer " + session.access_token } });
      } catch { /* handled as expired session below */ }
    }
    if (!response.ok) { clearMerchantCookie(res); return res.status(401).json({ error: "Your session expired. Please sign in again." }); }
    const user = await response.json() as MerchantUser;
    const email = String(user.email || "").trim().toLowerCase();
    const memberships: any[] = await db("animepay_merchant_memberships?select=id,merchant_id,email,role,status&email=eq." + encodeURIComponent(email) + "&status=eq.active&limit=1");
    if (!memberships.length) return res.status(403).json({ error: "No active merchant workspace is linked to this account." });
    const membership = memberships[0];
    const merchants: any[] = await db("animepay_merchants?select=id,name,slug,status&id=eq." + encodeURIComponent(membership.merchant_id) + "&limit=1");
    if (!merchants.length || merchants[0].status !== "active") return res.status(403).json({ error: "Your merchant workspace is unavailable." });
    res.locals.merchantUser = user;
    res.locals.merchant = merchants[0];
    res.locals.merchantRole = membership.role;
    next();
  } catch (error) {
    return res.status(503).json({ error: error instanceof Error ? error.message : "Unable to verify merchant session." });
  }
}

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
const merchantAuthLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false, message: { error: "Too many authentication attempts. Try again later." } });
app.post("/api/merchant/signup", requireSameOrigin, merchantAuthLimiter, async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const fullName = String(req.body?.full_name || "").trim().slice(0, 100);
  const company = String(req.body?.company || "").trim().slice(0, 100);
  if (!/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(email)) return res.status(400).json({ error: "Enter a valid email address." });
  if (password.length < 10) return res.status(400).json({ error: "Use a password with at least 10 characters." });
  if (fullName.length < 2) return res.status(400).json({ error: "Enter your full name." });
  try {
    const redirect = encodeURIComponent((req.get("origin") || "https://animepay.vercel.app") + "/login?verified=1");
    const data = await authRequest("signup?redirect_to=" + redirect, { email, password, data: { full_name: fullName, company } });
    if (!data.access_token || !data.refresh_token) return res.status(201).json({ ok: true, confirmationRequired: true, message: "Check your email and confirm your address. Then sign in to open your merchant workspace." });
    const session = { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: data.expires_at };
    const user = (data.user || {}) as MerchantUser;
    const workspace = await ensureMerchantForUser({ ...user, email, user_metadata: { full_name: fullName, company } });
    setMerchantCookie(res, session);
    return res.status(201).json({ ok: true, user: { email, full_name: fullName }, merchant: workspace.merchant });
  } catch (error) {
    const status = (error as any)?.status || 400;
    return res.status(status >= 500 ? 503 : status).json({ error: error instanceof Error ? error.message : "Sign up failed." });
  }
});
app.post("/api/merchant/login", requireSameOrigin, merchantAuthLimiter, async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  if (!email || !password) return res.status(400).json({ error: "Enter your email and password." });
  try {
    const data = await authRequest("token?grant_type=password", { email, password });
    const session = { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: data.expires_at };
    const user = (data.user || {}) as MerchantUser;
    const workspace = await ensureMerchantForUser(user);
    setMerchantCookie(res, session);
    return res.json({ ok: true, user: { email: user.email }, merchant: workspace.merchant });
  } catch (error) {
    const status = (error as any)?.status || 400;
    return res.status(status >= 500 ? 503 : status).json({ error: error instanceof Error ? error.message : "Sign in failed." });
  }
});
app.get("/api/merchant/me", requireMerchant, (req, res) => res.json({ authenticated: true, user: { email: res.locals.merchantUser.email, full_name: res.locals.merchantUser.user_metadata?.full_name || "" }, merchant: res.locals.merchant, role: res.locals.merchantRole }));
app.post("/api/merchant/logout", requireSameOrigin, async (req, res) => {
  const session = readMerchantSession(req);
  if (session && supabasePublicKey()) {
    await fetch(supabaseUrl() + "/auth/v1/logout", { method: "POST", headers: { apikey: supabasePublicKey(), Authorization: "Bearer " + session.access_token } }).catch(() => {});
  }
  clearMerchantCookie(res);
  return res.json({ ok: true });
});
app.get("/api/merchant/summary", requireMerchant, async (_req, res) => {
  try {
    const merchantId = String(res.locals.merchant.id);
    const rows: any[] = await db("animepay_payments?select=order_id,payment_id,pay_currency,price_amount,price_currency,payment_status,created_at&merchant_id=eq." + encodeURIComponent(merchantId) + "&order=created_at.desc&limit=100");
    const successful = rows.filter(x => x.payment_status === "finished");
    const total = successful.reduce((sum, x) => sum + Number(x.price_amount || 0), 0);
    return res.json({ mode: "live", availableBalance: total.toFixed(2), pendingBalance: rows.filter(x => !["finished","failed","expired","refunded"].includes(x.payment_status)).reduce((s,x)=>s+Number(x.price_amount||0),0).toFixed(2), totalPayments: rows.length, successfulPayments: successful.length, volumeUsd: total.toFixed(2), recentPayments: rows.map(x=>({id:x.order_id,customer:"Customer",asset:String(x.pay_currency).toUpperCase(),amount:String(x.price_amount),status:x.payment_status,date:x.created_at})) });
  } catch (error) {
    return res.status(503).json({ error: error instanceof Error ? error.message : "Unable to load merchant payments." });
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


const merchantRoles = ["owner", "admin", "developer", "viewer"] as const;
app.get("/api/admin/merchants", requireAdmin, async (_req, res) => {
  try {
    const merchants: any[] = await db("animepay_merchants?select=*&order=created_at.desc");
    const memberships: any[] = await db("animepay_merchant_memberships?select=id,merchant_id,email,role,status,created_at&order=created_at.asc");
    const rows = merchants.map(merchant => ({ ...merchant, members: memberships.filter(member => member.merchant_id === merchant.id) }));
    return res.json({ merchants: rows });
  } catch (error) {
    return res.status(503).json({ error: error instanceof Error ? error.message : "Merchant database is unavailable." });
  }
});
app.post("/api/admin/merchants", requireSameOrigin, requireAdmin, async (req, res) => {
  const name = String(req.body?.name || "").trim().slice(0, 100);
  const contactEmail = String(req.body?.contact_email || "").trim().toLowerCase().slice(0, 254);
  if (name.length < 2) return res.status(400).json({ error: "Merchant name must contain at least 2 characters." });
  if (contactEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contactEmail)) return res.status(400).json({ error: "Enter a valid contact email." });
  const slug = name.toLowerCase().normalize("NFKD").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) + "-" + randomUUID().slice(0, 8);
  try {
    const created: any[] = await db("animepay_merchants", { method: "POST", headers: { Prefer: "return=representation" }, body: JSON.stringify({ name, slug, contact_email: contactEmail || null, status: "active" }) });
    const merchant = created[0];
    if (contactEmail) {
      await db("animepay_merchant_memberships", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ merchant_id: merchant.id, email: contactEmail, role: "owner", status: "invited" }) });
    }
    return res.status(201).json({ merchant: { ...merchant, members: contactEmail ? [{ email: contactEmail, role: "owner", status: "invited" }] : [] } });
  } catch (error) {
    return res.status(503).json({ error: error instanceof Error ? error.message : "Could not create merchant." });
  }
});
app.patch("/api/admin/merchants/:id", requireSameOrigin, requireAdmin, async (req, res) => {
  const id = String(req.params.id || "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return res.status(400).json({ error: "Invalid merchant ID." });
  const patch: any = {};
  if (req.body?.name !== undefined) {
    const name = String(req.body.name).trim().slice(0, 100);
    if (name.length < 2) return res.status(400).json({ error: "Merchant name must contain at least 2 characters." });
    patch.name = name;
  }
  if (req.body?.contact_email !== undefined) {
    const email = String(req.body.contact_email || "").trim().toLowerCase();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Enter a valid contact email." });
    patch.contact_email = email || null;
  }
  if (req.body?.status !== undefined) {
    if (!["active", "suspended"].includes(String(req.body.status))) return res.status(400).json({ error: "Status must be active or suspended." });
    patch.status = String(req.body.status);
  }
  if (!Object.keys(patch).length) return res.status(400).json({ error: "No valid merchant changes supplied." });
  patch.updated_at = new Date().toISOString();
  try {
    const rows: any[] = await db("animepay_merchants?id=eq." + encodeURIComponent(id), { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch) });
    if (!rows.length) return res.status(404).json({ error: "Merchant not found." });
    return res.json({ merchant: rows[0] });
  } catch (error) {
    return res.status(503).json({ error: error instanceof Error ? error.message : "Could not update merchant." });
  }
});
app.post("/api/admin/merchants/:id/members", requireSameOrigin, requireAdmin, async (req, res) => {
  const merchantId = String(req.params.id || "");
  const email = String(req.body?.email || "").trim().toLowerCase().slice(0, 254);
  const role = String(req.body?.role || "");
  if (!/^[0-9a-f-]{36}$/i.test(merchantId)) return res.status(400).json({ error: "Invalid merchant ID." });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: "Enter a valid member email." });
  if (!(merchantRoles as readonly string[]).includes(role)) return res.status(400).json({ error: "Choose owner, admin, developer, or viewer." });
  try {
    const rows: any[] = await db("animepay_merchant_memberships?on_conflict=merchant_id,email", { method: "POST", headers: { Prefer: "resolution=merge-duplicates,return=representation" }, body: JSON.stringify({ merchant_id: merchantId, email, role, status: "invited" }) });
    return res.status(201).json({ member: rows[0] });
  } catch (error) {
    return res.status(503).json({ error: error instanceof Error ? error.message : "Could not save merchant member." });
  }
});
app.patch("/api/admin/merchant-members/:id", requireSameOrigin, requireAdmin, async (req, res) => {
  const id = String(req.params.id || "");
  const patch: any = {};
  if (req.body?.role !== undefined) {
    if (!(merchantRoles as readonly string[]).includes(String(req.body.role))) return res.status(400).json({ error: "Invalid member role." });
    patch.role = String(req.body.role);
  }
  if (req.body?.status !== undefined) {
    if (!["invited", "active", "suspended"].includes(String(req.body.status))) return res.status(400).json({ error: "Invalid member status." });
    patch.status = String(req.body.status);
  }
  if (!/^[0-9a-f-]{36}$/i.test(id) || !Object.keys(patch).length) return res.status(400).json({ error: "Invalid member update." });
  try {
    const rows: any[] = await db("animepay_merchant_memberships?id=eq." + encodeURIComponent(id), { method: "PATCH", headers: { Prefer: "return=representation" }, body: JSON.stringify(patch) });
    if (!rows.length) return res.status(404).json({ error: "Member not found." });
    return res.json({ member: rows[0] });
  } catch (error) {
    return res.status(503).json({ error: error instanceof Error ? error.message : "Could not update member." });
  }
});

app.post("/api/checkout", requireMerchant, async (req, res) => {
  const apiKey = process.env.NOWPAYMENTS_API_KEY || "";
  if (!apiKey || !process.env.NOWPAYMENTS_IPN_SECRET) return res.status(503).json({ error: "NOWPayments credentials are not configured yet." });
  const amount = Number(req.body?.price_amount);
  const currency = String(req.body?.price_currency || "usd").toLowerCase();
  const payCurrency = String(req.body?.pay_currency || "").toLowerCase();
  if (!Number.isFinite(amount) || amount <= 0 || amount > 100000 || currency !== "usd" || !currencies.includes(payCurrency)) return res.status(400).json({ error: "Invalid amount or unsupported currency." });
  const orderId = "AP-" + randomUUID();
  try {
    await db("animepay_payments", { method: "POST", headers: { Prefer: "return=minimal" }, body: JSON.stringify({ order_id: orderId, merchant_id: res.locals.merchant.id, price_amount: amount, price_currency: currency, pay_currency: payCurrency, payment_status: "creating" }) });
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
