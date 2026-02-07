interface AuthenticateWithWorkOSParams {
  email: string;
}

interface AuthenticateWithWorkOSResponse {
  user: Record<string, unknown>;
  accessToken: string;
  refreshToken: string;
  sealedSession?: string;
}

declare namespace Cypress {
  interface Chainable {
    login(username: string): Chainable<void>;

    task(
      event: "authenticateWithWorkOS",
      arg: AuthenticateWithWorkOSParams,
      options?: Partial<Loggable & Timeoutable>,
    ): Chainable<AuthenticateWithWorkOSResponse>;
  }
}
