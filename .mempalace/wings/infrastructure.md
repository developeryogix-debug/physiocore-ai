# Wing: Infrastructure

Vercel, Supabase, Anthropic, env vars, monitoring. The plumbing.

---

## Accounts in use

| Service | Account | Identifier |
|---|---|---|
| GitHub (active) | `developeryogix-debug` | developeryogix@gmail.com |
| GitHub (old, ignore) | `devkapil-tech` | - |
| GitHub (copy, ignore) | `kddocai` | - |
| Vercel | developeryogix@gmail.com | - |
| Supabase | project `qbrrugglfdwcapqrnahw` | Singapore region |
| Anthropic | developeryogix@gmail.com | Tier 1, $15 auto-reload, $100/mo cap |

## Live URLs

- **Production:** https://app-dteam1-mmcv.vercel.app
- **Supabase callback:** https://qbrrugglfdwcapqrnahw.supabase.co/auth/v1/callback
- **GitHub repo:** https://github.com/developeryogix-debug/physiocore-ai
- **Health check:** https://app-dteam1-mmcv.vercel.app/api/health-check
- **Ping test:** https://app-dteam1-mmcv.vercel.app/api/ping

## Environment variables

### packages/app/.env.local (frontend)
```
VITE_ANTHROPIC_KEY=sk-ant-...
VITE_SUPABASE_URL=https://qbrrugglfdwcapqrnahw.supabase.co
VITE_SUPABASE_ANON_KEY=eyJ...
SUPABASE_SERVICE_ROLE_KEY=eyJ...
FHIR_BASE_URL=https://hapi.fhir.org/baseR4
```

### Vercel env vars (must be set)
```
VITE_ANTHROPIC_KEY
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
RESEND_API_KEY          # resend.com - free 3000 emails/month
CRON_SECRET = a3f9b2c1d4e5f6
SUPABASE_SERVICE_ROLE_KEY
```

## Supabase schema (key tables)

| Table | Purpose |
|---|---|
| `profiles` | user_id, role (patient/clinician/admin) |
| `consents` | signed consent records |
| `user_profiles` | full onboarding data |
| `sessions` | session history (synced from localStorage) |
| `outcomes` | PSFS/NPRS/GROC/PHQ-4 scores |
| `biometrics` | HR, BP, glucose, HRV, sleep, weight |
| `trainer_sessions` | AI trainer conversation list |
| `trainer_messages` | messages per trainer session |
| `health_checks` | monitoring results |
| `alert_log` | sent email deduplication |
| `cost_log` | daily spend estimates |

Migrations under `packages/supabase/src/`:
- `migration.sql` - auth tables
- `monitor-migration.sql` - monitoring tables
- `session-memory-migration.sql` - session_summaries + chat_messages
- `pages-migration.sql` - biometrics + trainer_* tables (still needs to be run)

## Monitoring system

- `api/health-check.ts` checks Anthropic API, Supabase, MediaPipe CDN, app homepage. Cron `0 0 * * *` (daily 8am SGT).
- `DiagnoseAgent` (Haiku) on failure -> root cause + severity + fix steps.
- `AlertAgent` -> Resend email to devkapilicloud@gmail.com with 4h dedup.
- `CostWatchAgent` estimates daily spend, alerts at $1.50 (warning) and $3.00 (critical).
- Header `Authorization: Bearer {CRON_SECRET}` required for `/api/health-check`.

## Build/deploy commands

```bash
cd /Users/devkapilicloud.com/Desktop/physiocore-ai
cd packages/app && pnpm dev
# App: http://localhost:5173 (or 5174/5175)
pkill -f "vite"   # kill all dev servers
```

Vercel: framework = null, custom outputDirectory.
