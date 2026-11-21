import express, { type Request, type Response, type NextFunction } from "express";
import { createHmac, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import serverless from "serverless-http";

const app = express();
app.set("trust proxy", 1);
app.use(helmet());
app.use(express.json({ limit: "32kb" }));
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
  return item ? decodeURIComponent(item.slice(name.length + 1)) : "";
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
    if (claims.role !== "admin" || !claims.sub || claims.exp <= Math.floor(Date.now() / 1000)) return null;
    return claims;
  } catch { return null; }
}
function setAdminCookie(res: Response, token: string) {
  res.cookie(SESSION_COOKIE, token, { httpOnly: true, secure: true, sameSite: "strict", path: "/", maxAge: SESSION_SECONDS * 1000 });
}
function sameOrigin(req: Request, res: Response, next: NextFunction) {
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
  res.locals.admin = claims;
  next();
}
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 8, standardHeaders: true, legacyHeaders: false, message: { error: "Too many login attempts. Try again later." } });

app.get("/api/health", (_req, res) => res.json({ ok: true, service: "animepay-api", mode: "admin-auth-enabled" }));
app.get("/api/currencies", (_req, res) => res.json({ currencies: ["usdttrc20", "usdterc20", "btc", "eth", "usdc"], source: "demo" }));
app.get("/api/merchant/summary", (_req, res) => res.json({ mode: "demo", availableBalance: "0.00", pendingBalance: "0.00", totalPayments: 0, successfulPayments: 0, volumeUsd: "0.00", recentPayments: [] }));

app.post("/api/admin/login", sameOrigin, loginLimiter, async (req, res) => {
  const email = String(req.body?.email || "").trim().toLowerCase();
  const password = String(req.body?.password || "");
  const adminEmail = String(process.env.ADMIN_EMAIL || "").trim().toLowerCase();
  const passwordHash = process.env.ADMIN_PASSWORD_HASH || "";
  if (!adminEmail || !passwordHash || !process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    return res.status(503).json({ error: "Admin login is not configured. Set ADMIN_EMAIL, ADMIN_PASSWORD_HASH and a 32+ character SESSION_SECRET." });
  }
  if (!email || !password || email !== adminEmail || !(await bcrypt.compare(password, passwordHash))) {
    return res.status(401).json({ error: "Invalid email or password." });
  }
  setAdminCookie(res, signToken(adminEmail));
  return res.json({ ok: true, admin: { email: adminEmail, role: "admin" } });
});
app.get("/api/admin/me", requireAdmin, (_req, res) => res.json({ authenticated: true, admin: { email: res.locals.admin.sub, role: "admin" } }));
app.post("/api/admin/logout", sameOrigin, (_req, res) => {
  res.clearCookie(SESSION_COOKIE, { httpOnly: true, secure: true, sameSite: "strict", path: "/" });
  res.json({ ok: true });
});
app.get("/api/admin/overview", requireAdmin, (_req, res) => res.json({ dataConnected: false, message: "Authentication is active. Connect the production database and verified payment provider before enabling financial administration.", payments: [], merchants: [], withdrawals: [], auditEvents: [] }));
app.post("/api/checkout", (_req, res) => res.status(501).json({ error: "Live checkout is not enabled. Provider integration and verified IPN handling are required." }));
app.post("/api/withdrawals", (_req, res) => res.status(501).json({ error: "Withdrawals remain disabled until custody, ledger, compliance and approval controls are implemented." }));
app.use("/api", (_req, res) => res.status(404).json({ error: "API route not found." }));

export default serverless(app);
