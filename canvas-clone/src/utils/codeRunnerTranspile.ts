import { transform } from "sucrase";
import type { CodeLanguage } from "./quizzes";

/** Transpile TypeScript student code to plain JS for the existing JS harness. */
export function transpileStudentCode(
  language: CodeLanguage | string | undefined,
  code: string,
  mode: "transpile" | "strip" = "transpile",
): { code: string; error?: string } {
  if (language !== "typescript") return { code };
  try {
    // Sucrase always strips types; there is no real tsc strict checking in-browser.
    // `strip` vs `transpile` is documented for instructors — both use the same transform.
    void mode;
    const result = transform(code, {
      transforms: ["typescript"],
      disableESTransforms: true,
    });
    return { code: result.code };
  } catch (e) {
    return {
      code: "",
      error: e instanceof Error ? e.message : String(e),
    };
  }
}
