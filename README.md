<p align="center">
  <img src="canvas-clone/public/app-icon.svg" width="72" alt="CourseArc mark" />
</p>

<h1 align="center">CourseArc</h1>

<p align="center">
  <strong>A studio for learning — a high-fidelity, client-side LMS with student, TA, and instructor roles, at zero backend cost.</strong>
</p>

<p align="center">
  <a href="https://canvas-clone-theta.vercel.app">Live demo</a>
  &nbsp;·&nbsp;
  <a href="#getting-started">Getting started</a>
  &nbsp;·&nbsp;
  <a href="#question-banks">Question banks</a>
</p>

<p align="center">
  <img alt="lms" src="https://img.shields.io/badge/lms-client--side%20demo-3D6B4F" />
  <img alt="roles" src="https://img.shields.io/badge/roles-student%20%7C%20TA%20%7C%20instructor-C45D26" />
  <img alt="stack" src="https://img.shields.io/badge/stack-React%2019%20—%20Vite%207%20—%20TypeScript-1F2A24" />
  <img alt="tests" src="https://img.shields.io/badge/tests-Vitest%20%2B%20Playwright-C4A35A" />
</p>

## Overview

---

CourseArc is a complete **learning-management studio** that you can run in a browser with no server, no database, and no API keys. It models the surfaces instructors and students actually use: a customizable **dashboard**, a seeded **CSCI 570** semester, **modules** with unlock rules, **GradePro** speed grading, a 17-type **quiz platform**, **question banks**, discussions, people and groups, a full **calendar** with office-hour appointments, **Inbox**, a cross-course **planner**, and a light **ArcFolio** showcase. Roles are first-class — switch **Student**, **TA**, and **Instructor**, then swap demo student personas so submissions, missing work, and late work stay distinct while you walk through the product.

Built as a **solo, zero-backend** stack: React and Vite on Vercel, domain logic in TypeScript stores, persistence in **localStorage** and IndexedDB. Optional **device sync** can share a snapshot across browsers; course **JSON packages** import and export a curriculum without wiping the rest of the studio.

> Experience target: Canvas depth · atelier chrome · GradePro grading · CS-ready quizzes · paper-and-moss polish.

Independent educational and design-practice project. Not affiliated with or endorsed by Instructure Inc.

## Live demo

---

| | |
| --- | --- |
| **URL** | [canvas-clone-theta.vercel.app](https://canvas-clone-theta.vercel.app) |
| **Try it** | Splash → dashboard → open **CSCI 570 · Analysis of Algorithms** → toggle **Student / TA / Instructor** in the global nav |
| **Deep dive** | Course home → Modules → Quizzes / GradePro → People → Calendar → Inbox → Settings |

The hosted demo is the full client app. There is no login server: the optional **login gate** is off by default, and you enter as a demo persona. Everything you create lives in **this browser**. Use **Settings → Device sync** to push/pull a room snapshot, or **Course Settings → Import / export package** to share a course. Clearing site data resets the studio to its seeded state, including the 15-week CS570 semester.

## Product surface

---

### Dashboard, catalog, and navigation

The home dashboard is a **draggable widget studio** with separate student and instructor layouts. Widgets cover **quick actions**, this week, announcements, priority to-dos, recent activity, **course health**, the **grading queue**, progress, grades snapshot, upcoming deadlines, analytics, **missing work**, and a rotating tip. The **Courses** catalog (`/courses`) supports pin/favorite, nicknames, and term grouping. Global chrome includes ⌘K search, `?` keyboard shortcuts, Inbox, Planner, Analytics, Help, and a **Night desk** theme. A short atelier tour introduces the studio on first visit.

### Roles and demo personas

| Role | What you can do |
| --- | --- |
| **Instructor** | Author and publish content, manage roster/sections/groups, grade in GradePro, post/hide grades, run moderate extras, import/export packages, edit course settings |
| **TA** | Author, grade, and publish course content; instructor-only course administration stays gated |
| **Student** | See only published, unlocked, in-window items; submit work; take quizzes; join self-signup groups; book office hours; view posted grades |

Switchable **demo students** (Alex complete, Jordan missing, Sam late, plus extra CS570 roster names) keep submissions and grades distinct while presenting. Avatars support colored initials, photo upload, or doodle faces.

### Course content

- **Home** — customizable student/instructor widget layout for the course
- **Modules** — collapsible sections, drag-and-drop ordering, completion requirements, prerequisites, access hierarchy, and previous/next item navigation
- **Pages** — WYSIWYG authoring and a safe viewer
- **Files** — folder browser with typed previews (PDF, images, office documents, text, video)
- **Announcements** — create, schedule/delay, edit, and view; copies land in Inbox
- **Discussions** — topics, threaded replies, graded discussions, GradePro-style scoring
- **Syllabus** — teaching team, office hours, course summary, and grading scheme
- **People** — roster, sections, group sets with homepages, self-signup, and quiz accommodations
- **Attendance** — roll call (present / absent / late / excused)
- **Collaborations** — shared-doc and conference join links
- **Rubrics** — reusable library attached to assignments, discussions, and essay quiz questions
- **Audit log** — client-side trail for regrades, key changes, and sync imports

Student-facing views honor **publish state**, **lock dates**, **availability windows**, module prerequisites, and **grade visibility**.

### Assignments and GradePro

Assignments support due dates, availability windows, **late-penalty policies**, and per-section / per-student **due-date overrides**. Students submit and review their own submission details. Instructors grade in **GradePro**: document viewer, rubrics, comments, annotations, and feedback.

The gradebook adds assignment **groups with weighted overall %** (drop lowest, extra credit, 0-weight), per-column / per-cell **post & hide**, filters, a missing-work roster, and student comment composers. **Anonymous grading** holds names in GradePro until grades are posted. **Peer review** assigns N reviewers with due dates and optional anonymous peers; the instructor grade remains official. Students only see **posted** grades and instructor feedback.

### Quiz platform

A full quiz builder, taker, moderator, and grader:

| Area | Detail |
| --- | --- |
| **Question types** | Multiple choice, multiple answers, true/false, short answer, fill-in-the-blank(s), numerical, matching, ordering, calculated/formula, Likert, hotspot, essay, **file upload**, inline code, coding (Monaco), notes, and **pick-N groups** |
| **Authoring** | Time limits, multiple attempts, scoring policies, shuffling, access codes, correct-answer visibility, Bloom tags, difficulty, rich prompts, KaTeX, and code samples |
| **Taking** | Timed attempts, progress restore, coding questions with an in-browser runner, file-upload answers stored locally |
| **Moderation** | Extra time / attempts / unlock per student; course-wide accommodations |
| **Grading** | GradePro for quizzes, per-question manual scores, statistics (overview, histogram, per-question cards), and a **client-side similarity report** |
| **Import / export** | JSON, CSV, Markdown, QTI XML, Moodle XML, Aiken |

### Question banks

Forty-six CS topic banks (~104 questions each) ship under `canvas-clone/docs/banks/` and `src/data/bankPacks/`. Banks support pull-random / copy-into-quiz, merge, link-across-courses, and conflict handling (rename / replace / skip) on import. Topics range from data structures and algorithms through operating systems, ML, cryptography, HCI, and capstone research methods. See [Question banks](#question-banks).

### Calendar, Inbox, and Planner

- **Calendar** — month / week / day / agenda, course and type filters, today jump, day detail, print, and ICS export
- **Appointment groups** — instructor office hours with slots, student signup, waitlist, and slot attendance
- **Planner** — cross-course coming-up deadlines, booked appointments, and personal to-dos (mark-as-done, notes, ICS)
- **Inbox** — course messenger with compose, reply, CC, attachments, archive, mute, and lock-student-replies. Announcements, discussion replies, posted grades, and appointments also land here

### Student extras

Missing and late indicators in the gradebook and a dashboard **Missing Work** alert. **ArcFolio** showcases featured submissions and external projects, including a public share link (`/portfolio/:studentId/public`).

### Studio tools

- **Course packages (JSON v2)** from Course Settings — curriculum, roster, grades, banks, peer reviews, accommodations, group spaces, attendance, collaborations, syllabus, and course inbox (file binaries excluded; selective import)
- **Device sync** — optional room snapshot (BroadcastChannel + hosted JSON blob) with conflict review
- **Action alerts** — per-kind toast preferences (saved, created, deleted, published, files, grading, messages, layout, errors)
- **Help** — searchable FAQ covering navigation, roles, grades, quizzes, packages, and shortcuts
- **Settings** — profile, avatar, login-gate toggle, storage usage, backup download, and demo reset

## Seeded semester

---

On first load, CourseArc upserts **CSCI 570 · Analysis of Algorithms**: a 15-week module sequence, lecture pages, homework and exam assignments, quizzes with diagrams and feedback, discussions, files, syllabus, appointment hours, collaborations, group sets, attendance sessions, a demo roster, and sample submissions across personas. Seed-owned ids are refreshed when the semester copy improves; user-created rows with other ids are kept.

## Tech stack

---

| Layer | Technology |
| --- | --- |
| UI | React 19, TypeScript, Tailwind CSS 3, Fraunces + Sora |
| App | Vite 7, React Router 7 |
| State | React hooks + `localStorage` stores; file blobs in IndexedDB |
| Rich content | CKEditor 5, TinyMCE, KaTeX, Prism, Monaco |
| Documents | pdf.js |
| Drag and drop | dnd-kit |
| Quality | ESLint, Vitest, Playwright |
| Hosting | Vercel (static client) |

No backend, ORM, or paid inference. Optional sync uses a public JSON blob room you opt into from Settings.

## Architecture

---

The Vite application lives in [`canvas-clone/`](canvas-clone). Routes are declared in `src/App.tsx`. Domain logic sits in `src/utils/*` stores (courses, modules, quizzes, grades, inbox, packages, and so on) so pages stay presentational. Custom events (`MODULES_CHANGED_EVENT`, roster changes, sync applied, …) keep distant views in sync inside one tab.

```
canvas-clone/
├── docs/                 # Deferred backend TODOs + CS bank import pack
├── e2e/                  # Playwright smokes (inbox, course, calendar, quizzes, catalog, TA)
├── sample-imports/       # Example quiz / bank files
├── scripts/              # Bank generation helpers
├── public/               # Favicons and static assets
└── src/
    ├── components/       # Nav, GradePro, file viewers, dashboard widgets, modals
    ├── pages/            # Route-level screens
    ├── layouts/          # Course chrome
    ├── hooks/            # Settings, student view, user, shortcuts
    ├── utils/            # Domain stores and persistence
    ├── data/             # Seed data, CS570 semester, bank packs
    ├── types/            # Shared TypeScript types
    ├── App.tsx           # Route tree
    └── main.tsx          # Entry
```

## Getting started

---

### 1. Clone

```bash
git clone https://github.com/NehangPatel23/CourseArc.git
cd CourseArc/canvas-clone
```

### 2. Install

```bash
npm install
```

### 3. Run

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Data persists in this browser’s `localStorage` / IndexedDB.

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Vite development server |
| `npm run build` | Type-check (`tsc -b`) and production build |
| `npm run preview` | Preview the production build |
| `npm run lint` | ESLint |
| `npm test` | Vitest unit tests |
| `npm run test:e2e` | Playwright smoke tests (starts the app) |

## Question banks

---

Import from a course → **Question Banks** → **Import**. Each file matches `{ "version": 1, "title": "...", "questions": [ ... ] }`. Resolve title conflicts with Rename / Replace / Skip.

| # | Title | # | Title |
| ---: | --- | ---: | --- |
| 1 | Data Structures | 24 | JavaScript and TypeScript |
| 2 | Algorithms & Complexity | 25 | Software Engineering |
| 3 | Programming Fundamentals | 26 | DevOps and Site Reliability |
| 4 | Systems, OS & Networking | 27 | Mobile and Cloud Computing |
| 5 | NLP & Language Models | 28 | Functional Programming |
| 6–9 | Python, Java, C, C++ | 29 | Concurrent Programming |
| 10–12 | Discrete Math, Probability, Linear Algebra | 30–31 | Theory of Computation, Formal Methods |
| 13–15 | Computer Organization, OS, Networks | 32–35 | AI, ML, Data Science, Computer Vision |
| 16–18 | Cybersecurity, Cryptography, Databases | 36–38 | IR, Computer Graphics, HCI |
| 19–21 | Parallel/Distributed, Compilers, Embedded/IoT | 39–41 | Ethics, Numerical Methods, Game Dev |
| 22–23 | HTML/CSS, Web Technologies | 42–46 | Quantum, Blockchain, Robotics, Bioinformatics, Capstone |

Catalog and import notes: [`canvas-clone/docs/banks/README.md`](canvas-clone/docs/banks/README.md).

## Testing

---

Unit tests cover gradebook weighting, due-date overrides, quiz import/export, formula questions, partial credit, permissions, inbox, calendar, and related stores (`npm test`). Playwright smokes cover dashboard load, catalog, course structure, inbox, calendar, quizzes, login gate, and TA access (`npm run test:e2e`).

## Roadmap

---

Client-side LMS completeness for this demo is in place. Remaining work is a real backend or polish that needs one.

- [x] Student / TA / instructor roles and demo personas
- [x] Assignments, submissions, GradePro, weighted groups, anonymous grading, peer review
- [x] Quizzes, statistics, similarity report, question banks, 46 CS packs
- [x] Inbox, calendar, appointment scheduler, planner, ICS
- [x] Syllabus, sections, groups, attendance, collaborations, rubric library
- [x] Grade visibility, help center, course packages, ArcFolio
- [x] CS570 seeded semester, action alerts, device sync, course audit log
- [ ] Real authentication (registration, sessions, per-user server data)
- [ ] Multi-user backend (persistent grading, LTI, hosted files)
- [ ] Fully mobile-first responsive layout

Deferred items that need hardware, vendor LTI, or a server (webcam proctoring, Turnitin, QTI zip packages, and similar) live in [`canvas-clone/docs/TODO.md`](canvas-clone/docs/TODO.md).

## Author

---

**Nehang Patel** · University of Southern California

[GitHub](https://github.com/NehangPatel23) · [LinkedIn](https://www.linkedin.com/in/nehangpatel/)

## License

---

MIT. Fork, modify, and learn from it. Do not use Instructure or Canvas trademarks in a way that implies affiliation.
