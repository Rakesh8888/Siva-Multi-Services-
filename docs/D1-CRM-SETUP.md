# SIVA Multi Services CRM: D1 setup

This change is deliberately isolated on branch `feature/siva-d1-customer-ledger`. It does not overwrite the current website or its AI routes.

## Files added
- `migrations/0001_customer_crm.sql`: creates customers, service_records and payments tables.
- `crm.js`: protected admin API for customers, services, payments and ledger summaries.
- `crm-worker.js`: backward-compatible Worker entrypoint that sends only `/api/admin/*` requests to the CRM and forwards all existing requests to the original `worker.js`.

## Cloudflare steps still required
1. In the existing D1 database `siva-business-db`, open **Query** and run the complete contents of `migrations/0001_customer_crm.sql`. Do not drop or delete existing tables.
2. In the Worker settings, add a D1 database binding with variable name **DB** and select `siva-business-db`.
3. Add a Worker secret named **ADMIN_API_TOKEN**. Generate a long random value and keep it private. Never commit it to GitHub or send it in chat.
4. Change the Cloudflare Worker entrypoint from `worker.js` to `crm-worker.js`. This wrapper preserves the original AI/chat/voice/assets routes and handles only the new `/api/admin/*` paths.
5. Deploy the Worker and test its API using an authenticated admin client. Do not expose the admin token in browser JavaScript.

## API endpoints after integration
- `GET /api/admin/customers`
- `GET /api/admin/customers?q=search-text`
- `POST /api/admin/customers` with `{ "fullName": "Customer name", "phone": "+91..." }`
- `GET /api/admin/customers/{id}`
- `POST /api/admin/customers/{id}/services` with `{ "serviceName": "Visa assistance", "fee": 2500 }`
- `POST /api/admin/customers/{id}/payments` with `{ "amount": 1000, "method": "UPI" }`
- `GET /api/admin/customers/{id}/ledger`

Every endpoint requires `Authorization: Bearer <ADMIN_API_TOKEN>`.

## Important status
This is the backend foundation, not a finished customer/admin dashboard. Customer-facing login, session management, document uploads, and browser UI are not included in this first migration. Build those only after the D1 binding and protected admin API have been deployed and tested. Ticket bookings are intentionally not recorded in this CRM ledger.
