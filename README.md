# 🎨 Canvas Clone

A high-fidelity, front-end recreation of the [Canvas LMS](https://www.instructure.com/canvas) experience.
It simulates a complete learning-management system — courses, modules, assignments, quizzes, grading, discussions, people, calendar, and more — with a polished, Canvas-inspired UI and **student / TA / instructor roles**. Everything runs in the browser with client-side persistence (no backend required).

> 🧩 Educational and design-practice project only. Not affiliated with or endorsed by Instructure Inc.

<br>

## 🚀 Features

### 🏠 Dashboard & Navigation
- Customizable dashboard with draggable widgets (upcoming deadlines, recent activity, grading queue, course health, analytics snapshot, missing work, and more)
- Dedicated **Courses** catalog (`/courses`) with pin/favorite, nicknames, and term grouping
- Global navigation with ⌘K global search, keyboard shortcuts (`?`), Inbox, Planner, and a searchable **Help** center
- Splash screen and optional login gate (disabled by default) with student/TA/instructor demo login
- Light-theme UI throughout (full-width layout across app and course pages)

### 👩‍🏫 Dual Roles & Demo Personas
- Toggle **Student View**, **TA View**, and **Instructor View**
- Switchable **demo student personas** (Alex complete, Jordan missing, Sam late) so submissions and grades stay distinct while demoing
- Customizable avatars: colored initials, photo upload, or doodle faces
- Instructor-only tools (course settings, create/delete courses, add staff) stay gated; TAs can author, grade, and publish content
- Student-facing views respect availability windows, lock dates, publish states, and grade visibility

### 📚 Course Content
- **Modules** – collapsible sections, drag-and-drop ordering, completion requirements, prerequisites, and access hierarchy
- **Pages** – rich-text pages with a WYSIWYG editor and viewer
- **Files** – file browser with typed previews (PDF, images, office docs, and more)
- **Announcements** – create, schedule/delay, edit, and view announcements
- **Discussions** – topics, threaded replies, graded discussions, and GradePro-style grading
- **Syllabus** – rich course document with teaching team, office hours, course summary, and grading scheme
- **People** – roster, sections, group sets with homepages, and quiz accommodations
- **Attendance** – roll call (present / absent / late / excused), separate from appointment-slot attendance
- **Collaborations** – shared-doc and conference join links
- **Rubrics** – reusable library you can attach to assignments, discussions, and essay quiz questions
- **Course home** – customizable widget layout for student and instructor

### 📝 Assignments & Grading
- Assignment creation with availability windows, due dates, late-penalty policies, and per-section / per-student due-date overrides
- Student submission flow and submission-details view
- **GradePro** SpeedGrader-style interface: document viewer, rubrics, comments, annotations, and feedback
- Gradebook with per-column / per-cell **post & hide** controls, filters, missing-work roster, and student comment composers
- Student gradebook that only reveals posted grades and instructor feedback
- **Assignment groups** with weighted overall % (drop lowest, extra credit, 0-weight)
- **Anonymous grading** in GradePro until grades are posted
- **Peer review** with N reviewers, due dates, and optional anonymous peers (instructor grade remains official)

### 🧪 Quizzes
- Quiz builder with multiple choice, multiple answers, true/false, short answer, fill-in-the-blank(s), numerical, matching, ordering, calculated, Likert, hotspot, essay, inline code, and coding questions (Monaco editor)
- **Question banks** with pull-random / copy-into-quiz, merge, link-across-courses, and import (JSON, CSV, Markdown, QTI XML, Moodle XML, Aiken)
- Bundled **46 CS topic banks** (~100 questions each) under `canvas-clone/docs/banks/` and `src/data/bankPacks/`
- Configurable time limits, multiple attempts, scoring policies, answer shuffling, access codes, and correct-answer visibility rules
- Timed quiz-taking with progress tracking, moderate extras (time / attempts / unlock), and course-wide accommodations
- **GradePro** grading for quizzes, per-question manual scoring, statistics, and a client-side similarity report

### 📅 Calendar, Inbox & Planner
- Full-page **Calendar** with month / week / day / agenda views, course & type filters, today jump, day detail, print, and ICS export
- Instructor **appointment groups** (office hours): slots, student signup, waitlist, attendance on the slot
- Cross-course **Planner** for coming-up deadlines, booked appointments, and personal to-dos (mark-as-done, notes, ICS)
- **Inbox** as a course messenger: compose, reply, CC, attachments, archive, mute, and lock student replies. Announcements, discussion replies, posted grades, and appointments also land here

### 🎓 Student extras
- Missing / late indicators in the gradebook and a dashboard Missing Work alert
- Light **ArcFolio** showcase of featured submissions and external projects, plus a public share link

### 📦 Platform / Demo Tools
- **Import / export course package** (JSON v2) from Course Settings — curriculum, roster, grades, banks, peer reviews, accommodations, group spaces, attendance, collaborations, syllabus, and course inbox (file binaries excluded; selective import)
- Help FAQ covering navigation, roles, grades, quizzes, packages, and keyboard shortcuts

### 💅 Rich Content
- WYSIWYG editing (CKEditor 5 / TinyMCE), KaTeX math equations, code syntax highlighting (Prism), Monaco for coding questions, and safe HTML rendering

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
| Code editor      | Monaco                                                 |
| Math / Code      | KaTeX, Prism                                           |
| Documents        | pdfjs-dist (PDF preview)                               |
| Drag & Drop      | dnd-kit                                                |
| Tooling          | ESLint, TypeScript ESLint, Vitest, Playwright          |

<br>

## 📁 Project Structure

The Vite application lives in the [`canvas-clone/`](canvas-clone) subdirectory.

```
canvas-clone/
├── docs/              # Deferred backend TODOs + CS bank import pack
├── e2e/               # Playwright smoke tests (inbox, course, calendar, quizzes)
├── sample-imports/    # Example quiz / bank files for import demos
├── scripts/           # Bank generation helpers
├── public/            # Static assets
└── src/
    ├── components/     # Reusable UI (nav, avatars, gradebook, file viewers, widgets, …)
    ├── pages/          # Route-level pages (dashboard, courses, calendar, help, …)
    ├── layouts/        # Shared layouts (e.g. CourseLayout)
    ├── hooks/          # Custom hooks (settings, student view, useUser, keyboard shortcuts, …)
    ├── utils/          # Domain logic + localStorage stores (grades, inbox, packages, …)
    ├── data/           # Seed data and bundled question-bank packs
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
| `npm test`        | Run Vitest unit tests                 |
| `npm run test:e2e`| Playwright smoke tests                |

<br>

## 💾 Data & Persistence

There is no server. All data (courses, modules, assignments, quizzes, submissions, grades, roster, inbox, settings, avatars) is seeded from mock data and persisted in the browser's `localStorage` (file blobs use IndexedDB). Clearing site data resets the app to its seeded state. Use **Course Settings → Import / export package** to share a course snapshot without clearing the whole browser.

<br>

## 🎨 Design Philosophy

The project mirrors Canvas's clean, academic interface while leaving room for creative implementation. Fonts and color palettes stay visually close to Canvas without using any proprietary assets. Layouts use the full content width for dashboard and course surfaces.

<br>

## 🧠 Roadmap

Client-side Canvas parity for this demo is in place. Remaining work is either a real backend or polish that needs one.

- [x] Student / TA / instructor roles (demo persona switching)
- [x] Assignments, submissions, and grading (GradePro)
- [x] Quizzes, statistics, question banks, and CS bank packs
- [x] Inbox compose/reply, notification prefs, and activity → Inbox
- [x] Syllabus, sections, groups, attendance, collaborations, rubric library
- [x] Calendar events, appointment scheduler, due-date overrides
- [x] Grade visibility / post grades, help center, courses catalog, course packages
- [x] Student planner, missing/late indicators, light ArcFolio
- [x] Weighted assignment groups, anonymous grading, peer review
- [ ] Real authentication flow (login / registration, sessions, per-user data)
- [ ] Real backend integration (persistent, multi-user, server grading, LTI)
- [ ] Fully mobile-first responsive layout

Deferred backend items (webcam proctoring, Turnitin, QTI zip packages, and similar) live in [`canvas-clone/docs/TODO.md`](canvas-clone/docs/TODO.md).

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
