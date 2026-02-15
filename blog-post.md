# How to E2E Test Your AuthKit App

If you've built your app with [AuthKit](https://workos.com/docs/user-management), you've probably wondered: how do I write end-to-end tests for an app that requires login?

Your E2E tests don't need to test AuthKit -- we've already tested it, and we know it works. What you want to test is *your* application. But routing every test through the AuthKit login page adds unnecessary latency and complexity to your test suite. Some developers try to work around this by polling shared email inboxes for magic link codes, or building fragile scripts that automate the login form. These approaches are slow, flaky, and miss the point.

The good news: you don't need to log in through the browser at all. AuthKit sessions are just cookies. If you understand how they work, you can create one programmatically using WorkOS APIs and skip the login page entirely.

## How AuthKit sessions actually work

To understand why this testing approach works, it helps to know what's actually inside an AuthKit session cookie. It's simpler than you might think.

### Two layers

THe cookie value (you might recognize this as the `wos-session` cookie) consists of two parts:

1. **An encrypted envelope.** The cookie is encrypted and signed using your `WORKOS_COOKIE_PASSWORD` (via [iron-session](https://github.com/vvo/iron-session)). This is the outer layer -- it prevents anyone from reading or tampering with the contents.

2. **A session object inside.** Once decrypted, the envelope contains:
   - An **access token** (this is the JWT)
   - A **refresh token**
   - The **user object** (name, email, etc.)

### What happens on every request

When a request hits authenticated routes in your app, your AuthKit middleware does the following:

1. Reads the session cookie from the request headers
2. Decrypts the envelope using your cookie password
3. Extracts the access token JWT
4. Verifies the JWT signature against [WorkOS JWKS](https://workos.com/docs/user-management/sessions/jwks)
5. If the JWT is expired, uses the refresh token to get a new one from the WorkOS API
6. If neither token is valid, the session is treated as unauthenticated

That's the entire auth check. There's no server-side session store, no database lookup, no call back to WorkOS on every request (unless a refresh is needed). It's all in the cookie.

### The key insight

If your test browser sends a cookie that can be decrypted with the right password and contains a valid, WorkOS-signed JWT, your app's middleware will treat the request as authenticated. No login page, no redirect. Just a cookie.

The question is: how do you get a valid cookie without going through the login UI?

## Setting up a test user

Before you can authenticate, you need a user in your WorkOS environment. You have two options:

**Use a dedicated test user.** If you already have a user set aside for testing, you're good to go. Just have their email (and password, if applicable) available as environment variables.

**Create a user programmatically.** If you want full isolation between test runs, or you need a user in a specific organization, you can create one on the fly using the SDK:

```typescript
import { WorkOS } from "@workos-inc/node";

const workos = new WorkOS(process.env.WORKOS_API_KEY);

// Create a test user (with or without a password)
const user = await workos.userManagement.createUser({
  email: `test-${Date.now()}@yourcompany.com`,
  password: "a-secure-test-password",  // optional
  firstName: "Test",
  lastName: "User",
  emailVerified: true,
});

// Optionally add them to a specific organization
await workos.userManagement.createOrganizationMembership({
  userId: user.id,
  organizationId: "org_...",
});
```

Setting `emailVerified: true` is important -- it skips the email verification step that would otherwise block authentication.

If you create users per test run, you can clean up afterward:

```typescript
await workos.userManagement.deleteUser(user.id);
```

## Getting a session cookie programmatically

Once you have a test user, the WorkOS SDK can authenticate them and return a sealed session cookie. The key is the `sealSession` option -- it tells the API to encrypt the session for you and return the ready-to-use cookie value.

You have two options for how to authenticate.

### Option 1: Email and password

If your test user has a password, you can authenticate in a single call:

```typescript
const authResponse = await workos.userManagement.authenticateWithPassword({
  clientId: process.env.WORKOS_CLIENT_ID,
  email: user.email,
  password: "a-secure-test-password",
  session: {
    sealSession: true,
    cookiePassword: process.env.WORKOS_COOKIE_PASSWORD,
  },
});

// This is your ready-to-use cookie value
const cookieValue = authResponse.sealedSession;
```

### Option 2: Magic auth

With magic auth, you don't need a password at all -- just the user's email address. The trade-off is two API calls instead of one:

```typescript
// Step 1: Create a magic auth code
const { code } = await workos.userManagement.createMagicAuth({
  email: user.email,
});

// Step 2: Authenticate with the code and get a sealed session
const authResponse = await workos.userManagement.authenticateWithMagicAuth({
  clientId: process.env.WORKOS_CLIENT_ID,
  code,
  email: user.email,
  session: {
    sealSession: true,
    cookiePassword: process.env.WORKOS_COOKIE_PASSWORD,
  },
});

// This is your ready-to-use cookie value
const cookieValue = authResponse.sealedSession;
```

Note that `createMagicAuth` returns the code directly -- you're calling the SDK server-side, so there's no email to check and no inbox to poll. This is a programmatic API call, not the user-facing magic link flow.

Either option works well. Password auth is one fewer API call; magic auth means one fewer secret to manage. Pick whichever fits your setup.

## Setting the cookie in your tests

Once you have the sealed session string, you need to set it as a cookie in your test browser. The exact API depends on your test framework, but the pattern is the same everywhere: set a cookie with the right name and value before navigating to your app.

### Playwright

In Playwright, you set cookies on the browser context:

```typescript
await context.addCookies([
  {
    name: cookieName,       // Must match your app's session cookie name
    value: sealedSession,   // The value from authResponse.sealedSession
    domain: "localhost", // or the domain your app is running on during tests
    path: "/",
    httpOnly: true,
    secure: false,
    sameSite: "Lax",
  },
]);
```

### Cypress

Cypress browser code can't call the WorkOS SDK directly -- it runs in the browser, not Node. Instead, you register a [Cypress task](https://docs.cypress.io/api/commands/task) that runs server-side. First, create the task in your Cypress plugin config:

```typescript
// cypress/plugins/workos.ts
import { WorkOS } from "@workos-inc/node";

export function registerWorkOSTasks(on: Cypress.PluginEvents) {
  on("task", {
    async authenticateWithWorkOS({ email, password }) {
      const workos = new WorkOS(process.env.WORKOS_API_KEY, {
        clientId: process.env.WORKOS_CLIENT_ID,
      });

      // Using password auth (or swap for magic auth)
      return workos.userManagement.authenticateWithPassword({
        clientId: process.env.WORKOS_CLIENT_ID,
        email,
        password,
        session: {
          sealSession: true,
          cookiePassword: process.env.WORKOS_COOKIE_PASSWORD,
        },
      });
    },
  });
}
```

Register it in your `cypress.config.ts`:

```typescript
import { registerWorkOSTasks } from "./cypress/plugins/workos";

export default defineConfig({
  e2e: {
    setupNodeEvents(on, config) {
      registerWorkOSTasks(on);
    },
  },
});
```

Then use the task in your tests to get the sealed session and set the cookie:

```typescript
cy.task("authenticateWithWorkOS", {
  email: "test-user@yourcompany.com",
  password: "a-secure-test-password",
}).then((authResponse) => {
  cy.setCookie(cookieName, authResponse.sealedSession);
});
```

### Any other framework

The same idea applies to Selenium, WebDriver, or any other tool that lets you set cookies on a browser session. Get the sealed session string from the WorkOS API, set it as a cookie, and your app will treat the browser as authenticated.

## Authenticate once, reuse everywhere

A common mistake is to call the WorkOS API before every test. This is unnecessary and slow. The sealed session is just a string -- generate it once and reuse it.

**In Playwright**, cache the cookie in a module-level variable. The first test that needs authentication calls the API; every subsequent test reuses the cached value:

```typescript
let cachedCookies: any[] | undefined;

async function authenticateUser(email: string, context: BrowserContext) {
  if (cachedCookies) {
    await context.addCookies(cachedCookies);
    return;
  }

  // Call the WorkOS API (only happens once)
  const { code } = await workos.userManagement.createMagicAuth({ email });
  const authResponse = await workos.userManagement.authenticateWithMagicAuth({
    clientId: process.env.WORKOS_CLIENT_ID,
    code,
    email,
    session: {
      sealSession: true,
      cookiePassword: process.env.WORKOS_COOKIE_PASSWORD,
    },
  });

  cachedCookies = [
    {
      name: cookieName,
      value: authResponse.sealedSession,
      domain: "localhost",
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax" as const,
    },
  ];

  await context.addCookies(cachedCookies);
}
```

**In Cypress**, `cy.session()` handles caching automatically. It runs the setup function once and restores the cached session for subsequent calls:

```typescript
Cypress.Commands.add("login", (email) => {
  cy.session(email, () => {
    cy.task("authenticateWithWorkOS", { email }).then((authResponse) => {
      cy.setCookie(cookieName, authResponse.sealedSession);
    });
  });
});
```

With caching, authentication setup is a single fast API call for your entire test suite. Compare that to polling an email inbox for a magic link on every test -- the difference is seconds versus minutes.

## Writing authenticated and unauthenticated tests

The clean separation between authenticated and unauthenticated tests comes down to whether the cookie is present.

**Authenticated tests** set the cookie before running:

```typescript
// Playwright
test.describe("Authenticated flows", () => {
  test.use({ email: process.env.TEST_EMAIL });

  test("can access the dashboard", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page.getByText(/welcome back/i)).toBeVisible();
  });
});
```

```typescript
// Cypress
describe("Authenticated flows", () => {
  beforeEach(() => {
    cy.login(Cypress.env("TEST_EMAIL"));
  });

  it("can access the dashboard", () => {
    cy.visit("/dashboard");
    cy.contains(/welcome back/i).should("be.visible");
  });
});
```

**Unauthenticated tests** simply don't set the cookie. The default state is unauthenticated:

```typescript
// Playwright
test.describe("Unauthenticated flows", () => {
  // No test.use() -- no cookie, no auth

  test("redirects to login", async ({ page }) => {
    await page.goto("/dashboard");
    expect(page.url()).not.toContain("/dashboard");
  });
});
```

```typescript
// Cypress
describe("Unauthenticated flows", () => {
  // No beforeEach login -- no cookie, no auth

  it("redirects to login", () => {
    cy.visit("/dashboard");
    cy.url().should("not.include", "/dashboard");
  });
});
```

## Running in CI

To run these tests in CI, you need the following environment variables available as secrets:

- `WORKOS_API_KEY` -- your WorkOS API key
- `WORKOS_CLIENT_ID` -- your WorkOS client ID
- `WORKOS_COOKIE_PASSWORD` -- the same cookie password your app uses (this is critical -- the sealed session must be decryptable by your app)

Depending on your approach, you may also need additional variables -- for example, a `TEST_EMAIL` and `TEST_PASSWORD` if you're using a dedicated test user, or an organization ID if you're creating users on the fly. That's up to you and your test setup.

For a full working GitHub Actions workflow that runs both Playwright and Cypress tests, check out the [example repository](https://github.com/workos/next-authkit-example/tree/e2e-tests-magic-auth).

## Wrapping up

The core idea is simple: AuthKit authentication is cookie-based. Your app's middleware doesn't know or care whether that cookie came from a user clicking through the login UI or from a test script calling the WorkOS API. It just decrypts the cookie, verifies the JWT, and lets the request through.

By using the `sealSession` option, you get a production-identical session cookie from a single API call. Set it in your test browser, and your entire app behaves as if the user logged in normally. No login page to automate, no email inboxes to poll, no unnecessary latency. Just fast, reliable tests focused on what matters -- your application.

**Resources:**
- [Example repository with Playwright and Cypress tests](https://github.com/workos/next-authkit-example/tree/e2e-tests-magic-auth)
- [WorkOS User Management docs](https://workos.com/docs/user-management)
- [Magic Auth API reference](https://workos.com/docs/reference/magic-auth)
- [Session management docs](https://workos.com/docs/user-management/sessions)
