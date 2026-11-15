# SIVA Multi Services CRM – Setup Notes

The new private Admin Dashboard is available at /admin.html. The existing public website remains unchanged.

## Features in this first build
- Private admin login using a server-side secret token
- Customer directory with unique SIVA Customer IDs
- Service request records
- Service charges, payments and refunds ledger
- Customer outstanding balances
- Dashboard summary and audit logs

## Cloudflare D1 setup required
The current Worker does not yet have a D1 database binding. Create one in Cloudflare Dashboard:
1. Workers & Pages → D1 SQL Database → Create Database.
2. Name it siva-business-db.
3. Copy the Database ID.
4. Add this binding to wrangler.jsonc:

```jsonc
"d1_databases": [
  {
    "binding": "SIVA_DB",
    "database_name": "siva-business-db",
    "database_id": "PASTE_THE_DATABASE_ID_HERE",
    "migrations_dir": "migrations"
  }
]
```

5. Add a Worker secret named SIVA_ADMIN_TOKEN. Use a strong random value of at least 32 characters. Never put this token in GitHub or public website code.
6. Apply the SQL in migrations/0001_siva_crm.sql to the new D1 database.
7. Deploy the Worker after the binding and secret are configured.

## API routes
- GET /api/crm/admin/summary
- GET and POST /api/crm/admin/customers
- GET and POST /api/crm/admin/services
- GET and POST /api/crm/admin/transactions

## Important limitations
- Payment entries are manual accounting records, not verified gateway payments.
- This version does not issue tickets, confirm bookings or submit visa/job applications.
- Do not store Aadhaar, PAN, passport scans, OTPs, passwords, bank PINs or card details in this first CRM.
- Collect customer details only with informed consent and only when needed for the requested service.
- API routes return 503 until D1 is configured and 401 until the admin token is configured.
