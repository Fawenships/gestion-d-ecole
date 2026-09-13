require("dotenv").config();

const express = require("express");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "change-this-secret";

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ================================
// DATABASE
// ================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,

  ssl: process.env.NODE_ENV === "production"
    ? { rejectUnauthorized: false }
    : false
});

// ================================
// FRONTEND
// ================================

app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

// ================================
// AUTHENTICATION
// ================================

function authenticateToken(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({
      success: false,
      message: "Authentification requise."
    });
  }

  const token = authHeader.split(" ")[1];

  if (!token) {
    return res.status(401).json({
      success: false,
      message: "Token manquant."
    });
  }

  try {
    const user = jwt.verify(token, JWT_SECRET);
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({
      success: false,
      message: "Session invalide ou expirée."
    });
  }
}

// ================================
// LOGIN
// ================================

app.post("/api/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email et mot de passe obligatoires."
      });
    }

    const result = await pool.query(
      `SELECT id, school_id, first_name, last_name, email, password_hash, role
       FROM users
       WHERE LOWER(email) = LOWER($1)
       LIMIT 1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: "Identifiants incorrects."
      });
    }

    const user = result.rows[0];

    const passwordCorrect = await bcrypt.compare(
      password,
      user.password_hash
    );

    if (!passwordCorrect) {
      return res.status(401).json({
        success: false,
        message: "Identifiants incorrects."
      });
    }

    const token = jwt.sign(
      {
        id: user.id,
        school_id: user.school_id,
        role: user.role,
        email: user.email
      },
      JWT_SECRET,
      {
        expiresIn: "8h"
      }
    );

    delete user.password_hash;

    res.json({
      success: true,
      message: "Connexion réussie.",
      token,
      user
    });

  } catch (error) {
    console.error("LOGIN ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Erreur serveur."
    });
  }
});

// ================================
// CURRENT USER
// ================================

app.get("/api/me", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, school_id, first_name, last_name, email, role
       FROM users
       WHERE id = $1`,
      [req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Utilisateur introuvable."
      });
    }

    res.json({
      success: true,
      user: result.rows[0]
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Erreur serveur."
    });
  }
});

// ================================
// DASHBOARD
// ================================

app.get("/api/dashboard", authenticateToken, async (req, res) => {
  try {
    const schoolId = req.user.school_id;

    const [
      students,
      teachers,
      classes,
      subjects,
      presentTeachers,
      lateTeachers
    ] = await Promise.all([

      pool.query(
        "SELECT COUNT(*) FROM students WHERE school_id = $1",
        [schoolId]
      ),

      pool.query(
        "SELECT COUNT(*) FROM teachers WHERE school_id = $1",
        [schoolId]
      ),

      pool.query(
        "SELECT COUNT(*) FROM classes WHERE school_id = $1",
        [schoolId]
      ),

      pool.query(
        "SELECT COUNT(*) FROM subjects WHERE school_id = $1",
        [schoolId]
      ),

      pool.query(
        `SELECT COUNT(*)
         FROM teacher_attendance
         WHERE school_id = $1
         AND attendance_date = CURRENT_DATE
         AND status = 'present'`,
        [schoolId]
      ),

      pool.query(
        `SELECT COUNT(*)
         FROM teacher_attendance
         WHERE school_id = $1
         AND attendance_date = CURRENT_DATE
         AND status = 'late'`,
        [schoolId]
      )
    ]);

    res.json({
      success: true,
      dashboard: {
        students: Number(students.rows[0].count),
        teachers: Number(teachers.rows[0].count),
        classes: Number(classes.rows[0].count),
        subjects: Number(subjects.rows[0].count),
        presentTeachers: Number(presentTeachers.rows[0].count),
        lateTeachers: Number(lateTeachers.rows[0].count)
      }
    });

  } catch (error) {
    console.error("DASHBOARD ERROR:", error);

    res.status(500).json({
      success: false,
      message: "Impossible de charger le tableau de bord."
    });
  }
});

// ================================
// STUDENTS
// ================================

app.get("/api/students", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         s.id,
         s.student_number,
         s.first_name,
         s.last_name,
         s.date_of_birth,
         s.gender,
         s.phone,
         s.address,
         c.name AS class_name
       FROM students s
       LEFT JOIN classes c ON c.id = s.class_id
       WHERE s.school_id = $1
       ORDER BY s.last_name, s.first_name`,
      [req.user.school_id]
    );

    res.json({
      success: true,
      students: result.rows
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Erreur lors du chargement des élèves."
    });
  }
});

// ================================
// TEACHERS
// ================================

app.get("/api/teachers", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         id,
         teacher_number,
         first_name,
         last_name,
         email,
         phone,
         specialization
       FROM teachers
       WHERE school_id = $1
       ORDER BY last_name, first_name`,
      [req.user.school_id]
    );

    res.json({
      success: true,
      teachers: result.rows
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Erreur lors du chargement des professeurs."
    });
  }
});

// ================================
// CLASSES
// ================================

app.get("/api/classes", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT
         c.id,
         c.name,
         c.level,
         c.section,
         COUNT(s.id) AS student_count
       FROM classes c
       LEFT JOIN students s ON s.class_id = c.id
       WHERE c.school_id = $1
       GROUP BY c.id
       ORDER BY c.level, c.name`,
      [req.user.school_id]
    );

    res.json({
      success: true,
      classes: result.rows
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Erreur lors du chargement des classes."
    });
  }
});

// ================================
// SUBJECTS
// ================================

app.get("/api/subjects", authenticateToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, code, coefficient
       FROM subjects
       WHERE school_id = $1
       ORDER BY name`,
      [req.user.school_id]
    );

    res.json({
      success: true,
      subjects: result.rows
    });

  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: "Erreur lors du chargement des matières."
    });
  }
});

// ================================
// TEACHER ATTENDANCE
// ================================

app.get(
  "/api/teacher-attendance/today",
  authenticateToken,
  async (req, res) => {
    try {
      const result = await pool.query(
        `SELECT
           t.id,
           t.teacher_number,
           t.first_name,
           t.last_name,
           ta.arrival_time,
           ta.status
         FROM teachers t
         LEFT JOIN teacher_attendance ta
           ON ta.teacher_id = t.id
           AND ta.attendance_date = CURRENT_DATE
         WHERE t.school_id = $1
         ORDER BY t.last_name, t.first_name`,
        [req.user.school_id]
      );

      res.json({
        success: true,
        attendance: result.rows
      });

    } catch (error) {
      console.error(error);

      res.status(500).json({
        success: false,
        message: "Erreur lors du chargement des présences."
      });
    }
  }
);

// ================================
// HEALTH CHECK
// ================================

app.get("/api/health", async (req, res) => {
  try {
    await pool.query("SELECT NOW()");

    res.json({
      success: true,
      message: "Serveur et base de données fonctionnels."
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Base de données indisponible."
    });
  }
});

// ================================
// 404 API
// ================================

app.use("/api", (req, res) => {
  res.status(404).json({
    success: false,
    message: "Route API introuvable."
  });
});

// ================================
// START SERVER
// ================================

app.listen(PORT, () => {
  console.log(`=================================`);
  console.log(`  PLATEFORME SCOLAIRE`);
  console.log(`  Serveur : http://localhost:${PORT}`);
  console.log(`=================================`);
});
