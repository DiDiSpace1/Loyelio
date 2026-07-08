# Product Smoke Test

Run this on the production Vercel URL with Stripe test mode before inviting real users.

## Automated Preflight

Run:

```bash
pnpm smoke:prod
```

This checks:

- public pages
- protected route redirects
- unsigned Stripe webhook rejection
- Stripe Price IDs
- Supabase core tables
- Supabase `documents` bucket
- support email environment value

It does not create a user, submit payments or delete data. Continue with the manual flow below after it passes.

## Fresh User

1. Open `/login`.
2. Create a new account with country `France`.
3. Confirm the email if Supabase requires confirmation.
4. Log in and confirm `/dashboard` loads.

Expected:

- The user lands in the app without a server error.
- A profile, workspace and workspace membership exist in Supabase.

## Rental Setup

1. Open `/properties`.
2. Create one property.
3. Open the property detail page.
4. Add one unit.
5. Open `/tenants`.
6. Create one tenant.
7. Return to the property and create a lease with rent, charges and deposit.

Expected:

- Rent charges are generated for the lease.
- The dashboard shows current rent totals.

## Rent And Documents

1. Add a partial rent payment on a rent charge.
2. Confirm the charge status becomes `partial`.
3. Add the remaining amount.
4. Confirm the charge status becomes `paid`.
5. Open `/documents`.
6. Upload a PDF or image and associate it with a property, unit and tenant.
7. Add an expense and link the document.
8. Use search, year, type and property filters.

Expected:

- The document can be downloaded.
- The expense appears in `/documents` and `/tax`.

## Billing And Export

1. Open `/tax` as a free user.
2. Confirm export is blocked and the Pro prompt appears.
3. Click the Pro button and complete Stripe Checkout with a test card.
4. Wait for the webhook to update billing.
5. Reload `/tax`.
6. Download CSV and ZIP.
7. Open `/settings` and verify Customer Portal opens.

Expected:

- Free users cannot download tax exports.
- Paid users can download CSV and ZIP.
- Stripe Customer Portal loads for the workspace.

## Account Controls

1. Log out.
2. Use forgotten password and set a new password.
3. Log in with the new password.
4. Open `/settings`.
5. Export account data.
6. For a disposable test account only, type `SUPPRIMER` and delete the account.

Expected:

- Password reset completes without a server error.
- Data export returns JSON.
- Account deletion cancels active Stripe subscription before user deletion.

## Public Pages

1. Open `/privacy`.
2. Open `/terms`.
3. Open `/robots.txt`.
4. Open `/sitemap.xml`.
5. Use a fresh browser profile and confirm the cookie notice appears.

Expected:

- All public pages return `200`.
- Cookie notice can be accepted or declined.
