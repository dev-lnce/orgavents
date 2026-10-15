# OrgaVents UI Handoff

> Standalone frontend for OrgaVents — runs fully in **Mock Mode** (no server required) or connects to the **Live Backend** with a single `.env` change.

## Quick Start (Mock Mode — No Server Needed)

```bash
npm install
npm run dev
# → http://localhost:5173
```

Use the **⚡ Instant Demo Login** buttons on the login page:

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@orgavents.edu` | `Password123!` |
| Organizer | `organizer@campus.edu` | `Password123!` |
| Member | `member@campus.edu` | `Password123!` |

> **Reset Demo Data**: Click the "Reset Demo Data" button (bottom-right corner) to wipe `localStorage` back to seed state.

## Switch to Live Backend

1. Edit `.env`:
   ```env
   VITE_USE_MOCK=false
   VITE_API_URL=http://localhost:5000/api
   ```
2. Start your backend server
3. `npm run dev`

## Project Structure

```
src/
├── pages/           # All UI screens (LoginPage, EventCalendarPage, etc.)
├── components/      # Shared UI components (AppShell, ConfirmModal, etc.)
├── context/         # AuthContext (auth state, login/logout/register)
└── services/
    ├── api.js           # Dual-mode API client (Mock ↔ Live)
    └── mockBackend.js   # Full localStorage mock implementation
```

## Backend Integration

See **[BACKEND_INTEGRATION_GUIDE.md](./BACKEND_INTEGRATION_GUIDE.md)** for:
- Required server folder architecture
- Mongoose schemas with exact fields and indexes
- Screen-by-screen API contract (endpoint, method, request/response JSON)
- Standard error format
- 10-point integration testing checklist
