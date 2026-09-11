# DASHBOARD

A custom business analytics dashboard for revenue, orders, and new customers. Includes responsive charts, source and date filters, prior-period comparisons, searchable/sortable tables, CSV export, and an integrations page.

## Run

Install Node.js 22 or later. No package installation is required.

```sh
npm start
```

Open http://localhost:3000. Run `npm test` for data validation, request protection, import, webhook, and persistence tests.

The dashboard starts with clearly labeled synthetic sample data. Chart.js is loaded from a pinned CDN URL; charts require internet access. Metrics and tables still work if the CDN is unavailable. This repository contains the application code; GitHub does not automatically host its Node server.

## Connect your apps

### JSON import

Choose **Connect data → Choose JSON file**. Download an example from the same page. Upload a JSON array with one row per UTC day and source:

```json
[{"date":"2026-09-11","source":"Online store","revenue":2450.50,"orders":32,"customers":18}]
```

Revenue is in USD; orders and customers are nonnegative integers. Customers means **new customers per day**, not daily active users (which cannot safely be summed). Aggregate and deduplicate data before import. All sources must use the same currency. Imports replace the complete snapshot, with a limit of 10,000 rows and 2 MB. Failed validation preserves the existing snapshot. Dates in filters use UTC and the current day. Missing daily values are shown as zero; prior-period comparisons use available records and do not guarantee complete coverage.

### REST API connectors

Copy `.env.example` to `.env`. Set `CONNECTORS` to a JSON array on one line:

```dotenv
CONNECTORS=[{"id":"sales","name":"Sales API","url":"https://api.example.com/metrics","tokenEnv":"SALES_TOKEN","rowsPath":"data","mapping":{"date":"day","revenue":"sales","orders":"orders","customers":"new_customers","source":"channel"}}]
SALES_TOKEN=your-provider-token
```

Restart the server, open **Connections**, and click **Sync Sales API**. Endpoint URLs are controlled only by the server environment; they cannot be submitted by the browser. Bearer tokens stay on the server. HTTPS is required, redirects are rejected, requests time out after 15 seconds, and responses are limited to 2 MB. `rowsPath` optionally selects a nested array; `mapping` maps dashboard fields to top-level row properties. Without mapping, return the standard schema above. Only configure trusted endpoints.

Each sync replaces the entire dataset. To combine multiple apps, aggregate them into one snapshot upstream. Sync is manual; this starter has no provider-specific OAuth, provider pagination, scheduling, or built-in Stripe/Shopify adapters. API providers with other authentication or pagination need an adapter or automation workflow.

### Zapier, Make, n8n, or custom app ingestion

Set a strong `INGEST_TOKEN` in `.env`, restart, then POST the standard JSON array to `/api/ingest` with `Authorization: Bearer YOUR_TOKEN` and `Content-Type: application/json`. The endpoint replaces the full snapshot and persists it in `data/metrics.json`. Example for a local integration:

```sh
curl http://localhost:3000/api/ingest -H "Authorization: Bearer YOUR_TOKEN" -H "Content-Type: application/json" --data-binary @metrics.json
```

## Hosting and storage

The app intentionally binds to `127.0.0.1`. Local dashboard reads and imports assume a trusted single user. Host/origin checks and a custom write header protect local use; the webhook separately requires its bearer token. There is no built-in multi-user login.

Before exposing it remotely, deploy behind HTTPS and an authenticated reverse proxy, preserving the expected localhost Host header and configuring an explicit trusted public origin in the server. Add application authentication/authorization if users need separate workspaces. Cloud automation tools cannot reach localhost directly. Do not simply expose this port publicly. Keep persistent disk mounted for `data/`; back it up. Run one server process per data directory (not a horizontally scaled or serverless deployment). Secrets and data are excluded from Git.

## Customize

- `public/style.css`: colors, layout, and mobile styles
- `public/app.js`: metrics, chart options, filters, and exports
- `public/index.html`: navigation and integration instructions
- `model.mjs`: validation and sample data
- `server.mjs`: API routes, connectors, and storage

No real app credentials or customer records are included.
