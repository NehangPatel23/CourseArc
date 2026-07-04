# 🎨 Canvas Clone

A high-fidelity, front-end recreation of the [Canvas LMS](https://www.instructure.com/canvas) experience.
It simulates a complete learning-management system — courses, modules, assignments, quizzes, grading, discussions, and more — with a polished, Canvas-inspired UI and **dual student / instructor roles**. Everything runs in the browser with client-side persistence (no backend required).

> 🧩 Educational and design-practice project only. Not affiliated with or endorsed by Instructure Inc.

<br>

## 🚀 Features

### 🏠 Dashboard & Navigation
- Customizable dashboard with draggable widgets (upcoming deadlines, recent activity, grading queue, course health, analytics snapshot, and more)
- Global navigation with ⌘K global search, keyboard shortcuts, and an inbox
- Splash screen, mock login, and an auth gate
- 🌙 Dark / light mode

### 👩‍🏫 Dual Roles: Student & Instructor
- Toggle between **Student View** and **Instructor View** on any course
- Instructor-only tools (editors, grading, statistics) are gated behind the instructor role
- Student-facing views respect availability windows, lock dates, and publish states

### 📚 Course Content
- **Modules** – collapsible sections, drag-and-drop ordering, completion requirements, prerequisites, and access hierarchy
- **Pages** – rich-text pages with a WYSIWYG editor and viewer
- **Files** – file browser with previews (including PDFs)
- **Announcements** – create, schedule/delay, edit, and view announcements
- **Discussions** – topics, threaded replies, and a discussion editor

### 📝 Assignments & Grading
- Assignment creation with availability windows, due dates, and late-penalty policies
- Student submission flow and submission-details view
- **GradePro** SpeedGrader-style interface: document viewer, rubric-style scoring, comments, and feedback

### 🧪 Quizzes
- Quiz builder supporting multiple question types: multiple choice, multiple answers, true/false, short answer, fill-in-the-blank, numerical, matching, and essay
- Configurable time limits, multiple attempts, scoring policies, answer shuffling, and correct-answer visibility rules
- Timed quiz-taking experience with progress tracking
- **GradePro** grading for quizzes and per-question manual scoring
- **Quiz Statistics** with per-question breakdowns

### 🎓 Grades & Analytics
- Course gradebook and per-student grade views
- Analytics page with course-completion visualizations

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
├── public/            # Static assets
└── src/
    ├── components/     # Reusable UI (modals, nav, dashboard widgets, editors, viewers)
    ├── pages/          # Route-level pages (dashboard, courses, assignments, quizzes, ...)
    ├── layouts/        # Shared layouts (e.g. CourseLayout)
    ├── hooks/          # Custom hooks (settings, student view, keyboard shortcuts, ...)
    ├── utils/          # Domain logic + localStorage stores (quizzes, assignments, files, ...)
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

<br>

## 💾 Data & Persistence

There is no server. All data (courses, modules, assignments, quizzes, submissions, grades, settings) is seeded from mock data and persisted in the browser's `localStorage`. Clearing site data resets the app to its seeded state.

<br>

## 🎨 Design Philosophy

The project mirrors Canvas's clean, academic interface while leaving room for creative implementation. Fonts and color palettes stay visually close to Canvas without using any proprietary assets.

<br>

## 🧠 Future Roadmap

- [x] Mock authentication / login flow
- [x] Student vs. instructor roles
- [x] Assignments, submissions, and grading (GradePro)
- [x] Quizzes with statistics
- [ ] Real backend integration (persistent, multi-user)
- [ ] Fully mobile-first responsive layout
- [ ] Automated end-to-end test coverage (Playwright)

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
