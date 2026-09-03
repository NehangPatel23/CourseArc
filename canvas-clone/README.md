# CourseArc (app)

Vite + React + TypeScript client for the CourseArc LMS studio. The product overview, live demo, feature map, and bank catalog live in the [root README](../README.md).

## Local development

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Data persists in `localStorage` / IndexedDB in this browser.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Vite development server |
| `npm run build` | Type-check and production build |
| `npm run preview` | Preview the production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright smokes (starts the app) |

## Stack

React 19, TypeScript, Vite 7, Tailwind CSS 3, React Router 7, CKEditor / TinyMCE, KaTeX, Prism, Monaco, pdf.js, dnd-kit, Vitest, Playwright.
