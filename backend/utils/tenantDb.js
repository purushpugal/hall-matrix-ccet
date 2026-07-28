const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

const dbDir = path.join(__dirname, "..", "databases");

// Ensure databases directory exists
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const connections = {};

function initTenantSchema(db, callback) {
  db.serialize(() => {
    db.run(`CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      regno TEXT,
      name TEXT,
      dept TEXT,
      subject_code TEXT,
      batch TEXT,
      degree TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS degrees (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS departments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      degree TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS halls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      hall_no TEXT UNIQUE,
      capacity INTEGER,
      block TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS subjects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_code TEXT UNIQUE,
      subject_name TEXT,
      batch TEXT,
      dept TEXT,
      degree TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS invigilators (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT,
      dept TEXT
    )`);

    db.run(`CREATE TABLE IF NOT EXISTS seat_allocations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      regno TEXT,
      name TEXT,
      subject_code TEXT,
      hall_no TEXT,
      seat_label TEXT,
      dept TEXT,
      batch TEXT,
      exam_date TEXT,
      session TEXT,
      invigilator TEXT
    )`, callback);
  });
}

function getTenantDb(tenantId) {
  if (connections[tenantId]) {
    return connections[tenantId];
  }

  const dbPath = path.join(dbDir, `tenant_${tenantId}.db`);
  const dbExists = fs.existsSync(dbPath);
  
  const db = new sqlite3.Database(dbPath);
  connections[tenantId] = db;

  if (!dbExists) {
    initTenantSchema(db);
  } else {
    // Migration for existing DBs
    db.serialize(() => {
      db.all("PRAGMA table_info(students)", (err, info) => {
        if (info) {
          if (!info.some(col => col.name === 'batch')) {
            db.run("ALTER TABLE students ADD COLUMN batch TEXT");
          }
          if (!info.some(col => col.name === 'degree')) {
            db.run("ALTER TABLE students ADD COLUMN degree TEXT");
          }
          if (!info.some(col => col.name === 'name')) {
            db.run("ALTER TABLE students ADD COLUMN name TEXT");
          }
        }
      });
      db.all("PRAGMA table_info(subjects)", (err, info) => {
        if (info) {
          if (!info.some(col => col.name === 'batch')) {
            db.run("ALTER TABLE subjects ADD COLUMN batch TEXT");
          }
          if (!info.some(col => col.name === 'dept')) {
            db.run("ALTER TABLE subjects ADD COLUMN dept TEXT");
          }
          if (!info.some(col => col.name === 'degree')) {
            db.run("ALTER TABLE subjects ADD COLUMN degree TEXT");
          }
        }
      });
      db.all("PRAGMA table_info(seat_allocations)", (err, info) => {
        if (info) {
          if (!info.some(col => col.name === 'name')) {
            db.run("ALTER TABLE seat_allocations ADD COLUMN name TEXT");
          }
          if (!info.some(col => col.name === 'batch')) {
            db.run("ALTER TABLE seat_allocations ADD COLUMN batch TEXT");
          }
        }
      });
      db.all("PRAGMA table_info(departments)", (err, info) => {
        if (info) {
          if (info.length > 0 && !info.some(col => col.name === 'degree')) {
            db.run("ALTER TABLE departments ADD COLUMN degree TEXT");
          }
        }
      });
      db.run(`CREATE TABLE IF NOT EXISTS degrees (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE
      )`);
      db.run(`CREATE TABLE IF NOT EXISTS departments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        degree TEXT
      )`);
    });
  }

  return db;
}

module.exports = {
  getTenantDb,
  dbDir,
  initTenantSchema
};
