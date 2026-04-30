# Deploy MindMend (free Supabase + Render)

The app uses **Supabase (PostgreSQL)** on the free tier—no MongoDB.

## 1. Supabase (database)

1. Create a project at [supabase.com](https://supabase.com/dashboard) (free includes a reasonable DB size for this app).
2. Open **Project Settings → API** and copy:
   - **Project URL** → use as `SUPABASE_URL`
   - **service_role** key (**secret**) → use as `SUPABASE_SERVICE_ROLE_KEY`
   - **Never** expose the service role key in Frontend code or public repos.
3. Open **SQL Editor** → paste the contents of **`supabase/schema.sql`** → **Run**.
4. Tables **`user_profiles`** and **`journal_entries`** must exist before the API can save users/entries.

## 2. Local `.env`

Copy `.env.example` to `.env` and set at least:

- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `CLERK_SECRET_KEY`
- Clerk publishable keys in `Frontend/login.html`, `index.html`, `profile.html`, `admin.html` (or your production keys + allowed domains in Clerk).

## 3. Deploy on Render

1. Push this repo to GitHub/GitLab.
2. **Render → New Blueprint** (or Web Service → Docker): root = folder containing `Dockerfile`.
3. Environment variables:

| Variable | Notes |
|---------|--------|
| `SUPABASE_URL` | From Supabase dashboard |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role (**secret**) |
| `CLERK_SECRET_KEY` | Clerk dashboard |
| `NODE_ENV` | `production` |
| `BASE_URL` | After deploy: `https://<your-service>.onrender.com` |
| `OPENROUTER_API_KEY` | Optional |

4. In **Clerk**, add your Render URL to **allowed origins** and **redirect URLs** as in the earlier setup.

## 4. Checks

- `GET /health` → `"connected": true` when Supabase is reachable and tables exist.
- Sign in, save a journal entry, confirm it appears after refresh.

**Note:** Data that lived in MongoDB is **not** migrated; this stack starts fresh in Postgres.

Render’s free tier may **sleep** the service; the first request after idle can take ~30–60 seconds.
