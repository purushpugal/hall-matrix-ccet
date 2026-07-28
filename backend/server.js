console.log("✅ server.js loaded");

/* =======================
   1. IMPORTS
   ======================= */
const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const session = require("express-session");
const multer = require("multer");
const XLSX = require("xlsx");
const fs = require("fs");
const PDFDocument = require("pdfkit");
const cors = require("cors");

const { allocateBySubjectHallWise } = require("./utils/allocationLogic");
const { getTenantDb, initTenantSchema, dbDir } = require("./utils/tenantDb");

/* =======================
   2. APP & DB
   ======================= */
const app = express();

// Ensure the databases and uploads directories exist
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}
const uploadDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// Startup migration of existing SQLite database to tenant_ccet
const tenantCcetDbPath = path.join(dbDir, "tenant_ccet.db");
const rootDbPath = path.join(__dirname, "hall_matrix.db");
if (!fs.existsSync(tenantCcetDbPath) && fs.existsSync(rootDbPath)) {
  console.log("Migration: Copying existing database to tenant_ccet...");
  try {
    fs.copyFileSync(rootDbPath, tenantCcetDbPath);
    console.log("Migration: Copy successful!");
  } catch (err) {
    console.error("Migration: Failed to copy database:", err.message);
  }
}

const db = new sqlite3.Database(
  rootDbPath,
  sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE,
  (err) => {
    if (err) console.error("DB connection error:", err.message);
    else console.log("✅ SQLite connected");
  },
);

/* =======================
   3. MIDDLEWARE
   ======================= */
app.use(cors({
  origin: "http://localhost:5173", // React Frontend URL
  credentials: true
}));
app.use(express.urlencoded({ extended: true }));
app.use(express.json());
const upload = multer({ dest: "uploads/" });

/* =======================
   4. SESSION
   ======================= */
app.use(
  session({
    secret: "hallmatrix_secret",
    resave: false,
    saveUninitialized: false,
    cookie: {
      secure: false, // set to true if using https
      httpOnly: true,
      maxAge: 24 * 60 * 60 * 1000 // 1 day
    }
  }),
);

/* =======================
   5. AUTH & DB MIDDLEWARE
   ======================= */
app.use((req, res, next) => {
  const tenantId = (req.session.user && req.session.user.tenant_id) || (req.session.student && req.session.student.tenant_id) || "ccet";
  if (tenantId) {
    try {
      req.db = getTenantDb(tenantId);
    } catch (err) {
      console.error("Failed to load tenant database:", err.message);
    }
  }
  next();
});

function requireLogin(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ error: "Unauthorized: Access is denied due to invalid credentials." });
  }
  next();
}

function requireAnyLogin(req, res, next) {
  if (!req.session.user && !req.session.student) {
    return res.status(401).json({ error: "Unauthorized: Please log in." });
  }
  next();
}

/* =======================
   6. DATABASE TABLES (INIT MASTER)
   ======================= */
db.serialize(() => {
  db.run(`CREATE TABLE IF NOT EXISTS tenants (
    id TEXT PRIMARY KEY,
    name TEXT
  )`);

  db.run(`CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT,
    username TEXT UNIQUE,
    password TEXT,
    role TEXT,
    tenant_id TEXT
  )`, () => {
    db.get("SELECT COUNT(*) as count FROM tenants", (err, row) => {
      if (row && row.count === 0) {
        db.run("INSERT INTO tenants (id, name) VALUES ('ccet', 'CCET College')");
        console.log("Migration: Registered default tenant 'ccet'.");
      }
    });

    db.all("PRAGMA table_info(users)", (err, info) => {
      if (info) {
        const hasTenantId = info.some(col => col.name === "tenant_id");
        if (!hasTenantId) {
          db.run("ALTER TABLE users ADD COLUMN tenant_id TEXT", (alterErr) => {
            if (!alterErr) {
              db.run("UPDATE users SET tenant_id = 'ccet' WHERE tenant_id IS NULL");
            }
          });
        } else {
          db.run("UPDATE users SET tenant_id = 'ccet' WHERE tenant_id IS NULL");
        }
      }
    });
  });
});

/* =======================
   7. AUTH ENDPOINTS
   ======================= */
app.get("/api/auth/me", (req, res) => {
  if (req.session.user) {
    res.json({ user: req.session.user });
  } else {
    res.status(401).json({ error: "Unauthorized" });
  }
});

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;

  db.get(
    "SELECT * FROM users WHERE username=? AND password=?",
    [username, password],
    (err, user) => {
      if (err) return res.status(500).json({ error: "Database error" });
      
      if (user) {
        db.get(
          "SELECT name FROM tenants WHERE id = ?",
          [user.tenant_id],
          (err, tenant) => {
            user.tenant_name = tenant ? tenant.name : "Hall Matrix";
            delete user.password;
            req.session.user = user;
            res.json({ success: true, user });
          }
        );
      } else {
        res.status(400).json({ error: "Invalid credentials" });
      }
    },
  );
});

app.post("/api/auth/register", (req, res) => {
  const { tenant_id, tenant_name, name, username, password, role } = req.body;

  if (!tenant_id || !tenant_name || !name || !username || !password) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const tid = String(tenant_id).trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  if (!tid) {
    return res.status(400).json({ error: "Invalid Organization Code" });
  }

  db.get("SELECT * FROM tenants WHERE id = ?", [tid], (err, row) => {
    if (row) {
      return res.status(400).json({ error: "Organization Code already exists" });
    }

    db.get("SELECT * FROM users WHERE username = ?", [username], (err, urow) => {
      if (urow) {
        return res.status(400).json({ error: "Username already exists" });
      }

      db.run(
        "INSERT INTO tenants (id, name) VALUES (?, ?)",
        [tid, tenant_name],
        (err) => {
          if (err) return res.status(500).json({ error: "Failed to create organization" });

          db.run(
            "INSERT INTO users (name, username, password, role, tenant_id) VALUES (?,?,?,?,?)",
            [name, username, password, role || "admin", tid],
            (err) => {
              if (err) {
                db.run("DELETE FROM tenants WHERE id = ?", [tid]);
                return res.status(500).json({ error: "Failed to create admin user" });
              }

              try {
                getTenantDb(tid);
                console.log(`Initialized database for new tenant: ${tid}`);
              } catch (dbErr) {
                console.error("Failed to initialize database file:", dbErr.message);
              }

              res.json({ success: true, message: "Registered organization successfully" });
            },
          );
        },
      );
    });
  });
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) return res.status(500).json({ error: "Could not log out" });
    res.json({ success: true });
  });
});

/* =======================
   7b. STUDENT AUTH & ALLOCATION ENDPOINTS
   ======================= */
app.post("/api/auth/student-login", (req, res) => {
  const { tenant_id, regno } = req.body;

  if (!tenant_id || !regno) {
    return res.status(400).json({ error: "Organization Code and Register Number are required" });
  }

  const tid = String(tenant_id).trim().toLowerCase().replace(/[^a-z0-9_-]/g, "");
  const cleanRegNo = String(regno).trim().replace(/\.0$/, "");

  db.get("SELECT * FROM tenants WHERE id = ?", [tid], (err, tenant) => {
    if (err || !tenant) {
      return res.status(404).json({ error: "Organization Code not found" });
    }

    let tenantDb;
    try {
      tenantDb = getTenantDb(tid);
    } catch (dbErr) {
      return res.status(500).json({ error: "Failed to initialize organization database" });
    }

    tenantDb.get(
      "SELECT * FROM students WHERE TRIM(REPLACE(LOWER(regno), '.0', '')) = TRIM(LOWER(?))",
      [cleanRegNo],
      (err, studentRow) => {
        tenantDb.all(
          "SELECT * FROM seat_allocations WHERE TRIM(REPLACE(LOWER(regno), '.0', '')) = TRIM(LOWER(?))",
          [cleanRegNo],
          (err, allocRows) => {
            if (!studentRow && (!allocRows || allocRows.length === 0)) {
              return res.status(404).json({ error: "No student or exam allocation found for this Register Number" });
            }

            const name = studentRow ? studentRow.name : (allocRows && allocRows[0] ? allocRows[0].name : "Student");
            const dept = studentRow ? studentRow.dept : (allocRows && allocRows[0] ? allocRows[0].dept : "");
            const batch = studentRow ? studentRow.batch : (allocRows && allocRows[0] ? allocRows[0].batch : "");
            const degree = studentRow ? studentRow.degree : "";

            const studentSession = {
              regno: cleanRegNo,
              name,
              tenant_id: tid,
              tenant_name: tenant.name,
              dept,
              batch,
              degree
            };

            req.session.student = studentSession;
            res.json({ success: true, student: studentSession });
          }
        );
      }
    );
  });
});

app.get("/api/auth/student-me", (req, res) => {
  if (req.session.student) {
    res.json({ student: req.session.student });
  } else {
    res.status(401).json({ error: "Unauthorized" });
  }
});

app.post("/api/auth/student-logout", (req, res) => {
  req.session.student = null;
  res.json({ success: true });
});

app.get("/api/student/my-allocations", (req, res) => {
  if (!req.session.student) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const { regno, tenant_id } = req.session.student;
  const tenantDb = getTenantDb(tenant_id);

  tenantDb.all(
    `SELECT sa.*, s.subject_name 
     FROM seat_allocations sa 
     LEFT JOIN subjects s ON sa.subject_code = s.subject_code 
     WHERE TRIM(REPLACE(LOWER(sa.regno), '.0', '')) = TRIM(LOWER(?)) 
     ORDER BY sa.exam_date, sa.session`,
    [regno],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ allocations: rows || [] });
    }
  );
});

/* =======================
   8a. DEGREES ENDPOINTS
   ======================= */
app.get("/api/degrees", requireLogin, (req, res) => {
  req.db.all("SELECT * FROM degrees", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ degrees: rows || [] });
  });
});

app.post("/api/degrees/add", requireLogin, (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Degree name is required" });

  req.db.run("INSERT INTO degrees (name) VALUES (?)", [name], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, degree: { id: this.lastID, name } });
  });
});

app.post("/api/degrees/delete/:id", requireLogin, (req, res) => {
  req.db.run("DELETE FROM degrees WHERE id=?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

/* =======================
   8b. DEPARTMENTS ENDPOINTS
   ======================= */
app.get("/api/departments", requireLogin, (req, res) => {
  const { degree } = req.query;
  let query = "SELECT * FROM departments";
  const params = [];
  
  if (degree) {
    query += " WHERE degree = ?";
    params.push(degree);
  }
  
  req.db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ departments: rows || [] });
  });
});

app.post("/api/departments/add", requireLogin, (req, res) => {
  const { name, degree } = req.body;
  if (!name) return res.status(400).json({ error: "Department name is required" });

  req.db.run("INSERT INTO departments (name, degree) VALUES (?,?)", [name, degree || null], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true, department: { id: this.lastID, name, degree } });
  });
});

app.post("/api/departments/delete/:id", requireLogin, (req, res) => {
  req.db.run("DELETE FROM departments WHERE id=?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

/* =======================
   9. STUDENTS ENDPOINTS
   ======================= */
app.get("/api/students", requireLogin, (req, res) => {
  const { degree, dept, batch } = req.query;
  let query = "SELECT * FROM students WHERE 1=1";
  const params = [];

  if (degree) {
    query += " AND degree = ?";
    params.push(degree);
  }
  if (dept) {
    query += " AND dept = ?";
    params.push(dept);
  }
  if (batch) {
    query += " AND batch = ?";
    params.push(batch);
  }

  req.db.all(query, params, (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ students: rows || [] });
  });
});

app.post("/api/students/add", requireLogin, (req, res) => {
  const { regno, name, degree, dept, subject_code, batch } = req.body;
  if (!regno || !dept || !subject_code) {
    return res.status(400).json({ error: "Registration number, department, and subject code are required" });
  }

  req.db.run(
    "INSERT INTO students (regno, name, degree, dept, subject_code, batch) VALUES (?,?,?,?,?,?)",
    [regno, name || null, degree || null, dept, subject_code, batch || null],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, student: { id: this.lastID, regno, name, degree, dept, subject_code, batch } });
    },
  );
});

app.post("/api/students/delete/:id", requireLogin, (req, res) => {
  req.db.run("DELETE FROM students WHERE id=?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.post("/api/students/bulk-delete", requireLogin, (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "No student IDs specified for deletion" });
  }

  const chunkSize = 400;
  let deletedTotal = 0;
  let processedChunks = 0;
  const totalChunks = Math.ceil(ids.length / chunkSize);
  let hasError = false;

  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => "?").join(",");

    req.db.run(
      `DELETE FROM students WHERE id IN (${placeholders})`,
      chunk,
      function (err) {
        if (err && !hasError) {
          hasError = true;
          return res.status(500).json({ error: err.message });
        }
        deletedTotal += this ? (this.changes || 0) : 0;
        processedChunks++;

        if (processedChunks === totalChunks && !hasError) {
          res.json({ success: true, deletedCount: deletedTotal });
        }
      }
    );
  }
});

function getRowValue(row, possibleKeys) {
  if (!row || typeof row !== "object") return null;
  const normKeys = possibleKeys.map((k) => k.toLowerCase().replace(/[^a-z0-9]/g, ""));
  for (const origKey of Object.keys(row)) {
    const norm = origKey.toLowerCase().replace(/[^a-z0-9]/g, "");
    if (normKeys.includes(norm)) {
      const val = row[origKey];
      if (val !== undefined && val !== null && String(val).trim() !== "") {
        return String(val).trim();
      }
    }
  }
  return null;
}

function extractStudentFromRow(r, queryOpts = {}) {
  if (!r || typeof r !== "object") return null;

  const { queryDegree, queryDept, queryBatch, querySubjectCode } = queryOpts;

  let regno = null;
  let name = null;
  let dept = null;
  let subject_code = null;
  let batch = null;
  let degree = null;

  const keys = Object.keys(r);

  // 1. Key Matching
  for (const k of keys) {
    const norm = k.toLowerCase().replace(/[^a-z0-9]/g, "");
    const val = r[k] !== undefined && r[k] !== null ? String(r[k]).trim() : "";
    if (!val) continue;

    // Reg No matching (any header with reg, roll, enroll, id, student)
    if (!regno && (norm.includes("reg") || norm.includes("roll") || norm.includes("enroll") || norm === "id" || norm === "studentid")) {
      regno = val;
    }
    // Name matching
    else if (!name && (norm.includes("name") || norm.includes("student"))) {
      name = val;
    }
    // Dept matching
    else if (!dept && (norm.includes("dept") || norm.includes("branch") || norm.includes("stream"))) {
      dept = val;
    }
    // Subject Code matching
    else if (!subject_code && (norm.includes("subject") || norm.includes("subcode") || norm.includes("coursecode"))) {
      subject_code = val;
    }
    // Batch matching
    else if (!batch && (norm.includes("batch") || norm.includes("year"))) {
      batch = val;
    }
    // Degree matching
    else if (!degree && (norm.includes("degree") || norm.includes("course"))) {
      degree = val;
    }
  }

  // 2. Position / Value inspection fallback if regno not found by key name
  if (!regno && keys.length > 0) {
    for (const k of keys) {
      const val = String(r[k] || "").trim();
      // If a cell contains a 4+ digit number or alphanumeric registration code
      if (/^[A-Za-z0-9]{4,20}$/.test(val) && !isNaN(val.slice(-3))) {
        regno = val;
        break;
      }
    }
  }

  if (!regno) return null;

  return {
    regno: String(regno).replace(/\.0$/, ""),
    name: name || null,
    dept: dept || queryDept || "GENERAL",
    subject_code: subject_code || querySubjectCode || "GENERAL",
    batch: batch || queryBatch || null,
    degree: degree || queryDegree || null
  };
}

app.post("/api/students/upload", requireLogin, upload.single("file"), (req, res) => {
  const { degree: queryDegree, dept: queryDept, batch: queryBatch, subject_code: querySubjectCode } = req.query;

  if (!req.file) return res.status(400).json({ error: "Excel file is required" });

  try {
    const wb = XLSX.readFile(req.file.path);
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Uploaded sheet is empty" });
    }
    const sheet = wb.Sheets[sheetName];

    // Read sheet into JSON array of objects
    const data = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (!Array.isArray(data) || data.length === 0) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "No data rows found in the uploaded file" });
    }

    req.db.serialize(() => {
      req.db.run("BEGIN TRANSACTION");

      const stmt = req.db.prepare(
        "INSERT INTO students (regno, name, degree, dept, subject_code, batch) VALUES (?,?,?,?,?,?)",
      );

      let count = 0;
      data.forEach((r) => {
        const studentData = extractStudentFromRow(r, { queryDegree, queryDept, queryBatch, querySubjectCode });
        if (studentData && studentData.regno) {
          stmt.run(
            studentData.regno,
            studentData.name,
            studentData.degree,
            studentData.dept,
            studentData.subject_code,
            studentData.batch
          );
          count++;
        }
      });

      stmt.finalize();
      req.db.run("COMMIT", (commitErr) => {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

        if (commitErr) {
          return res.status(500).json({ error: "Failed to save student records into database" });
        }

        if (count === 0) {
          return res.status(400).json({
            error: "No valid student rows found. Please ensure the Excel file contains student Register Numbers."
          });
        }

        res.json({ success: true, count, message: `Successfully imported ${count} student records!` });
      });
    });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message });
  }
});

/* =======================
   10. SUBJECTS ENDPOINTS
   ======================= */
app.get("/api/subjects", requireLogin, (req, res) => {
  req.db.all("SELECT * FROM subjects", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ subjects: rows || [] });
  });
});

app.post("/api/subjects/add", requireLogin, (req, res) => {
  const { subject_code, subject_name, batch, dept, degree } = req.body;
  if (!subject_code || !subject_name) {
    return res.status(400).json({ error: "Subject code and name are required" });
  }

  req.db.run(
    "INSERT OR REPLACE INTO subjects (subject_code, subject_name, batch, dept, degree) VALUES (?,?,?,?,?)",
    [subject_code, subject_name, batch || null, dept || null, degree || null],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    },
  );
});

app.post("/api/subjects/delete/:id", requireLogin, (req, res) => {
  req.db.run("DELETE FROM subjects WHERE id=?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.post("/api/subjects/bulk-delete", requireLogin, (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "No subject IDs specified for deletion" });
  }

  const chunkSize = 400;
  let deletedTotal = 0;
  let processedChunks = 0;
  const totalChunks = Math.ceil(ids.length / chunkSize);
  let hasError = false;

  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => "?").join(",");

    req.db.run(
      `DELETE FROM subjects WHERE id IN (${placeholders})`,
      chunk,
      function (err) {
        if (err && !hasError) {
          hasError = true;
          return res.status(500).json({ error: err.message });
        }
        deletedTotal += this ? (this.changes || 0) : 0;
        processedChunks++;

        if (processedChunks === totalChunks && !hasError) {
          res.json({ success: true, deletedCount: deletedTotal });
        }
      }
    );
  }
});

app.post("/api/subjects/upload", requireLogin, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Excel file is required" });

  try {
    const wb = XLSX.readFile(req.file.path);
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Uploaded sheet is empty" });
    }
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (!Array.isArray(rows) || rows.length === 0) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "No data rows found in the uploaded file" });
    }

    req.db.serialize(() => {
      req.db.run("BEGIN TRANSACTION");

      const stmt = req.db.prepare(
        "INSERT OR REPLACE INTO subjects (subject_code, subject_name, batch) VALUES (?,?,?)",
      );

      let count = 0;
      rows.forEach((r) => {
        const subject_code = getRowValue(r, ["subject_code", "subjectcode", "subcode", "sub_code", "code"]);
        const subject_name = getRowValue(r, ["subject_name", "subjectname", "subname", "sub_name", "name", "title"]);
        const batch = getRowValue(r, ["batch", "year"]);

        if (subject_code && subject_name) {
          stmt.run(subject_code, subject_name, batch || null);
          count++;
        }
      });

      stmt.finalize();
      req.db.run("COMMIT", (commitErr) => {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

        if (commitErr) return res.status(500).json({ error: "Failed to save subject records" });

        if (count === 0) {
          return res.status(400).json({
            error: "No valid subject rows found. Required columns: Subject Code ('subject_code') and Subject Name ('subject_name')."
          });
        }

        res.json({ success: true, count, message: `Successfully imported ${count} subjects!` });
      });
    });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message });
  }
});

/* =======================
   11. HALLS ENDPOINTS
   ======================= */
app.get("/api/halls", requireLogin, (req, res) => {
  req.db.all("SELECT * FROM halls", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ halls: rows || [] });
  });
});

app.post("/api/halls/add", requireLogin, (req, res) => {
  const { hall_no, capacity, block } = req.body;
  if (!hall_no || !capacity) {
    return res.status(400).json({ error: "Hall number and capacity are required" });
  }

  req.db.run(
    "INSERT OR IGNORE INTO halls (hall_no, capacity, block) VALUES (?,?,?)",
    [hall_no, capacity, block || ""],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    },
  );
});

app.post("/api/halls/delete/:id", requireLogin, (req, res) => {
  req.db.run("DELETE FROM halls WHERE id=?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.post("/api/halls/bulk-delete", requireLogin, (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "No hall IDs specified for deletion" });
  }

  const chunkSize = 400;
  let deletedTotal = 0;
  let processedChunks = 0;
  const totalChunks = Math.ceil(ids.length / chunkSize);
  let hasError = false;

  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => "?").join(",");

    req.db.run(
      `DELETE FROM halls WHERE id IN (${placeholders})`,
      chunk,
      function (err) {
        if (err && !hasError) {
          hasError = true;
          return res.status(500).json({ error: err.message });
        }
        deletedTotal += this ? (this.changes || 0) : 0;
        processedChunks++;

        if (processedChunks === totalChunks && !hasError) {
          res.json({ success: true, deletedCount: deletedTotal });
        }
      }
    );
  }
});

app.post("/api/halls/upload", requireLogin, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Excel file is required" });

  try {
    const wb = XLSX.readFile(req.file.path);
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Uploaded sheet is empty" });
    }
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (!Array.isArray(rows) || rows.length === 0) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "No data rows found in the uploaded file" });
    }

    req.db.serialize(() => {
      req.db.run("BEGIN TRANSACTION");

      const stmt = req.db.prepare(
        "INSERT OR IGNORE INTO halls (hall_no, capacity, block) VALUES (?,?,?)",
      );

      let count = 0;
      rows.forEach((r) => {
        const hall_no = getRowValue(r, ["hall_no", "hallno", "hallnumber", "hall", "room", "roomno"]);
        const capacity = getRowValue(r, ["capacity", "seats", "cap", "size"]);
        const block = getRowValue(r, ["block", "sector", "building"]);

        if (hall_no && capacity) {
          stmt.run(hall_no, parseInt(capacity) || 0, block || "");
          count++;
        }
      });

      stmt.finalize();
      req.db.run("COMMIT", (commitErr) => {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

        if (commitErr) return res.status(500).json({ error: "Failed to save hall records" });

        if (count === 0) {
          return res.status(400).json({
            error: "No valid hall rows found. Required columns: Hall Number ('hall_no') and Capacity ('capacity')."
          });
        }

        res.json({ success: true, count, message: `Successfully imported ${count} classrooms!` });
      });
    });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message });
  }
});

/* =======================
   12. INVIGILATORS ENDPOINTS
   ======================= */
app.get("/api/invigilators", requireLogin, (req, res) => {
  req.db.all("SELECT * FROM invigilators", (err, rows) => {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ invigilators: rows || [] });
  });
});

app.post("/api/invigilators/add", requireLogin, (req, res) => {
  const { name, dept } = req.body;
  if (!name || !dept) {
    return res.status(400).json({ error: "Faculty name and department are required" });
  }

  req.db.run(
    "INSERT INTO invigilators (name, dept) VALUES (?,?)",
    [name, dept],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true });
    },
  );
});

app.post("/api/invigilators/delete/:id", requireLogin, (req, res) => {
  req.db.run("DELETE FROM invigilators WHERE id=?", [req.params.id], function (err) {
    if (err) return res.status(500).json({ error: err.message });
    res.json({ success: true });
  });
});

app.post("/api/invigilators/bulk-delete", requireLogin, (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: "No invigilator IDs specified for deletion" });
  }

  const chunkSize = 400;
  let deletedTotal = 0;
  let processedChunks = 0;
  const totalChunks = Math.ceil(ids.length / chunkSize);
  let hasError = false;

  for (let i = 0; i < ids.length; i += chunkSize) {
    const chunk = ids.slice(i, i + chunkSize);
    const placeholders = chunk.map(() => "?").join(",");

    req.db.run(
      `DELETE FROM invigilators WHERE id IN (${placeholders})`,
      chunk,
      function (err) {
        if (err && !hasError) {
          hasError = true;
          return res.status(500).json({ error: err.message });
        }
        deletedTotal += this ? (this.changes || 0) : 0;
        processedChunks++;

        if (processedChunks === totalChunks && !hasError) {
          res.json({ success: true, deletedCount: deletedTotal });
        }
      }
    );
  }
});

app.post("/api/invigilators/upload", requireLogin, upload.single("file"), (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Excel file is required" });

  try {
    const wb = XLSX.readFile(req.file.path);
    const sheetName = wb.SheetNames[0];
    if (!sheetName) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "Uploaded sheet is empty" });
    }
    const sheet = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (!Array.isArray(rows) || rows.length === 0) {
      if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: "No data rows found in the uploaded file" });
    }

    req.db.serialize(() => {
      req.db.run("BEGIN TRANSACTION");

      const stmt = req.db.prepare(
        "INSERT INTO invigilators (name, dept) VALUES (?,?)",
      );

      let count = 0;
      rows.forEach((r) => {
        const name = getRowValue(r, ["name", "faculty_name", "staff_name", "teacher_name", "faculty"]);
        const dept = getRowValue(r, ["dept", "department", "branch"]);

        if (name && dept) {
          stmt.run(name, dept);
          count++;
        }
      });

      stmt.finalize();
      req.db.run("COMMIT", (commitErr) => {
        if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);

        if (commitErr) return res.status(500).json({ error: "Failed to save invigilator records" });

        if (count === 0) {
          return res.status(400).json({
            error: "No valid invigilator rows found. Required columns: Name ('name') and Department ('dept')."
          });
        }

        res.json({ success: true, count, message: `Successfully imported ${count} invigilators!` });
      });
    });
  } catch (err) {
    if (req.file && fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path);
    res.status(500).json({ error: err.message });
  }
});

/* =======================
   13. PUBLIC STUDENT SEAT LOOKUP
   ======================= */
app.get("/api/t/:tenant_id/student-view", (req, res) => {
  const tid = req.params.tenant_id.toLowerCase();
  
  db.get("SELECT * FROM tenants WHERE id = ?", [tid], (err, tenant) => {
    if (err || !tenant) {
      return res.status(404).json({ error: "Organization not found" });
    }
    
    res.json({ tenant });
  });
});

app.post("/api/t/:tenant_id/student-view", (req, res) => {
  const tid = req.params.tenant_id.toLowerCase();
  let regno = String(req.body.regno || "").trim();
  regno = regno.replace(/\.0$/, "");

  db.get("SELECT * FROM tenants WHERE id = ?", [tid], (err, tenant) => {
    if (err || !tenant) {
      return res.status(404).json({ error: "Organization not found" });
    }

    let tenantDb;
    try {
      tenantDb = getTenantDb(tid);
    } catch (dbErr) {
      return res.status(500).json({ error: "Database initialization failed" });
    }

    // Query student master info
    tenantDb.get(
      "SELECT * FROM students WHERE TRIM(REPLACE(LOWER(regno), '.0', '')) = TRIM(LOWER(?))",
      [regno],
      (err, studentRow) => {
        // Query all seat allocations for this regno
        tenantDb.all(
          `SELECT sa.*, s.subject_name 
           FROM seat_allocations sa 
           LEFT JOIN subjects s ON sa.subject_code = s.subject_code 
           WHERE TRIM(REPLACE(LOWER(sa.regno), '.0', '')) = TRIM(LOWER(?)) 
           ORDER BY sa.exam_date, sa.session`,
          [regno],
          (err2, allocRows) => {
            if (!studentRow && (!allocRows || allocRows.length === 0)) {
              return res.status(404).json({ error: "No student or exam allocation details found for this register number." });
            }

            const student_info = {
              regno: regno,
              name: studentRow ? studentRow.name : (allocRows[0] ? allocRows[0].name : "Student"),
              dept: studentRow ? studentRow.dept : (allocRows[0] ? allocRows[0].dept : "N/A"),
              batch: studentRow ? studentRow.batch : (allocRows[0] ? allocRows[0].batch : "N/A"),
              degree: studentRow ? studentRow.degree : "N/A"
            };

            res.json({
              success: true,
              student: student_info,
              allocations: allocRows || []
            });
          }
        );
      }
    );
  });
});

/* =======================
   14. ALLOCATION GENERATOR
   ======================= */
app.post("/api/allocation/generate", requireLogin, (req, res) => {
  const { subject_codes, exam_date, session } = req.body;

  if (!exam_date || !session) {
    return res.status(400).json({ error: "Exam date and session are required" });
  }

  const rawCodes = String(subject_codes || "").trim();
  const isAll = !rawCodes || rawCodes.toUpperCase() === "ALL";

  let query = "SELECT * FROM students";
  let params = [];

  if (!isAll) {
    const codes = rawCodes.split(",").map((c) => c.trim().toUpperCase()).filter(Boolean);
    if (codes.length > 0) {
      query = `SELECT * FROM students WHERE TRIM(UPPER(subject_code)) IN (${codes.map(() => "TRIM(UPPER(?))").join(",")}) OR TRIM(UPPER(dept)) IN (${codes.map(() => "TRIM(UPPER(?))").join(",")})`;
      params = [...codes, ...codes];
    }
  }

  req.db.all(query, params, (err, students) => {
    if (err) return res.status(500).json({ error: err.message });

    if (!students || students.length === 0) {
      return res.status(404).json({ error: "No registered students found matching the selected subject codes or criteria" });
    }

    req.db.all("SELECT * FROM halls ORDER BY hall_no", (err, halls) => {
      if (err || !halls || halls.length === 0) {
        return res.status(400).json({ error: "No exam halls configured. Please add classroom halls first." });
      }

      req.db.all("SELECT * FROM invigilators", (err, invs) => {
        if (err || !invs || invs.length === 0) {
          return res.status(400).json({ error: "No invigilators registered. Please add faculty invigilators first." });
        }

        const raw = allocateBySubjectHallWise(students, halls);

        let seatCounter = {};
        let hallInv = {};
        let invIndex = 0;

        const preview = raw.map((r) => {
          if (!seatCounter[r.hall_no]) {
            seatCounter[r.hall_no] = 0;
            hallInv[r.hall_no] = invs[invIndex++ % invs.length].name;
          }

          const idx = seatCounter[r.hall_no]++;
          const seat = ["A", "B", "C", "D"][idx % 4] + (Math.floor(idx / 4) + 1);

          return {
            regno: r.student.regno,
            name: r.student.name || null,
            dept: r.student.dept,
            batch: r.student.batch || null,
            subject_code: r.student.subject_code,
            hall_no: r.hall_no,
            seat_label: seat,
            invigilator: hallInv[r.hall_no],
            exam_date,
            session,
          };
        });

        // Auto-save/confirm to database table seat_allocations
        req.db.run(
          "DELETE FROM seat_allocations WHERE exam_date = ? AND session = ?",
          [exam_date, session],
          (delErr) => {
            const stmt = req.db.prepare(`
              INSERT INTO seat_allocations
              (regno, name, subject_code, hall_no, seat_label, dept, batch, exam_date, session, invigilator)
              VALUES (?,?,?,?,?,?,?,?,?,?)
            `);

            preview.forEach((p) => {
              stmt.run(
                p.regno,
                p.name || null,
                p.subject_code,
                p.hall_no,
                p.seat_label,
                p.dept,
                p.batch || null,
                p.exam_date,
                p.session,
                p.invigilator
              );
            });

            stmt.finalize((finErr) => {
              req.session.preview = preview;
              res.json({
                success: true,
                preview,
                message: `Successfully scheduled and saved ${preview.length} student seating allocations for ${examDate} (${session})!`
              });
            });
          }
        );
      });
    });
  });
});

/* =======================
   16. CONFIRM ALLOCATION
   ======================= */
app.post("/api/allocation/confirm", requireLogin, (req, res) => {
  // Prefer preview sent in request body, fallback to session
  const preview = req.body.preview || req.session.preview;

  if (!preview || preview.length === 0) {
    return res.status(400).json({ error: "No active generated seat preview to confirm" });
  }

  const targetDate = preview[0].exam_date;
  const targetSession = preview[0].session;

  req.db.run(
    "DELETE FROM seat_allocations WHERE exam_date = ? AND session = ?",
    [targetDate, targetSession],
    (err) => {
      if (err) return res.status(500).json({ error: "Failed to update allocations for specified exam date and session" });

      const stmt = req.db.prepare(`
        INSERT INTO seat_allocations
        (regno, name, subject_code, hall_no, seat_label, dept, batch, exam_date, session, invigilator)
        VALUES (?,?,?,?,?,?,?,?,?,?)
      `);

      preview.forEach((p) => {
        stmt.run(
          p.regno,
          p.name || null,
          p.subject_code,
          p.hall_no,
          p.seat_label,
          p.dept,
          p.batch || null,
          p.exam_date,
          p.session,
          p.invigilator,
        );
      });

      stmt.finalize((err2) => {
        if (err2) return res.status(500).json({ error: "Failed to save seating layouts" });
        
        // Clean up session preview once successfully confirmed
        req.session.preview = null;
        res.json({ success: true, message: `Allocations for ${targetDate} (${targetSession}) confirmed and saved successfully!` });
      });
    }
  );
});

app.get("/api/allocation/list", requireLogin, (req, res) => {
  req.db.all(
    `SELECT exam_date, session, 
            COUNT(DISTINCT regno) as student_count,
            COUNT(DISTINCT hall_no) as hall_count,
            GROUP_CONCAT(DISTINCT subject_code) as subject_codes,
            GROUP_CONCAT(DISTINCT dept) as departments
     FROM seat_allocations
     GROUP BY exam_date, session
     ORDER BY exam_date DESC, session DESC`,
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, allocations: rows || [] });
    }
  );
});

app.get("/api/allocation/view-detail", requireLogin, (req, res) => {
  const { exam_date, session } = req.query;
  if (!exam_date || !session) {
    return res.status(400).json({ error: "Exam date and session parameters are required" });
  }

  req.db.all(
    `SELECT sa.*, s.subject_name
     FROM seat_allocations sa
     LEFT JOIN subjects s ON sa.subject_code = s.subject_code
     WHERE sa.exam_date = ? AND sa.session = ?
     ORDER BY sa.hall_no, sa.seat_label`,
    [exam_date, session],
    (err, rows) => {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, preview: rows || [] });
    }
  );
});

app.post("/api/allocation/delete", requireLogin, (req, res) => {
  const { exam_date, session } = req.body;
  if (!exam_date || !session) {
    return res.status(400).json({ error: "Exam date and session are required" });
  }

  req.db.run(
    "DELETE FROM seat_allocations WHERE exam_date = ? AND session = ?",
    [exam_date, session],
    function (err) {
      if (err) return res.status(500).json({ error: err.message });
      res.json({ success: true, count: this.changes });
    }
  );
});

/* =======================
   18. SMART MATRIX AI CHATBOT ENDPOINT
   ======================= */
app.post("/api/ai/chat", (req, res) => {
  const message = String(req.body.message || "").trim();
  const lowerMsg = message.toLowerCase();

  // 1. Detect Register Number (4 to 15 digits / alphanumeric code like 950001, 950002)
  let requestedRegNo = null;
  const regMatch = message.match(/\b[A-Za-z0-9]{4,15}\b/g);
  if (regMatch) {
    for (const token of regMatch) {
      if (/^\d{4,15}$/.test(token) || (token.length >= 5 && /\d{3,}/.test(token))) {
        // Exclude 4-digit years like 2026
        if (!/^(19|20)\d{2}$/.test(token)) {
          requestedRegNo = token;
          break;
        }
      }
    }
  }
  if (!requestedRegNo && req.session.student) {
    requestedRegNo = req.session.student.regno;
  }

  // 2. Detect Date (YYYY-MM-DD, DD-MM-YYYY, DD/MM/YYYY, today, inaiku, tomorrow)
  let searchedDate = null;
  const ymdMatch = message.match(/\b(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})\b/);
  const dmyMatch = message.match(/\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})\b/);

  if (ymdMatch) {
    searchedDate = `${ymdMatch[1]}-${String(ymdMatch[2]).padStart(2, "0")}-${String(ymdMatch[3]).padStart(2, "0")}`;
  } else if (dmyMatch) {
    searchedDate = `${dmyMatch[3]}-${String(dmyMatch[2]).padStart(2, "0")}-${String(dmyMatch[1]).padStart(2, "0")}`;
  } else if (lowerMsg.includes("today") || lowerMsg.includes("inaiku") || lowerMsg.includes("inayikku")) {
    searchedDate = new Date().toISOString().split("T")[0];
  } else if (lowerMsg.includes("tomorrow") || lowerMsg.includes("naalaiku")) {
    const tmr = new Date();
    tmr.setDate(tmr.getDate() + 1);
    searchedDate = tmr.toISOString().split("T")[0];
  }

  // -------------------------------------------------------------
  // BRANCH A: Register Number Typed (e.g. "950001", "reg 950001")
  // -------------------------------------------------------------
  if (requestedRegNo) {
    req.db.all(
      `SELECT sa.*, s.subject_name 
       FROM seat_allocations sa 
       LEFT JOIN subjects s ON sa.subject_code = s.subject_code 
       WHERE TRIM(REPLACE(LOWER(sa.regno), '.0', '')) = TRIM(LOWER(?)) 
       ORDER BY sa.exam_date, sa.session`,
      [requestedRegNo],
      (err, rows) => {
        if (!err && rows && rows.length > 0) {
          const first = rows[0];
          let reply = `🎓 **Scheduled Exam Seating for Register No: \`${requestedRegNo}\`** (${first.name || 'Student'})\n\n`;
          
          rows.forEach((r, idx) => {
            reply += `**Exam ${idx + 1}: Subject Code \`${r.subject_code}\`** (${r.subject_name || 'Scheduled Exam'})\n` +
              `- 📅 **Exam Date & Session:** **${r.exam_date} (${r.session} Session)**\n` +
              `- 🏫 **Assigned Hall:** **${r.hall_no}** | 🪑 **Seat Label:** **${r.seat_label}**\n` +
              `- 👨‍🏫 **Invigilator Staff:** **${r.invigilator || 'Assigned Staff'}**\n` +
              `- 🏢 **Department:** **${r.dept || 'N/A'}**\n\n`;
          });

          return res.json({
            success: true,
            reply,
            type: "student_profile",
            student: first
          });
        } else {
          // Check master student database if no direct seat allocation row exists
          req.db.get(
            "SELECT * FROM students WHERE TRIM(REPLACE(LOWER(regno), '.0', '')) = TRIM(LOWER(?))",
            [requestedRegNo],
            (err, studentRow) => {
              if (studentRow) {
                // Fetch department or subject matching allocations
                req.db.all(
                  `SELECT sa.*, s.subject_name 
                   FROM seat_allocations sa 
                   LEFT JOIN subjects s ON sa.subject_code = s.subject_code 
                   WHERE TRIM(UPPER(sa.subject_code)) = TRIM(UPPER(?)) OR TRIM(UPPER(sa.dept)) = TRIM(UPPER(?)) 
                   ORDER BY sa.exam_date, sa.session`,
                  [studentRow.subject_code || '', studentRow.dept || ''],
                  (err2, deptAllocRows) => {
                    let reply = `🎓 **Student Profile: \`${studentRow.regno}\`** (${studentRow.name || 'Student'})\n` +
                      `- **Department:** **${studentRow.dept}** | **Batch:** **${studentRow.batch || 'N/A'}**\n\n`;

                    if (deptAllocRows && deptAllocRows.length > 0) {
                      reply += `📅 **Scheduled Exams for ${studentRow.dept} Department:**\n\n`;
                      const uniqueExams = [...new Map(deptAllocRows.map(item => [item.subject_code + item.exam_date, item])).values()];
                      uniqueExams.forEach((r, idx) => {
                        reply += `• **Exam ${idx + 1}: Subject \`${r.subject_code}\`** (${r.subject_name || 'Exam'})\n` +
                          `  - Date: **${r.exam_date} (${r.session})** in Hall **${r.hall_no}**\n`;
                      });
                    } else {
                      reply += `📌 **No active exam seating allocations scheduled yet for ${studentRow.dept} department.**`;
                    }

                    return res.json({
                      success: true,
                      reply,
                      type: "student_profile",
                      student: studentRow
                    });
                  }
                );
              } else {
                // Fallback: list all active exam schedules in database
                req.db.all(
                  `SELECT DISTINCT exam_date, session, GROUP_CONCAT(DISTINCT subject_code) as subject_codes, GROUP_CONCAT(DISTINCT dept) as departments FROM seat_allocations GROUP BY exam_date, session`,
                  (e, allAlloc) => {
                    let reply = `⚠️ Register Number \`${requestedRegNo}\` was not found in the student database.\n\n`;
                    if (allAlloc && allAlloc.length > 0) {
                      reply += `📅 **Active Scheduled Exams in College:**\n` +
                        allAlloc.map(r => `• **${r.exam_date} (${r.session})**: Subject Codes \`${r.subject_codes}\` (${r.departments})`).join("\n");
                    } else {
                      reply += `No active exam seating allocations have been scheduled in the system database yet.`;
                    }
                    return res.json({ success: true, reply });
                  }
                );
              }
            }
          );
        }
      }
    );
    return;
  }

  // -------------------------------------------------------------
  // BRANCH B: Specific Date typed or Exam Schedule Query
  // -------------------------------------------------------------
  if (searchedDate || lowerMsg.includes("exam") || lowerMsg.includes("schedule") || lowerMsg.includes("subject")) {
    if (searchedDate) {
      // Query specific date
      req.db.all(
        `SELECT sa.*, s.subject_name
         FROM seat_allocations sa
         LEFT JOIN subjects s ON sa.subject_code = s.subject_code
         WHERE sa.exam_date = ?
         ORDER BY sa.session, sa.hall_no`,
        [searchedDate],
        (err, rows) => {
          if (!err && rows && rows.length > 0) {
            const subjectCodes = [...new Set(rows.map(r => r.subject_code))].join(", ");
            const depts = [...new Set(rows.map(r => r.dept))].join(", ");
            const halls = [...new Set(rows.map(r => r.hall_no))].join(", ");
            const invs = [...new Set(rows.map(r => r.invigilator).filter(Boolean))].join(", ");
            const session = rows[0].session || "FN";

            const reply = `📅 **Exam Schedule for Date: ${searchedDate} (${session} Session)**\n\n` +
              `- 📘 **Assigned Subject Codes:** \`${subjectCodes}\`\n` +
              `- 🏢 **Participating Departments:** ${depts}\n` +
              `- 👥 **Total Allocated Students:** ${rows.length} Students\n` +
              `- 🏫 **Classroom Halls Used:** ${halls}\n` +
              `- 👨‍🏫 **Assigned Invigilators:** ${invs || 'Faculty Staff'}`;

            return res.json({
              success: true,
              reply,
              type: "exam_schedule",
              schedule: { exam_date: searchedDate, session, subject_codes: subjectCodes }
            });
          } else {
            // Get all available scheduled dates to inform user
            req.db.all(
              `SELECT DISTINCT exam_date, session, GROUP_CONCAT(DISTINCT subject_code) as subject_codes FROM seat_allocations GROUP BY exam_date, session`,
              (e, allRows) => {
                let availInfo = "No active exam schedules in database yet.";
                if (allRows && allRows.length > 0) {
                  availInfo = "Active scheduled exam dates are:\n" + allRows.map(r => `• **${r.exam_date} (${r.session})**: Subjects \`${r.subject_codes}\``).join("\n");
                }
                return res.json({
                  success: true,
                  reply: `📅 **No Exam Schedule Found for Date: ${searchedDate}**\n\n${availInfo}`
                });
              }
            );
          }
        }
      );
      return;
    }

    // General Exam Schedule List
    req.db.all(
      `SELECT exam_date, session, 
              COUNT(DISTINCT regno) as student_count,
              COUNT(DISTINCT hall_no) as hall_count,
              GROUP_CONCAT(DISTINCT subject_code) as subject_codes,
              GROUP_CONCAT(DISTINCT dept) as departments
       FROM seat_allocations
       GROUP BY exam_date, session
       ORDER BY exam_date DESC, session DESC`,
      (err, rows) => {
        if (!err && rows && rows.length > 0) {
          const first = rows[0];
          let reply = `📅 **Active Scheduled Exams Overview**\n\n` +
            rows.map(r => `• **Date: ${r.exam_date} (${r.session})**\n  - 📘 Subject Codes: \`${r.subject_codes}\`\n  - 🏢 Departments: ${r.departments}\n  - 👥 Coverage: ${r.student_count} Students in ${r.hall_count} Halls`).join("\n\n");

          return res.json({
            success: true,
            reply,
            type: "exam_schedule",
            schedule: first
          });
        } else {
          return res.json({
            success: true,
            reply: `📅 **No Scheduled Exams Found**\n\nThere are currently no confirmed exam seating allocations saved in the database.`
          });
        }
      }
    );
    return;
  }

  // -------------------------------------------------------------
  // BRANCH C: General Query / Database Overview Response
  // -------------------------------------------------------------
  req.db.get("SELECT COUNT(*) as student_count FROM students", (e1, r1) => {
    req.db.get("SELECT COUNT(*) as hall_count FROM halls", (e2, r2) => {
      req.db.get("SELECT COUNT(*) as subject_count FROM subjects", (e3, r3) => {
        req.db.get("SELECT COUNT(*) as alloc_count FROM seat_allocations", (e4, r4) => {
          const reply = `🤖 **Matrix AI Assistant Ready**\n\n` +
            `Here is the active system overview:\n` +
            `- 🎓 **Total Students:** ${r1 ? r1.student_count : 0}\n` +
            `- 🏫 **Classroom Halls:** ${r2 ? r2.hall_count : 0}\n` +
            `- 📘 **Exam Subjects:** ${r3 ? r3.subject_count : 0}\n` +
            `- 🪑 **Active Seating Allocations:** ${r4 ? r4.alloc_count : 0}\n\n` +
            `**Try typing:**\n` +
            `• Type any Register Number (e.g. \`950001\`) to view student hall profile!\n` +
            `• Type any Date (e.g. \`2026-08-10\` or \`today\`) to view assigned subject codes!`;

          res.json({ success: true, reply });
        });
      });
    });
  });
});

/* =======================
   17. PDF STREAMING ENDPOINTS
   ======================= */
app.get("/api/allocation/pdf-hall", requireLogin, (req, res) => {
  // Attempt to fetch allocations from database if session is cleared, fallback to session
  req.db.all(
    `
    SELECT regno, dept, subject_code, hall_no, seat_label, exam_date, session, invigilator
    FROM seat_allocations
    ORDER BY hall_no, seat_label
    `,
    (err, rows) => {
      const activeAllocations = (rows && rows.length > 0) ? rows : req.session.preview;

      if (!activeAllocations || activeAllocations.length === 0) {
        return res.status(400).send("No confirmed allocation or active preview available");
      }

      const doc = new PDFDocument({ margin: 36, size: "A4" });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "inline; filename=Exam_Hall_Seating.pdf");
      doc.pipe(res);

      const date = activeAllocations[0].exam_date;
      const session = activeAllocations[0].session;

      /* GROUP BY HALL */
      const halls = {};
      activeAllocations.forEach((p) => {
        if (!halls[p.hall_no]) halls[p.hall_no] = [];
        halls[p.hall_no].push(p);
      });

      const cols = ["A", "B", "C", "D"];
      const cellWidth = 135;
      const cellHeight = 70;

      Object.keys(halls).forEach((hallNo, index) => {
        if (index !== 0) doc.addPage();

        const seats = halls[hallNo];

        /* ===== HEADER ===== */
        const headerX = 30;
        const headerY = 20;
        const headerWidth = doc.page.width - 60;
        const headerHeight = 90;

        doc
          .roundedRect(headerX, headerY, headerWidth, headerHeight, 12)
          .fill("#0f172a");

        doc
          .fillColor("white")
          .fontSize(16)
          .text("EXAM HALL SEATING ARRANGEMENT", headerX, headerY + 14, {
            width: headerWidth,
            align: "center",
          })
          .fontSize(10)
          .text(`Date: ${date} | Session: ${session}`, headerX, headerY + 38, {
            width: headerWidth,
            align: "center",
          })
          .fontSize(11)
          .text(
            `Hall: ${hallNo}   |   Invigilator: ${seats[0].invigilator}`,
            headerX,
            headerY + 62,
            { width: headerWidth, align: "center" },
          );

        doc.fillColor("black");
        doc.y = headerY + headerHeight + 20;

        /* MAP SEATS */
        const seatMap = {};
        seats.forEach((s) => (seatMap[s.seat_label] = s));

        const maxRow = Math.max(
          ...seats.map((s) => parseInt(s.seat_label.slice(1)) || 1),
        );

        let x = (doc.page.width - cols.length * cellWidth) / 2;
        let y = doc.y;

        /* COLUMN HEADERS */
        cols.forEach((c, i) => {
          doc
            .roundedRect(x + i * cellWidth, y, cellWidth - 10, 38, 8)
            .fill("#1e293b");

          doc
            .fillColor("white")
            .fontSize(13)
            .text(c, x + i * cellWidth, y + 10, {
              width: cellWidth - 10,
              align: "center",
            });

          doc.fillColor("black");
        });

        y += 50;

        /* SEAT GRID */
        for (let r = 1; r <= maxRow; r++) {
          cols.forEach((c, i) => {
            const key = c + r;
            const s = seatMap[key];

            const bx = x + i * cellWidth;
            const by = y;

            doc
              .roundedRect(bx, by, cellWidth - 10, cellHeight, 8)
              .stroke("#cbd5e1");

            if (s) {
              doc
                .fontSize(10)
                .text(key, bx, by + 8, { width: cellWidth - 10, align: "center" })
                .fontSize(11)
                .text(String(s.regno).replace(/\.0$/, ""), bx, by + 26, {
                  width: cellWidth - 10,
                  align: "center",
                })
                .fontSize(9)
                .fillColor("#475569")
                .text(s.dept, bx, by + 46, {
                  width: cellWidth - 10,
                  align: "center",
                })
                .fillColor("black");
            }
          });

          y += cellHeight + 14;

          if (y + cellHeight > doc.page.height - 40) {
            doc.addPage();
            y = 90;
          }
        }
      });

      doc.end();
    }
  );
});

app.get("/api/allocation/pdf-summary", requireLogin, (req, res) => {
  req.db.all(
    `
    SELECT hall_no, subject_code, regno, exam_date, session
    FROM seat_allocations
    ORDER BY hall_no, subject_code, regno
    `,
    (err, rows) => {
      if (err || !rows || rows.length === 0) {
        return res.status(400).send("No confirmed allocation data found to summarize");
      }

      /* ---------- GROUP DATA ---------- */
      const hallMap = {};
      rows.forEach((r) => {
        if (!hallMap[r.hall_no]) hallMap[r.hall_no] = {};
        if (!hallMap[r.hall_no][r.subject_code])
          hallMap[r.hall_no][r.subject_code] = [];
        hallMap[r.hall_no][r.subject_code].push(
          String(r.regno).replace(/\.0$/, ""),
        );
      });

      const halls = Object.keys(hallMap);
      const meta = rows[0];

      const doc = new PDFDocument({
        size: "A4",
        layout: "landscape",
        margins: { top: 0, left: 0, right: 0, bottom: 25 },
      });

      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", "inline; filename=Hall_Allocation_Summary.pdf");
      doc.pipe(res);

      /* ---------- HEADER (FULL WIDTH, NO GAPS) ---------- */
      const headerHeight = 80;

      const drawHeader = () => {
        doc.save();

        doc.rect(0, 0, doc.page.width, headerHeight).fill("#0f172a");

        doc
          .fillColor("white")
          .fontSize(18)
          .text("ANNA UNIVERSITY, CHENNAI – 25", 0, 20, {
            width: doc.page.width,
            align: "center",
          });

        doc.fontSize(12).text("Examination Wing – Hall Allocation Summary", {
          width: doc.page.width,
          align: "center",
        });

        doc
          .fontSize(10)
          .text(`Date / Session : ${meta.exam_date} | ${meta.session}`, {
            width: doc.page.width,
            align: "center",
          });

        doc.restore();
      };

      drawHeader();

      /* ---------- GRID CONFIG ---------- */
      const boxW = 380;
      const boxH = 210;

      const startX = 30;
      const startY = headerHeight + 30;

      const gapX = 30;
      const gapY = 30;

      /* ---------- DRAW HALL BLOCK ---------- */
      function drawHallBlock(hallNo, x, y) {
        const subjects = hallMap[hallNo];
        let hallTotal = 0;

        // Outer box
        doc.roundedRect(x, y, boxW, boxH, 10).stroke("#94a3b8");

        // Header
        doc
          .roundedRect(x, y, boxW, 28, 10)
          .fill("#1e293b")
          .fillColor("white")
          .fontSize(11)
          .text(`HALL : ${hallNo}`, x, y + 7, {
            width: boxW,
            align: "center",
          })
          .fillColor("black");

        let cy = y + 40;
        const contentBottom = y + boxH - 34;

        /* SUBJECTS (CLIPPED) */
        Object.entries(subjects).forEach(([sub, regs]) => {
          if (cy + 24 > contentBottom) return;

          doc.fontSize(9).text(sub, x + 12, cy);
          cy += 12;

          doc
            .fontSize(8)
            .fillColor("#334155")
            .text(regs.join(", "), x + 12, cy, {
              width: boxW - 24,
              height: contentBottom - cy,
              ellipsis: true,
            })
            .fillColor("black");

          cy += 22;
          hallTotal += regs.length;
        });

        /* FOOTER (FIXED POSITION) */
        doc.rect(x, y + boxH - 26, boxW, 26).fill("#f1f5f9");

        doc
          .fillColor("black")
          .fontSize(10)
          .text(`HALL TOTAL : ${hallTotal}`, x, y + boxH - 18, {
            width: boxW,
            align: "center",
          });
      }

      /* ---------- MAIN LOOP ---------- */
      halls.forEach((hallNo, i) => {
        if (i > 0 && i % 4 === 0) {
          doc.addPage();
          drawHeader();
        }

        const pos = i % 4;
        const col = pos % 2;
        const row = Math.floor(pos / 2);

        const x = startX + col * (boxW + gapX);
        const y = startY + row * (boxH + gapY);

        drawHallBlock(hallNo, x, y);
      });

      doc.end();
    },
  );
});

/* =======================
   17b. AI ASSISTANT ENDPOINT
   ======================= */
app.post("/api/ai/chat", (req, res) => {
  const { message } = req.body;
  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Message is required" });
  }

  const queryText = message.toLowerCase().trim();
  const isStudent = !!req.session.student;
  const studentRegNo = isStudent ? req.session.student.regno : null;

  // 1. Check if user is asking "where is my hall / seat"
  if (
    queryText.includes("where is my hall") ||
    queryText.includes("where is my seat") ||
    queryText.includes("where is my room") ||
    queryText.includes("my hall") ||
    queryText.includes("my seat") ||
    queryText.includes("my room")
  ) {
    if (!isStudent) {
      return res.json({
        success: true,
        reply: "📍 **Hall Lookup:** Please log in to the **Student Portal** with your Register Number to view your personal exam hall and seat label!"
      });
    }

    req.db.all(
      `SELECT sa.*, s.subject_name 
       FROM seat_allocations sa 
       LEFT JOIN subjects s ON sa.subject_code = s.subject_code 
       WHERE REPLACE(sa.regno, '.0', '') = ?
       ORDER BY sa.exam_date, sa.session`,
      [studentRegNo],
      (err, rows) => {
        if (err || !rows || rows.length === 0) {
          return res.json({
            success: true,
            reply: `📍 **Hall Location:**\nNo active seating allocation has been confirmed yet for Register Number **${studentRegNo}**.`
          });
        }

        let reply = `📍 **Your Exam Seating Details (Reg No: ${studentRegNo}):**\n\n`;
        rows.forEach((r, idx) => {
          reply += `${idx + 1}. **${r.subject_code}** (${r.subject_name || "Exam"})\n`;
          reply += `   • **Hall No:** \`${r.hall_no}\` | **Seat Label:** \`${r.seat_label}\`\n`;
          reply += `   • **Date & Session:** ${r.exam_date} (${r.session})\n`;
          reply += `   • **Invigilator:** ${r.invigilator}\n\n`;
        });

        res.json({ success: true, reply });
      }
    );
    return;
  }

  // 2. Check if user is asking "innaiku enna exam?" / "is there an exam today?"
  if (
    queryText.includes("innaiku enna exam") ||
    queryText.includes("today exam") ||
    queryText.includes("exam today") ||
    queryText.includes("is there exam today") ||
    queryText.includes("is there any exam today") ||
    queryText.includes("today's exam") ||
    queryText.includes("today") ||
    queryText.includes("enna exam")
  ) {
    const todayObj = new Date();
    const yyyy = todayObj.getFullYear();
    const mm = String(todayObj.getMonth() + 1).padStart(2, "0");
    const dd = String(todayObj.getDate()).padStart(2, "0");
    const todayFormatted = `${yyyy}-${mm}-${dd}`; // YYYY-MM-DD
    const todayLocale = todayObj.toLocaleDateString();

    if (isStudent) {
      req.db.all(
        `SELECT sa.*, s.subject_name 
         FROM seat_allocations sa 
         LEFT JOIN subjects s ON sa.subject_code = s.subject_code 
         WHERE REPLACE(sa.regno, '.0', '') = ? 
         AND (sa.exam_date = ? OR sa.exam_date = ?)`,
        [studentRegNo, todayFormatted, todayLocale],
        (err, rows) => {
          if (rows && rows.length > 0) {
            let reply = `✅ **YES! You have an exam scheduled today (${todayFormatted}):**\n\n`;
            rows.forEach((r) => {
              reply += `• **Subject:** ${r.subject_code} ${r.subject_name ? `(${r.subject_name})` : ""}\n`;
              reply += `• **Hall No:** \`${r.hall_no}\` | **Seat:** \`${r.seat_label}\`\n`;
              reply += `• **Session:** ${r.session}\n`;
              reply += `• **Invigilator:** ${r.invigilator}\n\n`;
            });
            reply += `Best of luck for your exam! 🍀`;
            res.json({ success: true, reply });
          } else {
            res.json({
              success: true,
              reply: `❌ **NO.** You do not have any exams scheduled for today (${todayFormatted}).`
            });
          }
        }
      );
      return;
    } else {
      // Admin query for today's exams
      req.db.all(
        `SELECT DISTINCT subject_code, hall_no, session, COUNT(*) as count 
         FROM seat_allocations 
         WHERE exam_date = ? OR exam_date = ? 
         GROUP BY subject_code, hall_no, session`,
        [todayFormatted, todayLocale],
        (err, rows) => {
          if (rows && rows.length > 0) {
            let reply = `✅ **YES! Exams are scheduled today (${todayFormatted}):**\n\n`;
            rows.forEach((r) => {
              reply += `• **Subject:** ${r.subject_code} in **Hall ${r.hall_no}** (${r.session}) - ${r.count} students\n`;
            });
            res.json({ success: true, reply });
          } else {
            res.json({
              success: true,
              reply: `❌ **NO.** There are no exams scheduled in the system for today (${todayFormatted}).`
            });
          }
        }
      );
      return;
    }
  }

  // 3. Fallback General Stats & Admin Answers
  const tenantName = (req.session.user && req.session.user.tenant_name) || (req.session.student && req.session.student.tenant_name) || "Hall Matrix";

  req.db.get("SELECT COUNT(*) as count FROM students", (err, sRow) => {
    const studentCount = sRow ? sRow.count : 0;
    
    req.db.get("SELECT COUNT(*) as count, SUM(capacity) as totalCap FROM halls", (err, hRow) => {
      const hallCount = hRow ? hRow.count : 0;
      const totalCapacity = (hRow && hRow.totalCap) ? hRow.totalCap : 0;

      req.db.get("SELECT COUNT(*) as count FROM subjects", (err, subRow) => {
        const subjectCount = subRow ? subRow.count : 0;

        req.db.get("SELECT COUNT(*) as count FROM invigilators", (err, iRow) => {
          const invigilatorCount = iRow ? iRow.count : 0;

          req.db.get("SELECT COUNT(*) as count FROM seat_allocations", (err, allocRow) => {
            const allocationCount = allocRow ? allocRow.count : 0;

            let reply = "";

            if (isStudent) {
              reply = `👋 Hello Student (**${studentRegNo}**)! I am **Matrix AI**.\n\nYou can ask me:\n• 📍 *"Where is my hall?"* or *"Where is my seat?"*\n• 📅 *"Innaiku enna exam?"* (Is there an exam today?)`;
            } else if (queryText.includes("student") || queryText.includes("register")) {
              reply = `🎓 **Student Roster Metrics:**\nCurrently, there are **${studentCount} students** registered in your system across various departments and degrees.`;
            } else if (queryText.includes("hall") || queryText.includes("capacity") || queryText.includes("room")) {
              reply = `🏫 **Exam Halls Overview:**\nYou have **${hallCount} halls** registered with a total seating capacity of **${totalCapacity} seats** (default 24 seats/hall in 4 columns: A, B, C, D).`;
            } else if (queryText.includes("subject") || queryText.includes("course") || queryText.includes("code")) {
              reply = `📘 **Subjects Info:**\nThere are **${subjectCount} exam subjects** configured in your institution's catalog.`;
            } else if (queryText.includes("invigilator") || queryText.includes("faculty") || queryText.includes("teacher")) {
              reply = `👨‍🏫 **Invigilator Roster:**\nThere are **${invigilatorCount} faculty invigilators** registered for exam supervision duties.`;
            } else if (queryText.includes("rule") || queryText.includes("algorithm") || queryText.includes("how it work") || queryText.includes("logic")) {
              reply = `🧮 **Hall Matrix Seating Logic:**\n1. **Department Separation:** No two students from the same department sit next to each other (Left, Right, Front, or Back).\n2. **Zig-Zag Pattern:** Seats are assigned in a alternating column order per row (Snake layout).\n3. **Subject Balancing:** Equal distribution of multiple subject exams across halls.\n4. **Auto Duty Allocation:** Round-robin invigilator duty assignment per hall.`;
            } else if (queryText.includes("pdf") || queryText.includes("export") || queryText.includes("download") || queryText.includes("print")) {
              reply = `📄 **PDF Reports & Downloads:**\nAfter generating and confirming seating allocations under **Allocation**, you can stream and download:\n• **Hall-wise Seating Chart PDF** (Graphical layout map)\n• **Allocation Summary PDF** (Official hall register sheets for exam invigilators).`;
            } else if (queryText.includes("stats") || queryText.includes("summary") || queryText.includes("count") || queryText.includes("dashboard")) {
              reply = `📊 **Live System Summary for ${tenantName}:**\n• 🎓 **Students:** ${studentCount}\n• 🏫 **Halls:** ${hallCount} (${totalCapacity} seats total)\n• 📘 **Subjects:** ${subjectCount}\n• 👨‍🏫 **Invigilators:** ${invigilatorCount}\n• 🧮 **Active Allocations:** ${allocationCount} seats assigned`;
            } else {
              reply = `🤖 **Matrix AI Assistant:**\nI am here to help you at **${tenantName}**.\n\nTry asking me:\n• *"Where is my hall?"*\n• *"Innaiku enna exam?"*\n• *"How does seating allocation work?"*\n• *"Show system stats"*`;
            }

            res.json({ success: true, reply, stats: { studentCount, hallCount, totalCapacity, subjectCount, invigilatorCount, allocationCount } });
          });
        });
      });
    });
  });
});

/* =======================
   18. PRODUCTION FRONTEND SERVING
   ======================= */
const frontendDistPath = path.join(__dirname, "..", "frontend", "dist");
app.use(express.static(frontendDistPath));

app.get(/.*/, (req, res, next) => {
  if (req.path.startsWith("/api/")) {
    return next();
  }
  const indexPath = path.join(frontendDistPath, "index.html");
  if (fs.existsSync(indexPath)) {
    res.sendFile(indexPath);
  } else {
    res.status(404).send("API route not found and Frontend build not found.");
  }
});

/* =======================
   19. SERVER LISTEN
   ======================= */
app.listen(3000, () => {
  console.log("🚀 Server running at http://localhost:3000");
});
