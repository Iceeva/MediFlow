# MediFlow - Healthcare Management SaaS

Plateforme SaaS **multi-établissements** de gestion médicale : patients, médecins, personnel, rendez-vous, consultations, prescriptions, documents, facturation, paiements, notifications et statistiques, depuis une seule interface.

Le projet est un **monolithe Next.js serverless** (frontend + API dans la même application), déployable sur **Vercel**, avec **PostgreSQL + Prisma**. Il n'utilise **ni Redis, ni file de messages, ni serveur backend permanent, ni stockage local persistant**.

> **Lisez d'abord la section [État du projet et limites connues](#état-du-projet-et-limites-connues).** Ce code a été généré dans un environnement sans accès réseau : les dépendances n'ont pas pu être installées, donc la compilation et les tests n'ont **pas** été exécutés. La procédure pour le valider en 5 minutes y est décrite.

---

## Sommaire

1. [Project Overview (Vue d'ensemble)](#1-project-overview-vue-densemble)
2. [Features (Fonctionnalités)](#2-features-fonctionnalités)
3. [Architecture](#3-architecture)
4. [Tech Stack](#4-tech-stack)
5. [Database Schema (Schéma de base de données)](#5-database-schema-schéma-de-base-de-données)
6. [API Documentation](#6-api-documentation)
7. [Authentication (Authentification)](#7-authentication-authentification)
8. [Security (Sécurité)](#8-security-sécurité)
9. [Multi-tenancy](#9-multi-tenancy)
10. [Roles and permissions (Rôles et permissions)](#10-roles-and-permissions-rôles-et-permissions)
11. [Installation](#11-installation)
12. [Environment Variables (Variables d'environnement)](#12-environment-variables-variables-denvironnement)
13. [Development (Développement)](#13-development-développement)
14. [Testing (Tests)](#14-testing-tests)
15. [Docker](#15-docker)
16. [Deployment (Déploiement Vercel)](#16-deployment-déploiement-vercel)
17. [Screenshots](#17-screenshots)
18. [Future Improvements (Évolutions)](#18-future-improvements-évolutions)
- [État du projet et limites connues](#état-du-projet-et-limites-connues)
- [Structure du projet](#structure-du-projet)
- [Historique Git et phases de développement](#historique-git-et-phases-de-développement)

---

## 1. Project Overview (Vue d'ensemble)

MediFlow permet à un **établissement de santé (tenant)** de gérer toute son activité :

```text
                    ┌─────────────────────┐
                    │       PATIENT       │
                    └──────────┬──────────┘
                               │
                               ▼
┌─────────────┐       ┌─────────────────────┐       ┌─────────────┐
│   DOCTOR    │──────▶│   MEDIFLOW SaaS     │◀──────│    ADMIN    │
└─────────────┘       └──────────┬──────────┘       └─────────────┘
                                 │
          ┌──────────────────────┼──────────────────────┐
          ▼                      ▼                      ▼
    Appointments             Medical                Billing
                             Records
          │                      │                      │
          ▼                      ▼                      ▼
       Calendar              Documents              Invoices
                                 │
                                 ▼
                           Prescriptions
```

Principes directeurs :

- **Vrai produit, pas une démo CRUD** : machine d'états des rendez-vous, anti double réservation transactionnel, paiements confirmés uniquement par webhook signé, journal d'audit, isolation stricte entre établissements.
- **Aucune donnée simulée** : tous les tableaux de bord proviennent de PostgreSQL via Prisma. Ce qui n'est pas implémenté est marqué `TODO` / `NOT IMPLEMENTED` (voir la liste plus bas) et n'a pas de faux bouton.
- **Security by design** : le tenant vient toujours de la session, jamais du client ; chaque requête Prisma est filtrée par tenant puis par rôle.

---

## 2. Features (Fonctionnalités)

| Domaine | Ce qui est implémenté |
|---|---|
| **Authentification** | Inscription (clinique ou patient), connexion, déconnexion, sessions en base (cookie HTTP-only), mot de passe oublié / réinitialisation, changement de mot de passe, vérification d'email, liste et révocation des sessions, déconnexion des autres appareils |
| **Établissements** | Création par le SUPER_ADMIN (avec invitation de l'administrateur), suspension, profil de la clinique, fuseau horaire |
| **Utilisateurs / personnel** | Invitation par email (l'administrateur ne connaît jamais le mot de passe), changement de rôle, désactivation (révoque les sessions) |
| **Patients** | Dossier complet, création, modification, archivage / restauration, suppression logique, recherche, filtres, pagination, tri, historique, export JSON contrôlé et audité, droits d'accès explicites médecin/infirmier |
| **Médecins** | Spécialisation, n° de licence, tarif, statut, disponibilités hebdomadaires, statistiques |
| **Rendez-vous** | Statuts `PENDING / CONFIRMED / CHECKED_IN / IN_PROGRESS / COMPLETED / CANCELLED / NO_SHOW`, machine d'états, contrôle des disponibilités, **anti double réservation** (transaction SERIALIZABLE avec nouvelle tentative), calendrier jour / semaine / mois |
| **Consultations** | Workflow Patient → Rendez-vous → Consultation, symptômes, diagnostic, observations, traitement, notes, suivi, constantes (tension, pouls, température, poids, taille, SpO2), historique chronologique |
| **Prescriptions** | Plusieurs médicaments par ordonnance, numéro unique par clinique, **PDF professionnel** avec zone de signature, notification du patient |
| **Médicaments** | Catalogue par clinique, recherche, filtres, arrêt (jamais de suppression) |
| **Documents médicaux** | Upload validé par signature binaire (PDF, PNG, JPEG, WebP), 4 Mo max, stockage privé via `StorageService` (Vercel Blob chiffré, S3 ou Cloudflare R2), **URLs signées temporaires**, contrôle d'accès serveur, journal des téléchargements |
| **Facturation** | Lignes, remise, taxe, totaux calculés **côté serveur en Decimal**, brouillon / émission / annulation, numérotation par clinique, **PDF** |
| **Paiements** | Abstraction `PaymentProvider`, adaptateur **Stripe**, enregistrement manuel (espèces, virement...), **clés d'idempotence**, **webhook signé idempotent**, verrouillage de la facture pendant le règlement |
| **Notifications** | Enregistrées en PostgreSQL, boîte de réception, compteur, emails via Resend (API HTTP), **rappels quotidiens via Vercel Cron** |
| **Tableaux de bord** | Administrateur, médecin, patient, comptable, plateforme (Recharts) |
| **Recherche globale** | Patients, médecins, rendez-vous, factures, documents, prescriptions (ILIKE PostgreSQL, mêmes périmètres que les listes) |
| **Audit** | Journal en ajout seul, consultation filtrable, aucune route de modification ou suppression |
| **Observabilité** | `/api/health`, logs JSON structurés avec masquage des données sensibles |
| **UX / accessibilité** | Responsive, police Atkinson Hyperlegible, focus visibles, navigation clavier, états loading / success / error / empty / unauthorized / forbidden / not found, confirmations pour les actions dangereuses |

---

## 3. Architecture

```text
                         INTERNET
                            │
                            ▼
                   ┌─────────────────┐
                   │     VERCEL      │
                   │                 │
                   │    Next.js      │
                   │                 │
                   │  ┌───────────┐  │
                   │  │ Frontend  │  │   React, App Router, Tailwind
                   │  └───────────┘  │
                   │        │        │
                   │        ▼        │
                   │  ┌───────────┐  │
                   │  │ API       │  │   Route Handlers /api/v1/*
                   │  │ Routes    │  │   (une fonction serverless par endpoint)
                   │  └─────┬─────┘  │
                   │        │        │
                   │      Prisma     │
                   └────────┼────────┘
                            │ connexion poolée
                            ▼
                    ┌───────────────┐
                    │  PostgreSQL   │   Neon / Supabase / Vercel Postgres
                    │ Managed DB    │
                    └───────────────┘
                            │
                            ▼
                    Object Storage          Vercel Blob / S3 / Cloudflare R2
                    (documents médicaux, privés)
```

### Couches du backend

```text
Route Handler (app/api/v1/**/route.ts)      mince : auth, permission, validation Zod, audit
        │
        ▼
lib/api.ts  route() / publicRoute()          session, RBAC, rate limit, same-origin, erreurs uniformes
        │
        ▼
services/*.service.ts                        logique métier, transactions, règles de rôle
        │
        ▼
services/scope.ts                            périmètres de lignes par rôle (tenant + rôle)
        │
        ▼
lib/prisma.ts  ──▶  PostgreSQL
```

Aucune logique métier dans les composants React. Les schémas Zod (`features/*/schemas.ts`) sont partagés entre client et serveur.

### Choix serverless (sans Redis)

| Besoin habituel | Solution retenue |
|---|---|
| Cache / rate limiting | Limiteur à fenêtre fixe dans PostgreSQL (un seul `INSERT ... ON CONFLICT` atomique) |
| File de tâches | Exécution directe dans la requête ; notifications = lignes en base |
| Tâches planifiées | Vercel Cron (`vercel.json`) appelant `/api/v1/notifications/cron` protégé par `CRON_SECRET` |
| Sessions | Table `Session` (jeton haché), pas de mémoire serveur |
| Connexions DB | Instance Prisma réutilisée + URL poolée (`DATABASE_URL`) et URL directe pour les migrations (`DIRECT_URL`) |
| Fichiers | Object storage, jamais le disque de Vercel |

---

## 4. Tech Stack

- **Next.js 15** (App Router, Route Handlers, Server Components), **React 19**, **TypeScript strict**
- **PostgreSQL** + **Prisma ORM** (seul ORM du projet), Prisma Migrate
- **Zod** (validation partagée), **React Hook Form** + `@hookform/resolvers`
- **Tailwind CSS**, composants de style shadcn (écrits à la main : button, form, modal, table...), **Lucide**, **Sonner**
- **TanStack Query**, **Recharts**, **FullCalendar**
- **bcryptjs** (JS pur, compatible serverless), **pdf-lib** (PDF sans binaire natif)
- **Stripe** (paiement), **Resend** (email, via `fetch`), **@vercel/blob** et **@aws-sdk/client-s3** (stockage)
- **Vitest** + Testing Library, **ESLint**, **GitHub Actions**, **Docker** (développement local uniquement)

---

## 5. Database Schema (Schéma de base de données)

Le schéma complet est dans [`prisma/schema.prisma`](prisma/schema.prisma) : UUID, relations, clés étrangères, index composites sur `tenantId`, contraintes d'unicité, enums, horodatages, suppression logique (`deletedAt`, `archivedAt`).

```mermaid
erDiagram
    Tenant ||--o{ Membership : has
    User ||--o{ Membership : "has role in"
    User ||--o{ Session : owns
    User ||--o| Doctor : "is"
    User ||--o| StaffProfile : "is"
    User ||--o| Patient : "is"
    Tenant ||--o{ Patient : owns
    Tenant ||--o{ Doctor : owns
    Doctor ||--o{ DoctorAvailability : "works"
    Patient ||--o{ PatientAccess : "granted to"
    Patient ||--o{ Appointment : books
    Doctor ||--o{ Appointment : attends
    Appointment ||--o| Consultation : "leads to"
    Consultation ||--o{ Vital : records
    Consultation ||--o{ Prescription : "may issue"
    Prescription ||--o{ PrescriptionItem : contains
    Medication ||--o{ PrescriptionItem : "referenced by"
    Patient ||--o{ MedicalDocument : has
    Patient ||--o{ Invoice : billed
    Invoice ||--o{ InvoiceItem : contains
    Invoice ||--o{ Payment : "settled by"
    User ||--o{ Notification : receives
    Tenant ||--o{ AuditLog : records
```

Modèles : `Tenant, User, Membership (rôle par établissement), Session, VerificationToken, RateLimit, SequenceCounter, Patient, PatientAccess, Doctor, DoctorAvailability, StaffProfile, Appointment, Consultation, Vital, Medication, Prescription, PrescriptionItem, MedicalDocument, Invoice, InvoiceItem, Payment, WebhookEvent, Notification, AuditLog`. Le « modèle `Role` » demandé est l'enum `Role`, porté par `Membership` : un utilisateur peut appartenir à plusieurs établissements avec un rôle différent dans chacun.

Détails, index et règles de relation : [`docs/DATABASE.md`](docs/DATABASE.md).

---

## 6. API Documentation

Toutes les routes sont sous `/api/v1`. Réponses : `{ "data": ..., "meta": ... }` ; erreurs : `{ "error": { "code", "message", "details?" } }` (400, 401, 403, 404, 409, 422, 429, 500, 501).

Aperçu (liste complète avec corps de requête et rôles : [`docs/API.md`](docs/API.md)) :

| Ressource | Endpoints |
|---|---|
| `auth` | `POST register, login, logout, password, forgot-password, reset-password, verify-email` - `GET me, sessions` - `DELETE sessions, sessions/[id]` |
| `users` | `GET, POST /users` - `PATCH /users/[id]` |
| `tenants` | `GET, POST /tenants` - `PATCH /tenants/[id]` |
| `patients` | `GET, POST /patients` - `GET, PATCH, DELETE /patients/[id]` - `POST, DELETE /patients/[id]/access` - `GET /patients/[id]/export` |
| `doctors` | `GET /doctors` - `GET, PATCH /doctors/[id]` - `PUT /doctors/[id]/availability` |
| `appointments` | `GET, POST /appointments` - `GET, PATCH /appointments/[id]` |
| `consultations` | `GET, POST /consultations` - `GET, PATCH /consultations/[id]` - `POST /vitals` |
| `prescriptions` | `GET, POST /prescriptions` - `GET /prescriptions/[id]` - `GET /prescriptions/[id]/pdf` |
| `medications` | `GET, POST /medications` - `PATCH, DELETE (arrêt) /medications/[id]` |
| `documents` | `GET, POST (multipart) /documents` - `GET, DELETE /documents/[id]` - `POST /documents/[id]/url` - `GET /documents/[id]/download?token=` |
| `invoices` | `GET, POST /invoices` - `GET, PATCH /invoices/[id]` - `GET /invoices/[id]/pdf` |
| `payments` | `GET, POST /payments` - `POST /payments/webhook?provider=stripe` |
| `notifications` | `GET, POST (tout lire) /notifications` - `PATCH /notifications/[id]` - `GET /notifications/cron` |
| `analytics` | `GET /analytics` (contenu selon le rôle) |
| `audit` | `GET /audit` (lecture seule) |
| `search` | `GET /search?q=` |
| `health` | `GET /api/health` |

Chaque endpoint gère : authentification, autorisation, validation Zod, isolation tenant, pagination (`page`, `pageSize` max 100), filtres, tri (liste blanche de colonnes), erreurs cohérentes et codes HTTP.

---

## 7. Authentication (Authentification)

- **Sessions en base** (`Session`) : un jeton aléatoire de 256 bits est envoyé dans un cookie ; seule une **empreinte HMAC** du jeton est stockée (une fuite de la base ne donne aucune session exploitable).
- Cookie `mf_session` : `HttpOnly`, `Secure` en production, `SameSite=Lax`, durée 7 jours avec expiration glissante.
- **Rotation** du jeton au changement de mot de passe ; **révocation** à la déconnexion, à la désactivation du compte, à la réinitialisation du mot de passe ; liste et révocation des sessions multiples.
- Mots de passe : **bcrypt** (12 tours), politique 10+ caractères avec majuscule, minuscule, chiffre. Jamais en clair, jamais loggés.
- Connexion : temps de réponse égalisé (comparaison bcrypt même si le compte n'existe pas), message d'erreur unique, limitation de débit par IP.
- Réinitialisation / vérification d'email : jetons à usage unique, hachés en base, durée limitée (1 h / 24 h). `forgot-password` répond toujours 200.
- **CSRF** : cookie `SameSite=Lax` + contrôle d'origine (`Origin` et `Sec-Fetch-Site`) sur toute requête modifiante.
- Un utilisateur peut avoir plusieurs établissements : `clinicSlug` à la connexion choisit le contexte.
- **2FA / TOTP : NOT IMPLEMENTED** (optionnel dans le cahier des charges, voir évolutions).

---

## 8. Security (Sécurité)

Appliqué dans le code :

- HTTPS forcé (HSTS), en-têtes de sécurité et CSP (`next.config.ts`), `X-Frame-Options: DENY`
- RBAC par permissions + périmètres de lignes par rôle, **refus journalisés**
- Isolation multi-tenant (section 9)
- Validation **Zod** serveur sur toutes les entrées, tri en liste blanche, requêtes Prisma paramétrées (pas de concaténation SQL ; les 5 requêtes brutes utilisent des paramètres liés)
- Protection XSS : React échappe par défaut, aucun `dangerouslySetInnerHTML`, CSP restrictive, emails échappés
- Uploads : signature binaire vérifiée (le type déclaré et l'extension ne suffisent pas), taille limitée, nom nettoyé, objets chiffrés AES-256-GCM pour Vercel Blob, bucket S3/R2 privé
- Téléchargement : lien signé HMAC lié au document **et** à l'utilisateur, 2 minutes, **plus** nouveau contrôle d'accès à l'usage, journalisé
- Rate limiting compatible serverless sur auth, uploads, exports, recherche, PDF, paiements
- Paiements : montant toujours recalculé côté serveur, statut confirmé **uniquement** par webhook signé, idempotence, rejet si le montant confirmé diffère
- Secrets uniquement en variables d'environnement, aucune clé dans le frontend
- **Aucune donnée médicale dans les logs** : le logger masque les champs sensibles
- Journal d'audit en ajout seul (aucune route de modification ou suppression)

> **Conformité réglementaire** : ce dépôt ne garantit **aucune conformité automatique** (HIPAA, RGPD / hébergement de données de santé, lois locales...). Elle dépend du pays, de l'hébergeur, des sous-traitants et des procédures de l'organisation. Faites auditer avant toute utilisation avec de vraies données.

Analyse détaillée et modèle de menaces : [`docs/SECURITY.md`](docs/SECURITY.md).

---

## 9. Multi-tenancy

Un **tenant = un établissement de santé**. Isolation par colonne `tenantId` appliquée à **quatre niveaux** :

1. **Route Handler** : `route()` charge la session ; `requireTenantId(auth)` lit le tenant **dans la session** (un `tenantId` envoyé par le frontend est ignoré).
2. **Services** : toute lecture / écriture reçoit `auth` et construit ses `where` à partir de `services/scope.ts`.
3. **Requêtes Prisma** : chaque fragment `where` contient `tenantId`, puis se restreint par rôle (patient = son dossier, médecin = ses patients, etc.). Un rôle sans droit reçoit un filtre impossible (échec fermé).
4. **Permissions** : `lib/permissions.ts` (matrice rôle → permissions).

Les identifiants inconnus ou d'un autre établissement renvoient **404** (jamais 403), pour ne pas révéler leur existence. Les clés d'idempotence de paiement sont préfixées par le tenant.

Seule exception documentée : un `SUPER_ADMIN` (sans tenant) peut nommer un établissement pour **créer son administrateur** (`POST /users`). Il ne peut appeler aucune route de données de tenant.

Pour aller plus loin en défense en profondeur, voir « Row Level Security PostgreSQL » dans les évolutions.

---

## 10. Roles and permissions (Rôles et permissions)

| Rôle | Peut |
|---|---|
| `SUPER_ADMIN` | gérer les établissements, créer leurs administrateurs, voir les statistiques globales |
| `CLINIC_ADMIN` | gérer médecins, personnel, patients, rendez-vous, médicaments, factures ; voir statistiques et audit ; accorder des accès aux dossiers. **Ne lit pas les consultations** (moindre privilège) |
| `DOCTOR` | ses rendez-vous, dossiers de ses patients (rendez-vous ou accès accordé), consultations, prescriptions, documents |
| `NURSE` | patients **avec accès accordé**, constantes, lecture des consultations et prescriptions de ces patients |
| `RECEPTIONIST` | enregistrer les patients (**données administratives seulement**), créer les rendez-vous |
| `ACCOUNTANT` | factures, paiements, finances ; **aucun accès clinique** |
| `PATIENT` | son profil, ses rendez-vous (prise et annulation), ses prescriptions, ses documents partagés, ses factures, paiement en ligne |

La matrice exacte est dans [`lib/permissions.ts`](lib/permissions.ts) et testée dans `tests/unit/permissions.test.ts`.

---

## 11. Installation

Prérequis : **Node.js 20+** (22 recommandé), **npm**, **PostgreSQL 14+** (ou Docker).

```bash
git clone <votre-depot> mediflow && cd mediflow
npm install                 # lance aussi `prisma generate`
cp .env.example .env        # puis renseignez DATABASE_URL, DIRECT_URL, AUTH_SECRET
```

### Étape indispensable : créer la migration initiale

Le schéma Prisma est fourni, mais le fichier SQL de la **migration initiale n'est pas pré-généré** (il se génère à partir de votre version de Prisma). Faites-le une fois et **commitez-le** :

```bash
npx prisma migrate dev --name init      # crée prisma/migrations/<date>_init/ et applique
git add prisma/migrations && git commit -m "feat(db): add initial migration"
```

`vercel.json` exécute `prisma migrate deploy` au build : **sans ce dossier committé, le déploiement ne créera aucune table.**

Optionnel, protection supplémentaire anti double réservation au niveau PostgreSQL : appliquer une fois [`prisma/sql/appointment_overlap.sql`](prisma/sql/appointment_overlap.sql).

### Données de démonstration (fictives)

```bash
npm run db:seed
```

Crée « Demo Clinic » (`demo-clinic`) et un compte par rôle, tous avec le mot de passe `ChangeMe!2026` :

| Rôle | Email |
|---|---|
| Super admin | `superadmin@mediflow.test` |
| Admin clinique | `admin@demo-clinic.test` |
| Médecin | `doctor@demo-clinic.test` |
| Infirmier | `nurse@demo-clinic.test` |
| Réceptionniste | `reception@demo-clinic.test` |
| Comptable | `accountant@demo-clinic.test` |
| Patient | `patient@demo-clinic.test` |

Ne jamais utiliser de vraies données médicales dans le seed ni en développement. Ne jamais exécuter le seed en production.

---

## 12. Environment Variables (Variables d'environnement)

Modèle : [`.env.example`](.env.example). Ne commitez jamais les valeurs réelles.

| Variable | Obligatoire | Description |
|---|---|---|
| `DATABASE_URL` | oui | URL PostgreSQL **poolée** (pgbouncer / pooler serverless) utilisée à l'exécution |
| `DIRECT_URL` | oui | URL PostgreSQL **directe**, utilisée par Prisma Migrate |
| `AUTH_SECRET` | oui | 32+ octets aléatoires (`openssl rand -base64 48`). Sert au hachage des sessions, aux liens signés et au chiffrement des blobs. **Le changer invalide les sessions et rend les anciens blobs illisibles** |
| `STORAGE_PROVIDER` | oui | `blob` ou `s3` |
| `BLOB_READ_WRITE_TOKEN` | si `blob` | jeton Vercel Blob |
| `S3_ENDPOINT`, `S3_REGION`, `S3_BUCKET`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY` | si `s3` | AWS S3 ou Cloudflare R2 (endpoint requis pour R2). Bucket **privé** |
| `EMAIL_API_KEY`, `EMAIL_FROM` | non | Resend. Sans clé, aucun email n'est envoyé (un avertissement est loggé) |
| `PAYMENT_SECRET_KEY`, `PAYMENT_WEBHOOK_SECRET` | pour payer en ligne | clé secrète Stripe et secret de signature du webhook |
| `CRON_SECRET` | pour les rappels | Vercel l'envoie en `Authorization: Bearer`. Sans lui la route cron est fermée |
| `NEXT_PUBLIC_APP_URL` | oui | URL publique (liens des emails, retours de paiement) |

`TEST_DATABASE_URL` (tests d'intégration) : voir section Tests.

---

## 13. Development (Développement)

```bash
npm run dev            # http://localhost:3000
npm run lint
npm run typecheck
npm test
npx prisma studio      # explorer la base
```

Commandes Prisma :

```bash
npx prisma generate
npx prisma migrate dev          # développement : crée et applique une migration
npx prisma migrate deploy       # production / CI : applique les migrations committées
npx prisma db seed
npx prisma validate
```

Conventions : TypeScript strict, composants sans logique métier, services indépendants, schémas Zod partagés, fichiers courts, messages de commit conventionnels (`feat(scope): ...`).

Ajouter une ressource : schéma Prisma, `features/<x>/schemas.ts`, `services/<x>.service.ts` (+ fragment dans `scope.ts`), `app/api/v1/<x>/route.ts` avec `route({ permission })`, permission dans `lib/permissions.ts`, test d'isolation.

Ajouter un fournisseur de paiement : implémenter `PaymentProvider` (`createCheckout`, `parseWebhook`), l'enregistrer dans `lib/payments/index.ts`, l'ajouter à `ONLINE_PROVIDERS`.

---

## 14. Testing (Tests)

```bash
npm test                                              # unitaires + composants
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/mediflow_test npm test   # + intégration
```

Les tests d'intégration sont **ignorés automatiquement** sans `TEST_DATABASE_URL` ; la base doit avoir le schéma appliqué (`DATABASE_URL=$TEST_DATABASE_URL npx prisma migrate deploy` ou `db push`). Ils créent leurs propres établissements et les suppriment ensuite. **N'utilisez jamais une base contenant des données réelles.**

| Fichier | Couvre |
|---|---|
| `tests/unit/permissions.test.ts` | matrice RBAC |
| `tests/unit/scope.test.ts` | périmètres tenant / rôle |
| `tests/unit/signed-url.test.ts` | liens signés (lié à l'utilisateur et au document, expiration, falsification) |
| `tests/unit/billing.test.ts` | calculs Decimal, statuts, unités monétaires |
| `tests/unit/upload-validation.test.ts` | signatures binaires, extensions, taille |
| `tests/unit/schemas-and-http.test.ts` | schémas, pagination, mapping des erreurs, fuseaux horaires |
| `tests/unit/pdf.test.ts` | génération PDF |
| `tests/components/ui.test.tsx` | états des composants (erreur, vide, pagination, accessibilité) |
| `tests/integration/isolation.test.ts` | **Tenant A n'accède pas à Tenant B**, **un patient n'accède pas au dossier / à la facture d'un autre**, **un médecin ne voit pas les ressources non autorisées**, **un utilisateur non autorisé ne lit pas un document**, **un comptable n'accède pas aux données médicales** |
| `tests/integration/booking-and-payments.test.ts` | double réservation (dont concurrence : 1 seul gagnant sur 5), idempotence des paiements, webhook rejoué sans effet, montant discordant refusé |

Pipeline CI : lint, typecheck, `prisma validate`, tests avec un PostgreSQL de service (voir section 15 et `.github/workflows`).

---

## 15. Docker

Docker sert **uniquement au développement local**. Services : `frontend` (Next.js avec l'API intégrée) et `postgres`. **Pas de Redis, pas de conteneur FastAPI.**

```bash
docker compose up
```

L'entrypoint attend PostgreSQL, applique les migrations (ou crée `init` au premier lancement, le dossier apparaît dans `./prisma/migrations` : commitez-le), injecte les données fictives puis lance `next dev` sur http://localhost:3000.

CI/CD (`.github/workflows`) :

```text
Push
 ↓
Lint            (lint.yml)
 ↓
Type Check      (lint.yml)
 ↓
Tests           (test.yml, PostgreSQL de service)
 ↓
Prisma validation (test.yml)
 ↓
Build           (deploy.yml, vercel build)
 ↓
Deploy          (deploy.yml, vercel deploy --prebuilt)
```

Secrets GitHub nécessaires pour le déploiement : `VERCEL_TOKEN`, `VERCEL_ORG_ID`, `VERCEL_PROJECT_ID`. Alternative plus simple : connecter le dépôt directement à Vercel (déploiement Git natif) et ne garder que `lint.yml` et `test.yml`.

---

## 16. Deployment (Déploiement Vercel)

Guide pas à pas : [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md). Résumé :

1. **PostgreSQL managé** (Neon, Supabase, Vercel Postgres...). Notez l'URL **poolée** (`DATABASE_URL`) et l'URL **directe** (`DIRECT_URL`).
2. **Créer et committer la migration initiale** (section 11).
3. **Stockage** : activer Vercel Blob (jeton `BLOB_READ_WRITE_TOKEN`) ou créer un bucket S3 / R2 privé.
4. Importer le dépôt dans Vercel (framework Next.js détecté), renseigner les variables d'environnement.
5. Premier déploiement : le build exécute `prisma generate && prisma migrate deploy && next build`.
6. **Stripe** : créer un endpoint webhook vers `https://<domaine>/api/v1/payments/webhook?provider=stripe` (événements `checkout.session.completed`, `checkout.session.expired`, `checkout.session.async_payment_succeeded`, `checkout.session.async_payment_failed`), copier le secret dans `PAYMENT_WEBHOOK_SECRET`.
7. **Cron** : défini dans `vercel.json` (tous les jours à 07:00 UTC). Définir `CRON_SECRET`.
8. Créer le premier établissement : soit via `/register` (« I run a clinic »), soit en créant manuellement un `SUPER_ADMIN` (`isSuperAdmin = true` en base) qui crée les cliniques depuis Réglages.
9. Vérifier `https://<domaine>/api/health`.

Contraintes Vercel prises en compte : pas de disque persistant, pas de connexion TCP persistante supposée, uploads limités à 4 Mo (corps de requête serverless), durée max des fonctions 30 s (60 s pour le cron).

---

## 17. Screenshots

Aucune capture n'est incluse : l'application n'a pas pu être lancée dans l'environnement de génération, et je ne fabrique pas de fausses images. Après `docker compose up`, ajoutez vos captures dans `docs/screenshots/` (voir le README de ce dossier pour la liste suggérée) et référencez-les ici :

```markdown
![Dashboard](docs/screenshots/dashboard.png)
```

---

## 18. Future Improvements (Évolutions)

- **2FA / TOTP** (NOT IMPLEMENTED)
- **Antivirus** sur les uploads (point d'extension prêt dans `lib/storage/validate.ts`, NOT IMPLEMENTED)
- **Mobile Money et paiement bancaire** : adaptateurs `PaymentProvider` (NOT IMPLEMENTED, le registre renvoie 501)
- **Remboursements** (statut `REFUNDED` prévu, flux non implémenté)
- **Row Level Security PostgreSQL** en plus du filtrage applicatif
- Uploads volumineux par URL présignée directe vers S3 / R2 (au-delà de 4 Mo)
- Rappels par SMS, rappel à plusieurs échéances (le cron est quotidien)
- Internationalisation (UI uniquement en anglais aujourd'hui)
- Ordonnances signées numériquement (aujourd'hui : zone de signature)
- Export PDF de dossier complet, téléconsultation, intégrations laboratoire / HL7 FHIR
- Suivi d'erreurs externe (Sentry) et métriques (les logs JSON et `/api/health` sont prêts)

---

## État du projet et limites connues

**À lire avant de s'en servir.**

1. **Non compilé, non testé ici.** Le code a été écrit sans accès réseau : `npm install` n'a pas pu être exécuté. Je n'ai donc pas lancé `tsc`, `next build`, ESLint ni Vitest. Je n'ai pas non plus vérifié mon propre code contre Prisma Client généré. Attendez-vous à **quelques erreurs de typage ou de lint à corriger** au premier passage (versions de bibliothèques, types Prisma, signatures de routes Next 15). La logique est cohérente, mais « livré testé » serait faux. Procédure :
   ```bash
   npm install
   npx prisma validate
   npx prisma migrate dev --name init
   npm run typecheck && npm run lint
   TEST_DATABASE_URL=... npm test
   npm run dev
   ```
2. **Migration initiale à générer** (section 11) : elle dépend de votre installation Prisma.
3. **Non implémenté** (marqué dans le code) : 2FA/TOTP, antivirus, Mobile Money / virement en ligne, remboursements.
4. **Édition de patient** : un champ vidé dans le formulaire n'est pas effacé (les chaînes vides sont ignorées par les schémas). Pour effacer, il faudrait accepter `null`.
5. **Vercel Blob** : les URL de blob sont publiques mais non devinables ; c'est pourquoi les fichiers y sont **chiffrés** (AES-256-GCM) et jamais servis directement. Pour un contrôle plus strict, préférez `STORAGE_PROVIDER=s3` avec un bucket privé.
6. **Seuil de taille d'upload** : 4 Mo (limite Vercel).
7. Fuseau horaire : la vérification des disponibilités utilise `Tenant.timezone` (UTC par défaut) ; configurez-le dans Réglages.

---

## Structure du projet

```text
mediflow/
├── app/
│   ├── (auth)/                login, register, forgot/reset password, verify email
│   ├── (app)/                 layout authentifié + pages
│   │   ├── dashboard/ patients/ doctors/ appointments/ consultations/
│   │   ├── prescriptions/ medications/ documents/ invoices/ payments/
│   │   └── notifications/ settings/ audit/
│   └── api/
│       ├── health/
│       └── v1/                auth users tenants patients doctors appointments consultations
│                              vitals prescriptions medications documents invoices payments
│                              notifications analytics audit search
├── components/                ui/ layout/ shared/ dashboard/ patients/ doctors/ appointments/ ...
├── features/                  schémas Zod partagés par domaine
├── hooks/                     useList, useOne, useApiMutation, usePermissions
├── lib/                       prisma, api (route wrapper), session, permissions, tenant,
│                              rate-limit, audit, security, billing, pdf, time, env, logger,
│                              storage/ (blob, s3, crypto, signed-url, validate), payments/ (stripe)
├── services/                  logique métier + scope.ts (périmètres de lignes)
├── prisma/                    schema.prisma, seed.ts, migrations/, sql/
├── tests/                     unit/ components/ integration/
├── docker/                    entrypoint de développement
├── docs/                      API, base de données, sécurité, déploiement
├── .github/workflows/         lint.yml test.yml deploy.yml
├── Dockerfile  docker-compose.yml  vercel.json  next.config.ts  middleware.ts
└── .env.example
```

---

## Historique Git et phases de développement

Le dépôt contient un historique de commits conventionnels, regroupés par phase :

| Phase | Contenu |
|---|---|
| 1 | Architecture, Next.js, Prisma, PostgreSQL, configuration Vercel |
| 2 | Authentification, utilisateurs, établissements, RBAC |
| 3 | Patients, médecins, personnel |
| 4 | Rendez-vous, calendrier |
| 5 | Consultations, dossier médical |
| 6 | Prescriptions, médicaments, PDF |
| 7 | Documents, stockage objet |
| 8 | Factures, paiements |
| 9 | Notifications, emails, cron |
| 10 | Tableaux de bord, analytics, recherche |
| 11 | Audit, durcissement sécurité |
| 12 | Tests |
| 13 | Docker, CI/CD |
| 14 | Documentation, déploiement Vercel |

```bash
git log --oneline --date=short
```
