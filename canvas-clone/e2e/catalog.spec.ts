import { test, expect } from "@playwright/test";

test.describe("Courses catalog", () => {
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
        window.localStorage.setItem("canvasClone:studentView:global", "false");
        window.localStorage.setItem("canvasClone:viewAs", "instructor");
      } catch {}
    });
  });

  test("catalog hero and compose modal", async ({ page }) => {
    await page.goto("/courses");
    await expect(page.getByRole("heading", { name: "The catalog." })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: /^Published/ })).toBeVisible();
    await page.getByRole("button", { name: "Compose a course" }).first().click();
    await expect(page.getByRole("heading", { name: "A new course" })).toBeVisible();
    await page.getByRole("button", { name: "Close" }).click();
    await expect(page.getByRole("heading", { name: "A new course" })).toHaveCount(0);
  });

  test("dashboard still has its own catalog heading", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: "Courses" })).toBeVisible({
      timeout: 15_000,
    });
  });

  test("student catalog hides compose", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem("canvasClone:studentView:global", "true");
      window.localStorage.setItem("canvasClone:viewAs", "student");
    });
    await page.goto("/courses");
    await expect(page.getByRole("heading", { name: "The catalog." })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText("Viewing as a student")).toBeVisible();
    await expect(page.getByRole("button", { name: "Compose a course" })).toHaveCount(0);
  });
});
