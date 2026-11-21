# Siva Multi Services: Visa & Cruise Tracking (Telugu)

ఈ feature ప్రస్తుతం feature/siva-visa-cruise-tracking branch లో ఉంది. ఇది existing Siva Multi Services project upgrade మాత్రమే. వేరే Master project కాదు.

## ఇందులో ఏముంది?

- Admin CRM లో customer select చేసి visa application record create చేయవచ్చు.
- Visa stage: Enquiry, Documents Pending, Documents Review, Appointment Pending/Booked, Submitted to Authority, Under Review, Additional Documents Requested, Decision Received, Passport Returned, Completed, On Hold.
- Visa document checklist: Pending, Received, Verified, Needs Update, Not Required.
- Customer portal లో customer తన visa assistance progress, checklist, customer-visible updates చూడవచ్చు.
- Official visa portal HTTPS link ఇవ్వవచ్చు. Government status API integration లేకపోతే official decision ను automatic గా fetch చేసినట్టు చూపించదు.
- Cruise job assistance: Candidate role, preferred company, CV stage, application stage, employer reference, applied date, interview date.
- Customer portal లో cruise progress updates కనిపిస్తాయి.
- CRM service/payment ledger లో People Services మరియు ticket-related service records కొత్తగా create చేయకుండా block చేయబడతాయి.
- ప్రతి కొత్త payment తప్పనిసరిగా eligible service record కు link అవుతుంది. పాత payments మాత్రం legacy/unallocated గా ఉంటాయి; delete చేయబడవు.

## URLs

- Admin CRM: /crm-admin.html
- Admin Visa & Cruise Tracker: /tracking-admin.html
- Customer account/payment portal: /customer-portal.html
- Customer Visa & Cruise Status: /customer-tracking.html

## Important privacy rules

- Passport number, Aadhaar number, OTP, passwords, card PINs, bank PINs ను application reference లేదా notes లో పెట్టకండి.
- ప్రస్తుతం document checklist metadata మాత్రమే save అవుతుంది. Passport/ID scans upload చేయడానికి private storage and access controls separately configure చేసి test చేయాలి.
- Customer API తన session ద్వారా ఆ customer records మాత్రమే చూపిస్తుంది.
- Private admin notes customer portal కు పంపబడవు.
- Cruise assistance అనేది CV preparation, online application guidance, interview assistance మాత్రమే. Job guarantee లేదా unauthorised recruitment కాదు.

## Deployment

ఈ branch production website/Worker ను deploy చేయదు. PR review/merge తర్వాత మాత్రమే main branch push workflow run అవుతుంది. Existing workflow D1 migrations ను remote database పై apply చేసి Worker deploy చేస్తుంది. Merge కు ముందు Cloudflare GitHub Actions secrets మరియు existing deployment connection పనిచేస్తున్నాయో check చేయాలి.

## Official visa status

Siva Multi Services internal progress (ఉదా: documents reviewed) మరియు embassy/government decision వేర్వేరు. Official portal link customer కు చూపించబడుతుంది. ప్రతి దేశానికి ఒకే public status API ఉండదు; official portal integration అవసరమైతే country/visa-specific approved API లేదా manual verification అవసరం.
