import { useStudentView as useStudentViewHook } from "../utils/studentView";

export function useStudentView(courseId?: string): boolean {
  return useStudentViewHook(courseId).studentView;
}
