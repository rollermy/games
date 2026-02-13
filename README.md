# Nuxt Base Template

A starter template for apps built on [nuxt-base](https://github.com/corsacca/nuxt-base).

## Quick Start

### 1. Clone this template

```bash
npx giget gh:corsacca/nuxt-base-template#master .
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your values:
- `DATABASE_URL` - PostgreSQL connection string (required)
- `JWT_SECRET` - A secure random string (required)
- `APP_TITLE` - Your app name

**Important:** Do NOT wrap values in quotes.

### 3. Install and run

```bash
npm install
npm run dev
```

Migrations run automatically. Your app is ready at http://localhost:3000

## What's in This Template

| File | Purpose |
|------|---------|
| `app/app.vue` | App wrapper - customize for your app |
| `app/pages/index.vue` | Landing page - customize for your app |
| `server/api/example/` | Example authenticated API endpoints |
| `nuxt.config.ts` | Extends the base layer |
| `package.json` | Dependencies and scripts |
| `.env.example` | Environment template |
| `BASE_LAYER.md` | API reference for the base layer |

## What Comes from the Layer

The [nuxt-base](https://github.com/corsacca/nuxt-base) layer provides (with automatic updates):

- **Auth pages**: `/login`, `/register`, `/dashboard`, `/profile`, `/reset-password`
- **Layouts**: `default`, `auth`
- **Composables**: `useAuth()`, `useTheme()`
- **Components**: `ThemeToggle`
- **API routes**: Authentication, profile management
- **Server utils**: Database, email, S3, JWT

## Creating API Endpoints

The base layer provides server utilities that are auto-imported. See `server/api/example/` for working examples.

```typescript
// server/api/my-endpoint.get.ts
export default defineEventHandler(async (event) => {
  // requireAuth() throws 401 if not logged in
  const user = requireAuth(event)

  // sql is a tagged template for database queries
  const data = await sql`SELECT * FROM my_table WHERE user_id = ${user.userId}`

  return { data }
})
```

Available utilities: `requireAuth`, `getAuthUser`, `sql`, `sendEmail`, `createError`

## Customization

**Files you own** (in this template):
- `app/app.vue` - Modify freely
- `app/pages/index.vue` - Your landing page
- `server/api/` - Your API endpoints

**To override layer files**, copy them to your project:
- Create `app/pages/login.vue` to customize login
- Create `app/layouts/default.vue` to customize the layout

## Documentation

`BASE_LAYER.md` contains the complete API reference for the base layer.
