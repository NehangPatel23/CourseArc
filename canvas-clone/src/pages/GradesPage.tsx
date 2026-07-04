import { Link, useParams } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import CourseHeader from "../components/CourseHeader";
import { getCourseById } from "../utils/coursesStore";
import { getGradeSnapshot, getInstructorGradebook } from "../data/mockData";
import { useStudentView } from "../utils/studentView";

export default function GradesPage() {
  const { courseId } = useParams();
  const course = courseId ? getCourseById(courseId) : null;
  const grade = courseId ? getGradeSnapshot(courseId) : null;
  const { studentView } = useStudentView(courseId ?? "default");
  const gradebook = courseId && !studentView ? getInstructorGradebook(courseId) : [];

  if (!course) {
    return (
      <div className="p-8">
        <p className="text-gray-500">Course not found.</p>
        <Link to="/" className="text-canvas-blue hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col bg-canvas-grayLight">
      <CourseHeader />
      <div className="flex-1 overflow-y-auto bg-white px-8 py-8">
        <div className="w-full">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-gray-500" />
                <h1 className="text-2xl font-semibold text-canvas-grayDark">Grades</h1>
              </div>
              <p className="mt-1 text-sm text-gray-600">
                {studentView
                  ? "View your grades for this course."
                  : "Review and manage the class gradebook."}
              </p>
            </div>
          </div>

          {studentView ? (
            <div className="mt-6 rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
              {grade ? (
                <div className="text-center">
                  <p className="text-5xl font-bold text-canvas-grayDark">{grade.letter}</p>
                  <p className="mt-2 text-lg text-gray-500">{grade.percent}% overall</p>
                  <p className="mt-4 text-sm text-gray-400">Mock grade data for this course.</p>
                </div>
              ) : (
                <p className="text-center text-sm text-gray-600">No grade data available yet.</p>
              )}
            </div>
          ) : (
            <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <div className="border-b border-gray-200 px-5 py-4">
                <h2 className="mb-1 text-lg font-semibold text-canvas-grayDark">Class Gradebook</h2>
                <p className="mt-0.5 text-xs text-gray-500">Mock data for demonstration.</p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-200 bg-canvas-grayLight/60 text-left text-xs uppercase tracking-wide text-gray-500">
                      <th className="px-5 py-3 font-semibold">Student</th>
                      <th className="px-5 py-3 font-semibold">Overall</th>
                      <th className="px-5 py-3 font-semibold">Homework 1</th>
                      <th className="px-5 py-3 font-semibold">Lab Exercise</th>
                      <th className="px-5 py-3 font-semibold">Midterm</th>
                    </tr>
                  </thead>
                  <tbody>
                    {gradebook.map((row) => (
                      <tr key={row.student} className="border-b border-gray-200 last:border-0">
                        <td className="px-5 py-3 font-medium text-canvas-grayDark">
                          {row.student}
                        </td>
                        <td className="px-5 py-3 tabular-nums text-gray-700">
                          {row.overall.letter} ({row.overall.percent}%)
                        </td>
                        <td className="px-5 py-3 tabular-nums text-gray-700">
                          {row.assignments["Homework 1"]}%
                        </td>
                        <td className="px-5 py-3 tabular-nums text-gray-700">
                          {row.assignments["Lab Exercise"]}%
                        </td>
                        <td className="px-5 py-3 tabular-nums text-gray-700">
                          {row.assignments["Midterm"]}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
