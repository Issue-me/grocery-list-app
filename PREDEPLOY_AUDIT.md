# Fiji Grocery List pre-deploy audit

Audit date: 20 November 2026

## Page review

| Area | Status | Notes |
| --- | --- | --- |
| Account creation and sign-in | Implemented; Supabase setup required | New users see account creation first. Returning signed-in users go straight to the 6 digit PIN pad. **Forgot PIN?** sends a recovery email. Accounts created before PIN sign-in changed may need to reset once to save the new PIN credential. |
| Shopping list | Implemented; live setup required | Quick add, suggestions, usual items, edit, move, delete, bought status, price and discounts, totals, repeat last trip, share text, and voice entry. ?Already have? items are left out of the estimated total. |
| Categories and aisles | Implemented | Items are grouped in store order and can be moved. |
| Store price comparison | Removed at your request | The store comparison and price entry screens are removed. Item prices and discounts remain available in the shopping list. |
| Pantry and expiry | Implemented; database setup required | Add, remove, move to list, and expiry warnings. Pantry changes sync to household members and are cached locally. |
| Household and sharing | Implemented; hosted setup required | Create and join households, choose the current group, copy invite codes, see item authors, sync list edits live, and queue offline changes. |
| Budget and history | Implemented; database setup required | Budget and saved trip totals sync with the active household and are cached locally. |
| Settings and privacy | Implemented; hosted setup required | Privacy page, clear-device action, sign-out, and account deletion flow. Deletion needs the Edge Function deployed. |
| Meals, recipes, and meal plans | Removed at your request | There is no Meals page, navigation item, or app feature. Old unused database tables remain for compatibility and are not used by the app. |


## Security review

- `supabase.js` contains a public publishable key. No service role key is in frontend files.
- Household tables use row level security and membership checks. Direct membership creation is blocked; joining uses the protected database function.
- Household pantry, budget, and history snapshots are visible only to members of that household.
- The current app does not read or write store comparison prices. Old price tables and admin functions remain in the database schema but are not exposed by the app.
- Account deletion uses an Edge Function that checks the caller's token before using the server-only admin key.
- The UI requires 6 digits. The app turns the email and PIN into a long credential before calling Supabase Auth. It checks PINs with Supabase while online and stores a salted local PIN check for offline unlock. The PIN is still only 6 digits and is easier to guess than a strong password, so keep email verification and Auth rate limits enabled.
- A Content Security Policy restricts loaded resources. User text is escaped before rendering as HTML; auth messages use text content.

These are code-level checks. I cannot confirm the live Supabase project's settings, schema, email settings, secrets, or deployed Edge Function from this workspace.

## Checks completed

- JavaScript syntax check passed for `app.js`.
- Earlier static checks found the page IDs, selectors, manifest, CSS, and app shell valid. Those checks do not exercise browser behavior.
- No browser automation, Supabase CLI, Deno runtime, or PostgreSQL client is available here. The SQL has not been applied to a live database, and two-account sync, email verification, CSV use, and account deletion have not been exercised against Supabase.

## Setup before public use

1. Run the latest `supabase/schema.sql` in the target Supabase project.
2. Keep Supabase Auth password rules and rate limits enabled. The app sends a generated long credential, not the raw PIN. A 6 digit PIN is still easier to guess than a strong password.
3. Enable email confirmation and allow the deployed redirect path in Supabase Auth, including the password recovery redirect.
4. Deploy `supabase/functions/delete-account` and set `APP_ORIGIN` to the site origin.
6. Test registration, the full-screen PIN lock, offline PIN unlock, and PIN recovery, household switching, two-account live sync, offline edits, item prices and discounts, and account deletion on the deployed HTTPS site.

GitHub Pages serves the frontend only. Supabase schema and Edge Function setup happen separately. Meals remain removed.
