PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS users (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL, full_name TEXT NOT NULL,
 email TEXT NOT NULL, password_hash TEXT NOT NULL,
 role TEXT NOT NULL CHECK(role IN ('admin','teacher','accountant','parent','student')),
 linked_student_id TEXT, active INTEGER NOT NULL DEFAULT 1,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(school_id,email)
);
CREATE INDEX IF NOT EXISTS idx_users_school_role ON users(school_id,role);

CREATE TABLE IF NOT EXISTS classes (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL, class_name TEXT NOT NULL,
 section TEXT NOT NULL DEFAULT '', class_teacher_id TEXT,
 academic_year TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(school_id,class_name,section,academic_year)
);
CREATE TABLE IF NOT EXISTS students (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL, admission_no TEXT NOT NULL,
 first_name TEXT NOT NULL, last_name TEXT DEFAULT '', dob TEXT, gender TEXT,
 class_id TEXT, guardian_name TEXT, guardian_phone TEXT, guardian_email TEXT,
 address TEXT, status TEXT NOT NULL DEFAULT 'active'
 CHECK(status IN ('active','inactive','transferred','graduated')),
 joined_on TEXT, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(school_id,admission_no),
 FOREIGN KEY(class_id) REFERENCES classes(id)
);
CREATE INDEX IF NOT EXISTS idx_students_school_class ON students(school_id,class_id,status);

CREATE TABLE IF NOT EXISTS attendance (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL, student_id TEXT NOT NULL,
 attendance_date TEXT NOT NULL, status TEXT NOT NULL CHECK(status IN ('present','absent','late','leave')),
 marked_by TEXT NOT NULL, note TEXT DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(school_id,student_id,attendance_date),
 FOREIGN KEY(student_id) REFERENCES students(id), FOREIGN KEY(marked_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_attendance_school_date ON attendance(school_id,attendance_date);

CREATE TABLE IF NOT EXISTS fee_invoices (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL, student_id TEXT NOT NULL,
 invoice_no TEXT NOT NULL, fee_type TEXT NOT NULL, amount_paise INTEGER NOT NULL CHECK(amount_paise>=0),
 due_date TEXT, status TEXT NOT NULL DEFAULT 'unpaid' CHECK(status IN ('unpaid','partial','paid','cancelled')),
 academic_year TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(school_id,invoice_no), FOREIGN KEY(student_id) REFERENCES students(id)
);
CREATE TABLE IF NOT EXISTS fee_payments (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL, invoice_id TEXT NOT NULL,
 amount_paise INTEGER NOT NULL CHECK(amount_paise>0), payment_method TEXT NOT NULL,
 receipt_no TEXT NOT NULL, reference TEXT, received_by TEXT NOT NULL,
 paid_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(school_id,receipt_no), FOREIGN KEY(invoice_id) REFERENCES fee_invoices(id),
 FOREIGN KEY(received_by) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_fee_invoice_student ON fee_invoices(school_id,student_id);

CREATE TABLE IF NOT EXISTS exams (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL, exam_name TEXT NOT NULL,
 class_id TEXT NOT NULL, subject TEXT NOT NULL, exam_date TEXT,
 max_marks REAL NOT NULL CHECK(max_marks>0), academic_year TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(class_id) REFERENCES classes(id)
);
CREATE TABLE IF NOT EXISTS exam_marks (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL, exam_id TEXT NOT NULL,
 student_id TEXT NOT NULL, marks REAL NOT NULL CHECK(marks>=0),
 remarks TEXT DEFAULT '', entered_by TEXT NOT NULL,
 UNIQUE(school_id,exam_id,student_id), FOREIGN KEY(exam_id) REFERENCES exams(id),
 FOREIGN KEY(student_id) REFERENCES students(id), FOREIGN KEY(entered_by) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS notices (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL, title TEXT NOT NULL,
 body TEXT NOT NULL, audience TEXT NOT NULL DEFAULT 'all'
 CHECK(audience IN ('all','teachers','parents','students')),
 published INTEGER NOT NULL DEFAULT 0, created_by TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, FOREIGN KEY(created_by) REFERENCES users(id)
);
CREATE TABLE IF NOT EXISTS audit_log (
 id TEXT PRIMARY KEY, school_id TEXT NOT NULL, user_id TEXT NOT NULL,
 action TEXT NOT NULL, entity_type TEXT NOT NULL, entity_id TEXT,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
