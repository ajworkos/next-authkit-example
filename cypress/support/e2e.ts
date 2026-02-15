// Import custom commands
import "./commands";

// Create test users before all specs, delete after
before(() => {
  cy.task("createTestUsers").then((state) => {
    Cypress.env("TEST_USERS_STATE", state);
  });
});

after(() => {
  cy.task("deleteTestUsers", Cypress.env("TEST_USERS_STATE"));
});
