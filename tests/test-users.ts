import path from "path";

/**
 * Test user configuration
 *
 * Define named user profiles for E2E tests. The auth method is auto-detected:
 * - If `password` is present, authenticates via `authenticateWithPassword`
 * - If `password` is absent, authenticates via magic auth (`createMagicAuth` + `authenticateWithMagicAuth`)
 *
 * Users are created automatically by global setup and deleted by global teardown,
 * so no pre-existing users are needed in your WorkOS environment.
 */

export interface TestUserConfig {
  email: string;
  password?: string;
}

/** Runtime state populated by global setup, persisted to disk */
export interface TestUserState {
  id: string;
  email: string;
  password?: string;
}

export const testUsers: Record<string, TestUserConfig> = {
  /**
   * Authenticates via magic auth (no password needed).
   * The simplest option — just an email.
   */
  magicAuthUser: {
    email: "test-magic-auth@example.com",
  },

  /**
   * Authenticates via password.
   * Password is inline since this user is ephemeral (created and deleted each run).
   */
  passwordUser: {
    email: "test-password@example.com",
    password: "test-password-123",
  },
};

/** Path to the state file written by global setup and read by teardown + fixtures */
export const TEST_USERS_STATE_PATH = path.resolve(
  __dirname,
  ".test-users-state.json",
);
