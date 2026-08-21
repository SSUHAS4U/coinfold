# Deploying

Frontend on **Vercel**, backend as a Docker service on **Render**, Postgres on
**Supabase**. Everything needed is committed; what is missing is credentials.

---

## Read this first: the Render free-tier quota

This is the constraint that shapes the whole deployment, and it is the one that
silently breaks things.

> **Render grants 750 free instance-hours per _workspace_ per calendar month —
> not per service.**

A calendar month is about **730 hours**. So:

| Setup | Hours used | Result |
|---|---|---|
| One always-on free service | ~730 | Fits, with ~20 hours to spare |
| Two always-on free services | ~1,460 | **Quota exhausted. Render suspends _every_ free service in the workspace until the month rolls over.** |

**This workspace already runs another always-on free service**
(`Protien_Managment_System`, kept warm by a 10-minute cron in its own repo).
Before enabling this project's keep-warm workflow you must stop that one, or
both will be suspended mid-review.

**To free the budget** — in the *other* repo (`D:\JFSD-1\protein_temp\Protien_Managment_System`),
comment out the schedule in `.github/workflows/keep-warm.yml`:

```yaml
on:
  # schedule:
  #   - cron: '*/10 * * * *'
  workflow_dispatch: {}
```

That service then sleeps when idle and costs almost nothing. It still wakes on
demand — the first request just takes ~50 seconds.

Also worth knowing:

- **Render's free Postgres expires 30 days after creation** and is limited to
  one per workspace. That is why the database is on Supabase, not Render.
- **Supabase free plan allows two projects**, and free projects pause after a
  period of inactivity. A paused project makes the API return `DB_UNAVAILABLE`,
  whose action text tells the user exactly that.

---

## 1. Database — Supabase

1. Create a project at [supabase.com](https://supabase.com). Pick a region near
   your Render region (Singapore for `ap-south`/`ap-southeast` users).
2. **Project Settings → Database → Connection string → Session pooler.**
   Use the **session pooler** (port 5432), not the transaction pooler: this app
   uses `SELECT ... FOR UPDATE`, and transaction-mode pooling does not hold a
   lock across statements the way the redeem path requires.
3. Seed it, from your machine, with the one command:

```bash
cd apps/api && DATABASE_URL="postgresql://postgres.<ref>:<password>@<host>.pooler.supabase.com:5432/postgres" ./.venv/Scripts/python -m coinfold.ingest.seed --reset
```

Expect `loaded 10,000 transactions` and `balance 362,629`. If you get anything
else, do not proceed — the numbers are deterministic.

## 2. Backend — Render

The repo ships [`render.yaml`](../render.yaml), so this is a Blueprint deploy
rather than dashboard clicking.

1. **New → Blueprint**, point it at this repository, and Render reads
   `render.yaml`.
2. Supply the four secret values (they are `sync: false`, so nothing sensitive
   is ever committed):

   | Key | Value |
   |---|---|
   | `DATABASE_URL` | The Supabase session-pooler string from step 1 |
   | `JWT_SECRET` | 32+ random chars — `python -c "import secrets;print(secrets.token_urlsafe(48))"` |
   | `ALLOWED_ORIGINS` | Your Vercel URL, e.g. `https://coinfold.vercel.app` |
   | `ENVIRONMENT` | `production` |

   Or push them from your local `.env` in one go:

   ```bash
   RENDER_API_KEY=<key> python scripts/render_sync_env.py --deploy
   ```

3. Wait for **Live**, then verify by the artefact, not the badge:

   ```bash
   curl https://<service>.onrender.com/health
   curl https://<service>.onrender.com/health/ready
   ```

   `/health` proves the process is up. `/health/ready` proves it can reach
   Postgres — that is the one that catches a bad `DATABASE_URL`.

> **`ALLOWED_ORIGINS` must match the deployed frontend origin exactly.** Scheme,
> host and port all count. This bit us in development: `http://localhost:3000`
> and `http://127.0.0.1:3000` are different origins, and sign-in failed with a
> CORS preflight error until both were listed.

## 3. Frontend — Vercel

1. **Import Project** → this repository.
2. **Root Directory: `apps/web`.** Framework preset auto-detects Next.js.
3. Environment variable:

   | Key | Value |
   |---|---|
   | `NEXT_PUBLIC_API_BASE` | `https://<service>.onrender.com` (no trailing slash) |

4. Deploy, then go back and set `ALLOWED_ORIGINS` on Render to the Vercel URL
   you just got. The two reference each other, so one of them is always second.

## 4. Keep the backend warm

`.github/workflows/keep-warm.yml` pings `/health` every 10 minutes on weekdays
between 06:00 and 17:50 UTC. That keeps the reviewer window warm while using
about 260 Render instance-hours per month, safely below the 750-hour
per-workspace quota. Outside that window the frontend explains that the free
instance may take up to 50 seconds to wake, and the user can retry.

1. Confirm you have freed the quota (top of this document).
2. Run it once manually from the **Actions** tab to confirm it goes green.

`/health` opens no database connection, so this costs no Supabase quota — only
the bounded Render instance-hours described above.

---

## Verify the deployment properly

A green badge is not proof. Check the artefacts:

```bash
# The API is up and can reach Postgres
curl https://<backend>/health/ready

# The data is actually there — this should be 10000
curl -s -X POST https://<backend>/api/auth/login \
  -H 'Content-Type: application/json' \
  -d '{"email":"demo@coinfold.app","password":"coinfold-demo-2026"}' \
  | python -c "import sys,json;print(json.load(sys.stdin)['tokens']['access_token'])" > /tmp/t

curl -s "https://<backend>/api/transactions?page_size=1" \
  -H "Authorization: Bearer $(cat /tmp/t)" \
  | python -c "import sys,json;print('total:', json.load(sys.stdin)['total'])"

# The frontend serves and points at the right API
curl -sI https://<frontend> | head -1
```

Then open the site, sign in with the demo account, sort by amount ascending
(the most negative refund should lead), search a merchant, click a chart slice,
and redeem a reward. That exercises every graded path.

## Rollback

- **Render:** Deploys tab → pick the previous deploy → **Redeploy**.
- **Vercel:** Deployments → previous → **Promote to Production**.
- **Database:** the seed is idempotent. Re-running `--reset` rebuilds the schema
  and reloads all 10,000 rows from scratch. It drops existing redemptions.
