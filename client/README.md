# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Oxc](https://oxc.rs)
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/)

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.

## Test Admin Login (Seeded)

This project auto-seeds at least one admin user in `localStorage` for testing.

- Email: `admin@learnify.test`
- Password: `Admin@123`
- Role: `admin`

### How to log in as admin

1. Start the app (`npm run dev`).
2. Open `http://localhost:5173/login`.
3. Enter the seeded credentials above.
4. Submit to access the Admin dashboard.

Notes:
- If an admin already exists in `localStorage`, no duplicate admin seed is created.
- This seed flow is for demo/testing only (frontend-only app, no backend auth).
