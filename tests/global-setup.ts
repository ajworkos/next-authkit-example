import { WorkOS } from "@workos-inc/node";
import fs from "fs";
import dotenv from "dotenv";
import path from "path";
import {
  testUsers,
  TEST_USERS_STATE_PATH,
  type TestUserState,
} from "./test-users";

/**
 * Playwright global setup
 *
 * Creates all test users defined in test-users.ts via the WorkOS API.
 * Writes user IDs and config to a state file for use by fixtures and teardown.
 */
export default async function globalSetup() {
  // Load env vars (same as playwright.config.ts)
  dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });
  dotenv.config({ path: path.resolve(__dirname, "..", ".env.test") });

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

  const state: Record<string, TestUserState> = {};

  for (const [profileName, config] of Object.entries(testUsers)) {
    try {
      console.log(`Creating test user: ${profileName} (${config.email})`);

      const user = await workos.userManagement.createUser({
        email: config.email,
        password: config.password,
        emailVerified: true,
      });

      state[profileName] = {
        id: user.id,
        email: config.email,
        password: config.password,
      };

      console.log(`Created test user: ${profileName} (id: ${user.id})`);
    } catch (error: any) {
      // If user already exists (e.g. from a prior unclean run), log and continue
      if (error?.code === "user_already_exists" || error?.status === 409) {
        console.warn(
          `User ${profileName} (${config.email}) already exists, continuing...`,
        );
        // Store config without ID — teardown will skip deletion for these
        state[profileName] = {
          id: "",
          email: config.email,
          password: config.password,
        };
      } else {
        console.error(`Failed to create user ${profileName}:`, error);
        throw error;
      }
    }
  }

  // Write state to disk for fixtures and teardown
  fs.writeFileSync(TEST_USERS_STATE_PATH, JSON.stringify(state, null, 2));
  console.log(`Test user state written to ${TEST_USERS_STATE_PATH}`);
}
