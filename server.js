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
            : false
});

/* =========================================================
   MIDDLEWARES
========================================================= */

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

/* =========================================================
   FICHIERS PUBLICS
========================================================= */

app.use(
    express.static(
        path.join(__dirname, "public")
    )
);

/* =========================================================
   PAGE D'ACCUEIL
========================================================= */

app.get("/", (req, res) => {
    res.sendFile(
        path.join(__dirname, "public", "index.html")
    );
});

/* =========================================================
   PAGES DE L'APPLICATION
========================================================= */

app.get("/admin.html", (req, res) => {
    res.sendFile(
        path.join(__dirname, "public", "admin.html")
    );
});

app.get("/eleves.html", (req, res) => {
    res.sendFile(
        path.join(__dirname, "public", "eleves.html")
    );
});

app.get("/professeurs.html", (req, res) => {
    res.sendFile(
        path.join(__dirname, "public", "professeurs.html")
    );
});

app.get("/classes.html", (req, res) => {
    res.sendFile(
        path.join(__dirname, "public", "classes.html")
    );
});

app.get("/matieres.html", (req, res) => {
    res.sendFile(
        path.join(__dirname, "public", "matieres.html")
    );
});

app.get("/presence.html", (req, res) => {
    res.sendFile(
        path.join(__dirname, "public", "presence.html")
    );
});

app.get("/notes.html", (req, res) => {
    res.sendFile(
        path.join(__dirname, "public", "notes.html")
    );
});

app.get("/emploi-du-temps.html", (req, res) => {
    res.sendFile(
        path.join(__dirname, "public", "emploi-du-temps.html")
    );
});

app.get("/paiements.html", (req, res) => {
    res.sendFile(
        path.join(__dirname, "public", "paiements.html")
    );
});

app.get("/bulletins.html", (req, res) => {
    res.sendFile(
        path.join(__dirname, "public", "bulletins.html")
    );
});

/* =========================================================
   AUTHENTIFICATION JWT
========================================================= */

function authenticateToken(req, res, next) {

    const authHeader =
        req.headers["authorization"];

    const token =
        authHeader &&
        authHeader.startsWith("Bearer ")
            ? authHeader.split(" ")[1]
            : null;

    if (!token) {

        return res.status(401).json({
            success: false,
            message: "Token manquant."
        });

    }

    jwt.verify(
        token,
        JWT_SECRET,
        (err, user) => {

            if (err) {

                return res.status(403).json({
                    success: false,
                    message: "Token invalide ou expiré."
                });

            }

            req.user = user;

            next();
        }
    );
}

/* =========================================================
   LOGIN
========================================================= */

app.post("/api/login", async (req, res) => {

    try {

        const {
            email,
            password
        } = req.body;

        if (!email || !password) {

            return res.status(400).json({
                success: false,
                message: "Email et mot de passe requis."
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
                password_hash,
                role
            FROM users
            WHERE LOWER(email) = LOWER($1)
            LIMIT 1
            `,
            [email.trim()]
        );

        if (result.rows.length === 0) {

            return res.status(401).json({
                success: false,
                message: "Email ou mot de passe incorrect."
            });

        }

        const user = result.rows[0];

        const passwordValid =
            await bcrypt.compare(
                password,
                user.password_hash
            );

        if (!passwordValid) {

            return res.status(401).json({
                success: false,
                message: "Email ou mot de passe incorrect."
            });

        }

        const token =
            jwt.sign(
                {
                    id: user.id,
                    school_id: user.school_id,
                    email: user.email,
                    role: user.role
                },
                JWT_SECRET,
                {
                    expiresIn: "24h"
                }
            );

        delete user.password_hash;

        res.json({
            success: true,
            token,
            user
        });

    } catch (error) {

        console.error(
            "Erreur login :",
            error
        );

        res.status(500).json({
            success: false,
            message: "Erreur serveur."
        });

    }

});

/* =========================================================
   UTILISATEUR CONNECTÉ
========================================================= */

app.get(
    "/api/me",
    authenticateToken,
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT
                        id,
                        school_id,
                        first_name,
                        last_name,
                        email,
                        role
                    FROM users
                    WHERE id = $1
                    AND school_id = $2
                    LIMIT 1
                    `,
                    [
                        req.user.id,
                        req.user.school_id
                    ]
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

            console.error(
                "Erreur /api/me :",
                error
            );

            res.status(500).json({
                success: false,
                message: "Erreur serveur."
            });

        }

    }
);

/* =========================================================
   DASHBOARD
========================================================= */

app.get(
    "/api/dashboard",
    authenticateToken,
    async (req, res) => {

        try {

            const schoolId =
                req.user.school_id;

            const result =
                await pool.query(
                    `
                    SELECT

                        (
                            SELECT COUNT(*)
                            FROM students
                            WHERE school_id = $1
                        ) AS students,

                        (
                            SELECT COUNT(*)
                            FROM teachers
                            WHERE school_id = $1
                        ) AS teachers,

                        (
                            SELECT COUNT(*)
                            FROM classes
                            WHERE school_id = $1
                        ) AS classes,

                        (
                            SELECT COUNT(*)
                            FROM subjects
                            WHERE school_id = $1
                        ) AS subjects,

                        (
                            SELECT COUNT(*)
                            FROM teacher_attendance
                            WHERE school_id = $1
                            AND attendance_date = CURRENT_DATE
                            AND status = 'present'
                        ) AS "presentTeachers",

                        (
                            SELECT COUNT(*)
                            FROM teacher_attendance
                            WHERE school_id = $1
                            AND attendance_date = CURRENT_DATE
                            AND status = 'late'
                        ) AS "lateTeachers"
                    `,
                    [schoolId]
                );

            res.json({
                success: true,
                dashboard: result.rows[0]
            });

        } catch (error) {

            console.error(
                "Erreur dashboard :",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Impossible de charger le tableau de bord."
            });

        }

    }
);

/* =========================================================
   ÉLÈVES — LECTURE
========================================================= */

app.get(
    "/api/students",
    authenticateToken,
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT
                        s.id,
                        s.school_id,
                        s.first_name,
                        s.last_name,
                        s.matricule,
                        s.date_of_birth,
                        s.gender,
                        s.phone,
                        s.class_id,
                        c.name AS class_name,
                        s.parent_name,
                        s.parent_phone,
                        s.address,
                        s.photo_url,
                        s.active,
                        s.created_at
                    FROM students s
                    LEFT JOIN classes c ON c.id = s.class_id
                    WHERE s.school_id = $1
                    ORDER BY s.last_name ASC, s.first_name ASC
                    `,
                    [req.user.school_id]
                );

            res.json({
                success: true,
                students: result.rows
            });

        } catch (error) {

            console.error(
                "Erreur students :",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Impossible de charger les élèves."
            });

        }

    }
);

/* =========================================================
   ÉLÈVES — AJOUT
========================================================= */

app.post(
    "/api/students",
    authenticateToken,
    async (req, res) => {

        try {

            const {
                first_name,
                last_name,
                matricule,
                date_of_birth,
                gender,
                phone,
                class_id,
                parent_name,
                parent_phone,
                address,
                photo_url
            } = req.body;

            if (
                !first_name || !first_name.trim() ||
                !last_name || !last_name.trim()
            ) {

                return res.status(400).json({
                    success: false,
                    message: "Le prénom et le nom sont requis."
                });

            }

            if (!class_id) {

                return res.status(400).json({
                    success: false,
                    message: "La classe est requise."
                });

            }

            const schoolId = req.user.school_id;

            const classCheck = await pool.query(
                `SELECT id FROM classes WHERE id = $1 AND school_id = $2 LIMIT 1`,
                [class_id, schoolId]
            );

            if (classCheck.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    message: "Classe introuvable."
                });

            }

            const finalMatricule =
                matricule && matricule.trim()
                    ? matricule.trim()
                    : "EL" + Date.now().toString().slice(-8);

            const result = await pool.query(
                `
                INSERT INTO students (
                    school_id, first_name, last_name, matricule,
                    date_of_birth, gender, phone, class_id, parent_name,
                    parent_phone, address, photo_url
                )
                VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
                RETURNING
                    id, school_id, first_name, last_name, matricule,
                    date_of_birth, gender, phone, class_id, parent_name,
                    parent_phone, address, photo_url, created_at
                `,
                [
                    schoolId,
                    first_name.trim(),
                    last_name.trim(),
                    finalMatricule,
                    date_of_birth || null,
                    gender || null,
                    phone || null,
                    class_id,
                    parent_name || null,
                    parent_phone || null,
                    address || null,
                    photo_url || null
                ]
            );

            res.status(201).json({
                success: true,
                message: "Élève ajouté avec succès.",
                student: result.rows[0]
            });

        } catch (error) {

            console.error("Erreur ajout élève :", error);

            if (error.code === "23505") {

                return res.status(409).json({
                    success: false,
                    message: "Ce matricule existe déjà."
                });

            }

            res.status(500).json({
                success: false,
                message: "Impossible d'ajouter l'élève."
            });

        }

    }
);

/* =========================================================
   ÉLÈVES — MODIFICATION
========================================================= */

app.put(
    "/api/students/:id",
    authenticateToken,
    async (req, res) => {

        try {

            const studentId = Number(req.params.id);

            if (!Number.isInteger(studentId)) {

                return res.status(400).json({
                    success: false,
                    message: "Identifiant d'élève invalide."
                });

            }

            const {
                first_name,
                last_name,
                matricule,
                date_of_birth,
                gender,
                phone,
                class_id,
                parent_name,
                parent_phone,
                address,
                photo_url
            } = req.body;

            if (
                !first_name || !first_name.trim() ||
                !last_name || !last_name.trim()
            ) {

                return res.status(400).json({
                    success: false,
                    message: "Le prénom et le nom sont requis."
                });

            }

            const result = await pool.query(
                `
                UPDATE students
                SET
                    first_name = $1,
                    last_name = $2,
                    matricule = $3,
                    date_of_birth = $4,
                    gender = $5,
                    phone = $6,
                    class_id = $7,
                    parent_name = $8,
                    parent_phone = $9,
                    address = $10,
                    photo_url = $11
                WHERE id = $12
                AND school_id = $13
                RETURNING
                    id, school_id, first_name, last_name, matricule,
                    date_of_birth, gender, phone, class_id, parent_name,
                    parent_phone, address, photo_url, created_at
                `,
                [
                    first_name.trim(),
                    last_name.trim(),
                    matricule || null,
                    date_of_birth || null,
                    gender || null,
                    phone || null,
                    class_id,
                    parent_name || null,
                    parent_phone || null,
                    address || null,
                    photo_url || null,
                    studentId,
                    req.user.school_id
                ]
            );

            if (result.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    message: "Élève introuvable."
                });

            }

            res.json({
                success: true,
                message: "Élève modifié avec succès.",
                student: result.rows[0]
            });

        } catch (error) {

            console.error("Erreur modification élève :", error);

            if (error.code === "23505") {

                return res.status(409).json({
                    success: false,
                    message: "Ce matricule existe déjà."
                });

            }

            res.status(500).json({
                success: false,
                message: "Impossible de modifier l'élève."
            });

        }

    }
);

/* =========================================================
   ÉLÈVES — SUPPRESSION
========================================================= */

app.delete(
    "/api/students/:id",
    authenticateToken,
    async (req, res) => {

        try {

            const studentId = Number(req.params.id);

            if (!Number.isInteger(studentId)) {

                return res.status(400).json({
                    success: false,
                    message: "Identifiant d'élève invalide."
                });

            }

            const result = await pool.query(
                `
                DELETE FROM students
                WHERE id = $1
                AND school_id = $2
                RETURNING id, first_name, last_name
                `,
                [studentId, req.user.school_id]
            );

            if (result.rows.length === 0) {

                return res.status(404).json({
                    success: false,
                    message: "Élève introuvable."
                });

            }

            res.json({
                success: true,
                message: "Élève supprimé avec succès.",
                student: result.rows[0]
            });

        } catch (error) {

            console.error("Erreur suppression élève :", error);

            if (error.code === "23503") {

                return res.status(409).json({
                    success: false,
                    message: "Impossible de supprimer : cet élève a des données liées (notes, présences, paiements)."
                });

            }

            res.status(500).json({
                success: false,
                message: "Impossible de supprimer l'élève."
            });

        }

    }
);

/* =========================================================
   PROFESSEURS
========================================================= */

app.get(
    "/api/teachers",
    authenticateToken,
    async (req, res) => {

        try {

            const result =
                await pool.query(
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
                teachers: result.rows
            });

        } catch (error) {

            console.error(
                "Erreur teachers :",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Impossible de charger les professeurs."
            });

        }

    }
);

/* =========================================================
   CLASSES
========================================================= */

app.get(
    "/api/classes",
    authenticateToken,
    async (req, res) => {

        try {

            const result =
                await pool.query(
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
                classes: result.rows
            });

        } catch (error) {

            console.error(
                "Erreur classes :",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Impossible de charger les classes."
            });

        }

    }
);

/* =========================================================
   MATIÈRES — LECTURE
========================================================= */

app.get(
    "/api/subjects",
    authenticateToken,
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT
                        id,
                        school_id,
                        name,
                        code,
                        coefficient,
                        description,
                        created_at
                    FROM subjects
                    WHERE school_id = $1
                    ORDER BY name ASC
                    `,
                    [req.user.school_id]
                );

            res.json({
                success: true,
                subjects: result.rows
            });

        } catch (error) {

            console.error(
                "Erreur subjects :",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Impossible de charger les matières."
            });

        }

    }
);

/* =========================================================
   MATIÈRES — AJOUT
========================================================= */

app.post(
    "/api/subjects",
    authenticateToken,
    async (req, res) => {

        try {

            const {
                name,
                code,
                coefficient,
                description
            } = req.body;

            if (
                !name ||
                !name.trim()
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Le nom de la matière est requis."
                });

            }

            const subjectName =
                name.trim();

            const subjectCode =
                code &&
                code.trim()
                    ? code.trim()
                    : null;

            const subjectDescription =
                description &&
                description.trim()
                    ? description.trim()
                    : null;

            const subjectCoefficient =
                Number(coefficient);

            if (
                !Number.isFinite(subjectCoefficient) ||
                subjectCoefficient <= 0
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Le coefficient doit être supérieur à 0."
                });

            }

            const result =
                await pool.query(
                    `
                    INSERT INTO subjects (
                        school_id,
                        name,
                        code,
                        coefficient,
                        description
                    )
                    VALUES (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5
                    )
                    RETURNING
                        id,
                        school_id,
                        name,
                        code,
                        coefficient,
                        description,
                        created_at
                    `,
                    [
                        req.user.school_id,
                        subjectName,
                        subjectCode,
                        subjectCoefficient,
                        subjectDescription
                    ]
                );

            res.status(201).json({
                success: true,
                message:
                    "Matière ajoutée avec succès.",
                subject: result.rows[0]
            });

        } catch (error) {

            console.error(
                "Erreur ajout matière :",
                error
            );

            if (
                error.code === "23505"
            ) {

                return res.status(409).json({
                    success: false,
                    message:
                        "Cette matière existe déjà dans votre école."
                });

            }

            res.status(500).json({
                success: false,
                message:
                    "Impossible d'ajouter la matière."
            });

        }

    }
);

/* =========================================================
   MATIÈRES — MODIFICATION
========================================================= */

app.put(
    "/api/subjects/:id",
    authenticateToken,
    async (req, res) => {

        try {

            const subjectId =
                Number(req.params.id);

            if (
                !Number.isInteger(subjectId)
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Identifiant de matière invalide."
                });

            }

            const {
                name,
                code,
                coefficient,
                description
            } = req.body;

            if (
                !name ||
                !name.trim()
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Le nom de la matière est requis."
                });

            }

            const subjectCoefficient =
                Number(coefficient);

            if (
                !Number.isFinite(subjectCoefficient) ||
                subjectCoefficient <= 0
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Le coefficient doit être supérieur à 0."
                });

            }

            const result =
                await pool.query(
                    `
                    UPDATE subjects
                    SET
                        name = $1,
                        code = $2,
                        coefficient = $3,
                        description = $4
                    WHERE id = $5
                    AND school_id = $6
                    RETURNING
                        id,
                        school_id,
                        name,
                        code,
                        coefficient,
                        description,
                        created_at
                    `,
                    [
                        name.trim(),

                        code &&
                        code.trim()
                            ? code.trim()
                            : null,

                        subjectCoefficient,

                        description &&
                        description.trim()
                            ? description.trim()
                            : null,

                        subjectId,

                        req.user.school_id
                    ]
                );

            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Matière introuvable."
                });

            }

            res.json({
                success: true,
                message:
                    "Matière modifiée avec succès.",
                subject:
                    result.rows[0]
            });

        } catch (error) {

            console.error(
                "Erreur modification matière :",
                error
            );

            if (
                error.code === "23505"
            ) {

                return res.status(409).json({
                    success: false,
                    message:
                        "Une matière avec ce nom existe déjà."
                });

            }

            res.status(500).json({
                success: false,
                message:
                    "Impossible de modifier la matière."
            });

        }

    }
);

/* =========================================================
   MATIÈRES — SUPPRESSION
========================================================= */

app.delete(
    "/api/subjects/:id",
    authenticateToken,
    async (req, res) => {

        try {

            const subjectId =
                Number(req.params.id);

            if (
                !Number.isInteger(subjectId)
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Identifiant de matière invalide."
                });

            }

            const usage =
                await pool.query(
                    `
                    SELECT

                        (
                            SELECT COUNT(*)
                            FROM grades
                            WHERE subject_id = $1
                            AND school_id = $2
                        ) AS grades_count,

                        (
                            SELECT COUNT(*)
                            FROM timetables
                            WHERE subject_id = $1
                            AND school_id = $2
                        ) AS timetable_count
                    `,
                    [
                        subjectId,
                        req.user.school_id
                    ]
                );

            const gradesCount =
                Number(
                    usage.rows[0].grades_count
                );

            const timetableCount =
                Number(
                    usage.rows[0].timetable_count
                );

            if (
                gradesCount > 0 ||
                timetableCount > 0
            ) {

                return res.status(409).json({
                    success: false,
                    message:
                        "Cette matière est déjà utilisée. " +
                        "Modifiez son coefficient au lieu de la supprimer."
                });

            }

            const result =
                await pool.query(
                    `
                    DELETE FROM subjects
                    WHERE id = $1
                    AND school_id = $2
                    RETURNING
                        id,
                        name
                    `,
                    [
                        subjectId,
                        req.user.school_id
                    ]
                );

            if (
                result.rows.length === 0
            ) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Matière introuvable."
                });

            }

            res.json({
                success: true,
                message:
                    "Matière supprimée avec succès.",
                subject:
                    result.rows[0]
            });

        } catch (error) {

            console.error(
                "Erreur suppression matière :",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Impossible de supprimer la matière."
            });

        }

    }
);

/* =========================================================
   PRÉSENCE DES PROFESSEURS AUJOURD'HUI
========================================================= */

app.get(
    "/api/teacher-attendance/today",
    authenticateToken,
    async (req, res) => {

        try {

            const result =
                await pool.query(
                    `
                    SELECT *
                    FROM teacher_attendance
                    WHERE school_id = $1
                    AND attendance_date = CURRENT_DATE
                    ORDER BY check_in ASC NULLS LAST
                    `,
                    [req.user.school_id]
                );

            res.json({
                success: true,
                attendance:
                    result.rows
            });

        } catch (error) {

            console.error(
                "Erreur teacher attendance :",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Impossible de charger les présences."
            });

        }

    }
);

/* =========================================================
   NOTES — LECTURE
========================================================= */

app.get(
    "/api/grades",
    authenticateToken,
    async (req, res) => {

        try {

            const {
                class_id,
                subject_id,
                period
            } = req.query;

            if (
                !class_id ||
                !subject_id ||
                !period
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "class_id, subject_id et period sont requis."
                });

            }

            const schoolId =
                req.user.school_id;

            const classCheck =
                await pool.query(
                    `
                    SELECT id
                    FROM classes
                    WHERE id = $1
                    AND school_id = $2
                    LIMIT 1
                    `,
                    [
                        class_id,
                        schoolId
                    ]
                );

            if (
                classCheck.rows.length === 0
            ) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Classe introuvable."
                });

            }

            const subjectCheck =
                await pool.query(
                    `
                    SELECT id
                    FROM subjects
                    WHERE id = $1
                    AND school_id = $2
                    LIMIT 1
                    `,
                    [
                        subject_id,
                        schoolId
                    ]
                );

            if (
                subjectCheck.rows.length === 0
            ) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Matière introuvable."
                });

            }

            const result =
                await pool.query(
                    `
                    SELECT
                        id,
                        student_id,
                        subject_id,
                        class_id,
                        period,
                        grade,
                        max_grade
                    FROM grades
                    WHERE school_id = $1
                    AND class_id = $2
                    AND subject_id = $3
                    AND period = $4
                    ORDER BY created_at ASC
                    `,
                    [
                        schoolId,
                        class_id,
                        subject_id,
                        period
                    ]
                );

            res.json({
                success: true,
                grades:
                    result.rows
            });

        } catch (error) {

            console.error(
                "Erreur lecture notes :",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Impossible de charger les notes."
            });

        }

    }
);

/* =========================================================
   NOTES — ENREGISTREMENT
========================================================= */

app.post(
    "/api/grades",
    authenticateToken,
    async (req, res) => {

        const client =
            await pool.connect();

        try {

            const {
                class_id,
                subject_id,
                period,
                max_grade,
                grades
            } = req.body;

            if (
                !class_id ||
                !subject_id ||
                !period ||
                !Array.isArray(grades)
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "Données de notes incomplètes."
                });

            }

            const maxGrade =
                Number(max_grade);

            if (
                !Number.isFinite(maxGrade) ||
                maxGrade <= 0 ||
                maxGrade > 400
            ) {

                return res.status(400).json({
                    success: false,
                    message:
                        "La note maximale doit être comprise entre 1 et 400."
                });

            }

            const schoolId =
                req.user.school_id;

            const classCheck =
                await pool.query(
                    `
                    SELECT id
                    FROM classes
                    WHERE id = $1
                    AND school_id = $2
                    LIMIT 1
                    `,
                    [
                        class_id,
                        schoolId
                    ]
                );

            if (
                classCheck.rows.length === 0
            ) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Classe introuvable."
                });

            }

            const subjectCheck =
                await pool.query(
                    `
                    SELECT id
                    FROM subjects
                    WHERE id = $1
                    AND school_id = $2
                    LIMIT 1
                    `,
                    [
                        subject_id,
                        schoolId
                    ]
                );

            if (
                subjectCheck.rows.length === 0
            ) {

                return res.status(404).json({
                    success: false,
                    message:
                        "Matière introuvable."
                });

            }

            await client.query("BEGIN");

            for (
                const item of grades
            ) {

                if (
                    !item.student_id
                ) {
                    continue;
                }

                const studentCheck =
                    await client.query(
                        `
                        SELECT id
                        FROM students
                        WHERE id = $1
                        AND school_id = $2
                        AND class_id = $3
                        LIMIT 1
                        `,
                        [
                            item.student_id,
                            schoolId,
                            class_id
                        ]
                    );

                if (
                    studentCheck.rows.length === 0
                ) {
                    continue;
                }

                const rawGrade =
                    item.grade;

                if (
                    rawGrade === "" ||
                    rawGrade === null ||
                    typeof rawGrade === "undefined"
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
                            schoolId,
                            item.student_id,
                            subject_id,
                            class_id,
                            period
                        ]
                    );

                    continue;
                }

                const grade =
                    Number(rawGrade);

                if (
                    !Number.isFinite(grade) ||
                    grade < 0 ||
                    grade > maxGrade
                ) {

                    throw new Error(
                        `Note invalide pour l'élève ${item.student_id}.`
                    );

                }

                await client.query(
                    `
                    INSERT INTO grades (
                        school_id,
                        student_id,
                        subject_id,
                        class_id,
                        period,
                        grade,
                        max_grade
                    )
                    VALUES (
                        $1,
                        $2,
                        $3,
                        $4,
                        $5,
                        $6,
                        $7
                    )
                    ON CONFLICT (
                        school_id,
                        student_id,
                        subject_id,
                        class_id,
                        period
                    )
                    DO UPDATE SET
                        grade = EXCLUDED.grade,
                        max_grade = EXCLUDED.max_grade,
                        updated_at = NOW()
                    `,
                    [
                        schoolId,
                        item.student_id,
                        subject_id,
                        class_id,
                        period,
                        grade,
                        maxGrade
                    ]
                );

            }

            await client.query("COMMIT");

            res.json({
                success: true,
                message:
                    "Notes enregistrées avec succès."
            });

        } catch (error) {

            await client.query(
                "ROLLBACK"
            );

            console.error(
                "Erreur enregistrement notes :",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    error.message ||
                    "Impossible d'enregistrer les notes."
            });

        } finally {

            client.release();

        }

    }
);

/* =========================================================
   TEST SERVEUR
========================================================= */

app.get(
    "/api/health",
    async (req, res) => {

        try {

            await pool.query(
                "SELECT 1"
            );

            res.json({
                success: true,
                message:
                    "Serveur et base de données fonctionnels."
            });

        } catch (error) {

            console.error(
                "Erreur health :",
                error
            );

            res.status(500).json({
                success: false,
                message:
                    "Base de données inaccessible."
            });

        }

    }
);

/* =========================================================
   ROUTES API INCONNUES
========================================================= */

app.use(
    "/api",
    (req, res) => {

        res.status(404).json({
            success: false,
            message:
                "Route API introuvable."
        });

    }
);

/* =========================================================
   ERREUR GÉNÉRALE
========================================================= */

app.use(
    (err, req, res, next) => {

        console.error(
            "Erreur serveur :",
            err
        );

        res.status(500).json({
            success: false,
            message:
                "Erreur interne du serveur."
        });

    }
);

/* =========================================================
   DÉMARRAGE
========================================================= */

app.listen(
    PORT,
    () => {

        console.log(
            `Serveur Gestion École démarré sur le port ${PORT}`
        );

    }
);
