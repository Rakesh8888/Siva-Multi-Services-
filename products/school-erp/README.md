# White-label School CRM & ERP

This is a standalone product kept separate from the Siva Multi Services customer CRM, visa/cruise tracker, and any Master project.

## White-label model
Each school gets its own deployment and its own Cloudflare D1 database. To prepare a customer copy, edit only `brand.config.js` (school name, logo, colours, contact details), create a separate D1 database, apply `schema.sql`, and deploy the Worker. Never share one school's database with another school unless a deliberately designed multi-tenant deployment is implemented and audited.

## Modules in this product foundation
- School branding and configurable identity
- Role-based sign-in foundation (Admin, Teacher, Accountant, Parent, Student)
- Student and guardian records
- Classes and sections
- Attendance
- Fee invoices and payments
- Exams and marks
- Notices and announcements
- Tenant-isolated database design (one database per school deployment)

## Setup
1. Create a Cloudflare D1 database for the school.
2. Apply `schema.sql` to that database.
3. Configure the D1 binding as `DB` and secrets `SESSION_SECRET` and `SETUP_KEY` on the Worker.
4. Set `SCHOOL_ID` to a unique identifier for this school deployment.
5. Deploy `worker.js` as a Cloudflare Worker and serve the frontend files from a Pages project or static assets binding.
6. Open the app and use the one-time setup screen with the configured setup key to create the first administrator. Disable/remove `SETUP_KEY` after setup.
7. Change branding only in `brand.config.js` for each customer's copy.

## Security
- Passwords are stored as PBKDF2 hashes, never plain text.
- Sessions are signed and stored in Secure, HttpOnly, SameSite cookies.
- Every data query is scoped to the deployment's `SCHOOL_ID`.
- Do not upload Aadhaar, medical records, or other sensitive student documents until private file storage, retention rules, consent, and access controls are implemented and tested.
- Configure HTTPS and strong secrets before real student data is entered.
- This is an initial product foundation, not a claim of production certification. Complete the test checklist before onboarding a school.

## Current development status
Initial white-label product foundation. Student, class, attendance, fee, exam, and notice APIs are included in the backend foundation. UI and end-to-end test coverage are being built in separate iterations.