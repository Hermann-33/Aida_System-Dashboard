# POS/Admin Backend Integration Plan

Updated: 2026-08-13

## Deployment/Auth boundary

The real Vercel project and a clean `READY` preview deployment now exist. The same-origin functions compile, but the deployment cannot reach Supabase until an operator configures `AIDA_SUPABASE_URL` and `AIDA_SUPABASE_PUBLISHABLE_KEY` in Vercel project settings. The available deployment automation cannot set those project variables. No service-role key is required or allowed.

After configuration, resume the existing login/session/refresh/logout and Admin Members E2E with approved accounts. Do not add a public bootstrap endpoint or browser-visible privileged credential.

## Admin catalogue — implemented source/data

Admin Menu now reads `/api/v1/admin/catalogue` and writes category/item mutations through `/api/v1/admin/catalogue/*`. The BFF validates the existing employee/admin HttpOnly session and calls Supabase catalogue RPCs with the caller JWT.

Admin can create categories/items and edit item name/SKU/category/type/description/base price/publication/availability/featured/bestseller/student eligibility/image/volume/prep route/sort, per-item variants and compatible add-ons.

Admin Menu no longer imports the preview catalogue/modifier fixtures.

## POS catalogue — implemented read path

The sale workspace reads `/api/v1/catalogue` and maps active categories, published products, availability, base prices, per-item variants and only compatible published add-ons. Fetch failure is visible and does not fall back to preview catalogue data.

Cart lines, client totals, order lifecycle, tender and receipts remain preview/local and untrusted. Replace those together with the authoritative quote/order/POS integration.
