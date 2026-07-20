# Canvas Clone (app)

Vite + React + TypeScript front end for the Canvas Clone LMS demo. See the [root README](../README.md) for the full feature list, design notes, and project overview.

## Scripts

| Command            | Description                                      |
| ------------------ | ------------------------------------------------ |
| `npm run dev`      | Start the Vite dev server                        |
| `npm run build`    | Type-check and production build                  |
| `npm run preview`  | Preview the production build                     |
| `npm run lint`     | Run ESLint                                       |
| `npm run test:e2e` | Playwright smoke tests (starts the server)       |

## Local development

```bash
npm install
npm run dev
```

Open <http://localhost:5173>. Data persists in `localStorage` / IndexedDB in your browser.

## Stack

React 19, TypeScript, Vite 7, Tailwind CSS 3, React Router 7, lucide-react, CKEditor / TinyMCE, KaTeX, Prism, pdfjs-dist, dnd-kit, Playwright.
