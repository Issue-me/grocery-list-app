# Fiji Grocery List

A simple, mobile friendly grocery list for Fiji. It uses plain HTML, CSS, and JavaScript, so there is no build step. The Meals page and meal planning are removed.

See [PREDEPLOY_AUDIT.md](PREDEPLOY_AUDIT.md) for the current review and known setup limits.

## Project files

```text
index.html                 App pages and forms
styles.css                 Phone and desktop styles
app.js                     List, offline data, and Supabase sync
supabase.js                Public Supabase URL and browser key
manifest.webmanifest       Installable app settings
service-worker.js          Offline app files
icon.svg                   App icon
supabase/schema.sql        Tables, access rules, and Realtime
supabase/functions/         Server-side account deletion
```

## Run it

```bash
python -m http.server 8000
```

Open <http://localhost:8000>. A web server is needed for install and offline support. HTTPS is needed outside localhost.

## Sign in and accounts

Create an account with your name, email, and password. Verify your email before signing in. Returning users sign in with their email and password. Use **Forgot password?** to get a password reset email.

Accounts made with the old PIN sign-in need a password reset before they can sign in with a password. The reset email changes the old PIN credential to a new password.

## Features

- Add, edit, move, tick, and delete items. Set amount, unit, notes, price, and a discount.
- See aisle groups, estimated total, savings, budget left, and who added each shared item.
- Use search suggestions, usual items, repeat last trip, voice entry, and share list text.
- Create a household, invite members with a code, and sync the list live. Pantry, budget, and trip history also sync with the active household.
- Keep a local copy for offline use. List edits and household data are queued and sent when the connection returns.
- Track pantry expiry dates. Install the app on supported phones and computers.

Meals, recipes, and meal plans are not part of the app.

## Supabase setup

The browser uses the public publishable key in `supabase.js`. This key is meant to be public. Never place a service role key in frontend files. Run the latest `supabase/schema.sql` to create or update the database tables and keep profile email updates in sync.

1. Create a Supabase project, or confirm the URL and publishable key in `supabase.js` belong to your project.
2. Run `supabase/schema.sql` in the Supabase SQL Editor. This creates the tables, membership checks, RLS policies, household state sync, and Realtime setup. Older store-price tables may remain in the database, but the app no longer uses them. It is safe to run again after updates.
3. In **Authentication > Providers**, enable Email and keep email confirmation on. Keep Supabase Auth password rules and rate limits enabled. Users sign in with their email and password.
4. In **Authentication > URL Configuration**, set the Site URL. Add the local URL and your deployed URL as redirect URLs. For GitHub Pages, include the full repository path, such as `https://your-name.github.io/your-repo/**`.
5. Set up SMTP for dependable verification email delivery.
6. Deploy account deletion from the project folder:

   ```bash
   supabase login
   supabase link --project-ref your-project-ref
   supabase functions deploy delete-account
   supabase secrets set APP_ORIGIN=https://your-name.github.io
   ```

   `APP_ORIGIN` is the site origin only. For GitHub Pages, leave off `/your-repo`. The service role key is provided to the Edge Function by Supabase and must not be added to this app.
7. Start the local server, create an account with a password, and verify the email. Try **Forgot password?** with a test account and make sure the recovery link returns to the app. Then create a household and share its invite code.

Only household members can read that household's list and shared shopping data. The database uses row level security. Do not disable RLS.

## Offline data and conflicts

The app shell is cached by the service worker. Shopping data and pending changes are stored in localStorage. A household's list, pantry, budget, and trip history sync when the device is online and signed in. If two devices change the same list item while offline, the latest update wins and the app shows a message. Pantry edits use the latest timestamp for each item.

## Account and privacy

Supabase stores account name and email. Household data is stored in the database for group sharing. This browser stores a local copy for offline access. Settings has sign out, clear this device, and delete account and data. Account deletion needs the deployed Edge Function. Deleting an account removes its profile and any household it owns.


## Supabase Edge Function editor setup

The account deletion function uses Deno. Open this project in VS Code and install the **Deno** extension by Deno Land (`denoland.vscode-deno`). Workspace settings enable it for `supabase/functions`, and `supabase/functions/deno.json` maps the Supabase package import. Reload the VS Code window after installing the extension.

## Free hosting

GitHub Pages, Cloudflare Pages, or Netlify can host these static files. There is no build command or output folder. Set the Supabase Auth Site URL and redirect URLs to your deployed site. Apply the database SQL and deploy the Edge Function separately; GitHub Pages cannot run backend code.

## Checks

Use a phone-sized browser and try adding, editing, adding item prices and discounts, moving, buying, and deleting list items. Test household sync using two verified accounts, then test offline edits and reconnect. Also test item prices and discounts, expiry warning, account deletion with a disposable account, and PWA install on the deployed HTTPS site.
