# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Start dev server (auto-runs migrations first)
- `npm run build` — Production build
- `npm start` — Production server (auto-runs migrations first)
- `npm run migrate` — Run database migrations only

No test or lint commands are configured.

## Architecture

**Nuxt 4 full-stack app** for multiplayer card games. SSR is disabled (`ssr: false`). Uses @nuxt/ui v4 with Tailwind CSS.

### Frontend (`app/`)

- **Pages**: File-based routing. Game pages live under `app/pages/games/dos/`. The `[code].vue` page is the active game room.
- **Composables**: `useAuth()` for auth state, `useGameSocket()` for WebSocket game communication, `useTheme()` from the base layer.
- **Layouts**: `default` (standard app), `auth` (login/register), `game` (game pages).
- **State**: Uses Nuxt `useState()` for reactive state. Auth is cached in sessionStorage.
- **Middleware**: `auth` middleware protects routes requiring login.

### Backend (`server/`)

- **WebSocket handler** (`server/api/games/ws.ts`): Central hub for all real-time game logic. Uses Nitro's experimental WebSocket support (crossws).
- **Game logic** (`server/game/dos/`): `types.ts` (state & message types), `state.ts` (state management), `logic.ts` (rules & card mechanics).
- **Game state is in-memory** (Map-based, not persisted). Room metadata is stored in PostgreSQL.
- **Auth**: JWT in cookies, verified on both API routes and WebSocket connections. Utilities: `requireAuth()`, `getAuthUser()`.
- **Database**: PostgreSQL via `postgres` library. Use the `sql` tagged template for queries.

### Migrations (`migrations/`)

JS-based migration classes with `.up()` methods. Run automatically on dev/start. Tables: users, activity_logs, game_rooms, password_resets.

### Base Layer

This project extends [nuxt-base](https://github.com/corsacca/nuxt-base) which provides auth pages, layouts, composables, and server utils. See `BASE_LAYER.md` for the base layer API reference. To override a base layer file, copy it into the corresponding local path.

## Game: DOS

2-player Uno variant with real-time WebSocket multiplayer. Flow: host creates room → gets 6-char code → guest joins with code. Players are identified as index 0 (host) or 1 (guest). 60-second grace period on disconnect before cleanup. Special cards include Gift, Fairy Gobble, Flip (transforms card colors/values), Wild+4, Skip.

## Environment

Required in `.env`: `DATABASE_URL` (PostgreSQL), `JWT_SECRET`. Do NOT wrap .env values in quotes.
