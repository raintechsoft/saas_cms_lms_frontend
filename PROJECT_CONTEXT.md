# SaaS CMS LMS Frontend — Project Context

Pair this with backend: `../saas_cms_lms_backend/PROJECT_CONTEXT.md` (same PC) or the backend repo `PROJECT_CONTEXT.md`.

## This repo

- Path: `C:\Users\USER\Desktop\saas_cms_lms_frontend`
- GitHub: `raintechsoft/saas_cms_lms_frontend`
- Stack: React + Vite + Tailwind + React Router

## Run

```powershell
cd C:\Users\USER\Desktop\saas_cms_lms_frontend
npm install
Copy-Item .env.example .env
npm run dev
```

`.env` must point at backend:

```env
VITE_API_URL=http://127.0.0.1:4000/api/v1
```

## UI areas

| Area | Routes | Look |
|------|--------|------|
| Super Admin | `/admin/*` | Zinc + amber ops console |
| Campus | `/dashboard`, students, fees, etc. | Navy/teal school panel |
| Student portal | `/portal/student/*` | Portal shell |
| Parent portal | `/portal/parent/*` | Portal shell + child switcher |
| Auth | `/login`, `/admin/login`, forgot/reset | Role-based login |

Shared Super Admin UI helpers: `src/pages/super-admin/platformUi.tsx`

## Demo logins

See backend `PROJECT_CONTEXT.md` (same passwords after backend seed).

## For AI

- Do not put campus teal styles into Super Admin
- Keep calling API via `VITE_API_URL` / `src/lib/api.ts`
- Backend must be running on port 4000 for login to work
