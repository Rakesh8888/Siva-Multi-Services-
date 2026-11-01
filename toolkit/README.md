# SIVA MULTI SERVICES — Free Travel Agent Toolkit

A static, dependency-free internal toolkit available at `/toolkit/` after the existing Cloudflare Pages project deploys this repository.

## Included
- Customer inquiry records and lead status
- Itinerary planner
- Package cost / markup / tax estimate calculator
- Booking and payment-status tracker
- Invoice creation and print-to-PDF
- General visa checklist (verify official requirements)
- English/Telugu marketing message templates
- Flight / hotel / bus enquiry and reservation status tracker
- Vendor and supplier contact directory
- Business summary reports with CSV export and print
- JSON backup and restore

## Deploy
This is a static HTML file with no build step. If the root of this repository is already connected to Cloudflare Pages, the new route should be available at:

`https://YOUR-DOMAIN/toolkit/`

If your Pages deployment uses a custom output directory or ignores this folder, check **Workers & Pages → your Pages project → Settings → Builds & deployments**. Keep the current build settings unchanged unless the project structure requires a change.

## Important limitations
- Data is stored in browser localStorage only. It does not sync between devices or browsers and has no authentication or server-side database.
- Do not store passport numbers, payment-card information, or sensitive customer documents.
- No live flight, hotel, bus inventory, booking, or payment API is connected.
- Invoice printouts are operational drafts, not a guarantee of tax compliance. Confirm required invoice fields and tax treatment with an accountant.
- The visa list is generic; always verify the relevant embassy or official visa centre's current checklist.
- Review this project and its license before commercial redistribution or adaptation.

## Free / potential costs
- Static hosting can fit within Cloudflare Pages Free limits for a small toolkit.
- A custom domain is optional and normally costs money to register/renew.
- Live supplier APIs, payment processing, transactional email/SMS, secure shared database, and authentication may have separate costs or eligibility requirements.
