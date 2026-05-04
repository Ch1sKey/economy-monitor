# EconomyManager

Read-only analytics web app for a Minecraft Paper server using the existing **EconomyMonitor** SQL schema. It does **not** modify the database and does **not** ship a plugin.

## Features

- Dashboard: money on hands, emitted/burned/net supply, transfers, charts, collapsed Sankey, top faucets/sinks/players.
- Players: searchable table with balances, snapshot-based window balance change, faucet/sink/transfer/auction/unknown columns, sorting.
- Player detail: summary, income/expense breakdown, balance series, player Sankey, raw events.
- Overall Sankey: configurable player collapse mode, top N expansion, min flow, grouping, optional auction pending.
- Raw events: filters + pagination + expandable `context_json`.
- Diagnostics: DB status, counts, warnings (snapshots, unknown deltas, missing balances, plugin coverage hints).

## Tech stack

- **Backend:** Node.js, TypeScript, **Hono**, `mysql2/promise`, **Zod**, **Luxon**, `dotenv`.
- **Frontend:** React, TypeScript, **Vite**, **React Router**, **TanStack Query**, **ECharts** (incl. Sankey), plain CSS.

Ports:

- API: `http://localhost:3001`
- UI: `http://localhost:5173` (Vite dev proxy forwards `/api` to the backend)

## Install

From the repo root:

```bash
npm install
```

## Configure

Copy `.env.example` to **either** the **repository root** (`.env` next to `package.json`) **or** `backend/.env`. The backend loads these paths in order (without relying on `process.cwd()` alone), so a monorepo root `.env` works when you run `npm run dev -w backend`.

Required variables:

| Variable            | Description                          |
| ------------------- | ------------------------------------ |
| `DB_HOST`           | MySQL/MariaDB host                   |
| `DB_PORT`           | Port (default `3306`)              |
| `DB_NAME`           | EconomyMonitor database name         |
| `DB_USER`           | **Read-only** SQL user (recommended) |
| `DB_PASSWORD`       | Password                             |
| `APP_PORT`          | API port (default `3001`)          |
| `DEFAULT_TIMEZONE`  | Default IANA zone (e.g. `UTC`)       |
| `CORS_ORIGIN`       | Allowed browser origin(s)            |

## Run (development)

```bash
npm run dev
```

Runs backend (`tsx watch`) and frontend (`vite`) together.

Separate terminals:

```bash
npm run dev:backend
npm run dev:frontend
```

## Run (production build)

```bash
npm run build
npm run start
```

`npm run start` runs the compiled backend from `backend/dist`. Serve `frontend/dist` with any static file host, or continue using Vite preview:

```bash
npm run preview -w frontend
```

## Read-only database user (recommended)

Create a dedicated user with `SELECT` only on the EconomyMonitor schema:

```sql
CREATE USER 'economy_readonly'@'%' IDENTIFIED BY 'use_a_strong_password';

GRANT SELECT ON your_economy_db.* TO 'economy_readonly'@'%';

FLUSH PRIVILEGES;
```

The application never issues `INSERT`, `UPDATE`, `DELETE`, or DDL.

## Metrics meaning (short)

- **Money on hands:** per-player latest balance coalesced from `economy_players.last_known_balance`, else latest snapshot, else latest `economy_events.balance_after`, summed.
- **Emitted / burned:** classified events in the window (`src/domain/moneyClassification.ts`), excluding inferred rows when “Include inferred” is off.
- **Net supply change:** emitted minus burned (string decimals on the wire).
- **Transfer volume:** one-sided counting (`pay_send`, `auction_buyer_pay` only) to avoid double-counting paired rows.
- **Balance change (players table):** snapshot balance at end of window minus snapshot balance just before window start (no snapshot → `0`).

## Known limitations

- Physical item trades are not modeled; only logged economy events count.
- Offline or plugin-bypass changes appear only after snapshots/reconciliation.
- `reconcile` / `unknown_delta` rows are **inferred** attribution, not ground truth.
- If EconomyMonitor logs duplicates, totals and Sankey links may need extra deduplication rules.
- Sankey accuracy is bounded by logging quality and how `transaction_id` correlates rows.
- Global “money supply” time series sums snapshot rows per bucket; multiple snapshots per player per bucket can inflate totals (called out in the API response `note`).

## API (REST)

All analytics query params support timeframe fields: `from`, `to`, `preset`, `timezone`, and usually `includeInferred`.

Main routes:

- `GET /api/health`
- `GET /api/meta`
- `GET /api/overview`
- `GET /api/players`, `GET /api/players/:uuid/summary`, `GET /api/players/:uuid/events`
- `GET /api/events`
- `GET /api/sankey/overall`, `GET /api/sankey/player/:uuid`
- `GET /api/timeseries/money-supply`, `GET /api/timeseries/player-balance/:uuid`
- `GET /api/breakdown/actions`
- `GET /api/diagnostics`

## Security notes

- DB credentials stay on the server; the browser only talks to `/api`.
- Centralized error handler avoids leaking stack traces as JSON errors in production (still log server-side).
- All SQL uses placeholders; query params validated with Zod.

## Project layout

```
backend/src   — Hono server, routes, SQL, domain logic
frontend/src  — React UI, charts, timeframe store
```

## License

Add your own license as needed.
