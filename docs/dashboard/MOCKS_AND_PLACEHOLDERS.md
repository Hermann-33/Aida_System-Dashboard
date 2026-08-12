# POS/Admin Mocks and Placeholders Register

Updated: 2026-08-13

## No longer preview in Admin Menu or POS browsing

Admin Menu categories/items/prices/publication/availability/variants/add-on compatibility now come from the shared Supabase catalogue through the BFF. The conflicting dashboard preview catalogue is not promoted to production data.

POS menu/category cards and modifier choices use the same shared snapshot. `PREVIEW_MENU`, `PREVIEW_CATEGORIES` and `PREVIEW_MODIFIER_GROUPS` remain fixture definitions but are not runtime POS browsing/configuration sources.

## Still preview

POS cart/order/payment/tender/receipt flows, loyalty, employee/terminal operations, branches, inventory, marketing, reporting and most settings remain preview until bounded backend tasks. Admin Inventory and Sales Performance still intentionally derive fake rows from `PREVIEW_MENU`; they are not production inventory/reporting integrations.

The remaining POS fixture must not be used as shared menu authority.
