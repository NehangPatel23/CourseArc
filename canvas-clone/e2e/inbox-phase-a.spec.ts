import { test, expect } from "@playwright/test";

test.describe("Phase A inbox", () => {
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

  test("inbox shows compose and can send a threaded message", async ({ page }) => {
    await page.goto("/inbox");
    await expect(page.getByRole("heading", { name: "Inbox" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: "Compose" })).toBeVisible();
    await page.getByRole("button", { name: "Compose" }).click();
    await expect(page.getByRole("heading", { name: "New message" })).toBeVisible();
    await page.getByPlaceholder("Search people or groups…").fill("Alex");
    await page.getByRole("button", { name: "Alex Chen student" }).click();
    await expect(page.getByRole("checkbox", { name: /Enable student replies/i })).toBeChecked();
    await page.getByPlaceholder("Subject").fill("Phase A compose check");
    await page.getByPlaceholder("Write your message…").fill("Please review the graph write-up.");
    await page.getByRole("button", { name: "Send" }).click();
    await expect(page.getByText("Phase A compose check").first()).toBeVisible();
    await expect(page.getByRole("article").getByText("Please review the graph write-up.")).toBeVisible();
    await page.getByPlaceholder("Write a reply…").fill("Thanks — looking now.");
    await page.getByRole("button", { name: "Reply" }).click();
    await expect(page.getByRole("article").getByText("Thanks — looking now.")).toBeVisible();
  });

  test("settings expose discussion reply notification preference", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("switch", { name: "Discussion replies" })).toBeVisible();
    await expect(page.getByRole("switch", { name: "Grades posted" })).toBeVisible();
    await expect(page.getByRole("switch", { name: "Announcements" })).toBeVisible();
  });

  test("people roster links to inbox compose", async ({ page }) => {
    await page.goto("/courses/1/people");
    await expect(page.getByRole("heading", { name: "People" })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("link", { name: /Message Alex Chen/i }).click();
    await expect(page).toHaveURL(/\/inbox\?compose=1/);
    await expect(page.getByRole("heading", { name: "New message" })).toBeVisible({
      timeout: 10_000,
    });
  });
});
