# AnimePay

AnimePay is a merchant-facing crypto payment workspace with a public landing page, email/password account access, merchant-scoped payment records, a NOWPayments checkout adapter, and a separate administrator console.

## Current capabilities

- Public landing page with merchant sign-up and sign-in.
- Supabase Auth email/password registration and login.
- HttpOnly merchant session cookie; merchant dashboard routes require an authenticated account.
- Merchant workspace is created on first successful account sign-in, or an invited membership is activated.
- Merchant payment records are scoped by merchant ID.
- Authenticated merchant invoice builder for configured NOWPayments assets.
- Server-side NOWPayments IPN signature and provider-status verification.
- Separate administrator console at /admin.
- Crypto withdrawals remain **disabled**. Deposits/payment invoices do not imply payout capability.

The dashboard no longer uses a sample merchant identity or fabricated payment totals. Payment volume is based on stored provider payment records. Some dashboard modules (merchant API key issuance, merchant webhook delivery/retries, advanced analytics and support ticketing) are not yet implemented.

## Requirements

- Node.js 20+
- npm
- Supabase project with Email/Password authentication enabled
- NOWPayments account and credentials for live invoice creation

## Run locally

```bash
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173. The API runs on http://localhost:4000.

## Environment

See .env.example.

Required server-side Supabase settings:
- SUPABASE_URL
- SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY) for Supabase Auth endpoints
- SUPABASE_SERVICE_ROLE_KEY for privileged server-side database access only

Other settings:
- SESSION_SECRET: random value of at least 32 characters for administrator sessions.
- ADMIN_EMAIL and ADMIN_PASSWORD_HASH: administrator login.
- NOWPAYMENTS_API_KEY and NOWPAYMENTS_IPN_SECRET: server-side provider credentials.
- NODE_ENV=production in production.

Never expose the Supabase service-role key or NOWPayments secrets in browser code or VITE_* variables.

## Merchant pages

- / — public AnimePay landing page
- /signup — create a merchant account
- /login — sign in to a merchant account
- /dashboard — authenticated merchant workspace
- /checkout — authenticated merchant invoice builder
- /admin — restricted administrator console

If Supabase email confirmation is enabled, set the Supabase Auth Site URL to https://animepay.vercel.app and allow the redirect URL https://animepay.vercel.app/login?verified=1 in Authentication → URL Configuration.

## API routes

- GET /api/health
- POST /api/merchant/signup
- POST /api/merchant/login
- GET /api/merchant/me
- POST /api/merchant/logout
- GET /api/merchant/summary — authenticated, merchant-scoped records
- POST /api/checkout — authenticated merchant invoice creation
- POST /api/nowpayments/ipn — signed provider callback verification
- POST /api/withdrawals — intentionally disabled (HTTP 501)

## Deployment

Deploy the repository root as a Vercel project. Set all required server-side environment variables for Production. After changing environment variables, trigger a new deployment.

## Security notes

- Merchant and admin cookies are HttpOnly and Secure in production.
- Merchant login and sign-up are rate-limited.
- Merchant access is checked against Supabase Auth and active merchant membership on the server.
- Payment queries are filtered by merchant ID.
- Supabase public tables use RLS; service-role access is kept on the server.
- Withdrawals must not be enabled until payout execution, balance locking, anti-double-spend protections, compliance checks, and admin approval are implemented and tested.
