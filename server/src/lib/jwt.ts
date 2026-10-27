import jwt from "jsonwebtoken";

const ACCESS_TOKEN_TTL_SECONDS = 60 * 60; // 1 hour

// Never fall back to a hardcoded secret: crash early with a clear message
// so the server cannot run authentication in an insecure state.
export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.length < 16) {
    throw new Error(
      "JWT_SECRET is not configured. Set a strong random value (at least 16 characters) in server/.env.",
    );
  }
  return secret;
}

export function signAccessToken(userId: string): string {
  return jwt.sign({ sub: userId }, getJwtSecret(), {
    expiresIn: ACCESS_TOKEN_TTL_SECONDS,
  });
}

// Returns the authenticated user id, or throws on any invalid/expired token.
export function verifyAccessToken(token: string): string {
  const payload = jwt.verify(token, getJwtSecret());
  if (
    typeof payload === "string" ||
    !payload.sub ||
    typeof payload.sub !== "string"
  ) {
    throw new jwt.JsonWebTokenError("Invalid token payload");
  }
  return payload.sub;
}
