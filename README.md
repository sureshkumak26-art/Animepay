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
