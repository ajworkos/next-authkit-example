import { test, expect } from "./fixtures";

test.describe("AuthKit - Authenticated User Flows", () => {
  test("Can log in", async ({ page, context }) => {
    await page.goto("/");

    // Click sign in with authkit
    await page.getByRole("link", { name: /sign in with authkit/i }).click();

    // Should see login form
    await expect(
      page.getByLabel(/email/i).or(page.getByRole("textbox").first())
    ).toBeVisible();

    // Fill in email and password
    await page.getByLabel(/email/i).fill(process.env.TEST_EMAIL!);

    // click continue
    await page.getByRole("button", { name: /continue/i }).click();

    // Should see password input
    await expect(page.getByLabel(/password/i)).toBeVisible();

    // Fill in password
    await page.getByLabel(/password/i).fill(process.env.TEST_PASSWORD!);

    // click sign in
    await page.getByRole("button", { name: /sign in/i }).click();

    // Should see welcome message for authenticated user
    await expect(page.getByText(/welcome back/i)).toBeVisible();
  });
});
