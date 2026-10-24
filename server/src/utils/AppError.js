const errorStatuses = Object.freeze({
  VALIDATION_ERROR: 400,
  UNAUTHENTICATED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  RATE_LIMITED: 429,
  AI_UNAVAILABLE: 503,
  SERVER_ERROR: 500,
});

export default class AppError extends Error {
  constructor(code, message, statusCode = errorStatuses[code], details = []) {
    super(message);

    if (!Object.hasOwn(errorStatuses, code)) {
      throw new TypeError(`Unsupported application error code: ${code}`);
    }

    this.name = 'AppError';
    this.code = code;
    this.statusCode = statusCode;
    this.details = details;
    Error.captureStackTrace?.(this, AppError);
  }
}
