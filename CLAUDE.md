# Falcon Eye — CLAUDE.md

## Project Overview

**Falcon Eye** is an Emergency Alert and Situational Awareness System built for Pakistan Railways trains and remote mining sites across Pakistan. It provides instant panic alerting, real-time GPS tracking, Quick Response Force (QRF) dispatch, and live device monitoring.

### Hardware Context
- **Panic Button Box** — ESP32 Wi-Fi module on-site (trains, mines). Writes alert state + GPS to Firebase Realtime Database (`sites/{site_id}/`).
- **Receiver Box** — ESP32 with buzzer at LEA/QRF HQ sites. Reads its own node in Firebase (`hq_receivers/{receiver_id}/alert`).
- A Node.js backend service (`alertRouter`) watches Firebase for alert state changes and dispatches to the correct receiver nodes based on routing rules stored in both PostgreSQL and Firebase (`routing/`).

### Stakeholders
- Deployed for **NACTA** (National Counter Terrorism Authority) as the head department, with other departments (Pakistan Railways, mining authorities, LEAs, etc.) onboarded as tenants
- Super admin: `admin@nacta.gov.pk`
- Operational users: Department Admins, Control Room Operators, Site Supervisors, QRF Commanders — see [Multi-Department Access Model](#multi-department-access-model)

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19 + TypeScript + Vite 8 |
| Styling | Tailwind CSS v3 + Shadcn-style owned components (Radix primitives) + `tailwindcss-animate` |
| Typography | Inter Variable + JetBrains Mono Variable, self-hosted via `@fontsource-variable/*` (no CDN — works on closed networks) |
| Feedback | `sonner` toasts + app-wide confirm dialog (`useConfirm`) |
| Routing | React Router DOM v7 (route-level code splitting with `React.lazy`) |
| Map | react-leaflet + Leaflet.js (Esri satellite / dark-gray tiles) |
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
│   │   │   ├── layout/            # App shell: DashboardLayout, Sidebar, Topbar, MobileNav, CommandPalette,
│   │   │   │                      #   AlertPopup, AlertBell, UserMenu, PageHeader, SplashScreen, navigation.ts
│   │   │   ├── ui/                # Design-system primitives (see UI / Design System below)
│   │   │   ├── admin/             # Admin panel tabs + their dialogs
│   │   │   ├── dashboard/         # StatCard, ActiveAlertsBanner, RecentAlerts, SiteStatusList
│   │   │   ├── map/               # SiteMarkers, MapController (fly-to/fit), SitePanel
│   │   │   └── sites/site-ui.tsx  # SiteStatusBadge, SiteStateDot, SiteTypeIcon
│   │   ├── contexts/              # AuthContext (user + department + access), ConfirmContext
│   │   ├── hooks/
│   │   │   ├── useFirebaseData.ts       # Live sites (merged with PostgreSQL access list), alerts, logs
│   │   │   ├── useAlertNotification.ts  # Active alerts + popup queue
│   │   │   ├── useFirebaseConnection.ts # connecting | online | offline (with grace period)
│   │   │   ├── useConfirm.ts            # `await confirm({...})` → boolean
│   │   │   └── useNow, usePageTitle, useMediaQuery, usePersistentState
│   │   ├── images/                # Logo.png is the 1254px master — the app uses the derived
│   │   │                          #   logo-full.png (480px) and logo-mark.png (192px emblem crop)
│   │   ├── lib/
│   │   │   ├── utils.ts           # cn(), errorMessage(), slugify()
│   │   │   ├── format.ts          # timeAgo, formatCoords, formatDateTime, initials, pluralize
│   │   │   ├── sites.ts           # siteState(), hasCoords(), sitesSummary() — live-state classification
│   │   │   ├── title.ts           # document.title = "(n) ALERT · Page · Falcon Eye"
│   │   │   ├── firebase.ts        # Firebase app init + db export
│   │   │   └── api.ts             # Central fetch client (JWT injection, 401 redirect)
│   │   ├── types/
│   │   │   └── access.ts          # Role, Department, Access — shared access-control types
│   │   ├── pages/
│   │   │   ├── Dashboard.tsx      # Live stats + alert feed from Firebase
│   │   │   ├── LiveMap.tsx        # react-leaflet map with real-time site GPS markers
│   │   │   ├── Cameras.tsx        # Camera feed viewer
│   │   │   ├── Admin.tsx          # Admin panel shell — tabs, department filter
│   │   │   └── Login.tsx
│   │   ├── App.tsx                # Router + AuthProvider tree
│   │   ├── main.tsx               # React DOM entry
│   │   └── index.css              # Theme tokens, base styles, utilities, Leaflet overrides, marker styles
│   ├── .env                       # VITE_ prefixed Firebase config (never commit)
│   ├── package.json               # Frontend deps only
│   └── vite.config.ts             # Path alias: @ → src/
│
├── server/                        # Express API
│   ├── index.js                   # App entry — mounts routes, starts alertRouter, syncs routing
│   ├── db.js                      # pg Pool singleton
│   ├── middleware/
│   │   └── auth.js                # JWT requireAuth (loads actor from DB — see note below), requireRole
│   ├── routes/
│   │   ├── auth.js                # POST /api/auth/login, GET/PATCH /api/auth/me, /password
│   │   ├── departments.js         # /api/departments/* — department CRUD (super_admin only)
│   │   ├── users.js                # /api/users/* — user CRUD, role/active changes, site grants
│   │   ├── admin.js               # /api/admin/* — sites, receivers, routing CRUD, audit log
│   │   ├── cameras.js             # /api/cameras/* — camera CRUD
│   │   └── streams.js             # /api/streams/* — HLS stream start/status/stop
│   ├── services/
│   │   ├── firebase.js            # Shared Firebase Admin singleton (getFirebaseDb)
│   │   ├── access.js              # Department-scoped visibility + management-permission checks
│   │   ├── audit.js               # Fire-and-forget audit_log writer
│   │   ├── alertRouter.js         # Watches sites/ in Firebase, dispatches to hq_receivers/
│   │   └── routingSync.js         # Syncs PostgreSQL routing table → Firebase routing/ node
│   └── scripts/
│       ├── setup-db.js            # One-time DB bootstrap + admin user seed
│       ├── 002_routing_schema.js  # Adds sites, hq_receivers, site_receiver_routes tables
│       └── 007_departments.js     # Adds departments, department_oversight, audit_log; department_id everywhere
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
node server/scripts/003_cameras_schema.js # Add cameras table (run once)
node server/scripts/004_imou_schema.js    # Add IMOU columns to cameras (run once)
node server/scripts/005_ownership_hierarchy.js  # Add owner_id + site_visibility_grants (run once)
node server/scripts/006_fms_integration_schema.js # Add FMS satellite tracking tables (run once)
node server/scripts/007_departments.js    # Add department model (departments, roles, audit_log) — run once
node server/scripts/008_fms_unmatched_messages.js # Park reports from unregistered FMS terminals — run once

# ── Start servers (two separate terminals) ─────────────────────────
node server/index.js                     # API + alertRouter on port 3001
cd client && npx vite                    # Frontend on port 5173

# ── Tests ──────────────────────────────────────────────────────────
npm test                                 # node:test — server/**/*.test.js (FMS state machine)

# ── FMS maintenance ────────────────────────────────────────────────
node server/scripts/fms_reconcile.js          # preview alert-data repairs (dry run)
node server/scripts/fms_reconcile.js --apply  # apply them (the server also does this on start)

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
CORS_ORIGIN=http://localhost:5173   # change to production frontend URL on deploy

# IMOU Cloud API (required only if using IMOU cameras)
IMOU_APP_ID=<from IMOU Open Platform console>
IMOU_APP_SECRET=<from IMOU Open Platform console>
IMOU_API_BASE_URL=https://openapi.easy4ip.com/openapi   # default; or openapi.lechange.cn for China accounts

# Falcon Mega Track (FMS) satellite tracking — see "FMS Satellite Integration"
FMS_API_KEY=<from Falcon Mega Track>     # sync is disabled when unset
FMS_POLL_INTERVAL_MS=60000               # default 60s; clamped to ≥ 30000 (API limit: 10 req / 5 min)
FMS_STALE_AFTER_MIN=60                   # no report for this long → GPS shown as last-known
FMS_REQUEST_TIMEOUT_MS=20000             # per request
# FMS_API_BASE_URL=...                   # override only if FMS changes its endpoint
```

### `client/.env` (Vite — must use `VITE_` prefix)
```
VITE_API_URL=http://localhost:3001   # change to production backend URL on deploy
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
    event       STRING   "alert"              ← incident onset (ESP32 press / first FMS SSAS alarm)
                         "alert_repeat"       ← FMS: SSAS re-sent every ~15 min while active — NOT a new incident
                         "reset" | "reset_acknowledged" | "test_alert"
                         (the web app only counts/lists "alert" — never add repeats to alert counts)
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
-- departments (tenancy boundary — added by 007_departments.js)
id         SERIAL PRIMARY KEY
code       TEXT UNIQUE NOT NULL                 -- e.g. 'NACTA', 'RAIL'
name       TEXT NOT NULL
view_scope TEXT NOT NULL DEFAULT 'own'          -- 'own' | 'all' | 'selected' — see access model below
is_head    BOOLEAN NOT NULL DEFAULT false        -- true only for NACTA; cannot be deleted/deactivated
active     BOOLEAN NOT NULL DEFAULT true         -- false blocks login for every user in this dept
created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()

-- department_oversight (view_scope='selected' targets — which other depts a dept can see)
viewer_department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE
target_department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE CASCADE
PRIMARY KEY (viewer_department_id, target_department_id)
created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()

-- users
id            SERIAL PRIMARY KEY
email         TEXT UNIQUE NOT NULL
password_hash TEXT NOT NULL
full_name     TEXT NOT NULL DEFAULT ''
role          TEXT NOT NULL DEFAULT 'operator'   -- 'super_admin' | 'dept_admin' | 'supervisor' | 'operator'
department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT
active        BOOLEAN NOT NULL DEFAULT true      -- false blocks login immediately (checked on every request, not just login)
created_by    INTEGER REFERENCES users(id) ON DELETE SET NULL
created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()

-- sites (panic button locations — source of truth for config)
id            TEXT PRIMARY KEY                   -- matches Firebase sites/ key e.g. "jaffer_express"
label         TEXT NOT NULL
type          TEXT NOT NULL DEFAULT 'train'      -- 'train' | 'mine' | 'other'
region        TEXT NOT NULL DEFAULT ''
source        TEXT NOT NULL DEFAULT 'cellular'   -- 'cellular' (ESP32) | 'satellite_fms' (Falcon Mega Track)
owner_id      INTEGER REFERENCES users(id) ON DELETE SET NULL   -- who created it ("Created By" in UI)
department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT
active        BOOLEAN NOT NULL DEFAULT true
created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()

-- hq_receivers (buzzer box locations)
id            TEXT PRIMARY KEY                   -- matches Firebase hq_receivers/ key
label         TEXT NOT NULL
lea           TEXT NOT NULL DEFAULT ''           -- Law Enforcement Agency name
city          TEXT NOT NULL DEFAULT ''
owner_id      INTEGER REFERENCES users(id) ON DELETE SET NULL
department_id INTEGER NOT NULL REFERENCES departments(id) ON DELETE RESTRICT
active        BOOLEAN NOT NULL DEFAULT true
created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()

-- site_receiver_routes (many-to-many routing)
site_id     TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE
receiver_id TEXT NOT NULL REFERENCES hq_receivers(id) ON DELETE CASCADE
PRIMARY KEY (site_id, receiver_id)
created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()

-- site_visibility_grants (per-operator site allow-list, within their department's universe)
site_id     TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE
user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE
granted_by  INTEGER REFERENCES users(id) ON DELETE SET NULL
PRIMARY KEY (site_id, user_id)
granted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()

-- audit_log (append-only; written by server/services/audit.js, never edited)
id            BIGSERIAL PRIMARY KEY
actor_id      INTEGER REFERENCES users(id) ON DELETE SET NULL
department_id INTEGER REFERENCES departments(id) ON DELETE SET NULL
action        TEXT NOT NULL                      -- e.g. 'site.create', 'user.delete', 'route.enable'
entity_type   TEXT NOT NULL                      -- 'user' | 'site' | 'receiver' | 'camera' | 'route' | 'department'
entity_id     TEXT
details       JSONB
created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()

-- cameras (IP cameras attached to sites — 003_cameras_schema.js + 004_imou_schema.js)
id              SERIAL PRIMARY KEY
site_id         TEXT NOT NULL REFERENCES sites(id) ON DELETE CASCADE
label           TEXT NOT NULL DEFAULT 'Camera'
stream_type     TEXT NOT NULL DEFAULT 'rtsp'    -- 'rtsp' | 'imou'
-- RTSP fields (nullable for IMOU cameras)
ip              TEXT                            -- null for IMOU cameras
port            INTEGER NOT NULL DEFAULT 554
username        TEXT                            -- null for IMOU cameras
password        TEXT                            -- null for IMOU cameras; never returned in API
channel         INTEGER NOT NULL DEFAULT 1
subtype         INTEGER NOT NULL DEFAULT 0      -- 0 = main stream, 1 = sub stream
-- IMOU Cloud fields (null for RTSP cameras)
imou_device_id  TEXT                            -- IMOU device serial number
imou_channel_id TEXT NOT NULL DEFAULT '0'       -- IMOU channel within the device
active          BOOLEAN NOT NULL DEFAULT true
created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()

-- sites.source (006) — 'cellular' (ESP32) | 'satellite_fms' (Falcon Mega Track)

-- fms_assets (006) — which FMS terminal feeds which site
site_id    TEXT PRIMARY KEY REFERENCES sites(id) ON DELETE CASCADE
mobile_id  TEXT NOT NULL UNIQUE                 -- terminal hardware serial — the match key
imo, mmsi  TEXT UNIQUE                          -- optional; ground terminals send junk ("0", "undefined")
asset_name TEXT NOT NULL DEFAULT ''

-- fms_sync_cursor (006) — single row: next_reference_id to request (inclusive)
-- fms_position_history (006) — every applied report, 15-day rolling window, UNIQUE(reference_id)
site_id, reference_id, lat, lng, speed_kmh, report_type, received_at

-- fms_unmatched_messages (008) — reports from terminals with no fms_assets row yet, 15-day window;
--   adopted into fms_position_history once a site is registered with that mobile_id
reference_id PK, mobile_id, asset_name, report_type, lat, lng, speed_kmh, received_at
```

A department's `department_id` is never nullable on `sites`/`hq_receivers`/`users` — every row belongs to exactly one department (see [Multi-Department Access Model](#multi-department-access-model)).

---

## Multi-Department Access Model

Falcon Eye is multi-tenant: every department (NACTA, Pakistan Railways, a mining authority, an LEA, …) owns its own sites, HQ receivers, and users. NACTA is the **head department** (`is_head=true`) and cannot be deleted or deactivated.

### Roles (`users.role`)
| Role | Scope | Can do |
|---|---|---|
| `super_admin` | Everything | Create/edit/deactivate departments and their admins; manage any site/receiver/user/camera; create cross-department routes; see the full audit log. Only NACTA (the head department) has super_admins. |
| `dept_admin` | Own department (+ read-only view of overseen departments) | Create/deactivate/reset users in own dept (any role except super_admin); add/remove own sites, receivers, cameras; route own sites → own receivers; assign sites to own operators; see own dept's audit log. |
| `supervisor` | Every site in the department's view scope, automatically | Read-only: Dashboard, Map, Cameras. No Admin Panel. |
| `operator` | Only the sites explicitly granted (`site_visibility_grants`) | Read-only, narrowed to granted sites. No Admin Panel. |

### Department view scope (`departments.view_scope`)
- **`own`** — sees only its own sites/receivers.
- **`all`** — sees every department's sites/receivers (NACTA).
- **`selected`** — sees its own plus the departments listed in `department_oversight` (e.g. a Railway Police department overseeing Pakistan Railways).

A user's "universe" is their department's view-scope resolution. Operators are additionally narrowed to their granted subset of that universe. **Management rights are always limited to the actor's own department**, even when their department's view scope includes others — an overseeing dept admin sees another department's sites read-only, they can't edit or delete them. Only `super_admin` can manage across departments, including creating cross-department routes.

### Enforcement
- `server/services/access.js` is the single source of truth for this logic (`loadActor`, `getScopeDepartmentIds`, `getVisibleSites`, `getVisibleReceiverIds`, `canManageSite/Receiver/Camera/User`, `canRoute`). Every route that touches sites, receivers, cameras, users, or routing calls into it — never re-implement the scoping logic in a route handler.
- `server/middleware/auth.js#requireAuth` reloads the actor (role/active/department) from the DB on every request, so deactivating a user or department takes effect immediately (see the Backend Architecture note above).
- On the frontend, `AuthContext` holds `{ user, department, access }` from `GET /api/auth/me`. `access.allSites`/`access.siteIds` drive `useFirebaseData()` and `useAlertNotification()` filtering — the Firebase `sites/`/`logs/` listeners are still unauthenticated reads (see Firebase write rules above), so **this client-side filtering is UX only, not a security boundary**. The real boundary is the backend API, which always re-derives visibility server-side.

---

## Backend (Node + Express) Rules

### Architecture
- One file per resource in `server/routes/` — never put business logic in `server/index.js`
- Services (Firebase listeners, sync tasks, access control, audit) live in `server/services/`
- Middleware lives in `server/middleware/` — reuse `requireAuth` on every protected route
- Keep `server/index.js` thin: env load, middleware stack, route mounting, listen, start services
- Database access only inside route handlers or dedicated service functions — **except** `requireAuth`, which is a deliberate exception (see below)
- Always use `getFirebaseDb()` from `server/services/firebase.js` — never call `initializeApp` directly in other files
- **`requireAuth` looks up the user on every request** (`services/access.js#loadActor`), rather than trusting the JWT payload. The JWT only carries `{ id }`. This means a role change, a deactivated account, or a deactivated department takes effect on the user's very next request — not after their 8h token expires. This is the one approved exception to "no DB access in middleware."
- All route handlers that touch sites/receivers/cameras/users go through `server/services/access.js` for visibility filtering (`getVisibleSites`, `getVisibleSiteIds`, `getVisibleReceiverIds`) and management permission checks (`canManageSite`, `canManageReceiver`, `canManageCamera`, `canManageUser`, `canRoute`) — never hand-roll a department or ownership check in a route file
- Any create/delete/role-change/route-change/grant-change should call `audit()` from `server/services/audit.js` (fire-and-forget, never throws)

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

"admin" below means `super_admin` or `dept_admin`. "super" means `super_admin` only. Routes without a role note are open to any authenticated, active user but still filtered to what they're allowed to see — see [Multi-Department Access Model](#multi-department-access-model).

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/login` | — | Returns JWT (payload is `{id}` only) |
| GET | `/api/auth/me` | ✓ | Current user + department + visible-site access set |
| PATCH | `/api/auth/password` | ✓ | Change own password (requires current password) |
| GET | `/api/departments` | ✓ super | List departments with counts + oversight targets |
| POST | `/api/departments` | ✓ super | Create a department + its first dept admin |
| PATCH | `/api/departments/:id` | ✓ super | Update name/view_scope/oversight targets/active |
| DELETE | `/api/departments/:id` | ✓ super | Delete (only if empty; head dept can't be deleted) |
| GET | `/api/users` | ✓ admin | List users in scope (super: all or `?departmentId=`; dept admin: own dept) |
| POST | `/api/users` | ✓ admin | Create a user (dept admin locked to own dept, can't create super_admin) |
| PATCH | `/api/users/:id` | ✓ admin | Update full_name/role/active (department_id: super only) |
| PATCH | `/api/users/:id/password` | ✓ admin | Reset a user's password |
| DELETE | `/api/users/:id` | ✓ admin | Remove a user |
| GET | `/api/users/:id/sites` | ✓ admin | An operator's granted site IDs |
| PUT | `/api/users/:id/sites` | ✓ admin | Bulk-replace an operator's site grants (`{siteIds:[]}`) |
| GET | `/api/admin/data` | ✓ | Sites + receivers + routes snapshot, scoped to the caller |
| PUT | `/api/admin/routes/:siteId/:receiverId` | ✓ admin | Enable a route (own dept only, unless super) |
| DELETE | `/api/admin/routes/:siteId/:receiverId` | ✓ admin | Disable a route |
| POST | `/api/admin/sites` | ✓ admin | Add a site (own dept, unless super) |
| DELETE | `/api/admin/sites/:id` | ✓ admin | Remove a site |
| GET | `/api/admin/sites/:id/history` | ✓ | Last 15 days of FMS satellite position history |
| POST | `/api/admin/receivers` | ✓ admin | Add a receiver |
| DELETE | `/api/admin/receivers/:id` | ✓ admin | Remove a receiver |
| GET | `/api/admin/audit` | ✓ admin | Audit trail (super: system-wide; dept admin: own dept) |
| GET | `/api/admin/fms/unregistered` | ✓ super | FMS terminals reporting with no registered site (`alarm_recent` flags an active alarm) |
| GET | `/api/cameras?siteId=x` | ✓ | Cameras for a site (no passwords) |
| GET | `/api/cameras/all` | ✓ | All cameras in scope, with site + department info |
| POST | `/api/cameras` | ✓ admin | Add a camera (must manage the parent site) |
| PUT | `/api/cameras/:id` | ✓ admin | Update a camera |
| DELETE | `/api/cameras/:id` | ✓ admin | Delete a camera |
| POST | `/api/streams/:id/start` | ✓ | Start FFmpeg/IMOU → HLS stream (403 if the camera's site isn't visible to you) |
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
- **Layout components** (`src/components/layout/`) — the shell. `DashboardLayout` owns the single `useAlertNotification()` and `useFirebaseConnection()` and passes results down to `Sidebar`, `Topbar` (+ `AlertBell`, `UserMenu`), `MobileNav`, `CommandPalette` and `AlertPopup`. Navigation items are defined once in `layout/navigation.ts` — add new pages there, not in each nav component.
- **`src/components/admin/`** — one component per Admin tab (`DepartmentsPanel`, `UsersPanel`, `SitesPanel`, `ReceiversPanel`, `RoutingMatrix`, `CamerasPanel`, `AuditPanel`) plus their dialogs (`AddSiteDialog`, `UserDialogs`, `DepartmentDialogs`, `SiteAccessDialog`), `shared.tsx` (RoleBadge, DepartmentBadge, PanelToolbar, PanelSkeleton, ReadOnlyHint) and `types.ts`. `pages/Admin.tsx` is only the shell — URL-synced tab (`?tab=`), data loading, the super-admin department filter.
- **Feature folders** (`components/dashboard/`, `components/map/`, `components/sites/`) — page-specific pieces, split out to keep pages small
- **UI primitives** (`src/components/ui/`) — Shadcn-style, stateless, styled with `cva` + Tailwind
- **Contexts** (`src/contexts/`) — global services only: auth (user + department + visible-site access) and the confirm dialog. Not a replacement for local state
- **`src/types/access.ts`** — shared `Role`/`Department`/`Access` types + `ROLE_LABELS`; import `Role` from here, not from `AuthContext`
- **`src/lib/utils.ts`** — `cn`, `errorMessage`, `slugify`. Display formatters live in `src/lib/format.ts`; site live-state logic in `src/lib/sites.ts` (keep non-component helpers out of `.tsx` files so fast refresh keeps working)
- **`src/lib/api.ts`** — central fetch client; use this for all backend calls, never raw `fetch`
- **`src/lib/firebase.ts`** — Firebase app init; imports `db` from here for all RTDB access
- **`src/hooks/useFirebaseData.ts`** — composite hook for all live Firebase data. Sites come from the PostgreSQL access list (`access.sites`, which carries label/type/department) merged with live Firebase state, so a registered device that has never reported still appears (`reported: false` → "Awaiting first report"). Exposes `sitesLoaded`/`alertsLoaded` — always render a skeleton until loaded and a real empty state after, never an endless spinner.
- **`src/hooks/useAlertNotification.ts`** — `activeAlerts` (every visible site in alert — drives the bell, nav badges and tab title) and a popup queue (each alert cycle pops up once per session)

### Routes

| Path | Page | Description |
|---|---|---|
| `/` | Dashboard | Active-alert banner, KPIs, recent alert timeline, site status |
| `/map?site=<id>` | LiveMap | Full-bleed map; `?site=` flies to and opens that site (used by alert popup, bell, search) |
| `/cameras?site=<id>` | Cameras | Camera grid for a site; defaults to the first site (alerts sort first) |
| `/admin?tab=<tab>` | Admin | `departments` (super only), `users`, `sites`, `receivers`, `routing`, `cameras`, `audit` — `super_admin`/`dept_admin` only |
| `/login` | Login | Sign-in; returns the user to the page they originally requested (`location.state.from`) |

Deep links are a feature: when linking to a site or tab from anywhere in the app, use these query params rather than local state.

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
- Theme tokens (colors, radius, spacing) come from CSS variables in `index.css` — do not hardcode hex values **or raw Tailwind palette colours** (`red-500`, `emerald-400`) in components; use the semantic tokens (`danger`, `success`, `warning`, `info`, `primary`, `muted`)
- Opacity modifiers must be on Tailwind's scale (`/10`, `/15`, `/20`, `/25`…) — e.g. `/12` silently generates nothing. Use arbitrary values (`/[0.07]`) when you need something off-scale
- Use `text-2xs` (11px) as the smallest text size — never `text-[10px]`
- Dark theme is the default and only theme — do not add light mode without discussion
- Responsive breakpoints: `sm` (640), `md` (768), `lg` (1024), `xl` (1280), `2xl` (1536). `md` is the phone/desktop split: below it the sidebar is replaced by `MobileNav`, dialogs become bottom sheets and `DataTable` renders cards
- Leaflet dark theme overrides live in `index.css` — do not add Leaflet CSS customisations elsewhere. `leaflet/dist/leaflet.css` is imported in `main.tsx` **before** `index.css`; the map page is lazy-loaded, so importing it there would load Leaflet's defaults after our overrides and win the cascade (white popups)

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
- Dark-only command-center palette derived from the logo: navy background (`#010A1F` family), electric-blue primary (`#0059FB` family, `--primary: 219 100% 56%`), red as the alert accent
- Semantic tokens in `index.css` (HSL channels, used as `hsl(var(--x))`): `background`, `card`, `elevated`, `popover`, `primary`, `secondary`, `muted`, `accent`, `border`, `input`, `ring`, plus status colours `danger`, `success`, `warning`, `info`
- Radius `0.75rem`; shadows `shadow-card`, `shadow-pop`, `shadow-glow-danger`, `shadow-glow-primary` (see `tailwind.config.js`)
- Fonts: Inter (UI), JetBrains Mono (`font-mono` — IDs, coordinates, department codes)
- `prefers-reduced-motion` is honoured globally in `index.css`

### Status language (be consistent)
| State | Colour | Where it comes from |
|---|---|---|
| Alert / panic | `danger` (red), pulsing dot | `site.alert` |
| Standby · live GPS | `success` (green) | `gps.status === "live"` |
| Standby · last known | `warning` (amber) | reported, GPS not live |
| Awaiting first report | muted outline | in PostgreSQL, never written to Firebase |

Always derive this with `siteState()` from `lib/sites.ts` and render it with `SiteStatusBadge`/`SiteStateDot` — don't re-implement the rules in a page.

### Badge Variants
| Variant | Use |
|---|---|
| `danger` | Active alerts, destructive audit actions |
| `warning` | Last-known GPS, inactive accounts/departments |
| `success` | Live, active, all-clear, IMOU Cloud |
| `info` | Satellite tracking, RTSP, informational |
| `outline` | Department codes (with `font-mono`), neutral states |
| `default` | Super Admin role, HEAD department |

Badges accept `size="sm"` and `dot` / `dot="pulse"`.

### Primitives (`src/components/ui/`)
| Component | Notes |
|---|---|
| `Button` | Variants `default`, `secondary`, `outline`, `ghost`, `destructive`, `danger-soft`, `link`; sizes `xs`, `sm`, `default`, `lg`, `icon`, `icon-sm`; `loading` prop shows a spinner and disables |
| `Input`, `SearchInput`, `Select`, `Field`, `Label` | `Field` wires label ↔ control ids and hint/error `aria-describedby`; `Select` is a styled native select (best on mobile) |
| `Card` (+ Header/Title/Content/Footer) | Has `min-w-0` built in — cards are grid/flex children, and long truncated text would otherwise overflow the page on phones |
| `Dialog` (+ Header/Body/Footer) | Bottom sheet below `sm`, centered modal above; `size` = `sm`/`md`/`lg`/`xl`. Put a `<form>` inside `DialogContent` wrapping Header/Body/Footer |
| `DataTable`, `RowActions` | Table on `md+`, stacked cards on phones. Columns declare `mobile: "title" / "subtitle" / "field" / "hidden"`. Per-row actions go in the `⋯` `RowActions` menu |
| `DropdownMenu`, `Tip` (tooltip), `Tabs`, `ChipGroup`, `Switch`, `Skeleton`/`SkeletonRows`, `EmptyState` | `Tabs` is an accessible tablist with arrow-key navigation |
| `ConfirmProvider` + `useConfirm()` | `if (!(await confirm({ title, description, destructive: true }))) return` |

### UX conventions
- **Every destructive action is confirmed** via `useConfirm()` (deletes, deactivations) — never a one-click delete
- **Every mutation reports its outcome**: `toast.success(...)` on success, `toast.error(title, { description: errorMessage(err) })` on failure. Never `catch { /* ignore */ }`
- **Loading → skeleton, empty → `EmptyState` with a next step, error → `EmptyState tone="danger"` with retry.** No indefinite spinners
- **Add/edit forms live in dialogs**, opened from a primary button in the panel toolbar; lists stay uncluttered
- Pages start with `PageHeader` (it also sets the browser tab title); full-bleed pages call `usePageTitle()` directly
- Icon-only buttons need an `aria-label`; add a `Tip` when the meaning isn't obvious
- Touch targets ≥ 36px on phones; primary actions sit within thumb reach (bottom sheets, bottom nav)
- Honest copy: the web app is read-only to Firebase, so the alert popup says **Dismiss** (not "Acknowledge") and explains the alert stays active until reset at the receiver

### Component Library
Shadcn UI pattern — components are owned code in `src/components/ui/`, not a black-box dependency. Edit them directly when needed. Do not install the Shadcn CLI to overwrite existing components without checking first.

---

## Key Decisions & Constraints

- **No registration flow** — user accounts are created by a super admin (any department) or a dept admin (own department only)
- **No light mode** — operational environment requires dark UI
- **Web frontend is Firebase read-only** — the ESP32 firmware and the Node.js backend write to Firebase; the React app only reads via `onValue`/`get`. **This is currently unauthenticated** — the `sites/`/`logs/` RTDB nodes have no security rules, so department isolation on the frontend is UX-only; the real boundary is the backend API. Locking Firebase down (per-user custom tokens + RTDB rules) is a planned follow-up — see Planned Features.
- **PostgreSQL is the source of truth** for departments, users, site config, receiver config, and routing rules — Firebase `routing/` is a derived cache synced from PostgreSQL by `routingSync.js`
- **Department is the tenancy boundary** — every site, receiver, and user belongs to exactly one department (`department_id`, `NOT NULL`, `ON DELETE RESTRICT`). See [Multi-Department Access Model](#multi-department-access-model).
- **`requireAuth` reloads the actor from PostgreSQL on every request** (not just at login) — the one approved exception to "no DB access in middleware," so role/active/department changes are enforced immediately, not after the JWT's 8h expiry
- **Firebase Admin SDK uses modular API** (`firebase-admin/app`, `firebase-admin/database`) — do not use the legacy namespace API (`admin.database()`, `admin.credential.cert()`)
- **Firebase client SDK uses modular API** (`firebase/app`, `firebase/database`) — do not use compat imports
- **JWT over sessions** — stateless auth suits the multi-device operator scenario; the JWT payload is `{id}` only, everything else (role, department, active) is loaded fresh server-side
- **CommonJS for server** — do not convert server files to ESM without updating root `package.json`
- **Routing sync is bidirectional in one direction** — DB is master, Firebase is replica; always update DB first then call `syncRoutingToFirebase()`
- **Cross-department routing is super_admin only** — a dept admin can only route their own department's sites to their own department's receivers (`canRoute()` in `services/access.js`)

---

## FMS Satellite Integration (Falcon Mega Track)

Some sites are tracked by an Inmarsat IDP satellite terminal instead of an ESP32. `server/services/fmsSync.js` polls the FMS cloud API and writes those sites into Firebase `sites/{id}` exactly like an ESP32 would, so the alert router, map and dashboard need no special cases. FMS field names are maritime (IMO, MMSI, `Ship_Security_Alert` = SSAS panic) because the platform was built for ships.

### The API (`server/services/fmsClient.js`)
- `GET …/GetTrackingDataByReferenceID/{FMS_API_KEY}/{cursor}` → `{ ErrorCode, AssetPosition[], NextReferenceID }`
- **Cursor-based and inclusive**: returns every message with `ReferenceID >= cursor`. FMS retains history, so rewinding the cursor replays messages (cursor `-1` returns everything retained).
- **Rate limit: 10 requests per 5 minutes per key** (HTTP 403 "API call limit exceeded"). Every process using the key shares that budget — **run exactly one server per key**, and don't run ad-hoc API probes in a tight loop. The poll interval is clamped to ≥ 30s; the 60s default uses half the budget.
- Message fields: `AssetName, IMO, MMSI, MobileID, PositionReportType, Network, ReferenceID, Latitude, Longitude, Speed, SpeedUnit (knots), Heading, CourseOverGround, ReceivedOn_UnixUTC, ReceivedOn_UTC`
- Terminals have no fixed heartbeat — a stationary terminal can be silent for days; an active SSAS alarm is re-sent every ~15 min until the terminal is reset.

### Each tick (non-overlapping, every `FMS_POLL_INTERVAL_MS`)
1. **Adopt** parked reports whose MobileID now has a registered site → history + latest position only (never replays an old alarm; an active one is re-raised by its next 15-min repeat)
2. **Fetch** from the cursor; skip ReferenceIDs already in history or parked (idempotent replays)
3. **Match** by `MobileID` (IMO/MMSI fallback). Unmatched → `fms_unmatched_messages`, shown to super admins in Admin → Sites with a pre-filled "Register" button
4. **Reduce** each site's messages with the pure state machine in `fmsState.js` (unit-tested in `fmsState.test.js`):
   - first `Ship_Security_Alert` = **onset** → `alert="true"`, `last_alert` = onset time, log `"alert"`
   - later ones while active = **repeat** → position only, log `"alert_repeat"` (`last_alert` never moves)
   - `SSAS_Reset_Acknowledgement` → `alert="false"`; `SSAS_Test` → log only
   - fresh onset + reset in the same batch → the reset is **deferred** one tick (cursor held back), otherwise Firebase would never show `alert="true"` and `alertRouter` would never buzz a receiver
5. **Write** Firebase first, then history + unmatched + cursor in one DB transaction
6. **Staleness**: GPS `status` is `live` only if the last report is newer than `FMS_STALE_AFTER_MIN`; otherwise `fallback` (UI: "last known")
7. **Prune** history and parked reports older than 15 days

On start, `fmsReconcile.js` replays stored history through the same state machine and repairs Firebase data written by the pre-fix sync (onset time, repeats logged as alerts). It's idempotent.

### Alarms are cleared only by the terminal (for now)
An HQ receiver's acknowledgement (`sites/{id}/reset`) does **not** clear an FMS alarm — only `SSAS_Reset_Acknowledgement` from the terminal does, so routed receivers keep buzzing until then. A remote reset through an FMS API is planned (see Planned Features).

### UI
- Admin → Sites: unregistered terminals callout (super admin), Satellite tracking badge
- Live Map: satellite sites' popups offer a **15-day track** (`/api/admin/sites/:id/history`, drawn by `components/map/TrackLayer.tsx`)

---

## IMOU Cloud Camera Integration

IMOU cameras can stream via IMOU's cloud instead of direct RTSP, removing the need for FFmpeg on the server.

### How it works
1. Register a developer account at [open.imoulife.com](https://open.imoulife.com) → create an App → get `appId` + `appSecret`
2. Add `IMOU_APP_ID`, `IMOU_APP_SECRET`, `IMOU_API_BASE_URL` to root `.env`
3. Run migration `004_imou_schema.js` to add IMOU columns to the cameras table
4. In Admin → Cameras → Add Camera, select **IMOU Cloud** as the stream type and enter the device's serial number (e.g. `AABHD12345678901`)
5. The Cameras page fetches an HLS URL from IMOU's cloud on demand — no FFmpeg, no local transcoding

### IMOU API flow (`server/services/imouService.js`)
- **`accessToken`** — fetched once, cached in memory with TTL (default 24h)
- **`bindDeviceLive`** — binds a device serial + channel to get a `streamId` (cached per camera per server session)
- **`getLiveStreamInfo`** — returns the live HLS URL; called on every stream start and status heartbeat
- **`deleteDeviceLive`** — called when the stream is stopped to release the binding on IMOU's side
- Signature: `MD5("time=<unix>&appSecret=<secret>&nonce=<hex>")`

### Limitations (IMOU developer tier)
- Max **5 devices** per developer account — contact IMOU for commercial tier if more cameras are needed
- 30,000 free API calls/month; $0.02 per 10,000 over the limit
- Camera must have internet access — RTSP is the only option for air-gapped/remote sites

### Data center selection
Default endpoint is `openapi.easy4ip.com` (works globally for most accounts). China-registered accounts may need `openapi.lechange.cn:443`. Override via `IMOU_API_BASE_URL` in `.env`.

---

## Planned Features (not yet built)

- **Firebase lock-down (Phase B of the multi-department access model)** — mint per-user Firebase custom tokens from the backend (`POST /api/auth/firebase-token`), add RTDB security rules scoped to an `access/{uid}/{siteId}` node synced from PostgreSQL, and move the client off unauthenticated `sites/`/`logs/` reads. The ESP32 firmware uses a legacy database secret (bypasses security rules), so this is safe to do without touching device firmware. **The current database secret was shared in plaintext during planning and should be rotated** (Firebase console → Project settings → Service accounts → Database secrets) before or as part of this work.
- **Remote FMS alarm reset** — clear a satellite terminal's SSAS alarm through the FMS API (endpoint details pending from Falcon Mega Track), triggered from HQ acknowledgement and/or the web UI
- Alert history page with filters (site, severity, date range)
- Train Network management page
- Mining Sites management page
- QRF Dispatch page
- Device management page (ESP32 node inventory, battery, signal)
- Browser push notifications for incoming panic alerts (in-app siren, tab-title alert count and alert bell already exist)
- Production deployment config (env vars, CORS, HTTPS)
