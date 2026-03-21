import { expect, test } from "@playwright/test";

test.describe("Goaly App", () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to the app
    await page.goto("http://localhost:8080/");
  });

  test("should display home page and login correctly", async ({ page }) => {
    // Assert home page elements
    await expect(page.getByRole("heading", { name: "Goaly Logo Goaly" }))
      .toBeVisible();
    await expect(page.getByRole("heading", { name: "Build Better Habits" }))
      .toBeVisible();
    await expect(page.getByRole("link", { name: "Continue with Google" }))
      .toBeVisible();

    // Login (Mock Auth is assumed to be enabled on the server)
    await page.getByRole("link", { name: "Continue with Google" }).click();

    // Assert we're on the dashboard now
    await expect(page.getByText("Logged in as mockuser@example.com"))
      .toBeVisible();
    await expect(page.getByRole("heading", { name: "Your Active Goals" }))
      .toBeVisible();
    await expect(page.getByRole("heading", { name: "New Goal" })).toBeVisible();
  });

  test("should allow creating and deleting a new goal", async ({ page }) => {
    // Start from login state
    await page.goto("http://localhost:8080/api/auth/login");

    // Make sure we are on the dashboard
    await expect(page.getByRole("heading", { name: "New Goal" })).toBeVisible();

    const testGoalName = `Test Goal ${Date.now()}`;

    // Fill the New Goal form
    await page.getByRole("textbox", { name: "I want to..." }).fill(
      testGoalName,
    );

    // The "radio" inputs for the time preference are hidden and using standard Playwright clicks
    // can sometimes be tricky because of labels wrapping them.
    // We can select "Morning" by finding its text:
    await page.locator("label").filter({ hasText: "Morning 6am - 12pm" })
      .click();

    // Submit the form
    await page.getByRole("button", { name: "Save Goal" }).click();

    // Verify it was created and is visible in the list
    await expect(page.getByRole("heading", { name: testGoalName }))
      .toBeVisible();

    // Try deleting it
    // The "Delete Goal" button is usually an icon or specific button next to the goal.
    // Based on the snapshot, it has the name 'Delete Goal'

    // Accept the confirmation dialog when it pops up
    page.on("dialog", (dialog) => dialog.accept());

    // Find the specific delete button for this goal and click it
    await page.locator(".bg-white", { hasText: testGoalName }).getByRole(
      "button",
      { name: "Delete Goal" },
    ).click();

    // Verify it was deleted (it shouldn't be visible anymore)
    await expect(page.getByRole("heading", { name: testGoalName })).not
      .toBeVisible();
  });
});
