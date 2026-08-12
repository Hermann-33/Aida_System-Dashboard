# System Map

Updated: 2026-08-13

| System | Runtime | Current trusted source |
|---|---|---|
| Customer | Flutter/Riverpod | Supabase Auth/member stack + shared catalogue |
| Admin | React/Vite | same-origin BFF + shared catalogue/member RPCs |
| Backend | Supabase | Auth, Postgres, forced RLS, controlled RPCs |

## Catalogue flow

```text
Admin Menu
 -> same-origin BFF cookie session
 -> admin/owner caller JWT
 -> save_catalogue_* SECURITY INVOKER RPC
 -> catalogue tables + audit + revision bump
 -> Supabase Realtime revision event
 -> Flutter invalidates catalogue snapshot
 -> get_catalogue() under RLS
 -> updated menu shown in app
```

The production customer menu contains no hardcoded catalogue fallback. Initial live seed is the 16 entries formerly hardcoded in the customer app.

POS transaction/checkout preview data is not catalogue authority and remains outside TASK-MENU-001.

## Deployment state

The dashboard Vercel project now exists and the source builds there. Its BFF is not operational until the project receives `AIDA_SUPABASE_URL` and `AIDA_SUPABASE_PUBLISHABLE_KEY` as runtime environment variables. These are publishable client/BFF inputs; a service-role key remains prohibited from Vite/browser code.
