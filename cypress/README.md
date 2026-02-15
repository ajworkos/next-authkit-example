# E2E Testing with Cypress and WorkOS AuthKit

This directory contains Cypress tests for WorkOS AuthKit authentication using programmatic authentication.

## Setup

1. **Environment Variables** (same as Playwright tests)

```bash
# WorkOS Configuration
WORKOS_CLIENT_ID=your_client_id
WORKOS_API_KEY=your_api_key
WORKOS_COOKIE_PASSWORD=your_cookie_password

# Test Configuration
TEST_BASE_URL=http://localhost:3000
```

2. **Test Users**

Test users are defined in `../tests/test-users.ts` (shared with Playwright).
They are created automatically before tests run and deleted afterwards — no
pre-existing users needed in your WorkOS environment.

3. **Run Tests**

```bash
npm run test:cypress        # Headless
npm run test:cypress:open   # Interactive
```

## Authentication

### **Custom Command**

```typescript
// Authenticate using a named profile from tests/test-users.ts
cy.login("magicAuthUser");
```

### **Session Caching**

- First use: API authentication + session creation
- Subsequent uses: Cached session (faster)
- Auto-validation: Ensures session is still valid

## Usage

**Authenticated Tests:**

```typescript
describe("Admin Features", () => {
  beforeEach(() => {
    // Use a named profile — switch to "passwordUser" for password auth
    cy.login("magicAuthUser");
  });

  it("can access admin panel", () => {
    cy.visit("/admin"); // Already authenticated
  });
});
```

**Unauthenticated Tests:**

```typescript
describe("Public Features", () => {
  // No beforeEach = unauthenticated

  it("shows login page", () => {
    cy.visit("/");
  });
});
```

## User Lifecycle

1. `before()` hook calls `createTestUsers` task — creates all users via WorkOS API
2. Each test authenticates with `cy.login("profileName")`
3. `after()` hook calls `deleteTestUsers` task — cleans up all created users

## Files

- `../tests/test-users.ts` - Shared test user profiles
- `plugins/workos.ts` - WorkOS tasks (create/delete users, authenticate)
- `support/commands.ts` - Authentication command
- `support/e2e.ts` - Lifecycle hooks + test configuration
- `e2e/authenticated-flows.cy.ts` - Tests for logged-in users
- `e2e/unauthenticated-flows.cy.ts` - Tests for anonymous users
