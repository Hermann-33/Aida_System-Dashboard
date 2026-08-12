# POS/Admin State and Data Flow

Updated: 2026-08-13

## Admin catalogue

```text
AdminMenuPage / AdminMenuEditorPage
 -> catalogueClient
 -> employeeFetch(credentials: include)
 -> same-origin catalogue BFF
 -> employee session validation
 -> caller admin JWT
 -> get_catalogue / save_catalogue_* SECURITY INVOKER RPC
 -> Postgres + audit + revision bump
```

Browser code never receives a service-role credential. A refreshed employee access cookie is reused by the catalogue BFF when the auth layer rotates the session.

## Cross-client propagation

A successful save bumps `catalogue_revision`; the Flutter customer app listens to that row and re-fetches its public RLS-filtered snapshot.

## POS catalogue read

```text
CounterWorkspace -> catalogueClient -> GET /api/v1/catalogue
 -> get_catalogue (publishable key, public read)
 -> posCatalogue adapter -> category cards / item cards / variants / compatible add-ons
```

No preview catalogue fallback is used when this request fails.

## Remaining preview

POS checkout/order/payment state remains local/fixture-backed and is not made authoritative by Admin catalogue integration.
