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
    body: "Dashboard is your studio desk — greeting, plated courses, and side notes. Courses is the full catalog index: every plate, by term. Pin a course, set a nickname, or compose a new studio from that page so it is not a copy of Dashboard.",
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
    body: "Use the Viewing as toggle in the sidebar to switch between student, TA, and instructor experiences. In student view you only see published content and grades that have been posted.",
  },
  {
    id: "ta-view",
    category: "Roles",
    title: "What can a TA do?",
    body: "Switch Viewing as to TA to use Taylor Kim. Like Canvas, TAs can create, edit, publish, and unpublish course content (assignments, quizzes, pages, modules, files, discussions, announcements, syllabus, rubrics, groups, and question banks), publish or unpublish the course, grade, see unpublished items, moderate discussions, manage the calendar, and add students. They cannot change course settings, create or delete courses, or add other instructors or TAs.",
  },
  {
    id: "demo-personas",
    category: "Roles",
    title: "How do demo student personas work?",
    body: "While in student view, pick a named student from the persona menu. Alex has complete on-time work, Jordan is missing, and Sam is late. Taylor Kim is the TA persona — switch Viewing as to TA to grade and moderate as Taylor. Use Reset demo data in the persona menu or Settings to re-seed those submissions without wiping instructor content. Your own profile appears with a You badge. Submissions are stored under each persona’s id so gradebook demos stay distinct.",
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
    body: "Students take quizzes from the Quizzes tool. Instructors review attempts in SpeedGrader, adjust scores, and control when scores and feedback are visible. Use Moderate on a quiz (or People → Accommodations) to grant extra time, attempts, or availability unlocks for individual students.",
  },
  {
    id: "shortcuts",
    category: "Keyboard",
    title: "What keyboard shortcuts are available?",
    body: "Press ? anytime for the shortcut sheet. / focuses course search, ⌘K / Ctrl+K opens global search, and ? opens keyboard help. On Calendar, T jumps to today and the left/right arrows move by month, week, or day depending on the current view.",
  },
  {
    id: "import-export",
    category: "Course packages",
    title: "How do I export or import a course?",
    body: "Open Course Settings (instructor view) and use Export course package or Import. Packages are JSON (v1 or v2) with curriculum, roster, student activity, question banks, peer reviews, accommodations, quiz rubric templates, syllabus, group sets, group homepages, attendance, collaborations, assignment rubrics, and course inbox threads. File binaries are not included. On import, choose Content, Roster, Grades, and/or Banks so you can restore only the sections you need.",
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
    body: "Open Help Center from the sidebar Actions section, the Help link on course pages, or press ? for keyboard shortcuts. The Help Center includes a searchable FAQ; ⌘K / Ctrl+K global search also returns matching FAQ articles.",
  },
  {
    id: "planner",
    category: "Navigation",
    title: "What is the Planner?",
    body: "Planner unifies coming-up deadlines, booked appointment times, and your personal to-dos across all courses. Open it from the sidebar (between Calendar and Inbox). Filter by course, mark a deadline done (does not submit), and add a personal note. Booked office hours also show on the dashboard Upcoming Deadlines and To-Do widgets. Use Open Planner on the Priority To-Do dashboard widget.",
  },
  {
    id: "inbox",
    category: "Navigation",
    title: "How does Inbox work?",
    body: "Open Inbox from the sidebar to read, star, and reply to conversations. Compose a new message (or press C) and pick a course plus people from the roster — or Add group to include everyone in a course group. Use CC for extra recipients and attach small files (stored in this browser). Instructors can Enable student replies when messaging students — leave it off for one-way notices, or lock/allow replies later on the thread. Archive tucks a conversation away; mute stops the unread badge. Unread, Starred, Sent, and Archived folders filter the list. New announcements, discussion replies to your posts, posted grades, and appointment updates also arrive as Inbox threads when those notification preferences are on. Direct messages always deliver. Turn off the Inbox badge in Settings if you do not want a sidebar count.",
  },
  {
    id: "groups-homepage",
    category: "People",
    title: "How do group homepages work?",
    body: "People → Groups is where instructors build group sets. Optional rules include self-signup, a max group size, same-section only, and a group leader. Open homepage on a group for announcements, a group discussion, files, and the member list. Students only see homepages for groups they belong to.",
  },
  {
    id: "attendance-roll",
    category: "People",
    title: "How does roll-call attendance work?",
    body: "Course navigation → Attendance is a class roll separate from appointment sign-up attendance. Instructors take today (or another date), mark present / absent / late / excused, or mark everyone present. Students see their own session history. Appointment slot attendance still lives on the calendar.",
  },
  {
    id: "collaborations",
    category: "Course content",
    title: "What are Collaborations and Conferences?",
    body: "Collaborations stores links to shared documents (Google Docs, Figma, and similar). The Conferences tab stores join URLs and optional start times. This demo does not host Google Docs or Zoom — it keeps the links in your browser so the class can open them.",
  },
  {
    id: "missing-work",
    category: "Grades",
    title: "What do Missing and Late mean in my grades?",
    body: "Missing means a due date has passed and you have not submitted yet. Late means you submitted after the due date. Filter the student gradebook by Missing or Late, and check the Missing Work widget on the dashboard. Instructors see who is missing on that widget, in GradePro sidebars, and via the Missing work filter in the course gradebook.",
  },
  {
    id: "eportfolio",
    category: "Profile",
    title: "How does ArcFolio work?",
    body: "In Student View, open ArcFolio to add a headline, skills, course submissions, and external projects (GitHub, websites, links, or zip/files). Instructors browse from ArcFolio (course → student) or by clicking a student name on People. Use Public share for a read-only /portfolio/:id/public link. Export JSON includes metadata (file binaries stay local).",
  },
  {
    id: "whats-new",
    category: "Help",
    title: "What’s new in this demo?",
    body: "Courses include a Syllabus tool, People → Groups with group homepages, roll-call Attendance, Collaborations (doc and conference links), and a Rubrics library you can copy from another course. Inbox is a real messenger: compose, CC, attachments, archive, mute, and lock student replies. Course packages include banks, peer reviews, accommodations, rubric templates, group spaces, attendance, collaborations, and course inbox threads (v2, selective import). Assignment groups support drop-lowest, extra credit, and 0-weight. Instructors see missing-work rosters and can message selected students from People or GradePro. Peer review supports N reviewers, due dates, and anonymous peers. Reset demo data seeds Alex (complete), Jordan (missing), and Sam (late). Planner has mark-as-done, notes, course filter, and ICS export. Catalog supports favorites and nicknames. Help is contextual and searchable from ⌘K.",
  },
  {
    id: "ayuda-paquetes",
    category: "Ayuda",
    title: "¿Cómo exporto o importo un curso?",
    body: "Abre Configuración del curso y usa Exportar paquete o Importar. Elige Contenido, Lista, Calificaciones y/o Bancos. Los archivos binarios no se incluyen.",
  },
  {
    id: "question-banks",
    category: "Quizzes",
    title: "What are question banks?",
    body: "Instructors create shared Question Banks from Quizzes → Question Banks. In the quiz Questions editor, Find in banks searches stems and inserts a copy. Copy or move questions between banks from the bank editor. Import JSON, CSV, Markdown, QTI 1.2 XML, Moodle XML, or Aiken .txt into a bank or quiz (points and feedback supported); if the title already exists you can rename, replace, or skip. Export a bank as JSON or QTI. Select two or more banks and use Merge selected to build a combined bank. Copy to another course duplicates the questions, while Link creates a read-only alias marked Linked — the first edit there makes a local copy. Usage lists which quizzes draw from which bank. Use Auto-assign points to score by type and content (recall → concept → application → synthesis). A quiz can mix fixed inline questions with random bank draws; if quiz Points is set, attempt weights scale to that total.",
  },
  {
    id: "quiz-moderate",
    category: "Quizzes",
    title: "How do I moderate a quiz for individual students?",
    body: "Open a quiz → Moderate. Grant extra minutes, a time multiplier (e.g. 1.5×), extra attempts, or unlock availability outside the normal window. Changes stay in draft until you Save. Select multiple students for bulk +15 min / +1 attempt. The In progress panel shows who is taking the quiz now—use +15 now for a one-shot extension on that attempt only, or Clear progress. On a student card, open View attempts for a preview of each submission—delete a specific attempt or all of them from there.",
  },
  {
    id: "quiz-accommodations",
    category: "Quizzes",
    title: "What are course-wide quiz accommodations?",
    body: "People → Accommodations sets extras that apply to every quiz (extra time, multiplier, attempts, availability unlock, and an optional note). Per-quiz grants on Moderate can add more; the more generous value wins for each field. Students see their effective accommodations on the quiz page. Mid-attempt grants of time or attempts show a toast and update the timer when the student is still taking the quiz.",
  },
  {
    id: "quiz-print-export",
    category: "Quizzes",
    title: "How do I print or export a quiz?",
    body: "Open Preview on a quiz to print: use Print quiz for a blank copy, or Print with answer key for an instructor key. Chrome’s print dialog can save as PDF. On the quiz page, Export downloads the quiz as JSON (questions plus settings). In the Questions editor, Export downloads questions only — the same JSON Import accepts.",
  },
  {
    id: "quiz-time-analytics",
    category: "Quizzes",
    title: "How do quiz time-per-question statistics work?",
    body: "While a student takes a quiz, focus time is recorded per question (the current question in one-at-a-time mode, or the most visible question when all are shown). Time pauses when the browser tab is hidden. After submit, Quiz → Statistics shows median time on each question card and a Slowest questions list on Overview. Older attempts taken before this feature have no timing data.",
  },
  {
    id: "quiz-code-runner",
    category: "Quizzes",
    title: "How do coding test cases and the code runner work?",
    body: "On a coding question, add stdin → expected stdout test cases. Supported runners: JavaScript and TypeScript (local worker), Python (Pyodide in a worker; first run downloads the runtime), C, C++, Java, and SQL via the free public Wandbox API (needs network; no API key), and HTML/CSS (sandboxed iframe preview; grades by normalized source, HTML body text, or CSS property checklist lines like color: red without braces). Java solutions should use class Main (not public class Main — Wandbox compiles as prog.java); switching Language to Java fills a starter template when starter code is empty. Set the question Language to match the code (SQL questions must be Language = SQL, not Python). Other has no runner — use reference string-match or GradePro. Students should Run tests while taking the quiz; submit reuses those results for partial credit (passed / total) and does not re-run the judge for empty answers or code that was never tested (those score 0 so submit stays fast). Instructors can regrade later to force a fresh run. Network errors show a Retry option. This is a soft sandbox / third-party compiler, not a production exam judge.",
  },
  {
    id: "quiz-copy-course",
    category: "Quizzes",
    title: "Can I copy a quiz to another course?",
    body: "On the Quizzes list, use Copy to another course (folder icon) next to Duplicate. Pick a destination course — a draft copy is created there with new question IDs. Submissions and in-progress attempts are not copied. Question banks have the same Copy action (plus Link). Import quiz on the Quizzes page creates a draft from exported quiz JSON (all settings round-trip) or from QTI 1.2 XML, Moodle XML, Aiken .txt, CSV, and Markdown files. Tick the checkboxes on quiz rows to Publish selected or Unpublish selected in bulk. In the Questions editor, Copy to another quiz (folder icon on a question or group) appends a copy of that item to another quiz in the course.",
  },
  {
    id: "quiz-lock-on-leave",
    category: "Quizzes",
    title: "What does lock when student leaves the quiz tab do?",
    body: "In quiz settings, enable Lock and blur when student leaves the quiz tab. If a student switches away during an attempt, the quiz blurs and locks behind a return screen until they acknowledge — the time limit keeps counting down (wall clock). Optionally enable Warn on first leave, Also count window blur, and/or Auto-submit after N leaves. Require fullscreen records a leave if they exit fullscreen mid-attempt. Idle timeout warns then auto-submits. Soft-disable paste blocks paste on essay/coding with a toast. Practice quizzes keep leave-lock off by default. Attempts store a submit reason (timeout, max leaves, idle, manual, or instructor force-end). Moderate shows leave toasts, answered counts, bulk extend, force-submit, and messaging; GradePro and submission details show the leave timeline.",
  },
  {
    id: "quiz-fullscreen-seat",
    category: "Quizzes",
    title: "What are fullscreen and seat number options?",
    body: "Require fullscreen before starting prompts students to enter browser fullscreen (soft focus mode); exiting fullscreen mid-attempt is recorded as a leave. Collect seat / station number asks for a seat before the attempt; you can require it or allow skip. Seat is saved on progress/attempts and shown on Moderate, GradePro, and submission details.",
  },
  {
    id: "quiz-take-shortcuts",
    category: "Quizzes",
    title: "What keyboard shortcuts work while taking a quiz?",
    body: "When not typing in an input: J or N goes to the next question, K or P to the previous, and M marks the current question for review. A short hint appears near the submit bar.",
  },
  {
    id: "quiz-qti-export",
    category: "Quizzes",
    title: "How do I export or import QTI?",
    body: "On the quiz viewer, use QTI next to Export (JSON). The Questions editor also has Export QTI for the current question set, and each question bank card has a QTI export. Export is QTI 1.2 (multiple choice, multi-answer, true/false, numerical, matching, and text items; question groups become sections). Import accepts QTI 1.2 XML, Moodle XML, and Aiken .txt from the Quizzes page, the Questions editor, and Question Banks. Zipped IMS content packages are not supported — unzip and import the XML.",
  },
  {
    id: "quiz-stats-csv",
    category: "Quizzes",
    title: "How do I export quiz statistics as CSV?",
    body: "Open Quiz → Statistics and use the Export menu: full statistics CSV, grades CSV (student × score), or Canvas-style scores CSV. Overview includes Cronbach α, an attention list (slow + low %), leave chronology, week/seat cohorts, and bank-source breakdowns when questions come from banks. Attempts can filter by leaves, seat, and auto vs manual grading.",
  },
  {
    id: "quiz-gradepro-tools",
    category: "Quizzes",
    title: "What GradePro tools help with quiz grading?",
    body: "Quiz GradePro’s right panel shows soft originality for the current submission (peer and self overlaps). Open the full originality report for a Turnitin-style view: highlighted paper, side-by-side source comparison, Match Overview, All / Peer / Self layers, All Sources, filters (exclude small matches / low %, boilerplate exclusions, code normalization, other quizzes), exclude-and-refresh, and JSON/CSV export. Class-wide scores live in the Similarity inbox. Configure options on the quiz editor (Soft originality). Scores are client-side against local attempts only — not an internet or publisher database.",
  },
  {
    id: "quiz-essay-rubric",
    category: "Quizzes",
    title: "How do essay rubrics work on quizzes?",
    body: "In the Questions editor, open an essay question and enable Use grading rubric. Add criteria (or use the suggested Content / Clarity / Completeness split). In GradePro, rating buttons under the essay set that question’s points; Save grade stores the rubric assessments and updates the attempt score. Criterion totals that exceed the question’s points are clamped to the question max.",
  },
  {
    id: "quiz-question-groups",
    category: "Quizzes",
    title: "What are local question groups?",
    body: "In the quiz Questions editor, click Group to add a pick-N pool of questions authored on the quiz (separate from bank pools on the settings tab). Set how many questions to draw and add members; each attempt gets a seeded subset. Expected points use the average member weight × pick count, then scale with the quiz point total like other questions.",
  },
  {
    id: "quiz-partial-credit",
    category: "Quizzes",
    title: "How does partial credit work on quizzes?",
    body: "In the quiz editor, enable Award partial credit. Multiple-answers and matching earn a proportional share for correct picks or pairs. Optionally penalize wrong multi-answer picks (quiz-wide or per question). Numerical questions can use a partial-credit margin (±): answers inside the full-credit margin score 100%; between full and partial margins, points decrease linearly to 0. Fill-in-the-blank and short-answer near matches (configurable similarity threshold, default 50%) earn proportional credit. Each eligible question can override the quiz partial-credit, multi-answer penalty, and near-match threshold. When answer shuffle is on, matching review notes that left/right order was shuffled but scoring is by pair content. Review shows a short explainer when partial credit was applied. Saving after scoring changes can regrade attempts (optionally clearing GradePro overrides). Correct and incorrect feedback are authored separately; general feedback is the fallback. Import JSON/CSV/Markdown can include partialTolerance, partialCredit, partialCreditPenalty, and nearMatchThreshold.",
  },
  {
    id: "quiz-fudge-points",
    category: "Quizzes",
    title: "What are fudge points?",
    body: "In GradePro, fudge points add or subtract from an attempt’s base score without changing per-question points. The effective score (base + fudge) is what students see when scores are visible, labeled when fudge is non-zero. Gradebook cells show a small “f” marker (hover for the amount) when the posted quiz score includes fudge. Gradebook CSV export includes a fudge column next to each quiz.",
  },
  {
    id: "quiz-scoring-policy",
    category: "Quizzes",
    title: "How do multiple attempts and scoring policy work?",
    body: "When multiple attempts are allowed, choose how the gradebook score is computed: highest, latest, average, or first. On the quiz page, take review, and Submission Details, an attempt picker lets you open any attempt; the one that counts toward the score is labeled. Average policy shows the average in the gradebook and uses the latest attempt for response review.",
  },
  {
    id: "assignment-groups",
    category: "Grades",
    title: "How do assignment groups and weights work?",
    body: "In Course Settings → Grading, create custom groups (Homework, Exams, Labs, and so on) and optionally enable Weighted grading. Each assignment, quiz, or discussion picks a group in its editor and appears under that group on the Assignments page. When weighted grading is on, overall % is the weighted average of group percentages. When it is off, overall % is total points earned ÷ points possible. Drop-lowest N ignores the weakest items in a group. Extra-credit groups add on top without counting in the weight total. 0% weight groups are excluded when weighted grading is on.",
  },
  {
    id: "anonymous-grading",
    category: "Grades",
    title: "What is anonymous grading?",
    body: "Enable Grade anonymously on an assignment or quiz. In GradePro, student names, avatars, and file names are hidden as Student 1, Student 2, … until that student’s grade is posted (Post reveals names).",
  },
  {
    id: "peer-review",
    category: "Assignments",
    title: "How does peer review work?",
    body: "Enable peer review on an assignment. After students submit, each is assigned N peers (default 1) to score and comment on. Optionally set a peer-review due date and hide reviewee names. Instructors still enter the official grade; peer reviews and a who-hasn’t-reviewed list appear in GradePro.",
  },
  {
    id: "calendar-events",
    category: "Calendar",
    title: "How do calendar events and repeating events work?",
    body: "Use Event on Calendar to add a personal or course event. Instructors can attach events to a course; filter the calendar by course to see just that course’s items. Check Repeat this event for daily, weekly, or monthly series. When you edit or delete a repeating event, choose This event, This and following events, or All events. Drag an occurrence on week, day, or month view to move just that occurrence.",
  },
  {
    id: "calendar-appointments",
    category: "Calendar",
    title: "How do appointment sign-ups work?",
    body: "Instructors create an Appointment group with time slots, optional extra courses, optional section or student limits, a gap between generated times, and an optional cancel cutoff (minutes before start). Duplicate a group to copy times a week later without sign-ups. Students use Find appointment to book or join a waitlist; ended times stay hidden unless Include ended times is on. Canceling a booking requires a comment. Instructors can reschedule by dragging a chip or using the meeting editor (including duration), add meetings to a calendar with .ics, export attendance as CSV from the calendar sidebar, reorder the waitlist, set a location per slot, and print a sign-up sheet. Meeting chat is private: students only see their own conversation plus broadcasts for their status (confirmed or waitlist). Dropping a student requires a comment, and marking someone absent can offer the seat to the next waitlisted student.",
  },
  {
    id: "calendar-due-drag",
    category: "Calendar",
    title: "Can I change a due date from the calendar?",
    body: "In instructor view, drag an assignment, quiz, or graded discussion chip to a new day or hour. Override chips (a section or student) move only that override; Everyone else moves the course default due date. Students cannot drag due dates.",
  },
  {
    id: "syllabus",
    category: "Course content",
    title: "Where is the syllabus?",
    body: "Open Syllabus in course navigation. Instructors and TAs can edit the syllabus body, teaching team, grading groups and letter bands, office hours, and Course Summary titles, points, and due dates. Those sections stay in sync with People, Course Settings, Calendar, Assignments, Quizzes, and Discussions. Save Syllabus is enabled only when there are unsaved changes, and it writes only the sections you edited. Students see the published page, including their own due-date overrides. Sort Course Summary by clicking column headers, or filter by type, upcoming/past, and search. Print saves a copy via the browser print dialog. You can hide Syllabus from students in Course Settings → Course navigation.",
  },
  {
    id: "course-groups",
    category: "People",
    title: "How do sections and groups work?",
    body: "People → Sections assigns each student to one section for differentiated due dates. People → Groups creates group sets (for example Project teams) with named groups. Students can open Groups to see their teammates’ names and emails. Attach a group set on an assignment so members share a submission and GradePro can apply a grade to the whole group. Attach a group set on a discussion so students only see replies from their group; instructors still see everyone. Enable self-signup if students should pick a group.",
  },
  {
    id: "rubric-library",
    category: "Grades",
    title: "How do assignment rubrics work?",
    body: "Open Rubrics in course navigation (instructors and TAs) to create reusable criteria. On an assignment, pick a grading rubric — GradePro then uses that library instead of the default generated rubric. Quiz essay questions still have their own template library in GradePro.",
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
