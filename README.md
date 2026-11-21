# AnimePay

AnimePay is a merchant-facing cryptocurrency payment gateway dashboard starter.

## Current status

This repository contains a **demo client panel and API scaffold**. It is not a live custodial wallet or production payment processor. Demo data is local to the browser; payment, balance, and withdrawal actions do not move funds.

Before accepting real funds, integrate an approved provider account (for example, NOWPayments), verify signed IPN/webhook callbacks, persist an immutable double-entry ledger in PostgreSQL, implement authentication and role-based access, add idempotency/reconciliation, withdrawal risk checks and 2FA, and obtain jurisdiction-specific legal/compliance advice.

## Requirements

- Node.js 20+
- npm

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173. The API runs on http://localhost:4000.

## Environment

See `.env.example`. Never put provider secrets in frontend variables (for example, never use a `VITE_*` prefix for secrets). Keep API keys and IPN secrets server-side.

## Customer checkout preview

Open `/checkout/demo?amount=25.00&currency=USD&invoice=AP-DEMO-001` to preview the public checkout page. It includes a cryptocurrency/network selector and a placeholder for the provider-generated QR code. The five listed assets are demo options, not a promise of live availability. The checkout POST endpoint intentionally returns HTTP 501 until the provider integration is completed.

## API scaffold

- `GET /api/health`
- `GET /api/currencies` — demo currency list
- `GET /api/merchant/summary` — demo summary
- `POST /api/checkout` — disabled until a provider is configured
- `POST /api/withdrawals` — disabled until custody, authentication, and compliance controls are implemented

## Deployment

Deploy the frontend and API as one Node service, or configure a reverse proxy so `/api` routes to the Express server. Set `NODE_ENV=production` and a strong server-side `SESSION_SECRET` before adding authentication.

## Security notice

Do not use demo balances, sample payment statuses, or this scaffold to represent real funds. No private keys, deposit address derivation, blockchain confirmation monitoring, or actual payouts are implemented.

## Admin panel (Vercel)

The separate administrator console is available at `/admin`. It uses a server-verified admin role, an HttpOnly/Secure/SameSite cookie, an 8-hour signed session, same-origin checks, and a login rate limit. There is no public admin registration. The merchant dashboard remains separate.

Set these **server-side** Vercel Environment Variables for Production:
- `ADMIN_EMAIL`: the administrator email address.
- `ADMIN_PASSWORD_HASH`: bcrypt hash of the administrator password (cost factor 12 or higher).
- `SESSION_SECRET`: a cryptographically random value of at least 32 characters.
- `NODE_ENV=production`.

Generate a bcrypt hash locally after installing dependencies:
```bash
node --input-type=module -e "import bcrypt from 'bcryptjs'; console.log(await bcrypt.hash('REPLACE_WITH_A_LONG_UNIQUE_PASSWORD', 12))"
```
Copy only the generated hash into `ADMIN_PASSWORD_HASH`; do not commit it or paste it into chat. Use a password manager and rotate it if exposed.

Vercel serverless entrypoint: `api/[...path].ts`. Deploy the project with the repository root as the Vercel project root. This adds admin authentication only: payment records, merchants, withdrawals, provider management and audit events remain locked until a persistent database, verified payment webhooks and compliance controls are implemented. Do not treat empty admin metrics as live financial data.
