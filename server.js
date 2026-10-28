
const express = require("express");
const Database = require("better-sqlite3");

const app = express();
const db = new Database("studentnest.db");


db.exec(`
  CREATE TABLE IF NOT EXISTS reviews (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id INTEGER NOT NULL,
    rating INTEGER NOT NULL,
    feedback TEXT NOT NULL
  )
`);
db.exec(`
  CREATE TABLE IF NOT EXISTS reports (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    listing_id INTEGER NOT NULL,
    reason TEXT NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  )
`);


app.use(express.json());
app.use(express.static("public"));

db.exec(`
  CREATE TABLE IF NOT EXISTS listings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    category TEXT NOT NULL,
    name TEXT NOT NULL,
    price INTEGER NOT NULL
  )
`);

const count = db.prepare("SELECT COUNT(*) AS total FROM listings").get().total;

if (count === 0) {
  const add = db.prepare(
    "INSERT INTO listings (category, name, price) VALUES (?, ?, ?)"
  );

  add.run("Room", "Student PG", 5000);
  add.run("Food", "Student Tiffin", 2000);
  add.run("Job", "Campus Assistant", 3000);
}

app.get("/api/listings", (req, res) => {
  res.json(db.prepare("SELECT * FROM listings").all());
});


app.post("/api/listings", (req, res) => {
  try {
    const { category, name, price } = req.body;

    if (!["Room", "Food", "Job"].includes(category) ||
        !name || !Number.isFinite(price) || price < 0) {
      return res.status(400).json({ error: "Please enter valid details" });
    }

    const result = db.prepare(
      "INSERT INTO listings (category, name, price) VALUES (?, ?, ?)"
    ).run(category, name.trim(), price);

    res.json({
      message: "Listing added successfully!",
      id: result.lastInsertRowid
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Database mein listing save nahi hui" });
  }
});


app.post("/api/reviews", (req, res) => {
  const { listing_id, rating, feedback } = req.body;

  if (!Number.isInteger(listing_id) || listing_id < 1 ||
      !Number.isInteger(rating) || rating < 1 || rating > 5 ||
      typeof feedback !== "string" || !feedback.trim()) {
    return res.status(400).json({ error: "Please enter valid review details" });
  }

  const listing = db.prepare(
    "SELECT id FROM listings WHERE id = ?"
  ).get(listing_id);

  if (!listing) {
    return res.status(404).json({ error: "Listing not found" });
  }

  const result = db.prepare(
    "INSERT INTO reviews (listing_id, rating, feedback) VALUES (?, ?, ?)"
  ).run(listing_id, rating, feedback.trim());

  res.json({ message: "Review saved!", id: result.lastInsertRowid });
});

app.get("/api/reviews/:listing_id", (req, res) => {
  const reviews = db.prepare(
    "SELECT * FROM reviews WHERE listing_id = ? ORDER BY id DESC"
  ).all(Number(req.params.listing_id));

  res.json(reviews);
});


app.post("/api/reports", (req, res) => {
  const { listing_id, reason } = req.body;

  if (!Number.isInteger(listing_id) || listing_id < 1 ||
      typeof reason !== "string" || !reason.trim()) {
    return res.status(400).json({ error: "Please select a reason" });
  }

  const listing = db.prepare(
    "SELECT id FROM listings WHERE id = ?"
  ).get(listing_id);

  if (!listing) {
    return res.status(404).json({ error: "Listing not found" });
  }

  db.prepare(
    "INSERT INTO reports (listing_id, reason) VALUES (?, ?)"
  ).run(listing_id, reason.trim());

  const total = db.prepare(
    "SELECT COUNT(*) AS total FROM reports WHERE listing_id = ?"
  ).get(listing_id).total;

  res.json({
    message: "Report submitted successfully!",
    totalReports: total,
    needsReview: total >= 2
  });
});


const bcrypt = require("bcryptjs");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL
  )
`);

app.post("/api/signup", (req, res) => {
  const { name, email, password } = req.body;

  if (!name || !email || !password || password.length < 6) {
    return res.status(400).json({
      message: "Name, email aur minimum 6-character password zaroori hai."
    });
  }

  try {
    const hashedPassword = bcrypt.hashSync(password, 10);

    db.prepare(
      "INSERT INTO users (name, email, password) VALUES (?, ?, ?)"
    ).run(name.trim(), email.trim().toLowerCase(), hashedPassword);

    res.status(201).json({ message: "Account successfully created!" });
  } catch (error) {
    if (error.code === "SQLITE_CONSTRAINT_UNIQUE") {
      return res.status(409).json({ message: "Email already registered hai." });
    }
    res.status(500).json({ message: "Account create nahi hua." });
  }
});

app.post("/api/login", (req, res) => {
  const { email, password } = req.body;

  const user = db.prepare(
    "SELECT * FROM users WHERE email = ?"
  ).get(email.trim().toLowerCase());

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({
      message: "Email ya password galat hai."
    });
  }

  res.json({
    message: "Login successful! Welcome, " + user.name
  });
});
app.listen(3000, () => {
  console.log("StudentNest running at http://localhost:3000");
});




