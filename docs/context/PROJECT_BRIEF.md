# AIDA Café Project Brief

Updated: 2026-08-14

## Product purpose

AIDA Café is the ordering, membership, loyalty and café-operations system for City University Malaysia. The product combines a customer application with staff POS and administration workflows over one authoritative backend.

## System components

### Customer application

Repository: `Hermann-33/Aida_System`.

Flutter customer UI for authentication, member provisioning, shared catalogue browsing/configuration, authoritative quote/place, scheduled pickup, history and persisted status refresh. Rewards/vouchers, real payment settlement and several downstream domains remain preview/deferred.

### POS/Admin dashboard

Repository: `Hermann-33/Aida_System-Dashboard`.

React 19 + TypeScript + Vite browser application. Trusted employee/Admin, Members, catalogue, POS quote/place and staff order queue/status paths use same-origin BFF APIs backed by the shared Supabase project. Many non-tranche operational surfaces remain explicit preview/local functionality.

### Shared backend

Supabase project **Aida System**, ref `eswovqxqzfevcdwwcmuh`.

Trusted identity/membership, catalogue, quote/order, scheduled pickup and fulfilment persistence are implemented with RLS and controlled RPCs. Payment, loyalty, inventory, marketing, reporting and branch-capacity authority remain deferred.

## Target users

- Students and other café customers.
- Baristas/cashiers/staff operating shared terminals and POS workflows.
- Managers/admin/owners operating catalogue, staff, inventory, rewards, marketing and reporting workflows.

## Shared product rule

The two frontends are views/controllers over one operational system. They must use the same identifiers, lifecycle definitions and backend rules. The customer app cannot invent a price/order/reward outcome that the POS does not recognise, and the dashboard cannot mutate data outside the same server-enforced contract.

## Current maturity

- Customer: live Auth/member/catalogue/order integration exists; deferred domains remain preview.
- Dashboard: live Admin/member/catalogue/order integration exists; deferred operations remain preview.
- Supabase: authoritative identity/member, catalogue, order/schedule and fulfilment state.
- Current ordering tranche: implementation complete across backend and both clients; final fresh cross-client live E2E evidence remains the closeout gate.

## Core business domains

Identity/session, membership/student verification, branches/sales points/terminals, employees/roles, catalogue/modifiers/pricing, cart/quote, orders/fulfilment/KDS, payments/refunds, loyalty/rewards/vouchers, inventory/recipes/wastage/transfers, promotions/marketing, reporting and immutable audit.

## Success criteria

AIDA succeeds when role-appropriate users complete their flows against one trusted backend with consistent IDs and state transitions, server-authoritative value calculations, secure ownership/branch/role access, audited privileged actions, usable failure/offline behavior, reproducible migrations, cross-client integration tests and current mirrored documentation.
