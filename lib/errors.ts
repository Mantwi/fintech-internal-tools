// Error types shared by services and route handlers. Messages must never
// contain sensitive values (SSN, DOB, note text) because they reach the client.

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class AuthenticationError extends AppError {
  constructor(message = "No demo identity selected") {
    super(401, "UNAUTHENTICATED", message);
  }
}

export class AuthorizationError extends AppError {
  constructor(message = "You are not permitted to perform this action") {
    super(403, "FORBIDDEN", message);
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Not found") {
    super(404, "NOT_FOUND", message);
  }
}

export class ValidationError extends AppError {
  constructor(message: string) {
    super(400, "INVALID_REQUEST", message);
  }
}

/** The request is well-formed and permitted, but the current state forbids it. */
export class BusinessRuleError extends AppError {
  constructor(message: string) {
    super(409, "RULE_VIOLATION", message);
  }
}
