import { WorkOS } from "@workos-inc/node";
import fs from "fs";
import dotenv from "dotenv";
import path from "path";
import { TEST_USERS_STATE_PATH, type TestUserState } from "./test-users";

/**
 * Playwright global teardown
 *
 * Reads the state file written by global setup and deletes all created users.
 * Best-effort: logs errors but doesn't fail.
 */
export default async function globalTeardown() {
  // Load env vars
  dotenv.config({ path: path.resolve(__dirname, "..", ".env.local") });
  dotenv.config({ path: path.resolve(__dirname, "..", ".env.test") });

  if (!fs.existsSync(TEST_USERS_STATE_PATH)) {
    console.warn("No test user state file found, skipping teardown.");
    return;
  }

  const state: Record<string, TestUserState> = JSON.parse(
    fs.readFileSync(TEST_USERS_STATE_PATH, "utf-8"),
  );

  const workos = new WorkOS(process.env.WORKOS_API_KEY!, {
    apiHostname: process.env.WORKOS_API_HOSTNAME,
  });

  for (const [profileName, userState] of Object.entries(state)) {
    if (!userState.id) {
      console.log(
        `Skipping deletion for ${profileName} (no ID — user may have pre-existed)`,
      );
      continue;
    }

    try {
      console.log(
        `Deleting test user: ${profileName} (id: ${userState.id})`,
      );
      await workos.userManagement.deleteUser(userState.id);
      console.log(`Deleted test user: ${profileName}`);
    } catch (error) {
      console.error(
        `Failed to delete user ${profileName} (id: ${userState.id}):`,
        error,
      );
      // Best-effort — don't throw
    }
  }

  // Clean up the state file
  try {
    fs.unlinkSync(TEST_USERS_STATE_PATH);
    console.log("Removed test user state file.");
  } catch {
    // Ignore
  }
}
