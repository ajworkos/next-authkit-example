# E2E Testing with Playwright and WorkOS AuthKit

End-to-end tests for WorkOS AuthKit authentication using programmatic authentication.

## Setup

**Environment Variables:**

```bash
# WorkOS Configuration
WORKOS_CLIENT_ID=your_client_id
WORKOS_API_KEY=your_api_key
WORKOS_COOKIE_PASSWORD=your_cookie_password
NEXT_PUBLIC_WORKOS_REDIRECT_URI=http://localhost:3000/callback

# Test Configuration (optional)
TEST_BASE_URL=http://localhost:3000
```

**Test Users:**

Test users are defined in `test-users.ts`. They are created automatically before
tests run and deleted afterwards — no pre-existing users needed in your WorkOS
environment. Edit the emails and passwords in the config to match your needs.

**Run Tests:**

```bash
npm run test:playwright
```

## Usage

**Import fixtures:**

```typescript
import { test, expect } from "./fixtures";
```

**Authenticated tests:**

```typescript
// Use a named profile from test-users.ts
// Switch to "passwordUser" to test with password auth instead
test.use({ user: "magicAuthUser" });

test.describe("Admin Features", () => {
  test("admin panel access", async ({ page }) => {
    await page.goto("/admin"); // Already authenticated
  });
});
```

**Unauthenticated tests:**

```typescript
test.describe("Public Features", () => {
  // No test.use() = unauthenticated

  test("login page", async ({ page }) => {
    await page.goto("/");
  });
});
```

## Authentication System

**Flow:**

1. Global setup creates test users via the WorkOS API
2. Each test authenticates programmatically (password or magic auth, auto-detected)
3. The sealed session cookie is injected into the browser context
4. Global teardown deletes all created test users

## Files

- `test-users.ts` - Test user profiles (shared with Cypress)
- `global-setup.ts` - Creates test users before all tests
- `global-teardown.ts` - Deletes test users after all tests
- `fixtures.ts` - Authentication fixture system
- `authenticated-flows.spec.ts` - Tests for authenticated users
- `unauthenticated-flows.spec.ts` - Tests for unauthenticated users
