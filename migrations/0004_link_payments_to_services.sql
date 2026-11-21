-- Link each new payment to a trackable service record.
-- Existing historic payments remain unallocated (NULL) and are not deleted.
ALTER TABLE payments ADD COLUMN service_record_id TEXT REFERENCES service_records(id);
CREATE INDEX IF NOT EXISTS idx_payments_service ON payments(service_record_id);
