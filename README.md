# CryptoPulse-CS375

## Server setup

The current server code uses Supabase via `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`.

If you also need a direct Postgres connection string for local tools or future server-side database access, use:

```text
postgresql://postgres:[YOUR-PASSWORD]@db.zxqkckqnmvgdvrulahmh.supabase.co:5432/postgres
```

If the database password contains special characters, percent-encode them in the connection string.

Example server environment variables:

```text
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
DATABASE_URL=postgresql://postgres:[YOUR-PASSWORD]@db.zxqkckqnmvgdvrulahmh.supabase.co:5432/postgres
REDIS_URL=redis://localhost:6379
PORT=4000
```

Optional Supabase agent skills install:

```bash
npx skills add supabase/agent-skills
```