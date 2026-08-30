import { test, expect } from "@playwright/test";

test.describe("require-login gate", () => {
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

  test("turning on require login sends the visitor to sign in", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Security" })).toBeVisible({
      timeout: 15_000,
    });

    await page.getByRole("checkbox", { name: "Require login to access app" }).click();

    await expect(page).toHaveURL(/\/login/, { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: "Sign in to CourseArc" })).toBeVisible();

    await page.getByRole("button", { name: "Nehang Patel Instructor" }).click();
    await expect(page).toHaveURL(/\/settings/);
    await expect(page.getByRole("button", { name: "Sign out" }).first()).toBeVisible();

    await page.getByRole("button", { name: "Sign out" }).first().click();
    await expect(page).toHaveURL(/\/login/);

    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Sign in to CourseArc" })).toBeVisible();
  });

  test("stored requireLogin blocks the app before a session exists", async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem(
        "canvasClone:settings",
        JSON.stringify({ requireLogin: true }),
      );
    });
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: "Sign in to CourseArc" })).toBeVisible();
  });
});
