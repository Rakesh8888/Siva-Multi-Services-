# White-label School CRM & ERP

This is an independent software product inside its own folder. It is not part of the Siva Multi Services customer CRM, visa/cruise tracker, or the paused Master project.

## White-label model
Each school gets a separate deployment and separate Cloudflare D1 database. To prepare a customer's branded copy, edit only `public/brand.config.js` for school name, logo, colours, address and contact details. Create a fresh D1 database for that school. Do not share student data or a database between schools.

## Included in this foundation
- Configurable school identity and branding
- Role-based sign-in: Admin, Teacher, Accountant, Parent, Student
- One-time first administrator setup
- Student and guardian records
- Classes and sections
- Daily attendance
- Fee invoices and payment receipts
- Exam schedule
- Notices and announcements
- Parent/student access scoped to their linked student for student and fee records
- Separate database per school deployment

## Deployment setup
1. Copy `wrangler.toml.example` to `wrangler.toml`.
2. Create a new Cloudflare D1 database for this school.
3. Replace the D1 database name and ID in `wrangler.toml`; set a unique `SCHOOL_ID`.
4. Run `npx wrangler d1 execute <DATABASE_NAME> --remote --file=./schema.sql`.
5. Set secrets: `npx wrangler secret put SESSION_SECRET` and `npx wrangler secret put SETUP_KEY`. Use long random values.
6. Deploy from this folder with `npx wrangler deploy`.
7. Open the Worker URL and use First-time school setup to create the first admin account.
8. Immediately remove the setup secret: `npx wrangler secret delete SETUP_KEY`.
9. Test with sample student records and test accounts before entering real school data.

## Product scope notes
This is the initial working foundation, not yet a complete school ERP for commercial sale. It includes login, role-based permissions, student/class/attendance, fee invoices/payments, exam scheduling, and notices. Exam marks, timetable, transport, library, payroll, parent messaging, bulk imports, document uploads, backups, analytics and mobile app packaging remain later modules.

## Security and customer delivery
- Passwords are PBKDF2 hashes. Session cookies are Secure, HttpOnly and SameSite=Strict.
- Data queries use the deployment's school ID; parent/student fee and student records are restricted to their linked student.
- Never store passwords, OTPs, Aadhaar numbers, or unnecessary sensitive data in notes.
- Do not upload student identity documents or medical information until private file storage, consent, retention, and access controls are added and tested.
- Use HTTPS, unique secrets, a separate database per school, and a tested backup/restore process.
- Before commercial delivery, complete security review, functional tests, school-specific requirements, and applicable privacy/legal review.

## Branding
Change `public/brand.config.js` for each customer's school name, tagline, logo URL, colours, contact details, academic year and locale. No Siva Multi Services branding is hard-coded into the school app.
