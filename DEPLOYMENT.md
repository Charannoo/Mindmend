# Hosting MindMend

The app uses **Supabase (PostgreSQL)** for data. The server is a single **Node + Express** process that also serves the `Frontend` static files.

## 1. Supabase (database)

1. Create a project at [supabase.com](https://supabase.com/dashboard) (free tier is fine for this app).
2. Open **Project Settings → API** and copy:
   - **Project URL** → `SUPABASE_URL`
   - **service_role** key (**secret**) → `SUPABASE_SERVICE_ROLE_KEY`
   - **Never** put the service role key in the browser or a public repo.
3. Open **SQL Editor** → paste **`supabase/schema.sql`** → **Run**.
4. Tables **`user_profiles`** and **`journal_entries`** must exist before the API can save data.

## 2. Environment variables

Set at least:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CLERK_SECRET_KEY`
- `NODE_ENV=production` when hosted
- `BASE_URL` = your public site URL (for OAuth-style redirects if you use them)
- `OPENROUTER_API_KEY` (optional; local affirmations work without it)

Clerk publishable keys live in the HTML files under `Frontend/` (or use your production keys and allow your domain in the Clerk dashboard).

## 3. Run in production

- **Docker:** build from the repo root `Dockerfile`, pass the env vars at run time.
- **Any Node host:** `cd Backend && npm ci --omit=dev && node server.js` with the same env vars.

## 4. Checks

- `GET /health` should show `"connected": true` when Supabase is reachable and tables exist.
- Sign in, save a journal entry, confirm it appears after refresh.

**Note:** Old MongoDB data is **not** migrated; this stack uses Postgres in Supabase only.
