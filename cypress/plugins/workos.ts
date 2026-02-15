import { WorkOS } from "@workos-inc/node";
import { testUsers, type TestUserState } from "../../tests/test-users";

/**
 * WorkOS plugin for Cypress
 *
 * Provides tasks for:
 * - Creating and deleting test users via the WorkOS API
 * - Programmatic authentication (password or magic auth, auto-detected)
 */
export function registerWorkOSTasks(
  on: Cypress.PluginEvents,
  config: Cypress.PluginConfigOptions,
) {
  // Shared WorkOS client
  function getWorkOS() {
    return new WorkOS(process.env.WORKOS_API_KEY!, {
      clientId: process.env.WORKOS_CLIENT_ID!,
      apiHostname: process.env.WORKOS_API_HOSTNAME!,
    });
  }

  on("task", {
    /**
     * Create all test users defined in tests/test-users.ts.
     * Returns a state object mapping profile names to { id, email, password? }.
     */
    async createTestUsers() {
      const workos = getWorkOS();
      const state: Record<string, TestUserState> = {};

      for (const [profileName, userConfig] of Object.entries(testUsers)) {
        try {
          console.log(
            `Creating test user: ${profileName} (${userConfig.email})`,
          );
          const user = await workos.userManagement.createUser({
            email: userConfig.email,
            password: userConfig.password,
            emailVerified: true,
          });

          state[profileName] = {
            id: user.id,
            email: userConfig.email,
            password: userConfig.password,
          };
          console.log(`Created test user: ${profileName} (id: ${user.id})`);
        } catch (error: any) {
          if (
            error?.code === "user_already_exists" ||
            error?.status === 409
          ) {
            console.warn(
              `User ${profileName} (${userConfig.email}) already exists, continuing...`,
            );
            state[profileName] = {
              id: "",
              email: userConfig.email,
              password: userConfig.password,
            };
          } else {
            console.error(`Failed to create user ${profileName}:`, error);
            throw error;
          }
        }
      }

      return state;
    },

    /**
     * Delete all test users from a state object returned by createTestUsers.
     */
    async deleteTestUsers(state: Record<string, TestUserState>) {
      if (!state) return null;

      const workos = getWorkOS();

      for (const [profileName, userState] of Object.entries(state)) {
        if (!userState.id) {
          console.log(
            `Skipping deletion for ${profileName} (no ID)`,
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
            `Failed to delete user ${profileName}:`,
            error,
          );
          // Best-effort — don't throw
        }
      }

      return null;
    },

    /**
     * Authenticate as a test user profile.
     * Auto-detects auth method: password if present, magic auth otherwise.
     */
    async authenticateWithWorkOS({ userProfile }: { userProfile: string }) {
      const userConfig = testUsers[userProfile];
      if (!userConfig) {
        throw new Error(
          `Unknown test user profile: "${userProfile}". Available profiles: ${Object.keys(testUsers).join(", ")}`,
        );
      }

      const workos = getWorkOS();

      if (userConfig.password) {
        // Password auth
        return workos.userManagement.authenticateWithPassword({
          clientId: process.env.WORKOS_CLIENT_ID!,
          email: userConfig.email,
          password: userConfig.password,
          session: {
            sealSession: true,
            cookiePassword: process.env.WORKOS_COOKIE_PASSWORD,
          },
        });
      } else {
        // Magic auth
        const magicCode = await workos.userManagement.createMagicAuth({
          email: userConfig.email,
        });

        return workos.userManagement.authenticateWithMagicAuth({
          code: magicCode.code,
          clientId: process.env.WORKOS_CLIENT_ID!,
          email: userConfig.email,
          session: {
            sealSession: true,
            cookiePassword: process.env.WORKOS_COOKIE_PASSWORD,
          },
        });
      }
    },
  });
}
