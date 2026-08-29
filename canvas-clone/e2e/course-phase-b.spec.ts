import { test, expect } from "@playwright/test";

test.describe("Phase B course structure", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.sessionStorage.setItem("splashShown", "true");
        window.localStorage.setItem("canvasClone:studentView:global", "false");
        window.localStorage.setItem("canvasClone:viewAs", "instructor");
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

  test("syllabus page shows course summary and can save", async ({ page }) => {
    await page.goto("/courses/1/syllabus");
    await expect(page.getByRole("heading", { name: "Syllabus" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { name: "Course Summary" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Teaching Team" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Grading" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add person" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add group" })).toBeVisible();
    const save = page.getByRole("button", { name: "Save Syllabus" });
    await expect(save).toBeDisabled();
    await page.getByRole("columnheader", { name: /Item/i }).click();
    await page.getByRole("checkbox", { name: /Show Course Summary/i }).uncheck();
    await expect(save).toBeEnabled();
    await save.click();
    await expect(page.getByText("Syllabus saved")).toBeVisible();
    await expect(save).toBeDisabled();
  });

  test("people groups tab can create a group set", async ({ page }) => {
    await page.goto("/courses/1/people/groups");
    await expect(page.getByRole("heading", { name: "People" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByPlaceholder("New group set name")).toBeVisible();
    await page.getByPlaceholder("New group set name").fill("Lab pairs");
    await page.getByRole("button", { name: "Add set" }).click();
    await expect(page.locator('input[value="Lab pairs"]')).toBeVisible();
    await expect(page.getByText("Group sets", { exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add group" }).first()).toBeVisible();
  });

  test("rubrics page can create a rubric", async ({ page }) => {
    await page.goto("/courses/1/rubrics");
    await expect(page.getByRole("heading", { name: "Rubrics" })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "New rubric" }).click();
    await expect(page.locator('input[value="New rubric"]').first()).toBeVisible();
    await page.getByRole("button", { name: "Save rubric" }).click();
    await expect(page.getByText("Rubric saved")).toBeVisible();
  });

  test("assignment editor exposes group set and rubric", async ({ page }) => {
    await page.goto("/courses/1/assignments/new");
    await expect(page.getByRole("heading", { name: "New Assignment" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Student group set")).toBeVisible();
    await expect(page.getByText("Grading rubric")).toBeVisible();
  });

  test("syllabus appears in course navigation", async ({ page }) => {
    await page.goto("/courses/1");
    await expect(page.getByRole("link", { name: "Syllabus" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("link", { name: "Rubrics" })).toBeVisible();
  });

  test("student syllabus shows letter grades as a table", async ({ page }) => {
    await page.goto("/courses/1/syllabus");
    await expect(page.getByRole("heading", { name: "Syllabus" })).toBeVisible({
      timeout: 15_000,
    });
    await page.evaluate(() => {
      window.localStorage.setItem("canvasClone:studentView:global", "true");
      window.localStorage.setItem("canvasClone:viewAs", "student");
      window.dispatchEvent(new Event("canvasClone:studentViewChanged"));
    });
    await expect(page.getByRole("button", { name: "Save Syllabus" })).toHaveCount(0);
    const grading = page.locator("#grading");
    await expect(grading.getByRole("columnheader", { name: "Letter" })).toBeVisible();
    await expect(grading.getByRole("columnheader", { name: "Range" })).toBeVisible();
    await expect(grading.getByRole("cell", { name: "A+" })).toBeVisible();
    await expect(grading.getByRole("cell", { name: "97% and above" })).toBeVisible();
    await expect(grading.getByRole("cell", { name: "Below 63%" })).toBeVisible();
  });

  test("student groups page shows a teammate view", async ({ page }) => {
    await page.goto("/courses/1/people/groups");
    await expect(page.getByRole("heading", { name: "People" })).toBeVisible({
      timeout: 15_000,
    });
    await page.evaluate(() => {
      window.localStorage.setItem("canvasClone:studentView:global", "true");
      window.localStorage.setItem("canvasClone:viewAs", "student");
      window.dispatchEvent(new Event("canvasClone:studentViewChanged"));
    });
    await expect(page.getByRole("button", { name: "Add set" })).toHaveCount(0);
    await expect(page.getByText("All groups").first()).toBeVisible();
    await expect(page.getByText("Team A").first()).toBeVisible();
    await expect(page.getByText("Team B").first()).toBeVisible();
  });

  test("group homepage and attendance tools load", async ({ page }) => {
    await page.goto("/courses/1/people/groups");
    await expect(page.getByRole("heading", { name: "People" })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("link", { name: "Open homepage" }).first().click();
    await expect(page.getByRole("button", { name: "Discussions", exact: true })).toBeVisible();
    await expect(page.getByRole("button", { name: "Files", exact: true })).toBeVisible();

    await page.goto("/courses/1/attendance");
    await expect(page.getByRole("heading", { name: "Attendance" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Roll call").first()).toBeVisible();
    await page.getByRole("button", { name: "Take today" }).click();
    await expect(page.getByRole("button", { name: "Mark all present" })).toBeVisible();

    await page.goto("/courses/1/collaborations");
    await expect(page.getByRole("heading", { name: "Collaborations" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: "Conferences" })).toBeVisible();
  });
});
