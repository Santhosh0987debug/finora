// Extends Express's Request type so auth middleware can attach the
// verified user id in a type-safe way.
declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export {};
