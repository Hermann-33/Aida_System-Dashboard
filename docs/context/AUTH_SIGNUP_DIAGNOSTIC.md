# Auth signup diagnostic

Status: `PARTIAL`

## Observed symptom

The customer Flutter signup flow returned the generic message `Authentication failed` while the live Supabase project still contained zero Auth users, profiles, and members.

## Verified backend evidence

- Supabase project: `eswovqxqzfevcdwwcmuh` (`Aida System`), `ACTIVE_HEALTHY`.
- `auth.users` -> `public.handle_new_auth_user()` trigger exists and is enabled.
- `public.handle_new_auth_user()` is `SECURITY DEFINER`, owned by `postgres`, and forces new public signups to the `customer` application role.
- `public.generate_member_code()` exists.
- The failed signup left zero Auth users and did not produce a corresponding provisioning-trigger Postgres error.

This points to an Auth-layer rejection occurring before the profile/member trigger rather than an RLS/provisioning failure.

## Client fix

The customer repository branch `codex/fix-auth-signup-diagnostics` improves Supabase Auth failure mapping so common signup failures are no longer collapsed into the generic `Authentication failed` message.

No dashboard authentication bypass is required and no service-role/secret credential should be added.

## Hosted Auth configuration requirement

The currently available Supabase connector does not expose project Auth email-confirmation/SMTP mutation controls, so this task does not silently alter hosted Auth settings.

For a local demo, one of these must be true before arbitrary customer email signup can be expected to work:

1. configure a working custom SMTP/email confirmation path; or
2. explicitly disable Confirm Email in the Supabase Authentication email provider for the demo environment.

This is a project-configuration action, not a database migration.

## Dashboard implication

The dashboard still requires a trusted `admin` or `owner` identity and valid local Supabase environment variables before protected Members/Menu pages can stay mounted and load data.
