/** Extracts a user-presentable message from an unknown thrown value. */
export function errorMessage(error: unknown, fallback = 'Something went wrong.'): string {
  if (error instanceof Error && error.message) return error.message;
  if (typeof error === 'string' && error.length > 0) return error;
  return fallback;
}

export class UserFacingError extends Error {
  constructor(message: string, override readonly cause?: unknown) {
    super(message);
    this.name = 'UserFacingError';
  }
}

export class CancelledError extends Error {
  constructor() {
    super('Operation cancelled.');
    this.name = 'CancelledError';
  }
}

export function isCancelled(error: unknown): boolean {
  return error instanceof CancelledError;
}
