/**
 * Custom command for programmatic authentication
 *
 * Accepts a user profile name from tests/test-users.ts.
 * Uses cy.session for caching per profile.
 */
Cypress.Commands.add("login", (userProfile: string) => {
  if (!userProfile) {
    throw new Error("A user profile name is required");
  }

  cy.session(
    userProfile,
    () => {
      const cookieName = Cypress.env("WORKOS_COOKIE_NAME") ?? "wos-session";

      cy.log(`Authenticating as profile: ${userProfile}`);

      return cy
        .task("authenticateWithWorkOS", { userProfile })
        .then((authResponse) => {
          cy.log("API authentication successful");
          cy.setCookie(cookieName, authResponse.sealedSession!);
        });
    },
    {
      validate() {
        // Validate that the session is still valid by checking authenticated state
        cy.visit("/");
        cy.get("body").should("contain.text", "Welcome back");
      },
    },
  );
});
