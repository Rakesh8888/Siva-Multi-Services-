# SIVA Multi Services — Customer Portal Foundation

This branch adds the first database migration for a private customer portal.

## Scope

Customer cases, document records, payment ledger entries and progress history are enabled only for:

- Visa documentation and application assistance
- Tourism and tour packages
- Overseas-job application assistance
- Cruise-job application assistance
- CRM / ERP / billing software support

The following are intentionally excluded from long-term customer-case storage:

- People/document services (for example, Aadhaar/PAN assistance)
- Flight, train and bus ticket bookings

Do not create a service case, customer document folder or payment ledger entry for an excluded service. Handle those requests outside this portal and retain no personal document copies in this system.

## What the migration creates

- Customer profile linked to Supabase Auth
- Automatically generated customer codes in the format SMS-YYYY-000001
- Service cases with explicit allowed-service check constraint
- Append-only payment ledger in paise (INR), with admin verification status
- Computed customer balance view based only on verified ledger entries
- Private customer document metadata
- Customer-visible progress activity
- Row Level Security policies for customer-owned records and admins
- Private Storage bucket with per-customer folder isolation

## Important: this is a database foundation, not a deployed portal

The migration does not yet connect the current website UI, add customer/admin login screens, configure OTP/email delivery, or deploy a production database. Do not tell customers that the portal is live until those steps and the security tests are complete.

## Setup

1. Create a Supabase project.
2. Open SQL Editor and review the migration at supabase/migrations/202611140001_customer_portal_foundation.sql.
3. Apply the migration in the new project.
4. Enable and configure a suitable sign-in method (email OTP or password + verified email). Phone OTP may incur SMS-provider costs.
5. Create the trusted business-admin Auth account.
6. In SQL Editor, promote only that verified account:
   update public.customer_profiles set role = 'admin' where user_id = '<AUTH_USER_UUID>';
7. Keep the service-role key server-side only. Never commit it to GitHub or expose it in browser JavaScript.
8. Configure the website to use only the project URL and anon/publishable key in browser code, with RLS enabled.
9. Test with two customer accounts and one admin account:
   - Customer A cannot read Customer B's profile, cases, payments or documents.
   - Customer B cannot read Customer A's data.
   - Customers cannot create or edit payment ledger entries.
   - Customers can read only their own visible progress and balances.
   - Admin can manage cases and verify documents/payments.
   - The private storage bucket is not publicly readable.
   - Excluded services cannot be inserted into service_cases.
10. Only after tests, connect the portal UI and deploy.

## Payment rules

- Store rupee amounts as integer paise to avoid floating-point rounding errors.
- Only verified payments affect the displayed balance.
- Use a new refund/adjustment row to correct a transaction; do not rewrite historical ledger rows.
- Never store card numbers, CVV, UPI PIN, banking passwords or OTPs.
- A customer-submitted screenshot/transaction reference is not proof of settlement until verified.

## Documents and privacy

- The bucket siva-private-documents is private.
- Upload object names using <customer-auth-user-uuid>/<random-file-name>.
- Use short-lived signed URLs for authorized viewing; never make the bucket public.
- Collect only documents required for the specific case, with a clear privacy notice and consent.
- Set a retention/deletion schedule and provide a request channel.
- Avoid uploading Aadhaar/PAN or other sensitive documents unless strictly necessary and legally permitted. This foundation is not a legal compliance certification.

## Free-tier caveats

Supabase Free currently lists 500 MB database, 1 GB file storage and pausing after one week of inactivity; it does not include automatic backups. It is suitable for development/testing, not as the only protected store for live passport/visa files or critical business records. Review current pricing and terms before production use.

The current Vercel Hobby plan is intended for personal, non-commercial use. For a business website, verify hosting terms and use a plan/provider that permits commercial use. Cloudflare Pages/Workers may be a suitable low-cost hosting route, subject to current plan limits.

## Branch

This work is isolated on feature/customer-portal-foundation. The production main branch and live website have not been changed by this migration.
