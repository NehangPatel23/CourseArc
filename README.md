# 🎨 Canvas Clone

A high-fidelity, front-end recreation of the [Canvas LMS](https://www.instructure.com/canvas) experience.
It simulates a complete learning-management system — courses, modules, assignments, quizzes, grading, discussions, people, calendar, and more — with a polished, Canvas-inspired UI and **dual student / instructor roles**. Everything runs in the browser with client-side persistence (no backend required).

> 🧩 Educational and design-practice project only. Not affiliated with or endorsed by Instructure Inc.

<br>

## 🚀 Features

### 🏠 Dashboard & Navigation
- Customizable dashboard with draggable widgets (upcoming deadlines, recent activity, grading queue, course health, analytics snapshot, and more)
- Dedicated **Courses** catalog (`/courses`) separate from the Dashboard home
- Global navigation with ⌘K global search, keyboard shortcuts (`?`), Inbox, and a searchable **Help** center
- Splash screen and optional login gate (disabled by default) with student/instructor demo login
- Light-theme UI throughout (full-width layout across app and course pages)

### 👩‍🏫 Dual Roles & Demo Personas
- Toggle between **Student View** and **Instructor View**
- Switchable **demo student personas** (named roster students) so submissions and grades stay distinct while demoing
- Customizable avatars: colored initials, photo upload, or doodle faces
- Instructor-only tools (editors, grading, statistics, course packages) are gated behind instructor view
- Student-facing views respect availability windows, lock dates, publish states, and grade visibility

### 📚 Course Content
- **Modules** – collapsible sections, drag-and-drop ordering, completion requirements, prerequisites, and access hierarchy
- **Pages** – rich-text pages with a WYSIWYG editor and viewer
- **Files** – file browser with typed previews (PDF, images, office docs, and more)
- **Announcements** – create, schedule/delay, edit, and view announcements
- **Discussions** – topics, threaded replies, graded discussions, and GradePro-style grading
- **People** – course roster management
- **Course home** – customizable widget layout for student and instructor

### 📝 Assignments & Grading
- Assignment creation with availability windows, due dates, and late-penalty policies
- Student submission flow and submission-details view
- **GradePro** SpeedGrader-style interface: document viewer, rubrics, comments, annotations, and feedback
- Gradebook with per-column / per-cell **post & hide** controls, filters, and student comment composers
- Student gradebook that only reveals posted grades and instructor feedback

### 🧪 Quizzes
- Quiz builder supporting multiple question types: multiple choice, multiple answers, true/false, short answer, fill-in-the-blank, numerical, matching, and essay
- Configurable time limits, multiple attempts, scoring policies, answer shuffling, and correct-answer visibility rules
- Timed quiz-taking experience with progress tracking
- **GradePro** grading for quizzes and per-question manual scoring
- **Quiz Statistics** with per-question breakdowns

### 📅 Calendar, Inbox & Grades
- Full-page **Calendar** with month/agenda views, course & type filters, today jump, day detail panel, and upcoming list
- **Inbox** notifications (including grade-posted alerts) with mark-read and delete-read actions
- Course gradebook, analytics, and per-student grade views

### 📦 Platform / Demo Tools
- **Import / export course package** (JSON) from Course Settings — curriculum, roster, and student activity (file binaries excluded)
- Help FAQ covering navigation, grades, personas, and packages

### 💅 Rich Content
- WYSIWYG editing (CKEditor 5 / TinyMCE), KaTeX math equations, code syntax highlighting (Prism), and safe HTML rendering

<br>

## 🧱 Tech Stack

| Layer            | Technology                                             |
| ---------------- | ------------------------------------------------------ |
| Framework        | React 19 + TypeScript                                  |
| Build Tool       | Vite 7                                                 |
| Styling          | Tailwind CSS 3                                         |
| Routing          | React Router DOM 7                                     |
| State / Data     | React hooks + `localStorage`-backed stores            |
| Icons            | lucide-react                                           |
| Rich Text        | CKEditor 5, TinyMCE                                    |
| Math / Code      | KaTeX, Prism                                           |
| Documents        | pdfjs-dist (PDF preview)                               |
| Drag & Drop      | dnd-kit                                                |
| Tooling          | ESLint, TypeScript ESLint, Playwright                  |

<br>

## 📁 Project Structure

The Vite application lives in the [`canvas-clone/`](canvas-clone) subdirectory.

```
canvas-clone/
├── e2e/               # Playwright smoke tests
├── public/            # Static assets
└── src/
    ├── components/     # Reusable UI (nav, avatars, gradebook, file viewers, widgets, …)
    ├── pages/          # Route-level pages (dashboard, courses, calendar, help, …)
    ├── layouts/        # Shared layouts (e.g. CourseLayout)
    ├── hooks/          # Custom hooks (settings, student view, useUser, keyboard shortcuts, …)
    ├── utils/          # Domain logic + localStorage stores (grades, inbox, packages, …)
    ├── data/           # Seed / mock data
    ├── types/          # Shared TypeScript types
    ├── App.tsx         # Route definitions
    └── main.tsx        # App entry point
```

<br>

## 🛠️ Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/NehangPatel23/canvas-clone.git
cd canvas-clone/canvas-clone
```

### 2. Install dependencies

```bash
npm install
```

### 3. Run the development server

```bash
npm run dev
```

Then open <http://localhost:5173> in your browser.

### Available scripts

| Command           | Description                          |
| ----------------- | ------------------------------------ |
| `npm run dev`     | Start the Vite dev server            |
| `npm run build`   | Type-check and build for production   |
| `npm run preview` | Preview the production build          |
| `npm run lint`    | Run ESLint                            |
| `npm run test:e2e`| Playwright smoke tests                |

<br>

## 💾 Data & Persistence

There is no server. All data (courses, modules, assignments, quizzes, submissions, grades, roster, inbox, settings, avatars) is seeded from mock data and persisted in the browser's `localStorage` (file blobs use IndexedDB). Clearing site data resets the app to its seeded state. Use **Course Settings → Import / export package** to share a course snapshot without clearing the whole browser.

<br>

## 🎨 Design Philosophy

The project mirrors Canvas's clean, academic interface while leaving room for creative implementation. Fonts and color palettes stay visually close to Canvas without using any proprietary assets. Layouts use the full content width for dashboard and course surfaces.

<br>

## 🧠 Future Roadmap

- [x] Student vs. instructor roles (demo persona switching)
- [x] Assignments, submissions, and grading (GradePro)
- [x] Quizzes with statistics
- [x] Grade visibility / post grades, help center, courses catalog, course packages
- [x] Calendar depth (filters, agenda, day detail)
- [ ] Real authentication flow (login / registration, sessions, per-user data)
- [ ] Real backend integration (persistent, multi-user)
- [ ] Fully mobile-first responsive layout
- [ ] Broader automated end-to-end test coverage (Playwright)

<br>

## 👨‍💻 Author

Nehang Patel\
📍 University of Southern California\
💻 Passionate about building aesthetic, functional software.

🔗 [GitHub](https://github.com/NehangPatel23) | [LinkedIn](https://www.linkedin.com/in/nehangpatel/)

<br>

## 🪪 License

This project is licensed under the MIT License — feel free to fork, modify, and learn from it.

<br>
