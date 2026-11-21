-- SIVA Multi Services: visa and cruise application tracking
-- Stores workflow metadata only. Do not store passport/Aadhaar scans or OTPs here.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS visa_applications (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  destination_country TEXT NOT NULL,
  visa_type TEXT NOT NULL,
  travel_purpose TEXT,
  application_reference TEXT,
  official_portal_url TEXT,
  official_status TEXT,
  internal_stage TEXT NOT NULL DEFAULT 'enquiry',
  submitted_on TEXT,
  next_update_due TEXT,
  admin_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_visa_customer ON visa_applications(customer_id, updated_at);

CREATE TABLE IF NOT EXISTS cruise_applications (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  target_role TEXT NOT NULL,
  preferred_company TEXT,
  cv_stage TEXT NOT NULL DEFAULT 'cv_pending',
  application_stage TEXT NOT NULL DEFAULT 'profile_created',
  employer_reference TEXT,
  applied_on TEXT,
  interview_on TEXT,
  admin_notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_cruise_customer ON cruise_applications(customer_id, updated_at);

CREATE TABLE IF NOT EXISTS visa_document_checklist (
  id TEXT PRIMARY KEY,
  visa_id TEXT NOT NULL,
  document_name TEXT NOT NULL,
  document_status TEXT NOT NULL DEFAULT 'pending',
  customer_note TEXT,
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (visa_id) REFERENCES visa_applications(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_visa_docs ON visa_document_checklist(visa_id);

CREATE TABLE IF NOT EXISTS tracking_updates (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL,
  record_type TEXT NOT NULL CHECK (record_type IN ('visa','cruise')),
  record_id TEXT NOT NULL,
  stage TEXT NOT NULL,
  note TEXT,
  visible_to_customer INTEGER NOT NULL DEFAULT 1 CHECK (visible_to_customer IN (0,1)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  FOREIGN KEY (customer_id) REFERENCES customers(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_tracking_updates_customer ON tracking_updates(customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_tracking_updates_record ON tracking_updates(record_type, record_id, created_at);
