# Gestion d'École

**Gestion d'École** est une application web de gestion scolaire conçue pour centraliser et simplifier l'administration d'un établissement scolaire.

L'application permet de gérer les élèves, les professeurs, les classes, les matières, les présences, les notes, les bulletins, les emplois du temps, les paiements et les annonces depuis une interface d'administration.

---

## Fonctionnalités

### Gestion des élèves

* Ajouter un élève
* Modifier les informations d'un élève
* Supprimer un élève
* Affecter un élève à une classe
* Consulter la liste des élèves
* Filtrer les élèves par classe

### Gestion des professeurs

* Ajouter un professeur
* Modifier les informations d'un professeur
* Supprimer un professeur
* Consulter la liste des professeurs
* Gérer les informations liées aux enseignants

### Gestion des classes

* Créer une classe
* Modifier une classe
* Supprimer une classe
* Consulter les élèves d'une classe
* Afficher le niveau, la section et le nombre d'élèves

### Gestion des matières

* Ajouter des matières
* Modifier les matières
* Supprimer des matières
* Associer les matières aux classes

### Gestion des notes

* Enregistrer les notes des élèves
* Modifier les notes
* Consulter les résultats
* Calculer les résultats selon les évaluations
* Gestion des notes avec une valeur maximale de **400**

### Gestion des présences

* Enregistrer les présences des élèves
* Suivre les absences
* Suivre les retards
* Gestion de la présence des professeurs

### Bulletins scolaires

* Consulter les résultats scolaires
* Générer les informations nécessaires aux bulletins
* Centraliser les notes et résultats des élèves

### Emploi du temps

* Gestion des horaires
* Organisation des cours
* Association des cours avec les classes, matières et professeurs

### Paiements

* Enregistrement des paiements scolaires
* Suivi des paiements
* Consultation de l'historique

### Annonces

* Publier des annonces
* Consulter les informations importantes destinées à l'établissement

### Tableau de bord

Le tableau de bord permet d'avoir une vue générale de l'établissement :

* Nombre d'élèves
* Nombre de professeurs
* Nombre de classes
* Nombre de matières
* Professeurs présents
* Professeurs en retard

---

## Technologies utilisées

### Frontend

* HTML5
* CSS3
* JavaScript
* Interface web responsive

### Backend

* Node.js
* Express.js
* API REST

### Base de données

* PostgreSQL
* Supabase

### Authentification

* JSON Web Token (JWT)
* Isolation des données par établissement scolaire

### Hébergement

* Application déployable sur des plateformes compatibles Node.js
* Base de données PostgreSQL hébergée avec Supabase

---

## Architecture du projet

```text
gestion-d-ecole/
│
├── public/
│   ├── index.html
│   ├── admin.html
│   ├── eleves.html
│   ├── professeurs.html
│   ├── classes.html
│   ├── matieres.html
│   ├── presence.html
│   ├── notes.html
│   ├── bulletins.html
│   ├── emploi-du-temps.html
│   ├── paiements.html
│   └── ...
│
├── modules/
│   ├── auth.js
│   ├── dashboard.js
│   ├── eleves.js
│   ├── professeurs.js
│   ├── classes.js
│   ├── matieres.js
│   ├── notes.js
│   ├── bulletins.js
│   ├── emploi-du-temps.js
│   ├── paiements.js
│   ├── annonces.js
│   ├── teacher_attendance.js
│   └── student-attendance.js
│
├── server.js
├── package.json
├── package-lock.json
└── README.md
```

---

## Installation

### 1. Cloner le projet

```bash
git clone https://github.com/Fawenships/gestion-d-ecole.git
```

### 2. Entrer dans le dossier

```bash
cd gestion-d-ecole
```

### 3. Installer les dépendances

```bash
npm install
```

### 4. Configurer les variables d'environnement

Créer un fichier `.env` :

```env
DATABASE_URL=postgresql://USER:PASSWORD@HOST:PORT/DATABASE
JWT_SECRET=your_secret_key
PORT=3000
```

### 5. Démarrer l'application

```bash
npm start
```

L'application sera accessible à :

```text
http://localhost:3000
```

---

## Base de données

Le projet utilise **PostgreSQL** pour stocker les données de l'établissement.

La connexion à la base de données est configurée avec la variable :

```env
DATABASE_URL
```

La base de données peut être hébergée avec Supabase ou tout autre service PostgreSQL compatible.

---

## Sécurité

L'application utilise plusieurs mécanismes pour protéger les données :

* Authentification avec JWT
* Mot de passe et informations d'accès protégés
* Variable `JWT_SECRET` pour sécuriser les tokens
* Séparation des données par établissement scolaire
* Vérification du `school_id` lors des opérations
* API protégées par authentification

Chaque établissement ne doit pouvoir accéder qu'à ses propres données.

---

## API

Le serveur expose une API REST permettant au frontend de communiquer avec la base de données.

Exemple :

```text
GET    /api/health
GET    /api/students
POST   /api/students
PUT    /api/students/:id
DELETE /api/students/:id
```

D'autres endpoints sont disponibles pour les professeurs, classes, matières, notes, présences, paiements, bulletins et annonces.

### Vérification du serveur

L'endpoint :

```text
/api/health
```

permet de vérifier que le serveur et la base de données fonctionnent correctement.

---

## Déploiement

Le projet peut être déployé sur une plateforme compatible avec Node.js.

Lors du déploiement, les variables suivantes doivent être configurées :

```env
DATABASE_URL=...
JWT_SECRET=...
PORT=...
```

Il est recommandé de ne jamais placer les informations de connexion à la base de données ou le secret JWT directement dans le code source.

---

## Objectif du projet

L'objectif de **Gestion d'École** est de fournir aux établissements scolaires une solution moderne permettant de réduire la gestion manuelle et de centraliser les principales opérations administratives et pédagogiques.

Le système est conçu pour pouvoir évoluer progressivement avec l'ajout de nouvelles fonctionnalités.

---

## État du projet

**Projet en développement actif.**

Les différents modules sont développés progressivement afin de préserver la stabilité de l'application et d'éviter les modifications inutiles des fonctionnalités existantes.

---

## Auteur

**Ing. Fawenbert Régis**
Développeur & créateur de Gestion d'École

Projet développé en Haïti.

---

## Licence

Ce projet est actuellement un projet privé/personnel.

Toute utilisation, modification ou redistribution du code doit être autorisée par l'auteur.
