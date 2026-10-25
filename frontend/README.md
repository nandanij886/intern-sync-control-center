# INTERNSYNC frontend
React + TanStack Start site (created with Lovable) connected to the Java backend in `../backend`.

    npm install
    npm run dev

The backend address is `VITE_API_URL` (default `http://localhost:8081`, see `.env.example`).
`src/lib/api.ts` holds all calls to the backend; `src/lib/os-store.tsx` polls `/api/state` every second and gives every page the live data.
When the backend is not running the pages fall back to demo data and show a warning.
