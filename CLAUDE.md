# Falcon Eye — CLAUDE.md

## Project Overview

**Falcon Eye** is an Emergency Alert and Situational Awareness System built for Pakistan Railways trains and remote mining sites across Pakistan. It provides instant panic alerting, real-time GPS tracking, Quick Response Force (QRF) dispatch, and live device monitoring.

### Hardware Context
- **Panic Button Box** — ESP32 Wi-Fi module on-site (trains, mines). Writes alert state + GPS to Firebase Realtime Database (`sites/{site_id}/`).
- **Receiver Box** — ESP32 with buzzer at LEA/QRF HQ sites. Reads its own node in Firebase (`hq_receivers/{receiver_id}/alert`).
- A Node.js backend service (`alertRouter`) watches Firebase for alert state changes and dispatches to the correct receiver nodes based on routing rules stored in both PostgreSQL and Firebase (`routing/`).

### Stakeholders
- Deployed for **NACTA** (National Counter Terrorism Authority)
- Default admin: `admin@nacta.gov.pk`
- Operational users: Control Room Operators, Site Supervisors, QRF Commanders

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite 8 |
| Styling | Tailwind CSS v3 + Shadcn UI (Radix primitives) |
| Routing | React Router DOM v7 |
| Map | react-leaflet + Leaflet.js (CartoDB dark tiles) |
| Backend | Node.js + Express 5 |
| Database | PostgreSQL 17 (via `pg` pool) |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Hardware bridge | Firebase Realtime Database (ESP32 ↔ Node.js backend ↔ web) |
| Firebase client SDK | `firebase` v9 modular API (frontend reads) |
| Firebase admin SDK | `firebase-admin` v12 modular API (backend writes) |
| Dev tooling | concurrently + nodemon |

---

## Project Structure

```
falcon_eye/
├── client/                        # React frontend (own package.json)
│   ├── src/
│   │   ├── components/
│   │   │   ├── layout/            # DashboardLayout, Topbar, Sidebar, ProtectedRoute
│   │   │   └── ui/                # Shadcn-style primitives (Button, Badge, Avatar, etc.)
│   │   ├── contexts/              # AuthContext
│   │   ├── hooks/
│   │   │   └── useFirebaseData.ts # Live Firebase listener — sites, alerts, logs
│   │   ├── lib/
│   │   │   ├── utils.ts           # cn() helper
│   │   │   ├── firebase.ts        # Firebase app init + db export
│   │   │   └── api.ts             # Central fetch client (JWT injection, 401 redirect)
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx      # Live stats + alert feed from Firebase
│   │   │   ├── LiveMap.tsx        # react-leaflet map with real-time site GPS markers
│   │   │   ├── Admin.tsx          # Routing matrix + site/receiver management
│   │   │   └── Login.tsx
│   │   ├── App.tsx                # Router + AuthProvider tree
│   │   ├── main.tsx               # React DOM entry
│   │   └── index.css              # Tailwind directives + CSS vars + Leaflet overrides
│   ├── .env                       # VITE_ prefixed Firebase config (never commit)
│   ├── package.json               # Frontend deps only
│   └── vite.config.ts             # Path alias: @ → src/
│
├── server/                        # Express API
│   ├── index.js                   # App entry — mounts routes, starts alertRouter, syncs routing
│   ├── db.js                      # pg Pool singleton
│   ├── middleware/
│   │   └── auth.js                # JWT requireAuth middleware
│   ├── routes/
│   │   ├── auth.js                # POST /api/auth/login, GET /api/auth/me
│   │   └── admin.js               # /api/admin/* — sites, receivers, routing CRUD
│   ├── services/
│   │   ├── firebase.js            # Shared Firebase Admin singleton (getFirebaseDb)
│   │   ├── alertRouter.js         # Watches sites/ in Firebase, dispatches to hq_receivers/
│   │   └── routingSync.js         # Syncs PostgreSQL routing table → Firebase routing/ node
│   └── scripts/
│       ├── setup-db.js            # One-time DB bootstrap + admin user seed
│       └── 002_routing_schema.js  # Adds sites, hq_receivers, site_receiver_routes tables
│
├── .env                           # DB URL, JWT secret, PORT, Firebase DB URL (never commit)
├── .gitignore                     # Includes client/.env, server/*-firebase-adminsdk-*.json
├── package.json                   # Server deps + orchestration scripts
└── CLAUDE.md                      # This file
```

---

## Development Commands

```bash
# ── First-time setup ───────────────────────────────────────────────
npm install
cd client && npm install

# ── Database setup ─────────────────────────────────────────────────
node server/scripts/setup-db.js          # Create DB + seed admin user (run once)
node server/scripts/002_routing_schema.js # Add routing tables + seed data (run once)

# ── Start servers (two separate terminals) ─────────────────────────
node server/index.js                     # API + alertRouter on port 3001
cd client && npx vite                    # Frontend on port 5173

# ── Production build ───────────────────────────────────────────────
cd client && npx tsc -b && npx vite build
```

**Note:** `npm run dev` at root uses `concurrently` but has a Windows path quirk — use separate terminals as above.

---

## Environment Variables

### Root `.env` (server)
```
DATABASE_URL=postgresql://postgres:<password>@localhost:5432/falcon_eye
JWT_SECRET=<strong-random-secret>
PORT=3001
FIREBASE_DATABASE_URL=https://falcon-eye-c03a4-default-rtdb.firebaseio.com
```

### `client/.env` (Vite — must use `VITE_` prefix)
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=falcon-eye-c03a4.firebaseapp.com
VITE_FIREBASE_DATABASE_URL=https://falcon-eye-c03a4-default-rtdb.firebaseio.com
VITE_FIREBASE_PROJECT_ID=falcon-eye-c03a4
VITE_FIREBASE_STORAGE_BUCKET=falcon-eye-c03a4.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

Neither `.env` file is committed. The Firebase Admin service account key (`server/*-firebase-adminsdk-*.json`) is also gitignored.

---

## Firebase Structure

```
/sites/{site_id}/
    label           STRING   "Jaffer Express"
    alert           STRING   "true" | "false"      ← written by ESP32 panic button
    reset           STRING   "true" | "false"      ← written by HQ receiver on acknowledge
    status          STRING   "standby" | "alert"
    last_alert      STRING   ISO timestamp
    gps/
        lat         STRING   decimal degrees
        lng         STRING   decimal degrees
        status      STRING   "live" | "fallback"
        speed_kmh   STRING   decimal
        satellites  STRING   integer
        updated     STRING   ISO timestamp

/hq_receivers/{receiver_id}/
    label               STRING
    status              STRING   "online" | "offline"
    last_seen           STRING   ISO timestamp
    alert               STRING   "true" | "false"      ← written by alertRouter
    triggered_by_site   STRING   site_id
    triggered_by_label  STRING   site label
    last_triggered      STRING   ISO timestamp

/routing/{site_id}/{receiver_id}   BOOLEAN true
    ← written by routingSync.js whenever PostgreSQL routing changes
    ← read by alertRouter to decide which receivers to buzz

/logs/{YYYY-MM-DD}/{push_key}/
    site_id     STRING
    site_label  STRING
    event       STRING   "alert" | "reset" | "reset_acknowledged"
    timestamp   STRING   ISO datetime
    lat         STRING
    lng         STRING
    gps_status  STRING
```

### Firebase write rules
- **ESP32 panic buttons** write to `sites/{site_id}/` and `logs/{date}/`
- **ESP32 receivers** write to `sites/{site_id}/reset` (acknowledgement) and `hq_receivers/{receiver_id}/last_seen` (heartbeat)
- **Node.js backend** (`alertRouter` + `routingSync`) writes to `hq_receivers/` and `routing/`
- **Web frontend** is **read-only** — it only uses `onValue` listeners and `get()` calls

---

## Database

### Conventions
- All tables use `snake_case` column names
- Every table has `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- `sites` and `hq_receivers` use `TEXT PRIMARY KEY` (slug IDs matching Firebase node keys)
- Use parameterised queries (`$1, $2, ...`) — never string-interpolate user input into SQL
- Connection pooling via single `db.js` pool export — never create ad-hoc `Client` instances in route handlers
- Migrations go in `server/scripts/` as numbered files (`002_routing_schema.js`, etc.)

### Current Schema

```sql
-- users
id            SERIAL PRIMARY KEY
email         TEXT UNIQUE NOT NULL
password_hash TEXT NOT NULL
full_name     TEXT NOT NULL DEFAULT ''
role          TEXT NOT NULL DEFAULT 'operator'   -- 'admin' | 'operator' | 'supervisor'
created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()

-- sites (panic button locations — source of truth for config)
id         TEXT PRIMARY KEY                      -- matches Firebase sites/ key e.g. "jaffer_express"
label      TEXT NOT NULL
type       TEXT NOT NULL DEFAULT 'train'         -- 'train' | 'mine' | 'other'
region     TEXT NOT NULL DEFAULT ''
active     BOOLEAN NOT NULL DEFAULT true
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

-- hq_receivers (buzzer box locations)
id         TEXT PRIMARY KEY                      -- matches Firebase hq_receivers/ key
label      TEXT NOT NULL
lea        TEXT NOT NULL DEFAULT ''              -- Law Enforcement Agency name
city       TEXT NOT NULL DEFAULT ''
active     BOOLEAN NOT NULL DEFAULT true
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

-- site_receiver_routes (many-to-many routing)
site_id     TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE
receiver_id TEXT NOT NULL REFERENCES hq_receivers(id) ON DELETE CASCADE
PRIMARY KEY (site_id, receiver_id)
created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()

-- cameras (RTSP cameras attached to sites — added by 003_cameras_schema.js)
id         SERIAL PRIMARY KEY
site_id    TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE
label      TEXT NOT NULL DEFAULT 'Camera'
ip         TEXT NOT NULL
port       INTEGER NOT NULL DEFAULT 554
username   TEXT NOT NULL
password   TEXT NOT NULL                     -- stored plain-text; never returned in API responses
channel    INTEGER NOT NULL DEFAULT 1
subtype    INTEGER NOT NULL DEFAULT 0        -- 0 = main stream, 1 = sub stream
active     BOOLEAN NOT NULL DEFAULT true
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

---

## Backend (Node + Express) Rules

### Architecture
- One file per resource in `server/routes/` — never put business logic in `server/index.js`
- Services (Firebase listeners, sync tasks) live in `server/services/`
- Middleware lives in `server/middleware/` — reuse `requireAuth` on every protected route
- Keep `server/index.js` thin: env load, middleware stack, route mounting, listen, start services
- Database access only inside route handlers or dedicated service functions — never in middleware
- Always use `getFirebaseDb()` from `server/services/firebase.js` — never call `initializeApp` directly in other files

### Alert Routing Flow
1. ESP32 pushes `sites/{site_id}/alert = "true"` to Firebase
2. `alertRouter` detects the state transition (ignores GPS/heartbeat-only changes via `prevAlertState`)
3. `alertRouter` reads `routing/{site_id}` from Firebase to find target receivers
4. `alertRouter` writes `hq_receivers/{receiver_id}/alert = "true"` for each target
5. Receiver ESP32 polls its own node, triggers buzzer
6. On acknowledge, receiver writes `sites/{site_id}/reset = "true"`, `alertRouter` clears receiver nodes
7. Admin UI changes to routing table in PostgreSQL → `routingSync` rewrites `routing/` node in Firebase

### Code Style
- CommonJS (`require`/`module.exports`) — root `package.json` has no `"type": "module"`
- Always `async/await` — no callback-style `.then()` chains in new code
- Wrap every async route handler in try/catch — never let unhandled rejections crash the process
- Return consistent error shapes: `{ error: "Human-readable message" }` with the appropriate HTTP status
- Use `req.body` validation at the top of each handler before touching the DB
- Never return `password_hash` in any API response

### API Routes

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | — | Returns JWT |
| GET | `/api/auth/me` | ✓ | Current user info |
| GET | `/api/admin/data` | ✓ | Sites + receivers + routes snapshot |
| PUT | `/api/admin/routes/:siteId/:receiverId` | ✓ | Enable a route |
| DELETE | `/api/admin/routes/:siteId/:receiverId` | ✓ | Disable a route |
| POST | `/api/admin/sites` | ✓ | Add a site |
| DELETE | `/api/admin/sites/:id` | ✓ | Remove a site |
| POST | `/api/admin/receivers` | ✓ | Add a receiver |
| DELETE | `/api/admin/receivers/:id` | ✓ | Remove a receiver |
| GET | `/api/cameras?siteId=x` | ✓ | Cameras for a site (no passwords) |
| GET | `/api/cameras/all` | ✓ | All cameras with site info |
| POST | `/api/cameras` | ✓ admin | Add a camera |
| PUT | `/api/cameras/:id` | ✓ admin | Update a camera |
| DELETE | `/api/cameras/:id` | ✓ admin | Delete a camera |
| POST | `/api/streams/:id/start` | ✓ | Start FFmpeg → HLS stream |
| GET | `/api/streams/:id/status` | ✓ | Stream status + heartbeat |
| DELETE | `/api/streams/:id` | ✓ | Stop stream |
| GET | `/streams/:id/stream.m3u8` | — | HLS playlist (static file) |

### HTTP Status Codes
| Situation | Code |
|---|---|
| Success (data returned) | 200 |
| Created | 201 |
| Bad input / missing fields | 400 |
| Auth failure | 401 |
| Forbidden (authenticated but not allowed) | 403 |
| Not found | 404 |
| Conflict (duplicate ID) | 409 |
| Server error | 500 |

### Security
- Passwords hashed with `bcryptjs`, salt rounds = 10
- JWT secret from env only — never hardcode
- JWT expiry: 8 hours for operator sessions
- CORS origin locked to `http://localhost:5173` in dev — update for production
- Never log request bodies that might contain passwords

---

## Frontend (React + TypeScript) Rules

### Architecture
- **Pages** (`src/pages/`) — route-level components, own their data-fetching and layout
- **Layout components** (`src/components/layout/`) — structural shell (Topbar, Sidebar, DashboardLayout, ProtectedRoute)
- **UI primitives** (`src/components/ui/`) — Shadcn-style, stateless, styled with `cva` + Tailwind
- **Contexts** (`src/contexts/`) — global state only (auth). Not a replacement for local state
- **`src/lib/utils.ts`** — pure utility functions only (`cn`, formatters, helpers)
- **`src/lib/api.ts`** — central fetch client; use this for all backend calls, never raw `fetch`
- **`src/lib/firebase.ts`** — Firebase app init; imports `db` from here for all RTDB access
- **`src/hooks/useFirebaseData.ts`** — composite hook for all live Firebase data (sites, alerts, logs)

### Routes

| Path | Page | Description |
|---|---|---|
| `/` | Dashboard | Live stats, active alerts, recent alert feed, site status |
| `/map` | LiveMap | Leaflet map with real-time GPS markers per site |
| `/admin` | Admin | Routing matrix + site/receiver management |
| `/login` | Login | JWT auth form |

### Component Rules
- Functional components only — no class components
- Co-locate component-specific types in the same file; shared types go in `src/types/`
- Prefer named exports for components — default exports only for page-level components
- Keep components focused: if a component has more than ~150 lines, split it
- Extract repeated JSX patterns into sub-components in the same file before promoting to `components/`

### State Management
- Local UI state: `useState` / `useReducer`
- Shared auth state: `AuthContext` via `useAuth()` hook
- Live Firebase state: `useFirebaseData()` hook (uses `onValue` — do not duplicate listeners)
- Server state (future): use React Query (`@tanstack/react-query`) — do not build manual fetch caches
- Do not put derived data into state — compute it inline or with `useMemo`

### Hooks
- Custom hooks live in `src/hooks/`
- Hook names always start with `use`
- Never call hooks conditionally

### Styling
- Tailwind utility classes only — no inline `style={{}}` except for truly dynamic values (e.g. calculated pixel widths)
- Use the `cn()` helper from `src/lib/utils.ts` for conditional class merging
- Theme tokens (colors, radius, spacing) come from CSS variables in `index.css` — do not hardcode hex values in components
- Dark theme is the default and only theme — do not add light mode without discussion
- Responsive breakpoints: `sm` (640), `md` (768), `lg` (1024), `xl` (1280)
- Leaflet dark theme overrides live in `index.css` — do not add Leaflet CSS customisations elsewhere

### TypeScript
- Strict mode is on — no `any`, no `@ts-ignore`
- Use `type` for object shapes and unions; `interface` only when extension is needed
- Import types with `import type { ... }` to keep runtime imports clean
- Never assert `as SomeType` to silence a type error — fix the type

### Path Aliases
- `@/` maps to `client/src/` — always use this for internal imports, never relative `../../`

### API Calls
- All backend fetch calls go through `src/lib/api.ts` (`api.get`, `api.post`, `api.put`, `api.delete`)
- The client reads the JWT from `localStorage` key `fe_token` automatically
- 401 responses are handled globally: token is cleared and user is redirected to `/login`
- Firebase RTDB reads go through `useFirebaseData()` — do not add new `onValue` listeners in page components

---

## UI / Design System

### Theme
- Dark navy/slate palette — this is a surveillance/ops tool, not a consumer app
- Primary: blue (`hsl(210 100% 52%)`)
- Danger/alerts: red variants
- Warning: amber variants
- Success/online: emerald variants
- Info: primary/blue variants
- All colours defined as CSS variables in `client/src/index.css`

### Badge Variants
| Variant | Colour | Use |
|---|---|---|
| `danger` | Red | Active alerts, critical status |
| `warning` | Amber | Offline devices, fallback GPS |
| `success` | Emerald | Online, standby, all-clear |
| `info` | Blue | Site type: train, system events |

### Alert Severity Levels
| Level | Colour | Use |
|---|---|---|
| `critical` | Red | Panic button triggered, immediate threat |
| `warning` | Amber | Device offline, low battery, connectivity loss |
| `info` | Blue | Status changes, system events |

### Component Library
Shadcn UI pattern — components are owned code in `src/components/ui/`, not a black-box dependency. Edit them directly when needed. Do not install the Shadcn CLI to overwrite existing components without checking first.

---

## Key Decisions & Constraints

- **No registration flow** — user accounts are created by admin only (future user management tab in Admin panel)
- **No light mode** — operational environment requires dark UI
- **Web frontend is Firebase read-only** — the ESP32 firmware and the Node.js backend write to Firebase; the React app only reads via `onValue`/`get`
- **PostgreSQL is the source of truth** for users, site config, receiver config, and routing rules — Firebase `routing/` is a derived cache synced from PostgreSQL by `routingSync.js`
- **Firebase Admin SDK uses modular API** (`firebase-admin/app`, `firebase-admin/database`) — do not use the legacy namespace API (`admin.database()`, `admin.credential.cert()`)
- **Firebase client SDK uses modular API** (`firebase/app`, `firebase/database`) — do not use compat imports
- **JWT over sessions** — stateless auth suits the multi-device operator scenario
- **CommonJS for server** — do not convert server files to ESM without updating root `package.json`
- **Routing sync is bidirectional in one direction** — DB is master, Firebase is replica; always update DB first then call `syncRoutingToFirebase()`

---

## Planned Features (not yet built)

- Alert history page with filters (site, severity, date range)
- Train Network management page
- Mining Sites management page
- QRF Dispatch page
- Device management page (ESP32 node inventory, battery, signal)
- User management tab in Admin panel (create/deactivate operators)
- Notification sound + browser push for incoming panic alerts
- Production deployment config (env vars, CORS, HTTPS)
