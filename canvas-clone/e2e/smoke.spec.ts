import { test, expect } from "@playwright/test";

test.describe("CourseArc smoke", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.sessionStorage.setItem("splashShown", "true");
        window.localStorage.setItem(
          "canvasClone:user",
          JSON.stringify({
            id: "1",
            name: "Nehang Patel",
            email: "nehang@example.edu",
            avatarInitials: "NP",
            role: "instructor",
            enrolledCourseIds: ["1", "2"],
            pronouns: "He/Him/His",
          }),
        );
      } catch {}
    });
  });

  test("dashboard loads", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("canvasClone:studentView:global", "false");
    });
    await page.goto("/");
    await expect(page.getByRole("heading", { level: 1 }).first()).toBeVisible({
      timeout: 15_000,
    });
  });

  test("navigate to course grades page", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("canvasClone:studentView:global", "false");
    });
    await page.goto("/courses/1/grades");
    await expect(page.getByRole("heading", { name: "Grades" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { name: "Class Gradebook" })).toBeVisible();
  });

  test("gradebook cell can open GradePro and return", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("canvasClone:studentView:global", "false");
    });
    await page.goto("/courses/1/grades");
    const gradeLink = page.locator('table a[href*="/grade"]').first();
    if ((await gradeLink.count()) === 0) {
      test.skip();
      return;
    }
    await gradeLink.click();
    await expect(page.getByTitle("Close GradePro")).toBeVisible({ timeout: 10_000 });
    await page.getByTitle("Close GradePro").click();
    await expect(page).toHaveURL(/\/grades/);
  });

  test("course home shows Needs Grading for instructors", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("canvasClone:studentView:global", "false");
    });
    await page.goto("/courses/1");
    await expect(page.getByText("Needs Grading")).toBeVisible({ timeout: 15_000 });
  });

  test("people page loads", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("canvasClone:studentView:global", "false");
    });
    await page.goto("/courses/1/people");
    await expect(page.getByRole("heading", { name: "People" })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("student view toggle hides instructor gradebook actions", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("canvasClone:studentView:global", "true");
    });
    await page.goto("/courses/1/grades");
    await expect(page.getByText(/View your grades for this course/i)).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("button", { name: "Post grades" })).toHaveCount(0);
  });
});
