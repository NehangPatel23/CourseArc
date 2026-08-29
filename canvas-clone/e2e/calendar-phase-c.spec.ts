import { test, expect } from "@playwright/test";

test.describe("Phase C calendar", () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      try {
        window.sessionStorage.setItem("splashShown", "true");
        window.localStorage.setItem("canvasClone:studentView:global", "false");
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

  test("course calendar URL opens the app calendar filtered by course", async ({ page }) => {
    await page.goto("/courses/1/calendar");
    await expect(page).toHaveURL(/\/calendar\?course=1/);
    await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("button", { name: "All" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Personal" })).toBeVisible();
  });

  test("instructor can create a personal calendar event", async ({ page }) => {
    await page.goto("/calendar");
    await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Event", exact: true }).click();
    await expect(page.getByRole("heading", { name: "New event" })).toBeVisible();
    await page.getByPlaceholder("Event title").fill("Office hours walk-in");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Office hours walk-in").first()).toBeVisible({
      timeout: 10_000,
    });
  });

  test("clicking a calendar date opens a day details popup", async ({ page }) => {
    await page.goto("/calendar");
    await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible({
      timeout: 15_000,
    });
    const today = new Date();
    await page.locator(`[data-calendar-day-number="${today.getDate()}"]`).click();
    const heading = today.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
    await expect(page.getByRole("button", { name: "Add event" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Open day view" })).toBeVisible();
  });

  test("people sections page loads", async ({ page }) => {
    await page.goto("/courses/1/people/sections");
    await expect(page.getByRole("heading", { name: "People" })).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByRole("heading", { name: "Assign students" })).toBeVisible();
  });

  test("week view is available on the app calendar", async ({ page }) => {
    await page.goto("/calendar");
    await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Week" }).click();
    await expect(page.getByRole("button", { name: "Week" })).toBeVisible();
  });

  test("find appointment shows demo office hours", async ({ page }) => {
    await page.goto("/calendar");
    await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Find appointment" }).click();
    await expect(page.getByRole("heading", { name: "Find appointment" })).toBeVisible();
    await expect(page.getByText("Office hours").first()).toBeVisible();
  });

  test("instructor can create an appointment group from find appointment", async ({ page }) => {
    await page.goto("/calendar");
    await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Find appointment" }).click();
    await expect(page.getByRole("heading", { name: "Find appointment" })).toBeVisible();
    await page.getByRole("button", { name: "New appointment group" }).click();
    await expect(page.getByRole("heading", { name: "New appointment group" })).toBeVisible();
  });

  test("instructor can collapse appointment groups in find appointment", async ({ page }) => {
    await page.goto("/calendar");
    await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Find appointment" }).click();
    await expect(page.getByRole("heading", { name: "Find appointment" })).toBeVisible();
    const toggle = page.getByRole("button", { name: /^(Expand|Collapse) Office hours/ }).first();
    await expect(toggle).toBeVisible();
    const expanded = await toggle.getAttribute("aria-expanded");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", expanded === "true" ? "false" : "true");
  });

  test("open appointment slots are dashed and booked slots are solid", async ({ page }) => {
    await page.goto("/calendar");
    await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Week", exact: true }).click();
    const openChip = page.locator('[data-slot-state="open"]').first();
    const bookedChip = page.locator('[data-slot-state="booked"]').first();
    await expect(openChip).toBeVisible();
    await expect(bookedChip).toBeVisible();
    await expect(openChip).toHaveCSS("border-style", "dashed");
    await expect(openChip).toContainText("(open)");
    await expect(bookedChip).not.toContainText("(open)");
  });

  test("find appointment filters slots by time of day", async ({ page }) => {
    await page.goto("/calendar");
    await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Find appointment" }).click();
    await expect(page.getByRole("heading", { name: "Find appointment" })).toBeVisible();
    await expect(page.getByText("Filters")).toBeVisible();
    await expect(page.getByText("Office hours").first()).toBeVisible();
    await page.getByLabel("Time of day").selectOption("morning");
    await expect(page.getByText("No slots match these filters.")).toBeVisible();
    await page.getByRole("button", { name: "Clear filters" }).click();
    await expect(page.getByText("Office hours").first()).toBeVisible();
    await page.getByRole("button", { name: "Filters" }).click();
    await expect(page.getByLabel("Time of day")).toHaveCount(0);
    await page.getByRole("button", { name: "Filters" }).click();
    await page.getByLabel("Search appointments").fill("zzzz-no-match");
    await expect(page.getByText("No slots match these filters.")).toBeVisible();
  });

  test("instructor can create a repeating calendar event", async ({ page }) => {
    await page.goto("/calendar");
    await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Event", exact: true }).click();
    await expect(page.getByRole("heading", { name: "New event" })).toBeVisible();
    await page.getByPlaceholder("Event title").fill("Weekly standup");
    await page.getByText("Repeat this event").click();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByText("Weekly standup").first()).toBeVisible({
      timeout: 10_000,
    });
    await page.getByText("Weekly standup").first().click();
    await expect(page.getByText("This event")).toBeVisible();
    await expect(page.getByText("All events")).toBeVisible();
  });

  test("appointment group editor has extra courses and cancel cutoff", async ({ page }) => {
    await page.goto("/calendar");
    await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Appointment group" }).click();
    await expect(page.getByRole("heading", { name: "New appointment group" })).toBeVisible();
    await expect(page.getByText("Details", { exact: true })).toBeVisible();
    await page.getByRole("button", { name: "Courses" }).click();
    await expect(page.getByText("All courses")).toBeVisible();
    await expect(page.getByText("Max slots per student")).toBeVisible();
    await expect(page.getByLabel("Max slots per student")).toContainText("Unlimited");
    await expect(page.getByText("Seats per time slot")).toBeVisible();
    await expect(page.getByText("Cancel cutoff (minutes before start)")).toBeVisible();
    await expect(page.getByRole("button", { name: "Generate slots" })).toBeVisible();
  });

  test("appointment group editor uses a trash icon to delete", async ({ page }) => {
    await page.goto("/calendar");
    await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Find appointment" }).click();
    await expect(page.getByRole("heading", { name: "Find appointment" })).toBeVisible();
    await page.getByRole("button", { name: "Edit" }).first().click();
    await expect(page.getByRole("heading", { name: "Edit appointment group" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Delete group" })).toBeVisible();
    await expect(page.getByText("Delete group", { exact: true })).toHaveCount(0);
  });

  test("appointment slots open a meeting details popup", async ({ page }) => {
    await page.goto("/calendar");
    await expect(page.getByRole("heading", { name: "Calendar" })).toBeVisible({
      timeout: 15_000,
    });
    await page.getByRole("button", { name: "Find appointment" }).click();
    await expect(page.getByRole("heading", { name: "Find appointment" })).toBeVisible();
    await page.getByTestId("appointment-slot-row").first().click();
    await expect(page.getByRole("heading", { name: "Office hours" })).toBeVisible();
    await expect(page.getByText("Participants")).toBeVisible();
    await expect(page.getByRole("button", { name: "Chat" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Notes" })).toBeVisible();
  });
});

test.describe("Phase C overridden due dates", () => {
  const overrideDue = Date.parse("2026-11-15T17:00:00");

  test.beforeEach(async ({ page }) => {
    await page.addInitScript((dueAt) => {
      try {
        window.sessionStorage.setItem("splashShown", "true");
        window.localStorage.setItem("canvasClone:studentView:global", "true");
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
        window.localStorage.setItem(
          "canvasClone:dueDateOverrides:1",
          JSON.stringify([
            {
              id: "e2e-asg",
              itemKind: "assignment",
              itemId: "seed_major1_1",
              targetKind: "student",
              targetId: "1",
              dueAt,
            },
            {
              id: "e2e-disc",
              itemKind: "discussion",
              itemId: "e2e-graded-topic",
              targetKind: "student",
              targetId: "1",
              dueAt,
            },
          ]),
        );
        window.localStorage.setItem(
          "canvasClone:discussions:1",
          JSON.stringify({
            topics: [
              {
                id: "e2e-graded-topic",
                title: "Graded intro post",
                author: "Instructor",
                body: "<p>Post an introduction.</p>",
                createdAt: Date.now() - 86400000,
                published: true,
                status: "published",
                graded: true,
                points: 10,
                dueAt: Date.parse("2026-09-01T17:00:00"),
              },
            ],
            replies: [],
          }),
        );
      } catch {}
    }, overrideDue);
  });

  test("assignments and discussions lists show the overridden due date", async ({
    page,
  }) => {
    const dueSnippet = new Date(overrideDue).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
    await page.goto("/courses/1/assignments");
    await expect(page.getByText("Major Assignment #1: Instructions").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(dueSnippet).first()).toBeVisible();
    await page.goto("/courses/1/discussions");
    await expect(page.getByText("Graded intro post").first()).toBeVisible({
      timeout: 15_000,
    });
    await expect(page.getByText(dueSnippet).first()).toBeVisible();
  });
});
