interface AuthenticateWithWorkOSParams {
  userProfile: string;
}

interface AuthenticateWithWorkOSResponse {
  user: Record<string, unknown>;
  accessToken: string;
  refreshToken: string;
  sealedSession?: string;
}

interface TestUserState {
  id: string;
  email: string;
  password?: string;
}

declare namespace Cypress {
  interface Chainable {
    login(userProfile: string): Chainable<void>;

    task(
      event: "authenticateWithWorkOS",
      arg: AuthenticateWithWorkOSParams,
      options?: Partial<Loggable & Timeoutable>,
    ): Chainable<AuthenticateWithWorkOSResponse>;

    task(
      event: "createTestUsers",
      arg?: undefined,
      options?: Partial<Loggable & Timeoutable>,
    ): Chainable<Record<string, TestUserState>>;

    task(
      event: "deleteTestUsers",
      arg: Record<string, TestUserState>,
      options?: Partial<Loggable & Timeoutable>,
    ): Chainable<null>;
  }
}
