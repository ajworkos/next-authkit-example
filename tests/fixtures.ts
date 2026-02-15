import { test as base, expect, type BrowserContext } from "@playwright/test";
import { WorkOS } from "@workos-inc/node";
import fs from "fs";
import {
  testUsers,
  TEST_USERS_STATE_PATH,
  type TestUserConfig,
  type TestUserState,
} from "./test-users";

// Cache for authenticated users keyed by profile name
interface CachedUser {
  config: TestUserConfig;
  cookies?: any[];
}

const userCache: Record<string, CachedUser> = {};

/**
 * Load the runtime state written by global-setup.ts.
 * Falls back to the static config if the state file doesn't exist
 * (e.g. when running a single test file without global setup).
 */
function loadUserState(): Record<string, TestUserState> | null {
  try {
    if (fs.existsSync(TEST_USERS_STATE_PATH)) {
      return JSON.parse(fs.readFileSync(TEST_USERS_STATE_PATH, "utf-8"));
    }
  } catch {
    // Fall through
  }
  return null;
}

/**
 * Resolve user config for a profile, preferring runtime state from global setup.
 */
function resolveUserConfig(profileName: string): TestUserConfig {
  const state = loadUserState();
  if (state && state[profileName]) {
    return {
      email: state[profileName].email,
      password: state[profileName].password,
    };
  }
  // Fallback to static config
  return testUsers[profileName];
}

// Extended test interface
interface TestFixtures {
  user?: string; // Profile name from testUsers config
  email?: string; // Derived from user profile (for assertions in tests)
}

interface WorkerFixtures {}

const COOKIE_NAME = process.env.WORKOS_COOKIE_NAME || "wos-session";

const COOKIE_DOMAIN = process.env.TEST_BASE_URL
  ? new URL(process.env.TEST_BASE_URL).hostname
  : "localhost";

async function authenticateUser(
  profileName: string,
  context: BrowserContext,
): Promise<void> {
  const userConfig = resolveUserConfig(profileName);
  if (!userConfig) {
    throw new Error(
      `Unknown test user profile: "${profileName}". Available profiles: ${Object.keys(testUsers).join(", ")}`,
    );
  }

  let cached = userCache[profileName];

  // Initialize cache entry if not exists
  if (!cached) {
    cached = userCache[profileName] = { config: userConfig };
  }

  // Check if we have valid cached cookies
  if (cached.cookies) {
    console.log(`Using cached cookies for user: ${profileName}`);
    await context.addCookies(cached.cookies);
    return;
  }

  console.log(
    `Authenticating user: ${profileName} (${userConfig.email}) via ${userConfig.password ? "password" : "magic auth"}`,
  );

  const workosApiKey = process.env.WORKOS_API_KEY;
  const workosClientId = process.env.WORKOS_CLIENT_ID;

  if (!workosApiKey || !workosClientId) {
    throw new Error(
      "Missing WORKOS_API_KEY or WORKOS_CLIENT_ID environment variables",
    );
  }

  const workos = new WorkOS(workosApiKey, {
    apiHostname: process.env.WORKOS_API_HOSTNAME,
  });

  try {
    let authResponse;

    if (userConfig.password) {
      // Password auth
      authResponse = await workos.userManagement.authenticateWithPassword({
        clientId: workosClientId,
        email: userConfig.email,
        password: userConfig.password,
        session: {
          sealSession: true,
          cookiePassword: process.env.WORKOS_COOKIE_PASSWORD,
        },
      });
    } else {
      // Magic auth
      const magicAuthToken = await workos.userManagement.createMagicAuth({
        email: userConfig.email,
      });

      authResponse = await workos.userManagement.authenticateWithMagicAuth({
        clientId: workosClientId,
        code: magicAuthToken.code,
        email: userConfig.email,
        session: {
          sealSession: true,
          cookiePassword: process.env.WORKOS_COOKIE_PASSWORD,
        },
      });
    }

    const cookie = {
      name: COOKIE_NAME,
      value: authResponse.sealedSession || "",
      domain: COOKIE_DOMAIN,
      path: "/",
      httpOnly: true,
      secure: false,
      sameSite: "Lax" as const,
    };

    // Cache cookies for this profile
    cached.cookies = [cookie];

    // Add cookies to current context
    await context.addCookies(cached.cookies);
    console.log(`Authenticated and cached user: ${profileName}`);
  } catch (error) {
    console.error(
      `Authentication failed for user ${profileName} (${userConfig.email}):`,
      error,
    );
    throw error;
  }
}

// Create extended test with user profile fixture
export const test = base.extend<TestFixtures, WorkerFixtures>({
  user: [undefined, { option: true }],

  // Derive email from the user profile for use in test assertions
  email: async ({ user }, use) => {
    if (user) {
      const config = resolveUserConfig(user);
      await use(config?.email);
    } else {
      await use(undefined);
    }
  },

  // Override the default page fixture to handle authentication
  page: async ({ page, user, context }, use) => {
    if (user) {
      await authenticateUser(user, context);
    }
    // If user not provided, page remains unauthenticated
    await use(page);
  },
});

export { expect };
