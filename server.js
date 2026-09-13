```js
require("dotenv").config();

const express = require("express");
const path = require("path");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

const app = express();

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
    console.error("ERREUR : JWT_SECRET n'est pas défini.");
    process.exit(1);
}

/* =========================================================
   BASE DE DONNÉES
========================================================= */

const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl:
        process.env.NODE_ENV === "production"
            ? { rejectUnauthorized: false }
            : false,
});

/* =========================================================
   MIDDLEWARES
========================================================= */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(express.static(path.join(__dirname, "public")));

/* =========================================================
   PAGES
========================================================= */

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/admin.html", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "admin.html"));
});

app.get("/eleves.html", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "eleves.html"));
});

app.get("/professeurs.html", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "professeurs.html"));
});

app.get("/classes.html", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "classes.html"));
});

app.get("/matieres.html", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "matieres.html"));
});

app.get("/presence.html", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "presence.html"));
});

app.get("/notes.html", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "notes.html"));
});

app.get("/emploi-du-temps.html", (req, res) => {
    res.sendFile(
        path.join(__dirname, "public", "emploi-du-temps.html")
    );
});

app.get("/paiements.html", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "paiements.html"));
});

app.get("/bulletins.html", (req, res) => {
    res.sendFile(path.join(__dirname, "public", "bulletins.html"));
});

/* =========================================================
   AUTHENTIFICATION JWT
========================================================= */

function authenticateToken(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({
            success: false,
            message: "Token d'authentification manquant.",
        });
    }

    const token = authHeader.split(" ")[1];

    try {
        const user = jwt.verify(token, JWT_SECRET);

        if (!user || !user.id || !user.school_id) {
            return res.status(401).json({
                success: false,
                message: "Token invalide.",
            });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            message: "Session expirée ou token invalide.",
        });
    }
}

/* =========================================================
   LOGIN
========================================================= */

app.post("/api/login", async (req, res) => {
    try {
        const { email, password } = req.body;

        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: "Email et mot de passe obligatoires.",
            });
        }

        const result = await pool.query(
            `
            SELECT
                id,
                school_id,
                first_name,
                last_name,
                email,
                password,
                role,
                active
            FROM users
            WHERE LOWER(email) = LOWER($1)
            LIMIT 1
            `,
            [email.trim()]
        );

        if (result.rows.length === 0) {
            return res.status(401).json({
                success: false,
                message: "Email ou mot de passe incorrect.",
            });
        }

        const user = result.rows[0];

        if (user.active === false) {
            return res.status(403).json({
                success: false,
                message: "Ce compte est désactivé.",
            });
        }

        const passwordOK = await bcrypt.compare(
            password,
            user.password
        );

        if (!passwordOK) {
            return res.status(401).json({
                success: false,
                message: "Email ou mot de passe incorrect.",
            });
        }

        const token = jwt.sign(
            {
                id: user.id,
                school_id: user.school_id,
                role: user.role,
                email: user.email,
            },
            JWT_SECRET,
            {
                expiresIn: "7d",
            }
        );

        delete user.password;

        return res.json({
            success: true,
            message: "Connexion réussie.",
            token,
            user,
        });
    } catch (error) {
        console.error("Erreur login :", error);

        return res.status(500).json({
            success: false,
            message: "Erreur serveur lors de la connexion.",
        });
    }
});

/* =========================================================
   UTILISATEUR CONNECTÉ
========================================================= */

app.get("/api/me", authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `
            SELECT
                id,
                school_id,
                first_name,
                last_name,
                email,
                role,
                active
            FROM users
            WHERE id = $1
              AND school_id = $2
            LIMIT 1
            `,
            [req.user.id, req.user.school_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Utilisateur introuvable.",
            });
        }

        res.json({
            success: true,
            user: result.rows[0],
        });
    } catch (error) {
        console.error("Erreur /api/me :", error);

        res.status(500).json({
            success: false,
            message: "Erreur serveur.",
        });
    }
});

/* =========================================================
   DASHBOARD
========================================================= */

app.get("/api/dashboard", authenticateToken, async (req, res) => {
    try {
        const schoolId = req.user.school_id;

        const [
            students,
            teachers,
            classes,
            subjects,
        ] = await Promise.all([
            pool.query(
                `SELECT COUNT(*)::int AS total
                 FROM students
                 WHERE school_id = $1`,
                [schoolId]
            ),

            pool.query(
                `SELECT COUNT(*)::int AS total
                 FROM teachers
                 WHERE school_id = $1`,
                [schoolId]
            ),

            pool.query(
                `SELECT COUNT(*)::int AS total
                 FROM classes
                 WHERE school_id = $1`,
                [schoolId]
            ),

            pool.query(
                `SELECT COUNT(*)::int AS total
                 FROM subjects
                 WHERE school_id = $1`,
                [schoolId]
            ),
        ]);

        res.json({
            success: true,
            data: {
                students: students.rows[0].total,
                teachers: teachers.rows[0].total,
                classes: classes.rows[0].total,
                subjects: subjects.rows[0].total,
            },
        });
    } catch (error) {
        console.error("Erreur dashboard :", error);

        res.status(500).json({
            success: false,
            message: "Impossible de charger le tableau de bord.",
        });
    }
});

/* =========================================================
   ÉLÈVES
========================================================= */

/* GET ÉLÈVES */

app.get("/api/students", authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `
            SELECT
                s.*,
                c.name AS class_name
            FROM students s
            LEFT JOIN classes c
                ON c.id = s.class_id
               AND c.school_id = s.school_id
            WHERE s.school_id = $1
            ORDER BY s.last_name ASC, s.first_name ASC
            `,
            [req.user.school_id]
        );

        res.json({
            success: true,
            students: result.rows,
        });
    } catch (error) {
        console.error("Erreur GET students :", error);

        res.status(500).json({
            success: false,
            message: "Erreur lors du chargement des élèves.",
        });
    }
});

/* POST ÉLÈVE */

app.post("/api/students", authenticateToken, async (req, res) => {
    try {
        const {
            first_name,
            last_name,
            email,
            phone,
            address,
            birth_date,
            gender,
            class_id,
        } = req.body;

        if (!first_name || !last_name) {
            return res.status(400).json({
                success: false,
                message: "Le prénom et le nom sont obligatoires.",
            });
        }

        if (class_id) {
            const classCheck = await pool.query(
                `
                SELECT id
                FROM classes
                WHERE id = $1
                  AND school_id = $2
                `,
                [class_id, req.user.school_id]
            );

            if (classCheck.rows.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Classe invalide.",
                });
            }
        }

        const result = await pool.query(
            `
            INSERT INTO students (
                school_id,
                first_name,
                last_name,
                email,
                phone,
                address,
                birth_date,
                gender,
                class_id
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
            RETURNING *
            `,
            [
                req.user.school_id,
                first_name,
                last_name,
                email || null,
                phone || null,
                address || null,
                birth_date || null,
                gender || null,
                class_id || null,
            ]
        );

        res.status(201).json({
            success: true,
            message: "Élève ajouté avec succès.",
            student: result.rows[0],
        });
    } catch (error) {
        console.error("Erreur POST student :", error);

        res.status(500).json({
            success: false,
            message: "Erreur lors de l'ajout de l'élève.",
        });
    }
});

/* PUT ÉLÈVE */

app.put("/api/students/:id", authenticateToken, async (req, res) => {
    try {
        const studentId = req.params.id;

        const {
            first_name,
            last_name,
            email,
            phone,
            address,
            birth_date,
            gender,
            class_id,
        } = req.body;

        if (!first_name || !last_name) {
            return res.status(400).json({
                success: false,
                message: "Le prénom et le nom sont obligatoires.",
            });
        }

        if (class_id) {
            const classCheck = await pool.query(
                `
                SELECT id
                FROM classes
                WHERE id = $1
                  AND school_id = $2
                `,
                [class_id, req.user.school_id]
            );

            if (classCheck.rows.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: "Classe invalide.",
                });
            }
        }

        const result = await pool.query(
            `
            UPDATE students
            SET
                first_name = $1,
                last_name = $2,
                email = $3,
                phone = $4,
                address = $5,
                birth_date = $6,
                gender = $7,
                class_id = $8
            WHERE id = $9
              AND school_id = $10
            RETURNING *
            `,
            [
                first_name,
                last_name,
                email || null,
                phone || null,
                address || null,
                birth_date || null,
                gender || null,
                class_id || null,
                studentId,
                req.user.school_id,
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Élève introuvable.",
            });
        }

        res.json({
            success: true,
            message: "Élève modifié avec succès.",
            student: result.rows[0],
        });
    } catch (error) {
        console.error("Erreur PUT student :", error);

        res.status(500).json({
            success: false,
            message: "Erreur lors de la modification.",
        });
    }
});

/* DELETE ÉLÈVE */

app.delete("/api/students/:id", authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `
            DELETE FROM students
            WHERE id = $1
              AND school_id = $2
            RETURNING id, first_name, last_name
            `,
            [req.params.id, req.user.school_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Élève introuvable.",
            });
        }

        res.json({
            success: true,
            message: "Élève supprimé avec succès.",
            student: result.rows[0],
        });
    } catch (error) {
        console.error("Erreur DELETE student :", error);

        res.status(500).json({
            success: false,
            message: "Impossible de supprimer cet élève.",
        });
    }
});

/* =========================================================
   PROFESSEURS
========================================================= */

/* GET PROFESSEURS */

app.get("/api/teachers", authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `
            SELECT *
            FROM teachers
            WHERE school_id = $1
            ORDER BY last_name ASC, first_name ASC
            `,
            [req.user.school_id]
        );

        res.json({
            success: true,
            teachers: result.rows,
        });
    } catch (error) {
        console.error("Erreur GET teachers :", error);

        res.status(500).json({
            success: false,
            message: "Erreur lors du chargement des professeurs.",
        });
    }
});

/* POST PROFESSEUR */

app.post("/api/teachers", authenticateToken, async (req, res) => {
    try {
        const {
            first_name,
            last_name,
            email,
            phone,
            address,
            specialization,
            hire_date,
        } = req.body;

        if (!first_name || !last_name) {
            return res.status(400).json({
                success: false,
                message: "Le prénom et le nom sont obligatoires.",
            });
        }

        const result = await pool.query(
            `
            INSERT INTO teachers (
                school_id,
                first_name,
                last_name,
                email,
                phone,
                address,
                specialization,
                hire_date
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
            RETURNING *
            `,
            [
                req.user.school_id,
                first_name,
                last_name,
                email || null,
                phone || null,
                address || null,
                specialization || null,
                hire_date || null,
            ]
        );

        res.status(201).json({
            success: true,
            message: "Professeur ajouté avec succès.",
            teacher: result.rows[0],
        });
    } catch (error) {
        console.error("Erreur POST teacher :", error);

        res.status(500).json({
            success: false,
            message: "Erreur lors de l'ajout du professeur.",
        });
    }
});

/* PUT PROFESSEUR */

app.put("/api/teachers/:id", authenticateToken, async (req, res) => {
    try {
        const {
            first_name,
            last_name,
            email,
            phone,
            address,
            specialization,
            hire_date,
            active,
        } = req.body;

        if (!first_name || !last_name) {
            return res.status(400).json({
                success: false,
                message: "Le prénom et le nom sont obligatoires.",
            });
        }

        const result = await pool.query(
            `
            UPDATE teachers
            SET
                first_name = $1,
                last_name = $2,
                email = $3,
                phone = $4,
                address = $5,
                specialization = $6,
                hire_date = $7,
                active = COALESCE($8, active)
            WHERE id = $9
              AND school_id = $10
            RETURNING *
            `,
            [
                first_name,
                last_name,
                email || null,
                phone || null,
                address || null,
                specialization || null,
                hire_date || null,
                typeof active === "boolean" ? active : null,
                req.params.id,
                req.user.school_id,
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Professeur introuvable.",
            });
        }

        res.json({
            success: true,
            message: "Professeur modifié avec succès.",
            teacher: result.rows[0],
        });
    } catch (error) {
        console.error("Erreur PUT teacher :", error);

        res.status(500).json({
            success: false,
            message: "Erreur lors de la modification du professeur.",
        });
    }
});

/* DELETE PROFESSEUR */

app.delete("/api/teachers/:id", authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `
            DELETE FROM teachers
            WHERE id = $1
              AND school_id = $2
            RETURNING id, first_name, last_name
            `,
            [req.params.id, req.user.school_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Professeur introuvable.",
            });
        }

        res.json({
            success: true,
            message: "Professeur supprimé avec succès.",
            teacher: result.rows[0],
        });
    } catch (error) {
        console.error("Erreur DELETE teacher :", error);

        if (error.code === "23503") {
            return res.status(409).json({
                success: false,
                message:
                    "Ce professeur est utilisé dans d'autres données et ne peut pas être supprimé.",
            });
        }

        res.status(500).json({
            success: false,
            message: "Impossible de supprimer ce professeur.",
        });
    }
});

/* =========================================================
   CLASSES
========================================================= */

app.get("/api/classes", authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `
            SELECT *
            FROM classes
            WHERE school_id = $1
            ORDER BY name ASC
            `,
            [req.user.school_id]
        );

        res.json({
            success: true,
            classes: result.rows,
        });
    } catch (error) {
        console.error("Erreur GET classes :", error);

        res.status(500).json({
            success: false,
            message: "Erreur lors du chargement des classes.",
        });
    }
});

/* =========================================================
   MATIÈRES
========================================================= */

/* GET */

app.get("/api/subjects", authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `
            SELECT *
            FROM subjects
            WHERE school_id = $1
            ORDER BY name ASC
            `,
            [req.user.school_id]
        );

        res.json({
            success: true,
            subjects: result.rows,
        });
    } catch (error) {
        console.error("Erreur GET subjects :", error);

        res.status(500).json({
            success: false,
            message: "Erreur lors du chargement des matières.",
        });
    }
});

/* POST */

app.post("/api/subjects", authenticateToken, async (req, res) => {
    try {
        const { name, code, coefficient } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Le nom de la matière est obligatoire.",
            });
        }

        const coef = Number(coefficient);

        if (!Number.isFinite(coef) || coef <= 0) {
            return res.status(400).json({
                success: false,
                message: "Le coefficient doit être supérieur à 0.",
            });
        }

        const result = await pool.query(
            `
            INSERT INTO subjects (
                school_id,
                name,
                code,
                coefficient
            )
            VALUES ($1,$2,$3,$4)
            RETURNING *
            `,
            [
                req.user.school_id,
                name,
                code || null,
                coef,
            ]
        );

        res.status(201).json({
            success: true,
            message: "Matière ajoutée avec succès.",
            subject: result.rows[0],
        });
    } catch (error) {
        console.error("Erreur POST subject :", error);

        res.status(500).json({
            success: false,
            message: "Erreur lors de l'ajout de la matière.",
        });
    }
});

/* PUT */

app.put("/api/subjects/:id", authenticateToken, async (req, res) => {
    try {
        const { name, code, coefficient } = req.body;

        if (!name) {
            return res.status(400).json({
                success: false,
                message: "Le nom de la matière est obligatoire.",
            });
        }

        const coef = Number(coefficient);

        if (!Number.isFinite(coef) || coef <= 0) {
            return res.status(400).json({
                success: false,
                message: "Le coefficient doit être supérieur à 0.",
            });
        }

        const result = await pool.query(
            `
            UPDATE subjects
            SET
                name = $1,
                code = $2,
                coefficient = $3
            WHERE id = $4
              AND school_id = $5
            RETURNING *
            `,
            [
                name,
                code || null,
                coef,
                req.params.id,
                req.user.school_id,
            ]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Matière introuvable.",
            });
        }

        res.json({
            success: true,
            message: "Matière modifiée avec succès.",
            subject: result.rows[0],
        });
    } catch (error) {
        console.error("Erreur PUT subject :", error);

        res.status(500).json({
            success: false,
            message: "Erreur lors de la modification.",
        });
    }
});

/* DELETE */

app.delete("/api/subjects/:id", authenticateToken, async (req, res) => {
    try {
        const result = await pool.query(
            `
            DELETE FROM subjects
            WHERE id = $1
              AND school_id = $2
            RETURNING id, name
            `,
            [req.params.id, req.user.school_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({
                success: false,
                message: "Matière introuvable.",
            });
        }

        res.json({
            success: true,
            message: "Matière supprimée avec succès.",
            subject: result.rows[0],
        });
    } catch (error) {
        console.error("Erreur DELETE subject :", error);

        if (error.code === "23503") {
            return res.status(409).json({
                success: false,
                message:
                    "Cette matière est déjà utilisée et ne peut pas être supprimée.",
            });
        }

        res.status(500).json({
            success: false,
            message: "Impossible de supprimer cette matière.",
        });
    }
});

/* =========================================================
   PRÉSENCE DES PROFESSEURS
========================================================= */

app.get(
    "/api/teacher-attendance/today",
    authenticateToken,
    async (req, res) => {
        try {
            const result = await pool.query(
                `
                SELECT
                    ta.*,
                    t.first_name,
                    t.last_name
                FROM teacher_attendance ta
                INNER JOIN teachers t
                    ON t.id = ta.teacher_id
                   AND t.school_id = ta.school_id
                WHERE ta.school_id = $1
                  AND ta.date = CURRENT_DATE
                ORDER BY t.last_name ASC, t.first_name ASC
                `,
                [req.user.school_id]
            );

            res.json({
                success: true,
                attendance: result.rows,
            });
        } catch (error) {
            console.error(
                "Erreur teacher attendance :",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Erreur lors du chargement des présences.",
            });
        }
    }
);

/* =========================================================
   NOTES
========================================================= */

app.get("/api/grades", authenticateToken, async (req, res) => {
    try {
        const {
            class_id,
            subject_id,
            period,
        } = req.query;

        if (!class_id || !subject_id || !period) {
            return res.status(400).json({
                success: false,
                message:
                    "class_id, subject_id et period sont obligatoires.",
            });
        }

        const result = await pool.query(
            `
            SELECT
                g.*,
                s.first_name,
                s.last_name,
                sub.name AS subject_name
            FROM grades g
            INNER JOIN students s
                ON s.id = g.student_id
               AND s.school_id = g.school_id
            INNER JOIN subjects sub
                ON sub.id = g.subject_id
               AND sub.school_id = g.school_id
            WHERE g.school_id = $1
              AND g.class_id = $2
              AND g.subject_id = $3
              AND g.period = $4
            ORDER BY s.last_name ASC, s.first_name ASC
            `,
            [
                req.user.school_id,
                class_id,
                subject_id,
                period,
            ]
        );

        res.json({
            success: true,
            grades: result.rows,
        });
    } catch (error) {
        console.error("Erreur GET grades :", error);

        res.status(500).json({
            success: false,
            message: "Erreur lors du chargement des notes.",
        });
    }
});

app.post("/api/grades", authenticateToken, async (req, res) => {
    const client = await pool.connect();

    try {
        const {
            student_id,
            subject_id,
            class_id,
            period,
            score,
            max_grade,
        } = req.body;

        if (
            !student_id ||
            !subject_id ||
            !class_id ||
            !period
        ) {
            return res.status(400).json({
                success: false,
                message: "Données de note incomplètes.",
            });
        }

        const max = Number(max_grade);

        if (!Number.isFinite(max) || max < 1 || max > 400) {
            return res.status(400).json({
                success: false,
                message:
                    "La note maximale doit être comprise entre 1 et 400.",
            });
        }

        await client.query("BEGIN");

        const studentCheck = await client.query(
            `
            SELECT id
            FROM students
            WHERE id = $1
              AND school_id = $2
              AND class_id = $3
            `,
            [
                student_id,
                req.user.school_id,
                class_id,
            ]
        );

        if (studentCheck.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message:
                    "Élève invalide pour cette classe.",
            });
        }

        const subjectCheck = await client.query(
            `
            SELECT id
            FROM subjects
            WHERE id = $1
              AND school_id = $2
            `,
            [
                subject_id,
                req.user.school_id,
            ]
        );

        if (subjectCheck.rows.length === 0) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message: "Matière invalide.",
            });
        }

        if (
            score === "" ||
            score === null ||
            typeof score === "undefined"
        ) {
            await client.query(
                `
                DELETE FROM grades
                WHERE school_id = $1
                  AND student_id = $2
                  AND subject_id = $3
                  AND class_id = $4
                  AND period = $5
                `,
                [
                    req.user.school_id,
                    student_id,
                    subject_id,
                    class_id,
                    period,
                ]
            );

            await client.query("COMMIT");

            return res.json({
                success: true,
                message: "Note supprimée.",
            });
        }

        const numericScore = Number(score);

        if (
            !Number.isFinite(numericScore) ||
            numericScore < 0 ||
            numericScore > max
        ) {
            await client.query("ROLLBACK");

            return res.status(400).json({
                success: false,
                message:
                    "La note doit être comprise entre 0 et la note maximale.",
            });
        }

        const result = await client.query(
            `
            INSERT INTO grades (
                school_id,
                student_id,
                subject_id,
                class_id,
                period,
                score,
                max_grade
            )
            VALUES ($1,$2,$3,$4,$5,$6,$7)
            ON CONFLICT (
                school_id,
                student_id,
                subject_id,
                class_id,
                period
            )
            DO UPDATE SET
                score = EXCLUDED.score,
                max_grade = EXCLUDED.max_grade
            RETURNING *
            `,
            [
                req.user.school_id,
                student_id,
                subject_id,
                class_id,
                period,
                numericScore,
                max,
            ]
        );

        await client.query("COMMIT");

        res.json({
            success: true,
            message: "Note enregistrée avec succès.",
            grade: result.rows[0],
        });
    } catch (error) {
        await client.query("ROLLBACK");

        console.error("Erreur POST grade :", error);

        res.status(500).json({
            success: false,
            message: "Erreur lors de l'enregistrement de la note.",
        });
    } finally {
        client.release();
    }
});

/* =========================================================
   HEALTH CHECK
========================================================= */

app.get("/api/health", async (req, res) => {
    try {
        await pool.query("SELECT 1");

        res.json({
            success: true,
            message: "Serveur et base de données fonctionnels.",
        });
    } catch (error) {
        console.error("Erreur health :", error);

        res.status(500).json({
            success: false,
            message: "Base de données inaccessible.",
        });
    }
});

/* =========================================================
   API INCONNUE
========================================================= */

app.use("/api", (req, res) => {
    res.status(404).json({
        success: false,
        message: "Route API introuvable.",
    });
});

/* =========================================================
   GESTION DES ERREURS
========================================================= */

app.use((error, req, res, next) => {
    console.error("Erreur générale :", error);

    res.status(500).json({
        success: false,
        message: "Erreur interne du serveur.",
    });
});

/* =========================================================
   DÉMARRAGE
========================================================= */

app.listen(PORT, () => {
    console.log(`Serveur Gestion École démarré sur le port ${PORT}`);
});
```
