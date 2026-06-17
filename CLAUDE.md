# Falcon Eye — CLAUDE.md

## Project Overview

**Falcon Eye** is an Emergency Alert and Situational Awareness System built for Pakistan Railways trains and remote mining sites across Pakistan. It provides instant panic alerting, real-time GPS tracking, Quick Response Force (QRF) dispatch, and live device monitoring.

### Hardware Context
- **Panic Button Box** — ESP32 Wi-Fi module on-site (trains, mines). Triggers alerts via Firebase Realtime Database.
- **Receiver Box** — ESP32 with buzzer at LEA/QRF sites. Receives alerts from Firebase.
- The firmware layer communicates through Firebase Realtime Database. The web platform reads that same database for live awareness.

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
| Backend | Node.js + Express 5 |
| Database | PostgreSQL 17 (via `pg` pool) |
| Auth | JWT (jsonwebtoken) + bcryptjs |
| Hardware bridge | Firebase Realtime Database (ESP32 ↔ web) |
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
│   │   ├── contexts/              # React contexts (AuthContext)
│   │   ├── lib/                   # Utilities (cn helper)
│   │   ├── pages/                 # Route-level page components
│   │   ├── App.tsx                # Router + AuthProvider tree
│   │   ├── main.tsx               # React DOM entry
│   │   └── index.css              # Tailwind directives + CSS variables
│   ├── public/
│   ├── package.json               # Frontend deps only
│   └── vite.config.ts             # Path alias: @ → src/
│
├── server/                        # Express API
│   ├── index.js                   # App entry, middleware, route mounting
│   ├── db.js                      # pg Pool singleton
│   ├── middleware/
│   │   └── auth.js                # JWT requireAuth middleware
│   ├── routes/
│   │   └── auth.js                # POST /api/auth/login, GET /api/auth/me
│   └── scripts/
│       └── setup-db.js            # One-time DB bootstrap + admin seed
│
├── .env                           # DB URL, JWT secret, PORT (never commit)
├── package.json                   # Server deps + orchestration scripts
└── CLAUDE.md                      # This file
```

---

## Development Commands

```bash
# First-time setup
npm install && cd client && npm install

# Database bootstrap (run once, or after wiping DB)
node server/scripts/setup-db.js

# Start API server
node server/index.js              # port 3001

# Start frontend dev server (from client/)
cd client && npx vite              # port 5173

# Production build
cd client && npx tsc -b && npx vite build
```

**Note:** `npm run dev` at root uses `concurrently` but has a Windows path quirk — start the two servers in separate terminals as shown above.

---

## Environment Variables (`.env`)

```
DATABASE_URL=postgresql://postgres:<password>@localhost:5432/falcon_eye
JWT_SECRET=<strong-random-secret>
PORT=3001
```

Never commit `.env`. It is in `.gitignore`.

---

## Database

### Conventions
- All tables use `snake_case` column names
- Every table has `id SERIAL PRIMARY KEY` and `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
- Use parameterised queries (`$1, $2, ...`) — never string-interpolate user input into SQL
- Connection pooling via single `db.js` pool export — never create ad-hoc `Client` instances in route handlers
- Migrations go in `server/scripts/` as numbered files (`001_initial.js`, `002_add_alerts.js`, etc.)

### Current Schema

```sql
-- users
id          SERIAL PRIMARY KEY
email       TEXT UNIQUE NOT NULL
password_hash TEXT NOT NULL
full_name   TEXT NOT NULL DEFAULT ''
role        TEXT NOT NULL DEFAULT 'operator'  -- 'admin' | 'operator' | 'supervisor'
created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
```

---

## Backend (Node + Express) Rules

### Architecture
- One file per resource in `server/routes/` — never put business logic in `server/index.js`
- Middleware lives in `server/middleware/` — reuse `requireAuth` on every protected route
- Keep `server/index.js` thin: env load, middleware stack, route mounting, listen only
- Database access only inside route handlers or dedicated service functions — never in middleware

### Code Style
- CommonJS (`require`/`module.exports`) — root `package.json` has no `"type": "module"`
- Always `async/await` — no callback-style `.then()` chains in new code
- Wrap every async route handler in try/catch — never let unhandled rejections crash the process
- Return consistent error shapes: `{ error: "Human-readable message" }` with the appropriate HTTP status
- Use `req.body` validation at the top of each handler before touching the DB
- Never return `password_hash` in any API response — explicitly select only needed columns

### HTTP Status Codes
| Situation | Code |
|---|---|
| Success (data returned) | 200 |
| Created | 201 |
| Bad input / missing fields | 400 |
| Auth failure | 401 |
| Forbidden (authenticated but not allowed) | 403 |
| Not found | 404 |
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
- **Contexts** (`src/contexts/`) — global state only (auth, theme). Not a replacement for local state
- **`src/lib/utils.ts`** — pure utility functions only (`cn`, formatters, helpers)

### Component Rules
- Functional components only — no class components
- Co-locate component-specific types in the same file; shared types go in `src/types/`
- Prefer named exports for components — default exports only for page-level components
- Keep components focused: if a component has more than ~150 lines, split it
- Extract repeated JSX patterns into sub-components in the same file before promoting to `components/`

### State Management
- Local UI state: `useState` / `useReducer`
- Shared auth state: `AuthContext` via `useAuth()` hook
- Server state (future): use React Query (`@tanstack/react-query`) — do not build manual fetch caches
- Do not put derived data into state — compute it inline or with `useMemo`

### Hooks
- Custom hooks live in `src/hooks/` (create the directory when first needed)
- Hook names always start with `use`
- Never call hooks conditionally

### Styling
- Tailwind utility classes only — no inline `style={{}}` except for truly dynamic values (e.g. calculated pixel widths)
- Use the `cn()` helper from `src/lib/utils.ts` for conditional class merging
- Theme tokens (colors, radius, spacing) come from CSS variables in `index.css` — do not hardcode hex values in components
- Dark theme is the default and only theme — do not add light mode without discussion
- Responsive breakpoints: `sm` (640), `md` (768), `lg` (1024), `xl` (1280)

### TypeScript
- Strict mode is on — no `any`, no `@ts-ignore`
- Use `type` for object shapes and unions; `interface` only when extension is needed
- Import types with `import type { ... }` to keep runtime imports clean
- Never assert `as SomeType` to silence a type error — fix the type

### Path Aliases
- `@/` maps to `client/src/` — always use this for internal imports, never relative `../../`

### API Calls
- All fetch calls go through a central `src/lib/api.ts` client (create this when adding more than 2 endpoints)
- Always include the JWT Bearer token from `useAuth()` on protected requests
- Handle 401 responses globally: clear token and redirect to `/login`

---

## UI / Design System

### Theme
- Dark navy/slate palette — this is a surveillance/ops tool, not a consumer app
- Primary: blue (`hsl(210 100% 52%)`)
- Danger/alerts: red variants
- Warning: amber variants
- Success/online: emerald variants
- All colours defined as CSS variables in `client/src/index.css`

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

- **No registration flow** — user accounts are created by admin only (future admin panel)
- **No light mode** — operational environment requires dark UI
- **Firebase is read-only from the web platform** — the ESP32 firmware writes to Firebase; the web app only reads (via SDK or REST)
- **PostgreSQL is the source of truth** for users, alert history, site config, and QRF assignments — not Firebase
- **JWT over sessions** — stateless auth suits the multi-device operator scenario
- **CommonJS for server** — do not convert server files to ESM without updating root `package.json`

---

## Planned Features (not yet built)

- Firebase Realtime Database integration for live ESP32 alert ingestion
- Alert history page with filters (site, severity, date range)
- Live Map page (GPS asset tracking — trains + QRF units)
- Train Network management page
- Mining Sites management page
- QRF Dispatch page
- Device management page (ESP32 node inventory, battery, signal)
- Admin panel (user management — create/deactivate operators)
- Notification sound + browser push for incoming panic alerts
