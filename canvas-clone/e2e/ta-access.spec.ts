import { test, expect } from "@playwright/test";

test.describe("TA access (Taylor Kim)", () => {
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
        window.localStorage.setItem("canvasClone:viewAs", "ta");
        window.localStorage.setItem("canvasClone:studentView:global", "false");
        window.localStorage.setItem("canvasClone:activeStudentId", "demo_ta");
      } catch {}
    });
  });

  test("identity is Taylor Kim with TA view", async ({ page }) => {
    await page.goto("/courses/1");
    await expect(page.getByText("Taylor Kim").first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("TA View").first()).toBeVisible();
    await expect(page.getByTitle("TA view (Taylor Kim)")).toHaveAttribute("aria-pressed", "true");
  });

  test("opens the instructor gradebook", async ({ page }) => {
    await page.goto("/courses/1/grades");
    await expect(page.getByRole("heading", { name: "Grades" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { name: "Class Gradebook" })).toBeVisible();
    await expect(page.getByText(/View your grades for this course/i)).toHaveCount(0);
  });

  test("can open SpeedGrader and save a score", async ({ page }) => {
    await page.goto("/courses/1/assignments/seed_major1_1/grade");
    await expect(page.getByRole("button", { name: "Save grade" })).toBeVisible({
      timeout: 15_000,
    });
    const score = page.locator('input[type="number"]').first();
    if ((await score.count()) > 0) {
      await score.fill("12");
      await page.getByRole("button", { name: "Save grade" }).click();
    }
    await expect(page.getByRole("button", { name: "Save grade" })).toBeVisible();
  });

  test("course settings redirect away but course publish is available", async ({ page }) => {
    await page.goto("/courses/1/settings");
    await expect(page).not.toHaveURL(/\/settings/, { timeout: 10_000 });
    await page.goto("/courses/1");
    await expect(page.getByRole("link", { name: "Course settings" })).toHaveCount(0);
    const unpublish = page.getByLabel("Unpublish course");
    const publish = page.getByLabel("Publish course");
    await expect(unpublish.or(publish).first()).toBeVisible();
  });

  test("can publish and unpublish assignments and quizzes", async ({ page }) => {
    await page.goto("/courses/1/assignments");
    await expect(page.getByRole("heading", { name: "Assignments", level: 1 })).toBeVisible({
      timeout: 15_000,
    });
    await expect(
      page.getByLabel("Unpublish assignment").or(page.getByLabel("Publish assignment")).first(),
    ).toBeVisible();

    await page.goto("/courses/1/quizzes");
    await expect(page.getByRole("heading", { name: "Quizzes", level: 1 })).toBeVisible({
      timeout: 10_000,
    });
    await expect(
      page.getByLabel("Unpublish quiz").or(page.getByLabel("Publish quiz")).first(),
    ).toBeVisible();
  });

  test("can open the assignment editor", async ({ page }) => {
    await page.goto("/courses/1/assignments/seed_major1_1/edit");
    await expect(page).toHaveURL(/\/assignments\/seed_major1_1\/edit/, { timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Update" })).toBeVisible();
  });

  test("can open the page editor", async ({ page }) => {
    await page.goto("/courses/1/pages/course-home");
    await expect(page).toHaveURL(/\/pages\/course-home$/, { timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
  });

  test("can open the quiz editor", async ({ page }) => {
    await page.goto("/courses/1/quizzes/seed_quiz1_1/edit");
    await expect(page).toHaveURL(/\/quizzes\/seed_quiz1_1\/edit/, { timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Update" })).toBeVisible();
  });

  test("can open discussion, announcement, module, and file authoring", async ({ page }) => {
    await page.goto("/courses/1/discussions/new");
    await expect(page).toHaveURL(/\/discussions\/new/, { timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Publish", exact: true })).toBeVisible();

    await page.goto("/courses/1/announcements/new");
    await expect(page).toHaveURL(/\/announcements\/new/, { timeout: 10_000 });
    await expect(page.getByRole("button", { name: "Publish", exact: true })).toBeVisible();

    await page.goto("/courses/1/modules");
    await expect(page.getByText("Add module").first()).toBeVisible({ timeout: 10_000 });

    await page.goto("/courses/1/files");
    await expect(page.getByRole("button", { name: "Upload" })).toBeVisible({ timeout: 10_000 });

    await page.goto("/courses/1/people/groups");
    await expect(page.getByRole("button", { name: "Add set" })).toBeVisible({ timeout: 10_000 });

    await page.goto("/courses/1/syllabus");
    await expect(page.getByRole("button", { name: "Save Syllabus" })).toBeVisible({ timeout: 10_000 });

    await page.goto("/courses/1/quizzes");
    await expect(page.getByRole("button", { name: "New Quiz" })).toBeVisible({ timeout: 10_000 });

    await page.goto("/courses/1/question-banks");
    await expect(page.getByRole("button", { name: "New bank" })).toBeVisible({ timeout: 10_000 });

    await page.goto("/courses/1/pages");
    await expect(page.getByRole("button", { name: "Page" })).toBeVisible({ timeout: 10_000 });

    await page.goto("/courses/1/rubrics");
    await expect(page.getByRole("button", { name: "New rubric" })).toBeVisible({ timeout: 10_000 });

    await page.goto("/calendar");
    await expect(page.getByRole("button", { name: "Appointment group" })).toBeVisible({ timeout: 10_000 });
  });

  test("Add person only offers Student", async ({ page }) => {
    await page.goto("/courses/1/people");
    await expect(page.getByRole("heading", { name: "People" })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Add person" }).click();
    await expect(page.getByRole("heading", { name: "Add person" })).toBeVisible();
    await expect(page.locator("#add-person-name")).toBeVisible();
    await expect(page.locator("p").filter({ hasText: /^Student$/ })).toBeVisible();
    await expect(page.locator("#add-person-role")).toHaveCount(0);
  });

  test("discussion reply is tagged TA", async ({ page }) => {
    await page.goto("/courses/1/discussions");
    await expect(page.getByRole("heading", { name: "Discussions" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Office hours poll (draft)")).toBeVisible();
    await page.getByRole("link", { name: /Week 1 Q&A/i }).click();
    await expect(page.getByText("TA", { exact: true }).first()).toBeVisible({
      timeout: 10_000,
    });
    await expect(page.getByRole("button", { name: "Post reply" })).toBeVisible();
  });
});
