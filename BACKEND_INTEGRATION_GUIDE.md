# OrgaVents — Backend Integration Guide

> **For:** Backend Engineering Team
> **From:** Frontend Engineering Team
> **Date:** October 2026 | v1.0

---

## Table of Contents

1. [Project Overview & How to Run the UI](#1-project-overview--how-to-run-the-ui)
2. [Required Backend Folder Architecture](#2-required-backend-folder-architecture)
3. [Database Schemas & Indexes Checklist](#3-database-schemas--indexes-checklist)
4. [Screen-by-Screen API Contract](#4-screen-by-screen-api-contract)
5. [Standard Error Format & Status Codes](#5-standard-error-format--status-codes)
6. [Step-by-Step Integration Testing Checklist](#6-step-by-step-integration-testing-checklist)

---

## 1. Project Overview & How to Run the UI

### What this repo is

`/orgavents-ui-handoff` is a **standalone React + Vite frontend** that runs completely independently — no server required in mock mode. It uses a dual-mode API layer:

| Mode | What happens | How to enable |
|------|-------------|---------------|
| **Mock Mode** (default) | All API calls hit `mockBackend.js` (localStorage) | `VITE_USE_MOCK=true` in `.env` |
| **Live Mode** | All API calls go to your Express server at `VITE_API_URL` | `VITE_USE_MOCK=false` in `.env` |

### Run the UI immediately (no server needed)

```bash
cd orgavents-ui-handoff
npm install
npm run dev
# → Open http://localhost:5173
```

**Demo credentials (all use `Password123!`):**

| Role | Email |
|------|-------|
| Admin | `admin@orgavents.edu` |
| Organizer | `organizer@campus.edu` |
| Member | `member@campus.edu` |
| Inactive | `inactive.student@campus.edu` (tests FR-AUTH-06) |

> **Tip:** Use the ⚡ **Instant Demo Login** buttons on the login page to log in with one click.
> 
> Use the **Reset Demo Data** button (bottom-right corner) to reset all localStorage to seed state at any time.

---

### Switch the UI to your Live Backend

1. Open `orgavents-ui-handoff/.env`
2. Change:

```env
# Before (mock mode):
VITE_USE_MOCK=true

# After (live mode — point at your server):
VITE_USE_MOCK=false
VITE_API_URL=http://localhost:5000/api
```

3. Restart the dev server: `npm run dev`

The UI will now make real HTTP requests to your Express server with `Authorization: Bearer <JWT>` headers.

> [!IMPORTANT]
> Your backend must respond with **`Access-Control-Allow-Origin: http://localhost:5173`** (or a wildcard in dev). Set this in your Express `cors()` middleware.

---

## 2. Required Backend Folder Architecture

Per **NFR-MNT-01** (clear separation of concerns) and **NFR-DC-03** (MERN stack), build your `/server` with this exact structure:

```
/server
├── .env                          ← Environment variables (see below)
├── server.js                     ← Express entry point, CORS, mounts routes
├── package.json
│
├── config/
│   └── db.js                     ← Mongoose connect() with retry logic
│
├── middleware/
│   ├── auth.js                   ← verifyToken (JWT), requireRole(roles[])
│   ├── sanitize.js               ← Strip $ and . from req.body keys (NFR-SEC-04)
│   ├── rateLimiter.js            ← express-rate-limit: 5 attempts / 15 min (NFR-SEC-06)
│   └── errorHandler.js           ← Global 404 + 500 handler
│
├── models/
│   ├── User.js                   ← Mongoose User schema (see Section 3)
│   ├── Event.js                  ← Mongoose Event schema
│   └── Registration.js           ← Mongoose Registration schema
│
├── controllers/
│   ├── userController.js         ← register, login, getProfile, updateProfile
│   ├── eventController.js        ← CRUD for events
│   ├── registrationController.js ← rsvp, cancel, roster, checkIn
│   ├── reportController.js       ← attendance stats, CSV/JSON export
│   └── adminController.js        ← admin user/event management
│
├── routes/
│   ├── userRoutes.js             ← /api/users/*
│   ├── eventRoutes.js            ← /api/events/*
│   ├── registrationRoutes.js     ← /api/registrations/*
│   ├── reportRoutes.js           ← /api/reports/*
│   └── adminRoutes.js            ← /api/admin/*
│
└── scripts/
    └── seedAdmin.js              ← Seeds initial admin account (run once)
```

### Minimum `.env` for the server

```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/orgavents
JWT_SECRET=your-strong-secret-here-change-this
JWT_EXPIRES_IN=7d
NODE_ENV=development
CLIENT_ORIGIN=http://localhost:5173
```

### `server.js` minimal setup

```js
import express from 'express';
import cors from 'cors';
import { connectDB } from './config/db.js';
import sanitize from './middleware/sanitize.js';
import errorHandler from './middleware/errorHandler.js';
import userRoutes from './routes/userRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import registrationRoutes from './routes/registrationRoutes.js';
import reportRoutes from './routes/reportRoutes.js';
import adminRoutes from './routes/adminRoutes.js';

await connectDB();
const app = express();

app.use(cors({ origin: process.env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json());
app.use(sanitize);   // ← MUST come before routes (NFR-SEC-04)

app.use('/api/users', userRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/admin', adminRoutes);

// 404 catch-all (must be last route)
app.use((req, res) => {
  res.status(404).json({ message: `Endpoint ${req.method} ${req.path} not found` });
});
app.use(errorHandler);

app.listen(process.env.PORT || 5000, () =>
  console.log(`[Server] OrgaVents API running on port ${process.env.PORT}`)
);
```

---

## 3. Database Schemas & Indexes Checklist

### 3.1 `models/User.js`

```js
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs'; // npm install bcryptjs

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      maxlength: [100, 'Name cannot exceed 100 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,         // ← Index: unique email lookup
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, 'Please enter a valid email'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [8, 'Password must be at least 8 characters'],
      select: false,        // ← Never returned in queries by default
    },
    role: {
      type: String,
      enum: ['admin', 'organizer', 'member'],
      default: 'member',    // ← FR-AUTH-02: public signup always creates member
    },
    isActive: {
      type: Boolean,
      default: true,        // ← FR-AUTH-06: deactivated users get 403 on login
    },
  },
  { timestamps: true }      // ← adds createdAt, updatedAt automatically
);

// FR-SEC-01: Hash password before save (10 salt rounds)
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// Instance method for password comparison
userSchema.methods.comparePassword = function (plain) {
  return bcrypt.compare(plain, this.password);
};

// Index for role-based admin queries (NFR-PER-01)
userSchema.index({ role: 1 });
userSchema.index({ isActive: 1 });

export default mongoose.model('User', userSchema);
```

> [!IMPORTANT]
> Always use `select: false` on the `password` field. Add `+password` only in the login controller when you need to compare it.

---

### 3.2 `models/Event.js`

```js
import mongoose from 'mongoose';

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: [true, 'Event title is required'],
      trim: true,
      maxlength: [200, 'Title cannot exceed 200 characters'],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [2000, 'Description cannot exceed 2000 characters'],
      default: '',
    },
    date: {
      type: Date,
      required: [true, 'Event date is required'],
    },
    venue: {
      type: String,
      required: [true, 'Venue is required'],
      trim: true,
    },
    capacity: {
      type: Number,
      required: [true, 'Capacity is required'],
      min: [1, 'Capacity must be at least 1'],
    },
    registeredCount: {
      type: Number,
      default: 0,
      min: 0,
    },
    organizer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true }
);

// Index for calendar date-range queries (FR-EVT-01, FR-CAL-01)
eventSchema.index({ date: 1 });
// Index for organizer's own events dashboard
eventSchema.index({ organizer: 1, date: 1 });

export default mongoose.model('Event', eventSchema);
```

**Key rules:**
- `registeredCount` must be updated **atomically** using `$inc` on the Event document when a Registration is created/deleted (Appendix A.4 — see Section 4.3 below).
- **FR-EVT-09**: Before updating `capacity`, check `event.registeredCount <= newCapacity`. Return `409` if not.

---

### 3.3 `models/Registration.js`

```js
import mongoose from 'mongoose';

const registrationSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    event: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Event',
      required: true,
    },
    checkedIn: {
      type: Boolean,
      default: false,
    },
    checkedInAt: {
      type: Date,
      default: null,
    },
    registeredAt: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: false }
);

// Prevent double-registration (FR-REG-04 uniqueness)
registrationSchema.index({ user: 1, event: 1 }, { unique: true });
// Fast roster lookup by event
registrationSchema.index({ event: 1 });
// Fast user registrations lookup
registrationSchema.index({ user: 1 });

export default mongoose.model('Registration', registrationSchema);
```

---

### 3.4 `scripts/seedAdmin.js`

```js
import mongoose from 'mongoose';
import User from '../models/User.js';
import dotenv from 'dotenv';
dotenv.config();

await mongoose.connect(process.env.MONGO_URI);

const existing = await User.findOne({ email: 'admin@orgavents.edu' });
if (!existing) {
  await User.create({
    name: 'System Administrator',
    email: 'admin@orgavents.edu',
    password: 'Password123!',  // hashed by pre-save hook
    role: 'admin',
    isActive: true,
  });
  console.log('[Seed] Admin account created.');
} else {
  console.log('[Seed] Admin already exists.');
}
await mongoose.disconnect();
```

Run once: `node scripts/seedAdmin.js`

---

## 4. Screen-by-Screen API Contract

### Legend

| Column | Meaning |
|--------|---------|
| **UI File** | React page that makes the call |
| **api.js Function** | The function in `src/services/api.js` that wraps the call |
| **Method + Endpoint** | The exact Express route to implement |
| **Auth** | Who can call this |
| **SRS Ref** | Requirements reference |

---

### 4.1 Authentication & User Profile

#### `LoginPage.jsx` → `authAPI.login()`

| Field | Value |
|-------|-------|
| **Method** | `POST` |
| **Endpoint** | `/api/users/login` |
| **Auth** | Public (no token) |
| **Rate Limit** | 5 failed attempts per 15 min per IP (NFR-SEC-06) |

**Request body:**
```json
{ "email": "user@university.edu", "password": "Password123!" }
```

**Success `200` response:**
```json
{
  "token": "<JWT signed with JWT_SECRET, expires in JWT_EXPIRES_IN>",
  "user": {
    "_id": "64a...",
    "name": "Alex Rivera",
    "email": "member@campus.edu",
    "role": "member",
    "isActive": true,
    "createdAt": "2026-09-01T00:00:00.000Z"
  }
}
```

**Error cases the UI handles:**
- `401` → `{ "message": "Invalid email or password." }`
- `403` → `{ "message": "Account deactivated. Contact an administrator." }` (FR-AUTH-06)
- `429` → `{ "message": "Too many login attempts. Please try again in 15 minutes." }` (NFR-SEC-06)

---

#### `SignUpPage.jsx` → `authAPI.register()`

| Field | Value |
|-------|-------|
| **Method** | `POST` |
| **Endpoint** | `/api/users/register` |
| **Auth** | Public |
| **Critical** | `role` must always be set to `"member"` regardless of request body (FR-AUTH-02) |

**Request body:**
```json
{ "name": "New Student", "email": "student@campus.edu", "password": "SecurePass1!" }
```

**Success `201` response:**
```json
{ "message": "Account created successfully.", "user": { "_id": "...", "name": "...", "role": "member" } }
```

**Error cases:**
- `409` → `{ "message": "An account with this email already exists." }`
- `400` → `{ "message": "Validation failed.", "errors": { "name": "...", "email": "...", "password": "..." } }`

---

#### `ProfilePage.jsx` → `authAPI.getUserProfile()` + `authAPI.updateUserProfile()`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/users/:userId` | Any logged-in user (own profile), Admin (any) | Fetch profile |
| `PUT` | `/api/users/:userId` | Own profile, Admin for isActive | Update name/email/password |

**`PUT` request body** (all fields optional):
```json
{
  "name": "Updated Name",
  "email": "new@email.com",
  "password": "NewPass123!"
}
```

**Response:** Same as user object above (no password field).

> [!NOTE]
> The UI's `ProfilePage` calls `refreshUser()` from `AuthContext` after a successful update, which re-calls `GET /api/users/:userId` to sync the sidebar.

---

#### Live RBAC check on hydration (FR-AUTH-09)

When the app loads, `AuthContext` calls `GET /api/users/:userId` with the stored token to detect mid-session role/status changes. If the account was deactivated since login, return `403`. The UI will automatically log the user out and show a banner.

---

### 4.2 Events

#### `EventCalendarPage.jsx` → `eventsAPI.getAll()`

| Field | Value |
|-------|-------|
| **Method** | `GET` |
| **Endpoint** | `/api/events` |
| **Auth** | Any logged-in user |
| **Query params** | `from` (ISO date), `to` (ISO date), `organizer` (userId) |

The UI sends `from` and `to` for the current calendar month ±1 month:
```
GET /api/events?from=2026-09-01T00:00:00Z&to=2026-11-30T23:59:59Z
```

**Success `200` response (array):**
```json
[
  {
    "_id": "64a...",
    "title": "Intro to Git & GitHub Workshop",
    "description": "...",
    "date": "2026-10-22T08:00:00.000Z",
    "venue": "Tech Building Lab 304",
    "capacity": 40,
    "registeredCount": 6,
    "organizer": {
      "_id": "64b...",
      "name": "Computer Science Society",
      "email": "organizer@campus.edu"
    },
    "createdAt": "2026-10-01T00:00:00.000Z"
  }
]
```

> [!IMPORTANT]
> Always **populate** the `organizer` field with `{ _id, name, email }` — the UI uses `event.organizer.name` to display the organizer name on calendar cards and the event detail page.

---

#### `EventDetailsPage.jsx` → `eventsAPI.getById()`

| Method | Endpoint | Auth |
|--------|----------|------|
| `GET` | `/api/events/:id` | Any logged-in user |

Returns the same shape as a single event from `getAll`. The UI reads `registeredCount` and `capacity` to decide whether to show the RSVP button or a "Full" badge.

---

#### `EventFormPage.jsx` → `eventsAPI.create()` / `eventsAPI.update()`

| Method | Endpoint | Auth |
|--------|----------|------|
| `POST` | `/api/events` | `organizer`, `admin` |
| `PUT` | `/api/events/:id` | Owner organizer, `admin` |

**Request body:**
```json
{
  "title": "New Workshop",
  "description": "Optional description...",
  "date": "2026-11-15T09:00:00.000Z",
  "venue": "Tech Building Lab 304",
  "capacity": 30
}
```

**`PUT` 409 when capacity is being reduced below registeredCount (FR-EVT-09):**
```json
{
  "message": "Capacity cannot be less than the current number of registrations (6)."
}
```

---

#### `OrganizerDashboardPage.jsx` → `eventsAPI.getAll({ organizer: user._id })`

The organizer dashboard calls `getAll` with `organizer=<userId>` to show only their events. Implement this filter server-side.

---

#### `AdminEventsPage.jsx` → `adminAPI.getEvents()` + `adminAPI.deleteEvent()`

| Method | Endpoint | Auth |
|--------|----------|------|
| `GET` | `/api/admin/events` | `admin` |
| `DELETE` | `/api/admin/events/:id` | `admin` |

Admin event list returns all events (no organizer filter). Also cascades to delete registrations when an event is deleted.

---

### 4.3 Registrations & Check-In

#### `EventDetailsPage.jsx` → `registrationsAPI.rsvp()` / `registrationsAPI.cancelRsvp()`

| Method | Endpoint | Auth | SRS |
|--------|----------|------|-----|
| `POST` | `/api/registrations` | `member`, `admin` | FR-REG-01 |
| `DELETE` | `/api/registrations/:id` | Own registrant, `admin` | FR-REG-12 |

**`POST` request body:**
```json
{ "eventId": "64a..." }
```

**`POST` success `201`:**
```json
{
  "_id": "64c...",
  "user": { "_id": "...", "name": "Alex Rivera", "email": "member@campus.edu" },
  "event": { "_id": "...", "title": "Intro to Git Workshop", "date": "..." },
  "checkedIn": false,
  "checkedInAt": null,
  "registeredAt": "2026-10-15T11:00:00.000Z"
}
```

**Error cases the UI handles:**
```json
// FR-REG-04: Full event
{ "message": "Event is full. No seats available." }   // 409

// FR-REG-02: Past event
{ "message": "Registration is closed. This event has already started." }  // 409

// Already registered
{ "message": "You are already registered for this event." }  // 409
```

> [!IMPORTANT]
> **Atomic RSVP** (Appendix A.4): Increment `registeredCount` on the Event document atomically using:
> ```js
> await Event.findByIdAndUpdate(eventId, { $inc: { registeredCount: 1 } });
> ```
> Do NOT read `registeredCount`, add 1, then write back — this causes race conditions under concurrent requests.

**`DELETE` 409 after check-in (FR-REG-13):**
```json
{ "message": "Cannot cancel registration after check-in." }
```

---

#### `MyRegistrationsPage.jsx` → `registrationsAPI.getUserRegistrations(userId)`

| Method | Endpoint | Auth |
|--------|----------|------|
| `GET` | `/api/registrations/user/:userId` | Own user, `admin` |

**Response (array):** Same Registration shape, with `event` fully populated (including `organizer`).

---

#### `RosterCheckInPage.jsx` → `registrationsAPI.getRoster()` + `registrationsAPI.checkIn()`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/registrations/event/:eventId` | `organizer` (own), `admin` | Fetch all registrants for an event |
| `PATCH` | `/api/registrations/:id/check-in` | `organizer` (own), `admin` | One-tap check-in |

**`GET` response (array):**
```json
[
  {
    "_id": "64c...",
    "user": { "_id": "...", "name": "Alex Rivera", "email": "member@campus.edu" },
    "event": { "_id": "...", "title": "Intro to Git Workshop" },
    "checkedIn": false,
    "checkedInAt": null,
    "registeredAt": "2026-10-10T08:00:00.000Z"
  }
]
```

**`PATCH` success `200` (FR-REG-09, FR-REG-11):**
```json
{
  "_id": "64c...",
  "checkedIn": true,
  "checkedInAt": "2026-10-22T09:14:32.000Z",
  "user": { "_id": "...", "name": "Alex Rivera" }
}
```

---

### 4.4 Reports & Exports

#### `ReportsPage.jsx` → `reportsAPI.getAttendance()` + `reportsAPI.exportRegistrants()`

| Method | Endpoint | Auth |
|--------|----------|------|
| `GET` | `/api/reports/events/:eventId/attendance` | `organizer` (own), `admin` |
| `GET` | `/api/reports/events/:eventId/export?format=csv\|json` | `organizer` (own), `admin` |

**Attendance `GET` response** (exact keys the UI reads):
```json
{
  "eventId": "64a...",
  "title": "Campus Freshmen Orientation",
  "capacity": 50,
  "registered": 7,
  "checkedIn": 5,
  "noShows": 2,
  "attendanceRate": 71
}
```

> [!CAUTION]
> The UI reads `data.registered`, `data.checkedIn`, `data.noShows`, and `data.attendanceRate` directly. If the key names differ, the stats panel will show zeroes.

**CSV export requirements (FR-RPT-05, FR-RPT-06):**
- Set header: `Content-Disposition: attachment; filename="<event-title>_registrants.csv"`
- Set `Content-Type: text/csv`
- RFC 4180 quoting: wrap fields with commas, newlines, or `"` in double quotes; escape `"` as `""`
- **Formula injection protection**: Prefix any value starting with `=`, `+`, `-`, `@` with a single quote `'`

**CSV columns:** `Name, Email, Registered At, Checked In, Checked In At`

**JSON export:** `Content-Type: application/json`, array of objects with same fields.

---

### 4.5 Admin User Management

#### `AdminUsersPage.jsx` → `adminAPI.getUsers()`, `adminAPI.updateRole()`, `adminAPI.updateStatus()`, `adminAPI.deleteUser()`

| Method | Endpoint | Auth | Description |
|--------|----------|------|-------------|
| `GET` | `/api/admin/users` | `admin` | List all users (with search/filter) |
| `PATCH` | `/api/users/:id/role` | `admin` | Change role |
| `PUT` | `/api/users/:id` | `admin` | Toggle isActive, update name/email |
| `DELETE` | `/api/admin/users/:id` | `admin` | Delete user |

**`GET /api/admin/users` query params the UI sends:**

| Param | Values | Description |
|-------|--------|-------------|
| `search` | string | Match against `name` or `email` (case-insensitive) |
| `role` | `admin`, `organizer`, `member`, or omitted | Filter by role |
| `isActive` | `true`, `false`, or omitted | Filter by status |

**Response (array):** User objects without `password`.

**`PATCH /api/users/:id/role` request body:**
```json
{ "role": "organizer" }
```

**`DELETE /api/admin/users/:id` error cases:**
```json
// FR-USR-09: Organizer owns events
{ "message": "Cannot delete an organizer who owns events. Reassign or delete their events first." }
// Status: 409

// FR-USR-10: Last active admin
{ "message": "Cannot delete the last active administrator." }
// Status: 409
```

---

## 5. Standard Error Format & Status Codes

The UI reads **every** error response in this exact shape:

```json
{
  "message": "Human-readable summary shown in toast or banner",
  "errors": {
    "fieldName": "Inline validation message shown under the form field"
  }
}
```

The `errors` object is optional — only include it for `400` validation failures.

### HTTP Status Code Reference

| Code | When to use | UI behavior |
|------|-------------|-------------|
| `200` | Successful GET, PUT, PATCH | Renders data |
| `201` | Successful POST (creation) | Shows success toast, refreshes data |
| `400` | Validation failure | Shows `errors` inline under form fields |
| `401` | Missing/expired JWT token | Logs out, shows "Session expired" banner |
| `403` | Valid token but wrong role, or deactivated account | Logs out or shows "Access denied" |
| `404` | Resource not found | Shows "Not found" empty state |
| `409` | Business rule conflict (full event, already registered, etc.) | Shows error banner with `message` |
| `429` | Rate limit exceeded | Shows "Too many attempts" banner |
| `500` | Unexpected server error | Shows generic "Something went wrong" toast |

### Global Error Response Middleware

```js
// middleware/errorHandler.js
export default function errorHandler(err, req, res, next) {
  const status = err.status || 500;
  const message = err.message || 'Internal server error';
  const errors = err.errors || {};
  
  if (status === 500) {
    console.error('[Server Error]', err);
  }
  
  res.status(status).json({ message, ...(Object.keys(errors).length ? { errors } : {}) });
}
```

---

## 6. Step-by-Step Integration Testing Checklist

Switch the UI to live mode (`VITE_USE_MOCK=false`) and test each module in order:

- [ ] **1. Health Check**: Start the server. `GET http://localhost:5000/api` returns `200 { status: "ok" }`. CORS header is present.

- [ ] **2. Registration Flow**: Open `http://localhost:5173/signup`. Create a new account (`newtest@campus.edu`, any password ≥8 chars). You should be auto-logged in and redirected to `/calendar`.

- [ ] **3. Login Flow**: Log out. Log back in with the same credentials. Then try `inactive.student@campus.edu` / `Password123!` → should see 403 "Account deactivated" banner.

- [ ] **4. Event Calendar**: Log in as organizer. Navigate to `/calendar`. All events should load. Month navigation should fetch fresh data. Verify `registeredCount` and `capacity` match the database.

- [ ] **5. RSVP & Full-Event Block**: Log in as `member@campus.edu`. RSVP to an open event. Then RSVP to the "AI Ethics Symposium" (full event) → should see 409 "Event is full" inline error. RSVP to the "Campus Freshmen Orientation" (past) → should see 409 "Registration closed."

- [ ] **6. Unregister Block**: Find a registration where `checkedIn=true`. Try to cancel it → should see 409 "Cannot cancel after check-in."

- [ ] **7. Door Check-In Roster**: Log in as organizer. Go to `/events/<id>/roster`. Verify the roster lists all registrants. Tap the check-in button on a pending attendee → `checkedIn` should update to `true` immediately, and `checkedInAt` should be set.

- [ ] **8. Attendance Reports & Export**: Log in as organizer or admin. Go to `/reports`. Select the "Intro to Git Workshop." Verify `registered`, `checkedIn`, `noShows`, and `attendanceRate` match your DB. Click "Export CSV" → a CSV file should download. Open it and confirm no formula injection (values starting with `=` should be prefixed with `'`).

- [ ] **9. Admin User Management**: Log in as admin. Go to `/admin/users`. Try deleting yourself (the last admin) → should see 409. Try deleting the Computer Science Society organizer (who owns events) → should see 409. Deactivate `member@campus.edu`, then log in as Alex → should see 403.

- [ ] **10. Mid-Session RBAC** (FR-AUTH-09): Log in as `member@campus.edu` in one tab. In another tab, log in as admin and deactivate Alex's account. Return to Alex's tab and navigate to any protected route → the UI should detect the 403 on the next `GET /api/users/:id` hydration and log Alex out automatically.

---

> **Questions?** Reach out to the Frontend Team. The UI mock (`mockBackend.js`) is the living reference implementation for every business rule above — you can read it as pseudocode for your controllers.
