import { test, expect } from "@playwright/test";

const instructorUser = {
  id: "1",
  name: "Nehang Patel",
  email: "nehang@example.edu",
  avatarInitials: "NP",
  role: "instructor",
  enrolledCourseIds: ["1", "2"],
  pronouns: "He/Him/His",
};

function seedQuizStorage(quiz: Record<string, unknown>) {
  return `
    try {
      window.sessionStorage.setItem("splashShown", "true");
      window.localStorage.setItem("canvasClone:studentView:global", "false");
      window.localStorage.setItem("canvasClone:user", ${JSON.stringify(JSON.stringify(instructorUser))});
      window.localStorage.setItem("canvasClone:quizzes:1", ${JSON.stringify(JSON.stringify([quiz]))});
    } catch {}
  `;
}

test.describe("Phase 9 quiz quality", () => {
  test("#161 print with answer key shows sample-in-box", async ({ page }) => {
    const quiz = {
      id: "p9-print",
      title: "P9 Print Key",
      published: true,
      status: "published",
      quizType: "graded",
      questions: [
        {
          id: "q-code",
          type: "coding",
          prompt: "Write hello",
          points: 2,
          language: "javascript",
          starterCode: "// starter",
          correctCode: "console.log('SAMPLE_IN_BOX')",
          codeTests: [],
        },
      ],
    };
    await page.addInitScript(seedQuizStorage(quiz));
    await page.addInitScript(() => {
      // Keep print classes long enough for assertions (#161)
      window.print = () => {};
    });
    await page.goto("/courses/1/quizzes/p9-print/take?preview=1");
    await expect(page.getByRole("button", { name: /Print with answer key/i })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: /Print with answer key/i }).click();
    await expect(page.locator("body")).toHaveClass(/quiz-print-with-key/, { timeout: 5_000 });
    await expect(page.getByText("SAMPLE_IN_BOX")).toBeVisible({ timeout: 5_000 });
  });

  test("#162 leave lock shows timer while locked", async ({ page }) => {
    const quiz = {
      id: "p9-leave",
      title: "P9 Leave Lock",
      published: true,
      status: "published",
      quizType: "graded",
      lockOnLeave: true,
      timeLimitMinutes: 30,
      questions: [
        {
          id: "q1",
          type: "true_false",
          prompt: "Sky is blue?",
          points: 1,
          correctTrueFalse: true,
        },
      ],
    };
    await page.addInitScript(seedQuizStorage(quiz));
    // Student view so leave lock engages on a live attempt
    await page.addInitScript(() => {
      window.localStorage.setItem("canvasClone:studentView:global", "true");
    });
    await page.goto("/courses/1/quizzes/p9-leave/take");
    // Live attempt workspace (student view) — may need to dismiss one-at-a-time ack if present
    const begin = page.getByRole("button", { name: /Begin quiz/i });
    if (await begin.isVisible().catch(() => false)) {
      await begin.click();
    }
    await expect(page.getByText("Sky is blue?")).toBeVisible({ timeout: 15_000 });
    await page.evaluate(() => {
      Object.defineProperty(document, "visibilityState", {
        configurable: true,
        get: () => "hidden",
      });
      document.dispatchEvent(new Event("visibilitychange"));
    });
    await expect(page.getByText(/You left this tab|Saliste de esta pestaña/i)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByTestId("leave-lock-timer")).toBeVisible();
    await expect(page.getByTestId("leave-lock-timer")).toContainText(/\d+:\d+/);
  });

  test("#165 sticky submit action bar is present and sticky", async ({ page }) => {
    const quiz = {
      id: "p9-sticky",
      title: "P9 Sticky Bar",
      published: true,
      status: "published",
      quizType: "graded",
      questions: [
        {
          id: "q1",
          type: "multiple_choice",
          prompt: "2+2?",
          points: 1,
          choices: ["3", "4"],
          correctChoiceIndex: 1,
        },
      ],
    };
    await page.addInitScript(seedQuizStorage(quiz));
    await page.goto("/courses/1/quizzes/p9-sticky/take?preview=1");
    const bar = page.getByTestId("quiz-take-action-bar");
    await expect(bar).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("quiz-submit-button")).toBeVisible();
    const position = await bar.evaluate((el) => getComputedStyle(el).position);
    expect(position).toBe("sticky");
  });
});
