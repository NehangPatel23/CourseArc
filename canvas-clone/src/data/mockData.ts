export const mockCourses = [
  {
    id: "1",
    short_name: "CSCI 570",
    title: "Analysis of Algorithms",
    code: "CSCI-570",
    term: "Fall 2025",
    color: "#E74C3C",
    published: true,
    updated_at: "2025-10-20",
  },
  {
    id: "2",
    short_name: "NLP 600",
    title: "Natural Language Processing",
    code: "NLP-600",
    term: "Fall 2025",
    color: "#27AE60",
    published: false,
    updated_at: "2025-10-18",
  },
];

export type DashboardEventType = "due" | "review" | "office";

export type MockGrade = { letter: string; percent: number };

export type MockStudentGrade = {
  student: string;
  overall: MockGrade;
  assignments: Record<string, number>;
};

export const mockGrades: Record<string, MockGrade> = {
  "1": { letter: "A-", percent: 91 },
  "2": { letter: "B+", percent: 87 },
};

const LETTERS = ["A", "A-", "B+", "B", "B-", "C+", "C"];

export function getGradeSnapshot(courseId: string): MockGrade {
  if (mockGrades[courseId]) return mockGrades[courseId];
  let hash = 0;
  for (let i = 0; i < courseId.length; i++) hash = (hash + courseId.charCodeAt(i) * 17) % 100;
  const percent = 72 + (hash % 25);
  const letter = LETTERS[Math.min(LETTERS.length - 1, Math.floor((percent - 70) / 5))];
  return { letter, percent };
}

export function getInstructorGradebook(courseId: string): MockStudentGrade[] {
  const names = ["Alex Chen", "Jordan Lee", "Sam Rivera", "Taylor Kim", "Casey Wong"];
  return names.map((student, i) => {
    const overall = getGradeSnapshot(`${courseId}-${i}`);
    return {
      student,
      overall,
      assignments: {
        "Homework 1": 85 + ((i * 3) % 15),
        "Lab Exercise": 78 + ((i * 5) % 20),
        "Midterm": 80 + ((i * 2) % 18),
      },
    };
  });
}

export type MockSubmission = {
  id: string;
  courseId: string;
  student: string;
  assignment: string;
  submittedAt: string;
  status: "pending" | "graded";
};

export const mockSubmissions: MockSubmission[] = [
  {
    id: "s1",
    courseId: "1",
    student: "Alex Chen",
    assignment: "Problem Set 3",
    submittedAt: "2025-10-19",
    status: "pending",
  },
  {
    id: "s2",
    courseId: "1",
    student: "Jordan Lee",
    assignment: "Problem Set 2",
    submittedAt: "2025-10-18",
    status: "pending",
  },
  {
    id: "s3",
    courseId: "2",
    student: "Sam Rivera",
    assignment: "Lab 4",
    submittedAt: "2025-10-17",
    status: "pending",
  },
];

export function getTermGPA(): string {
  const grades = Object.values(mockGrades);
  if (!grades.length) return "—";
  const avg = grades.reduce((s, g) => s + g.percent, 0) / grades.length;
  const gpa = (avg / 100) * 4;
  return gpa.toFixed(2);
}

export const mockDashboardEvents = [
  {
    courseId: "1",
    dayOffset: 0,
    label: "Problem Set 3 due",
    type: "due" as DashboardEventType,
  },
  {
    courseId: "2",
    dayOffset: 2,
    label: "Lab review",
    type: "review" as DashboardEventType,
  },
  {
    courseId: "1",
    dayOffset: 4,
    label: "Office hours",
    type: "office" as DashboardEventType,
  },
];
