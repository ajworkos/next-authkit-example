import { WorkOS } from "@workos-inc/node";

/**
 * WorkOS authentication plugin for Cypress
 * Provides tasks for programmatic authentication using WorkOS SDK
 */
export function registerWorkOSTasks(
  on: Cypress.PluginEvents,
  config: Cypress.PluginConfigOptions,
) {
  on("task", {
    async authenticateWithWorkOS({ email }) {
      const workos = new WorkOS(process.env.WORKOS_API_KEY!, {
        clientId: process.env.WORKOS_CLIENT_ID!,
        apiHostname: process.env.WORKOS_API_HOSTNAME!,
      });

      // create a magic code
      const magicCode = await workos.userManagement.createMagicAuth({
        email,
      });

      // authenticate with the magic code
      return workos.userManagement.authenticateWithMagicAuth({
        code: magicCode.code,
        clientId: process.env.WORKOS_CLIENT_ID!,
        email,
        session: {
          sealSession: true,
          cookiePassword: process.env.WORKOS_COOKIE_PASSWORD,
        },
      });
    },
  });
}
