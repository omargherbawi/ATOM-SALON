# Next.js Architecture Guide

> **Purpose:** Use this document as the single source of truth when building new features in this project, or when scaffolding a new system with the same architecture. Paste it into Cursor (or add it as a project rule) so the AI follows these conventions.

---

## 1. Overview

This is a **full-stack Next.js App Router** application with:

- **Frontend:** React 19, TypeScript, Tailwind CSS 4, client components for interactivity
- **Backend:** Next.js Route Handlers (`app/api/**/route.ts`) — no separate Express server for HTTP
- **Database:** MongoDB via Mongoose
- **Auth:** NextAuth.js (Credentials provider, JWT sessions)
- **i18n:** Client-side JSON translations (no URL locale prefix)
- **UI shell:** Reusable sidebar layout with role/department/permission-based navigation

### Core principles

1. **Colocation by feature** — pages, API routes, and models are grouped by domain (`patients`, `appointments`, `billing`, `derma`, etc.)
2. **Thin pages, fat API routes** — pages fetch/submit via `/api/*`; business logic lives in route handlers and `lib/`
3. **Always authenticate on the server** — never trust client-side session checks alone for mutations
4. **Department scoping** — many resources are filtered by `session.user.department` for multi-department clinics
5. **Staff permissions** — granular `permission.key` strings (e.g. `patients.view`) loaded from `StaffType`
6. **Minimal abstractions** — prefer direct Mongoose queries and inline helpers over heavy service layers

---

## 2. Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | Next.js 16 (App Router, Turbopack) |
| Language | TypeScript (strict) |
| UI | React 19, Tailwind CSS 4, Lucide icons |
| Auth | NextAuth.js 4, bcryptjs, `@auth/mongodb-adapter` |
| Database | MongoDB 6, Mongoose 9 |
| Tables | `@tanstack/react-table` |
| Toasts | `react-hot-toast` |
| i18n | Custom `useTranslations` hook + `messages/*.json` |
| Path alias | `@/*` → project root |

---

## 3. Directory Structure

```
project-root/
├── app/                          # Next.js App Router
│   ├── layout.tsx                # Root layout (fonts, Providers)
│   ├── providers.tsx             # SessionProvider, contexts, Toaster
│   ├── globals.css               # Tailwind + global overrides
│   ├── protected-route.tsx       # Client auth guard wrapper
│   ├── login/page.tsx            # Public login page
│   │
│   ├── page.tsx                  # Dashboard (staff)
│   ├── patients/                 # Feature pages
│   │   ├── page.tsx              # List
│   │   ├── new/page.tsx          # Create
│   │   └── [id]/
│   │       ├── page.tsx          # Detail
│   │       └── edit/page.tsx     # Edit
│   │
│   ├── derma/                    # Department module (scoped UI + APIs)
│   ├── patient-portal/           # Separate portal for patient role
│   │   └── layout.tsx            # Patient-only layout
│   │
│   ├── api/                      # Route Handlers (REST-ish)
│   │   ├── auth/[...nextauth]/route.ts
│   │   ├── patients/route.ts     # Collection: GET, POST
│   │   └── patients/[id]/route.ts # Resource: GET, PUT, DELETE
│   │
│   ├── components/               # Shared UI components
│   │   ├── sidebar-layout.tsx    # Main app shell
│   │   ├── DataTable.tsx
│   │   └── SearchablePatientSelect.tsx
│   │
│   ├── contexts/                 # React Context providers
│   │   ├── LanguageContext.tsx
│   │   └── SettingsContext.tsx
│   │
│   └── hooks/
│       └── useTranslations.ts
│
├── models/                       # Mongoose schemas (one file per entity)
│   ├── User.ts
│   ├── Patient.ts
│   └── Appointment.ts
│
├── lib/                          # Shared server/client utilities
│   ├── mongodb.ts                # Mongoose connection (cached)
│   ├── mongodb-adapter.ts        # Native driver for NextAuth adapter
│   ├── staff-permissions.ts      # Permission key registry
│   ├── require-admin-request.ts  # Admin JWT helper for route handlers
│   └── notifications/            # Email/SMS services
│
├── messages/                     # i18n JSON files
│   ├── en.json
│   ├── ar.json
│   ├── es.json
│   └── fr.json
│
├── types/                        # Global TypeScript augmentations
│   ├── next-auth.d.ts            # Extend Session/User/JWT
│   └── global.d.ts
│
├── public/uploads/               # User-uploaded files (served statically)
├── scripts/                      # Seed/migration scripts (tsx)
├── servers/                      # Optional TCP servers (HL7, ASTM) — separate process
├── middleware.ts                 # Next.js middleware (minimal in this project)
├── next.config.ts
├── tsconfig.json                 # paths: { "@/*": ["./*"] }
└── .env.example
```

---

## 4. Authentication & Authorization

### 4.1 NextAuth setup

- **Location:** `app/api/auth/[...nextauth]/route.ts`
- **Provider:** Credentials (email + password)
- **Session strategy:** JWT (not database sessions)
- **User sources:** `User` model (admin, doctor, staff, callcenter) and `Patient` model (patient role)
- **Password hashing:** bcrypt, cost factor 12
- **JWT/session callbacks** attach: `role`, `id`, `department`, `permissions`, `patientId`

### 4.2 Session shape (extended types)

```typescript
// types/next-auth.d.ts
interface Session {
  user: {
    id?: string;
    email?: string;
    name?: string;
    role?: string;           // admin | doctor | staff | patient | callcenter
    department?: string;     // ophthalmology | dermatology | undefined = super admin
    permissions?: string[];  // staff only, from StaffType
    patientId?: string;      // patient only
  };
}
```

### 4.3 Role hierarchy

| Role | Access |
|------|--------|
| `admin` (no department) | Super admin — all departments, all settings |
| `admin` (with department) | Department admin — scoped to one department |
| `doctor` | Own patients/appointments, department-scoped |
| `staff` | Permission-based (`lib/staff-permissions.ts`) |
| `callcenter` | Cross-department appointment booking |
| `patient` | Patient portal only (`/patient-portal/*`) |

### 4.4 Client-side protection

Wrap staff pages with `ProtectedRoute`:

```tsx
'use client';

import ProtectedRoute from '../protected-route';
import SidebarLayout from '../components/sidebar-layout';

export default function MyPage() {
  return (
    <ProtectedRoute>
      <SidebarLayout title="Page Title" description="Optional subtitle">
        {/* page content */}
      </SidebarLayout>
    </ProtectedRoute>
  );
}
```

- `ProtectedRoute` redirects unauthenticated users to `/login`
- Patients are redirected to `/patient-portal` if they hit staff routes
- Use `Suspense` when the page uses `useSearchParams()`

### 4.5 Server-side protection (API routes)

**Always** check session in route handlers:

```typescript
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);

  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const role = session.user.role || '';
  const canView =
    role === 'admin' ||
    role === 'doctor' ||
    (role === 'staff' && session.user.permissions?.includes('patients.view'));

  if (!canView) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  // ... handler logic
}
```

For admin-only checks in App Router (reliable JWT read):

```typescript
import { getAdminTokenFromRequest } from '@/lib/require-admin-request';

const token = await getAdminTokenFromRequest(request);
if (!token) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
```

### 4.6 Department scoping pattern

When querying data, filter by department for non–super-admin users:

```typescript
let query: Record<string, unknown> = {};

if (session.user.role === 'admin' || session.user.role === 'staff') {
  if (session.user.department) {
    query.department = session.user.department;
  }
  // Super admin (admin with no department): no filter
}

if (session.user.role === 'doctor') {
  query.doctorEmail = session.user.email;
  if (session.user.department) query.department = session.user.department;
}
```

---

## 5. API Route Conventions

### 5.1 File naming

| Pattern | HTTP methods | Example |
|---------|--------------|---------|
| `app/api/{resource}/route.ts` | GET (list), POST (create) | `/api/patients` |
| `app/api/{resource}/[id]/route.ts` | GET, PUT, DELETE | `/api/patients/abc123` |
| `app/api/{resource}/[id]/{action}/route.ts` | POST (sub-action) | `/api/inpatient/admissions/[id]/discharge` |

Department-specific APIs live under a prefix: `app/api/derma/appointments/route.ts` → `/api/derma/appointments`.

### 5.2 Standard route handler template

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '../auth/[...nextauth]/route';
import dbConnect from '@/lib/mongodb';
import MyModel from '@/models/MyModel';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    await dbConnect();

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    // ... query logic

    return NextResponse.json(results);
  } catch (error) {
    console.error('GET /api/my-resource error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.name) {
      return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    }

    await dbConnect();

    const doc = new MyModel(body);
    await doc.save();

    return NextResponse.json({ message: 'Created successfully', data: doc });
  } catch (error) {
    console.error('POST /api/my-resource error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
```

### 5.3 Dynamic route params (Next.js 15+)

Params are async — always await:

```typescript
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  // ...
}
```

### 5.4 Response conventions

| Status | When |
|--------|------|
| `200` | Success with JSON body |
| `400` | Validation error (missing/invalid fields) |
| `401` | Not authenticated |
| `403` | Authenticated but not allowed |
| `404` | Resource not found |
| `500` | Unhandled server error |

- Never return passwords or sensitive fields — use `.select('-password')` or delete before responding
- Use `{ error: 'Human-readable message' }` for failures
- Use `{ message: '...', data: ... }` for successful mutations when helpful

### 5.5 File uploads

- Accept `FormData` via `request.formData()`
- Save to `public/uploads/{category}/`
- Store metadata in MongoDB (URL, mimeType, uploadedBy)
- Set `export const dynamic = 'force-dynamic'` on upload routes
- Enforce max file size and role checks

---

## 6. Mongoose Model Conventions

### 6.1 Model file template

```typescript
// models/MyEntity.ts
import mongoose from 'mongoose';

export interface IMyEntity {
  _id: string;
  name: string;
  department?: 'ophthalmology' | 'dermatology';
  createdAt: Date;
  updatedAt: Date;
}

const myEntitySchema = new mongoose.Schema<IMyEntity>(
  {
    name: { type: String, required: true, trim: true },
    department: { type: String, enum: ['ophthalmology', 'dermatology'] },
  },
  { timestamps: true }
);

myEntitySchema.index({ department: 1 });

// Prevent model re-registration during HMR
export default mongoose.models.MyEntity ||
  mongoose.model<IMyEntity>('MyEntity', myEntitySchema);
```

### 6.2 Rules

- Export a TypeScript interface (`IEntity`) alongside the schema
- Use `timestamps: true` for `createdAt` / `updatedAt`
- Add indexes for frequently queried fields (`role`, `department`, foreign keys)
- Always use the HMR-safe export pattern (`mongoose.models.X || mongoose.model(...)`)
- Enum values in schema should match TypeScript union types
- Password fields: optional on schema, never returned in API responses

### 6.3 Database connection

Always call `await dbConnect()` at the start of each route handler (cached singleton in `lib/mongodb.ts`).

Two MongoDB clients exist intentionally:
- `lib/mongodb.ts` — Mongoose (application data)
- `lib/mongodb-adapter.ts` — Native driver (NextAuth adapter only)

---

## 7. Page & UI Conventions

### 7.1 Page structure

Every staff page follows this pattern:

```
'use client'                          ← pages are client components
  ProtectedRoute                      ← auth guard
    SidebarLayout (title, description) ← shell
      ... content ...
```

Forms pages additionally:
- Local `useState` for form data, `saving`, `error`
- `fetch('/api/...')` for load/submit
- `react-hot-toast` for success/error feedback
- `useRouter().push(...)` redirect after create
- `useTranslations()` for all user-visible strings

### 7.2 SidebarLayout

- **File:** `app/components/sidebar-layout.tsx`
- Props: `title`, `description?`, `fullWidth?`
- Navigation items declare: `roles`, `departments?`, `excludeDepartments?`, `superAdminOnly?`, `staffPermission?`
- When adding a new module, register its nav item in the `navigation` array inside `sidebar-layout.tsx`

### 7.3 Reusable components

| Component | Use for |
|-----------|---------|
| `DataTable` | Sortable/paginated lists (`@tanstack/react-table`) |
| `SearchablePatientSelect` | Patient picker with search |
| `SearchableDoctorSelect` | Doctor picker with search |
| `SearchableCountrySelect` / `SearchableCitySelect` | Location pickers |
| `LanguageSwitcher` | i18n toggle |

Place new shared components in `app/components/`.

### 7.4 Styling rules

- **Tailwind CSS 4** — utility classes only, no CSS modules
- Background: `bg-gray-50` for app shell
- Cards: `bg-white rounded-xl border border-gray-200 shadow-sm`
- Primary actions: `bg-blue-600 hover:bg-blue-700 text-white`
- Status badges: colored pill classes (`bg-green-100 text-green-700`, etc.)
- Icons: Lucide React, typically `h-5 w-5`
- Loading spinners: `animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600`
- Forms: labels `text-sm font-medium text-gray-700`, inputs with border/focus ring
- Global overrides in `app/globals.css` for placeholder contrast and table headers

### 7.5 Patient portal

- Separate layout: `app/patient-portal/layout.tsx`
- Teal/cyan color theme (distinct from staff blue theme)
- Only accessible to `role === 'patient'`
- Non-patients redirected to `/`

---

## 8. Internationalization (i18n)

This project does **not** use URL-based locales (`/en/patients`). Language is client-side only.

### How it works

1. `LanguageContext` stores current language in `localStorage`
2. `useTranslations()` hook loads the matching JSON from `messages/{lang}.json`
3. Call `t('navigation.patients')` with dot-notation keys
4. Add new keys to **all** language files (`en`, `ar`, `es`, `fr`)

### Adding translations

```json
// messages/en.json
{
  "myFeature": {
    "title": "My Feature",
    "save": "Save"
  }
}
```

```tsx
const { t } = useTranslations();
<h1>{t('myFeature.title')}</h1>
```

---

## 9. Staff Permissions System

### Registry

All permission keys are defined in `lib/staff-permissions.ts`:

```typescript
{ key: 'patients.view', label: 'View Patients', group: 'Patients' }
```

Naming convention: `{module}.{action}` — e.g. `appointments.add`, `billing.view`.

### StaffType model

Staff users have a `staffTypeId` pointing to a `StaffType` document with a `permissions: string[]` array.

### Checking permissions

**API route:**
```typescript
function hasPermission(session: any, permission: string): boolean {
  return session?.user?.permissions?.includes(permission) ?? false;
}
```

**Sidebar nav:**
```typescript
{ staffPermission: 'patients.view', roles: ['staff'], ... }
```

When adding a new module, add its permission keys to `STAFF_PERMISSIONS` and gate both API routes and sidebar items.

---

## 10. Department Modules

For multi-department clinics, use this pattern (see `derma/` as reference):

```
app/derma/                    # Department UI pages
app/api/derma/                # Department-scoped API routes
```

- Department field on models: `department: 'ophthalmology' | 'dermatology'`
- Department admins (`admin` + `department`) can only manage their department
- Super admin (`admin` without `department`) sees everything
- Department dashboards can live at `/derma` instead of `/` for department-specific landing

Shared business logic that varies by department goes in `lib/` (e.g. `lib/department-specializations.ts`).

---

## 11. Settings & Global Config

- **Model:** `models/Settings.ts` (singleton document)
- **Context:** `app/contexts/SettingsContext.tsx` — loads settings on mount, exposes `settings`, `updateSettings`, `refreshSettings`
- Settings include: system title, logos, currency, timezone, working hours per department, notification prefs
- Pages read branding via `useSettings()` — e.g. login page logo, sidebar title

---

## 12. Notifications

- **Service:** `lib/notifications/notification-service.ts`
- **Providers:** `lib/notifications/email-provider.ts`, `sms-provider.ts`
- **Templates:** `lib/notifications/templates.ts`
- Trigger notifications from API routes after key events (e.g. appointment created → schedule reminder)

---

## 13. Background Protocol Servers (Optional)

Lab/device integration runs as a **separate Node process**, not inside Next.js:

```bash
npm run servers        # HL7 + ASTM TCP servers
npm run dev:all        # Next.js + protocol servers concurrently
```

- Config: `lib/protocols/config.ts`, env vars in `.env.example`
- FHIR endpoints are regular Next.js API routes under `app/api/fhir/`

Only add standalone servers when TCP/socket protocols are required. Normal HTTP features stay in `app/api/`.

---

## 14. Environment Variables

Copy `.env.example` to `.env.local`:

```bash
MONGODB_URI=mongodb://localhost:27017/ai-doc
NEXTAUTH_SECRET=your-super-secret-key
NEXTAUTH_URL=http://localhost:3000
DEMO=false
```

Never commit `.env.local`. Required for auth: `MONGODB_URI`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`.

---

## 15. Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Next.js dev server |
| `npm run build` | Production build (Turbopack) |
| `npm run seed` | Seed database (`tsx scripts/seed-db.ts`) |
| `npm run servers` | Start HL7/ASTM servers |
| `npm run dev:all` | Dev + protocol servers |

Use `tsx` for one-off scripts in `scripts/`.

---

## 16. Checklist: Adding a New Feature Module

When Cursor (or a developer) adds a new module (e.g. "Radiology"), follow this checklist:

### Database
- [ ] Create `models/RadiologyStudy.ts` with interface, schema, timestamps, indexes, HMR-safe export

### API
- [ ] Create `app/api/radiology/route.ts` (GET list, POST create)
- [ ] Create `app/api/radiology/[id]/route.ts` (GET, PUT, DELETE)
- [ ] Add session check + role/permission checks on every handler
- [ ] Add department scoping if applicable
- [ ] Call `await dbConnect()` in every handler
- [ ] Return consistent error JSON

### Permissions
- [ ] Add keys to `lib/staff-permissions.ts` (e.g. `radiology.view`, `radiology.add`)
- [ ] Gate API routes and sidebar with those keys

### UI
- [ ] Create `app/radiology/page.tsx` (list)
- [ ] Create `app/radiology/new/page.tsx` (create form)
- [ ] Create `app/radiology/[id]/page.tsx` (detail)
- [ ] Wrap with `ProtectedRoute` + `SidebarLayout`
- [ ] Use `useTranslations()` — add keys to all `messages/*.json`
- [ ] Register nav item in `sidebar-layout.tsx`

### Types
- [ ] Extend interfaces if new session fields are needed (`types/next-auth.d.ts`)

---

## 17. Checklist: Scaffolding a New Project With This Architecture

When starting a **brand-new** Next.js project using this architecture:

```bash
npx create-next-app@latest my-app --typescript --tailwind --app --src-dir=false
```

Then set up:

1. **Dependencies:** next-auth, mongoose, mongodb, bcryptjs, @auth/mongodb-adapter, lucide-react, react-hot-toast, @tanstack/react-table
2. **Path alias:** `"@/*": ["./*"]` in `tsconfig.json`
3. **Folders:** `models/`, `lib/`, `messages/`, `types/`, `scripts/`
4. **Core files (copy patterns from this repo):**
   - `lib/mongodb.ts` + `lib/mongodb-adapter.ts`
   - `app/api/auth/[...nextauth]/route.ts`
   - `app/providers.tsx` + `app/layout.tsx`
   - `app/protected-route.tsx`
   - `app/components/sidebar-layout.tsx`
   - `app/contexts/LanguageContext.tsx` + `SettingsContext.tsx`
   - `app/hooks/useTranslations.ts`
   - `types/next-auth.d.ts`
   - `models/User.ts`
5. **First pages:** `/login`, `/` (dashboard)
6. **Env:** `.env.local` from `.env.example`

---

## 18. Cursor Prompt Template

Copy and paste this when asking Cursor to build something new:

```
Follow the architecture in ARCHITECTURE.md exactly.

Task: [describe the feature]

Requirements:
- Use Next.js App Router with TypeScript
- Client page with ProtectedRoute + SidebarLayout
- API routes in app/api/ with getServerSession auth checks
- Mongoose model in models/ with IInterface, timestamps, HMR-safe export
- Add staff permissions to lib/staff-permissions.ts if staff access is needed
- Add i18n keys to all messages/*.json files
- Register sidebar nav item in sidebar-layout.tsx
- Department-scope queries when session.user.department is set
- Use Tailwind CSS 4 utility classes matching existing pages
- Use lucide-react icons and react-hot-toast for feedback
- Do not create unnecessary abstractions or service layers
- Match naming and file structure of existing modules like doctors/ or appointments/
```

---

## 19. Anti-Patterns (Do NOT Do)

| Avoid | Do instead |
|-------|------------|
| Server Components for interactive forms | `'use client'` pages with fetch to API |
| Business logic only in client components | Validate and mutate in API route handlers |
| Skipping auth on API routes | Always `getServerSession(authOptions)` |
| Hardcoded UI strings | `useTranslations()` + JSON files |
| New CSS files or styled-components | Tailwind utility classes |
| Separate Express/Fastify server for CRUD | Next.js Route Handlers |
| Returning passwords in API responses | `.select('-password')` or omit field |
| Creating models without HMR guard | `mongoose.models.X \|\| mongoose.model(...)` |
| URL-based i18n (`/en/...`) | Client-side LanguageContext |
| Over-abstracted repository/service layers | Direct Mongoose in route handlers |

---

## 20. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────┐
│                        Browser (Client)                      │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────────────┐  │
│  │ ProtectedRoute│  │ SidebarLayout│  │ Contexts/Hooks    │  │
│  │ (auth guard)  │  │ (app shell)  │  │ Language, Settings│  │
│  └──────┬───────┘  └──────────────┘  └───────────────────┘  │
│         │ fetch('/api/...')                                  │
└─────────┼───────────────────────────────────────────────────┘
          │ HTTP
┌─────────▼───────────────────────────────────────────────────┐
│                   Next.js App Router                         │
│  ┌─────────────────────────────────────────────────────────┐ │
│  │ app/api/**/route.ts                                      │ │
│  │  1. getServerSession() → auth + permissions             │ │
│  │  2. dbConnect()                                          │ │
│  │  3. Mongoose query/mutation                              │ │
│  │  4. NextResponse.json()                                  │ │
│  └──────────────────────────┬──────────────────────────────┘ │
│  ┌──────────────────────────▼──────────────────────────────┐ │
│  │ app/api/auth/[...nextauth]/route.ts                      │ │
│  │  Credentials → bcrypt → JWT session                      │ │
│  └─────────────────────────────────────────────────────────┘ │
└──────────────────────────┬──────────────────────────────────┘
                           │
┌──────────────────────────▼──────────────────────────────────┐
│                        MongoDB                               │
│  models/User, Patient, Appointment, Settings, ...             │
└─────────────────────────────────────────────────────────────┘

Optional (separate process):
┌─────────────────────────────────────────────────────────────┐
│  servers/ — HL7 & ASTM TCP listeners for lab devices         │
└─────────────────────────────────────────────────────────────┘
```

---

*This architecture guide reflects the patterns used in the EyeCarePro / Telescope Medical Center codebase. Keep it updated when conventions change.*
