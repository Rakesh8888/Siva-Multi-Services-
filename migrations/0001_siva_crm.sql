PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS customers (
 id TEXT PRIMARY KEY, customer_code TEXT NOT NULL UNIQUE, full_name TEXT NOT NULL,
 phone TEXT NOT NULL, email TEXT, city TEXT, notes TEXT,
 status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','inactive')),
 created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_customers_name ON customers(full_name);
CREATE INDEX IF NOT EXISTS idx_customers_phone ON customers(phone);
CREATE TABLE IF NOT EXISTS service_cases (
 id TEXT PRIMARY KEY, case_code TEXT NOT NULL UNIQUE,
 customer_id TEXT NOT NULL REFERENCES customers(id), service_type TEXT NOT NULL,
 description TEXT, status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','in_progress','waiting','completed','cancelled')),
 due_date TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_service_cases_customer ON service_cases(customer_id);
CREATE TABLE IF NOT EXISTS transactions (
 id TEXT PRIMARY KEY, customer_id TEXT NOT NULL REFERENCES customers(id),
 transaction_type TEXT NOT NULL CHECK(transaction_type IN ('charge','payment','refund')),
 amount_paise INTEGER NOT NULL CHECK(amount_paise > 0), description TEXT NOT NULL,
 reference_number TEXT, payment_method TEXT, recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
 created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_transactions_customer ON transactions(customer_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(recorded_at);
CREATE TABLE IF NOT EXISTS audit_logs (
 id TEXT PRIMARY KEY, action TEXT NOT NULL, record_type TEXT NOT NULL,
 record_id TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);