const path = require("path");
const express = require("express");
const session = require("express-session");
const mysql = require("mysql2/promise");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

const pool = mysql.createPool({
  host: process.env.DB_HOST || "localhost",
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "",
  database: process.env.DB_NAME || "faculty_site",
  waitForConnections: true,
  connectionLimit: 10
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(
  session({
    secret: process.env.SESSION_SECRET || "default_secret",
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 1000 * 60 * 60 * 24 }
  })
);

app.use(express.static(path.join(__dirname, "public")));

function requireAuth(req, res, next) {
  if (!req.session.user) {
    return res.status(401).json({ message: "Avval login qiling." });
  }
  next();
}

async function ensureSampleNews() {
  try {
    const [rows] = await pool.query("SELECT COUNT(*) AS total FROM news");
    if (rows[0].total === 0) {
      await pool.query(
        `INSERT INTO news (title, content)
         VALUES (?, ?), (?, ?), (?, ?)`,
        [
          "Fakultetda yangi o'quv semestri boshlandi",
          "Yangi semestr uchun dars jadvali e'lon qilindi va barcha talabalar uchun ro'yxatdan o'tish jarayoni davom etmoqda.",
          "Talabalar uchun IT seminar",
          "Ushbu haftada amaliy seminar tashkil etiladi. Mavzu: zamonaviy web texnologiyalar.",
          "Kutubxona ish vaqti yangilandi",
          "Kutubxona endilikda dam olish kunlari ham 09:00 dan 17:00 gacha ishlaydi."
        ]
      );
    }
  } catch (error) {
    console.error("Sample news yaratilmadi:", error.message);
  }
}

app.post("/api/auth/signup", async (req, res) => {
  const { fullName, email, password } = req.body;

  if (!fullName || !email || !password) {
    return res.status(400).json({ message: "Barcha maydonlarni to'ldiring." });
  }

  try {
    const [existing] = await pool.query("SELECT id FROM users WHERE email = ?", [email]);
    if (existing.length > 0) {
      return res.status(409).json({ message: "Bu email allaqachon mavjud." });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [result] = await pool.query(
      "INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)",
      [fullName, email, passwordHash]
    );

    req.session.user = {
      id: result.insertId,
      fullName,
      email
    };

    return res.json({ message: "Ro'yxatdan o'tildi.", user: req.session.user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server xatoligi." });
  }
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email va parol kiriting." });
  }

  try {
    const [users] = await pool.query(
      "SELECT id, full_name, email, password_hash FROM users WHERE email = ?",
      [email]
    );

    if (users.length === 0) {
      return res.status(401).json({ message: "Email yoki parol noto'g'ri." });
    }

    const user = users[0];
    const isValid = await bcrypt.compare(password, user.password_hash);

    if (!isValid) {
      return res.status(401).json({ message: "Email yoki parol noto'g'ri." });
    }

    req.session.user = {
      id: user.id,
      fullName: user.full_name,
      email: user.email
    };

    return res.json({ message: "Muvaffaqiyatli login.", user: req.session.user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Server xatoligi." });
  }
});

app.post("/api/auth/logout", (req, res) => {
  req.session.destroy(() => {
    res.json({ message: "Logout qilindi." });
  });
});

app.get("/api/auth/me", (req, res) => {
  res.json({ user: req.session.user || null });
});

app.get("/api/news", async (_req, res) => {
  try {
    const [rows] = await pool.query(
      "SELECT id, title, content, created_at FROM news ORDER BY created_at DESC"
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Yangiliklarni olishda xatolik." });
  }
});

app.post("/api/messages", requireAuth, async (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ message: "Xabar bo'sh bo'lmasin." });
  }

  try {
    await pool.query("INSERT INTO messages (user_id, message_text) VALUES (?, ?)", [
      req.session.user.id,
      message.trim()
    ]);
    res.json({ message: "Xabar saqlandi." });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Xabarni saqlashda xatolik." });
  }
});

app.get("/api/messages", requireAuth, async (_req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT m.id, m.message_text, m.created_at, u.full_name
       FROM messages m
       JOIN users u ON u.id = m.user_id
       ORDER BY m.created_at DESC`
    );
    res.json(rows);
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Xabarlarni olishda xatolik." });
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.listen(PORT, async () => {
  await ensureSampleNews();
  console.log(`Server ishga tushdi: http://localhost:${PORT}`);
});
