export type FaqItem = {
  id: string;
  category: string;
  title: string;
  body: string;
};

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "nav-dashboard",
    category: "Navigation",
    title: "What’s the difference between Dashboard and Courses?",
    body: "Dashboard is your home with widgets, deadlines, and a course strip. Courses opens the full course catalog where you can search, filter, and manage all courses.",
  },
  {
    id: "nav-search",
    category: "Navigation",
    title: "How do I search?",
    body: "Press / to focus the sidebar search on the Courses catalog, or ⌘K / Ctrl+K to open global search across the app.",
  },
  {
    id: "student-view",
    category: "Roles",
    title: "What is Student View?",
    body: "Use the Viewing as toggle in the sidebar to switch between instructor and student experiences. In student view you only see published content and grades that have been posted.",
  },
  {
    id: "demo-personas",
    category: "Roles",
    title: "How do demo student personas work?",
    body: "While in student view, pick a named student from the persona menu. Submissions, quiz attempts, and progress are stored under that student’s id so gradebook demos stay distinct.",
  },
  {
    id: "grades-post",
    category: "Grades",
    title: "Why can’t a student see a grade?",
    body: "Grades are hidden until the instructor posts them (column, cell, or all grades). Use Post Grades or the eye icon on gradebook columns in GradePro.",
  },
  {
    id: "quizzes",
    category: "Quizzes",
    title: "How do quizzes and attempts work?",
    body: "Students take quizzes from the Quizzes tool. Instructors review attempts in SpeedGrader, adjust scores, and control when scores and feedback are visible.",
  },
  {
    id: "shortcuts",
    category: "Keyboard",
    title: "What keyboard shortcuts are available?",
    body: "Press ? anytime for the shortcut sheet. / focuses course search, ⌘K / Ctrl+K opens global search, and ? opens keyboard help.",
  },
  {
    id: "import-export",
    category: "Course packages",
    title: "How do I export or import a course?",
    body: "Open Course Settings (instructor view) and use Export course package or Import course package. Packages are JSON files with curriculum, roster, and student activity. File binaries are not included.",
  },
  {
    id: "modules",
    category: "Course content",
    title: "How do modules unlock for students?",
    body: "Instructors can set requirements, sequential unlock, and unlock dates on modules. Students only see published modules and items they are allowed to access.",
  },
  {
    id: "help-center",
    category: "Help",
    title: "Where is Help?",
    body: "Open Help from the sidebar Actions section, or press ? for keyboard shortcuts. This Help page includes a searchable FAQ.",
  },
];

export function searchFaq(query: string): FaqItem[] {
  const q = query.trim().toLowerCase();
  if (!q) return FAQ_ITEMS;
  return FAQ_ITEMS.filter(
    (item) =>
      item.title.toLowerCase().includes(q) ||
      item.body.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q),
  );
}
