-- =========================================================
-- PLATEFORME DE GESTION SCOLAIRE
-- DATABASE SCHEMA V1
-- =========================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =========================================================
-- ECOLES
-- =========================================================

CREATE TABLE IF NOT EXISTS schools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    name VARCHAR(200) NOT NULL,
    code VARCHAR(50) UNIQUE,
    email VARCHAR(150),
    phone VARCHAR(50),
    address TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- UTILISATEURS
-- =========================================================

CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    school_id UUID REFERENCES schools(id) ON DELETE CASCADE,

    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,

    email VARCHAR(150) NOT NULL,
    password_hash TEXT NOT NULL,

    role VARCHAR(30) NOT NULL DEFAULT 'admin',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(school_id, email)
);

-- =========================================================
-- CLASSES
-- =========================================================

CREATE TABLE IF NOT EXISTS classes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    school_id UUID NOT NULL
        REFERENCES schools(id)
        ON DELETE CASCADE,

    name VARCHAR(100) NOT NULL,
    level VARCHAR(100),
    section VARCHAR(50),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(school_id, name, section)
);

-- =========================================================
-- ELEVES
-- =========================================================

CREATE TABLE IF NOT EXISTS students (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    school_id UUID NOT NULL
        REFERENCES schools(id)
        ON DELETE CASCADE,

    class_id UUID
        REFERENCES classes(id)
        ON DELETE SET NULL,

    student_number VARCHAR(100) NOT NULL,

    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,

    date_of_birth DATE,
    gender VARCHAR(20),

    phone VARCHAR(50),
    address TEXT,

    parent_name VARCHAR(200),
    parent_phone VARCHAR(50),

    photo_url TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(school_id, student_number)
);

-- =========================================================
-- PROFESSEURS
-- =========================================================

CREATE TABLE IF NOT EXISTS teachers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    school_id UUID NOT NULL
        REFERENCES schools(id)
        ON DELETE CASCADE,

    teacher_number VARCHAR(100) NOT NULL,

    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,

    email VARCHAR(150),
    phone VARCHAR(50),

    specialization VARCHAR(200),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(school_id, teacher_number)
);

-- =========================================================
-- MATIERES
-- =========================================================

CREATE TABLE IF NOT EXISTS subjects (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    school_id UUID NOT NULL
        REFERENCES schools(id)
        ON DELETE CASCADE,

    name VARCHAR(150) NOT NULL,
    code VARCHAR(50),

    coefficient NUMERIC(5,2) DEFAULT 1,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(school_id, name)
);

-- =========================================================
-- PRESENCE DES PROFESSEURS
-- =========================================================

CREATE TABLE IF NOT EXISTS teacher_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    school_id UUID NOT NULL
        REFERENCES schools(id)
        ON DELETE CASCADE,

    teacher_id UUID NOT NULL
        REFERENCES teachers(id)
        ON DELETE CASCADE,

    attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,

    arrival_time TIME,
    departure_time TIME,

    status VARCHAR(30) NOT NULL DEFAULT 'present',

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(teacher_id, attendance_date)
);

-- =========================================================
-- PRESENCE DES ELEVES
-- =========================================================

CREATE TABLE IF NOT EXISTS student_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    school_id UUID NOT NULL
        REFERENCES schools(id)
        ON DELETE CASCADE,

    student_id UUID NOT NULL
        REFERENCES students(id)
        ON DELETE CASCADE,

    attendance_date DATE NOT NULL DEFAULT CURRENT_DATE,

    status VARCHAR(30) NOT NULL DEFAULT 'present',

    note TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

    UNIQUE(student_id, attendance_date)
);

-- =========================================================
-- NOTES
-- =========================================================

CREATE TABLE IF NOT EXISTS grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    school_id UUID NOT NULL
        REFERENCES schools(id)
        ON DELETE CASCADE,

    student_id UUID NOT NULL
        REFERENCES students(id)
        ON DELETE CASCADE,

    subject_id UUID NOT NULL
        REFERENCES subjects(id)
        ON DELETE CASCADE,

    teacher_id UUID
        REFERENCES teachers(id)
        ON DELETE SET NULL,

    grade NUMERIC(6,2) NOT NULL,
    max_grade NUMERIC(6,2) NOT NULL DEFAULT 100,

    assessment_type VARCHAR(50),

    period VARCHAR(50),

    comment TEXT,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- PAIEMENTS
-- =========================================================

CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    school_id UUID NOT NULL
        REFERENCES schools(id)
        ON DELETE CASCADE,

    student_id UUID NOT NULL
        REFERENCES students(id)
        ON DELETE CASCADE,

    amount NUMERIC(12,2) NOT NULL,

    payment_method VARCHAR(50),

    reference VARCHAR(100),

    description TEXT,

    payment_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- EMPLOI DU TEMPS
-- =========================================================

CREATE TABLE IF NOT EXISTS timetables (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    school_id UUID NOT NULL
        REFERENCES schools(id)
        ON DELETE CASCADE,

    class_id UUID NOT NULL
        REFERENCES classes(id)
        ON DELETE CASCADE,

    subject_id UUID NOT NULL
        REFERENCES subjects(id)
        ON DELETE CASCADE,

    teacher_id UUID
        REFERENCES teachers(id)
        ON DELETE SET NULL,

    day_of_week INTEGER NOT NULL,

    start_time TIME NOT NULL,
    end_time TIME NOT NULL,

    room VARCHAR(100),

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- ANNONCES
-- =========================================================

CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    school_id UUID NOT NULL
        REFERENCES schools(id)
        ON DELETE CASCADE,

    title VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,

    created_by UUID
        REFERENCES users(id)
        ON DELETE SET NULL,

    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- =========================================================
-- INDEX
-- =========================================================

CREATE INDEX IF NOT EXISTS idx_students_school
ON students(school_id);

CREATE INDEX IF NOT EXISTS idx_students_class
ON students(class_id);

CREATE INDEX IF NOT EXISTS idx_teachers_school
ON teachers(school_id);

CREATE INDEX IF NOT EXISTS idx_classes_school
ON classes(school_id);

CREATE INDEX IF NOT EXISTS idx_subjects_school
ON subjects(school_id);

CREATE INDEX IF NOT EXISTS idx_grades_student
ON grades(student_id);

CREATE INDEX IF NOT EXISTS idx_attendance_teacher_date
ON teacher_attendance(teacher_id, attendance_date);

CREATE INDEX IF NOT EXISTS idx_attendance_student_date
ON student_attendance(student_id, attendance_date);
