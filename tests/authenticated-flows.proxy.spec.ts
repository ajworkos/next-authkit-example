import {
  test as baseTest,
  expect,
} from "next/experimental/testmode/playwright";
import * as jose from "jose";
import { AccessToken, UserResponse } from "@workos-inc/node";

const DEFAULT_REFRESH_TOKEN = "1234567890";

const DEFAULT_USER: UserResponse = {
  first_name: "John",
  last_name: "Doe",
  email: "john.doe@example.com",
  email_verified: true,
  profile_picture_url: "https://example.com/profile.jpg",
  object: "user",
  id: "12345",
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
  external_id: "12345",
  metadata: {},
  last_sign_in_at: "2025-01-01T00:00:00.000Z",
  locale: "en-US",
};

const DEFAULT_ACCESS_TOKEN: AccessToken = {
  sid: "123456",
};

const test = baseTest.extend<{
  user: UserResponse;
  accessTokenClaims: AccessToken;
  refreshToken: string;
  _login: void;
}>({
  user: [DEFAULT_USER, { option: true }],
  accessTokenClaims: [DEFAULT_ACCESS_TOKEN, { option: true }],
  refreshToken: [DEFAULT_REFRESH_TOKEN, { option: true }],
  _login: [
    async ({ page, user, refreshToken, accessTokenClaims, next }, use) => {
      const keyPair = await jose.generateKeyPair("RS256");
      const accessToken = await new jose.SignJWT({ ...accessTokenClaims })
        .setProtectedHeader({ alg: "RS256" })
        .setExpirationTime("1h")
        .setIssuedAt("-1h")
        .sign(keyPair.privateKey);

      next.onFetch(async (request) => {
        // request to the refresh token endpoint
        if (
          request.url.includes("api.workos.com/user_management/authenticate")
        ) {
          return Response.json({ accessToken, refreshToken, user });
        }

        // pass through
        return "continue";
      });

      const baseURL = process.env.TEST_BASE_URL;

      // login by calling our test endpoint which calls saveSession
      await page.request.post(`${baseURL}/api/test/set-session`, {
        data: { user, accessToken, refreshToken },
        headers: { "Content-Type": "application/json" },
      });

      await use();
    },
    { auto: true },
  ],
});

test.use({ nextOptions: { fetchLoopback: true } });

test.describe("Authenticated User Flows", async () => {
  test("homepage shows authenticated state", async ({ page }) => {
    await page.goto("/");

    // Should see welcome message for authenticated user
    await expect(page.getByText(/welcome back/i)).toBeVisible();

    // Should see account navigation
    await expect(
      page.getByRole("link", { name: /view account/i })
    ).toBeVisible();

    // Should see sign out button
    // There are multiple sign out buttons, so we need to make sure we see at least one
    await expect(
      page.getByRole("button", { name: /sign out/i }).first()
    ).toBeVisible();

    // Should NOT see sign in button
    await expect(
      page.getByRole("link", { name: /sign in/i })
    ).not.toBeVisible();
  });
});
