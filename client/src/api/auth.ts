import type { AuthSession, AuthUser } from "../types/api";
import { apiRequest } from "./client";
import { asRecord, dateField, stringField } from "./validation";

function parseUser(value: unknown): AuthUser {
  const user = asRecord(value, "user");
  return {
    id: stringField(user, "id", "user id"),
    name: stringField(user, "name", "user name"),
    email: stringField(user, "email", "user email"),
    createdAt: dateField(user, "createdAt", "user creation date"),
    updatedAt: dateField(user, "updatedAt", "user update date"),
  };
}

function parseSession(value: unknown): AuthSession {
  const payload = asRecord(value, "authentication response");
  return {
    user: parseUser(payload.user),
    token: stringField(payload, "token", "authentication token"),
  };
}

export async function loginRequest(
  email: string,
  password: string,
): Promise<AuthSession> {
  const payload = await apiRequest<unknown>("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  return parseSession(payload);
}

export async function registerRequest(
  name: string,
  email: string,
  password: string,
): Promise<AuthSession> {
  const payload = await apiRequest<unknown>("/api/auth/register", {
    method: "POST",
    body: { name, email, password },
  });
  return parseSession(payload);
}

export async function getCurrentUser(
  token: string,
  signal?: AbortSignal,
): Promise<AuthUser> {
  const payload = await apiRequest<unknown>("/api/auth/me", {
    token,
    signal,
  });
  const record = asRecord(payload, "profile response");
  return parseUser(record.user);
}
