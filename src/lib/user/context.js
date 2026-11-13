"use client";

import { createContext, useContext } from "react";

/**
 * Authenticated user data from /api/auth/me.
 *
 * Set once by AuthGuard after a successful fetch. Components below the guard
 * can call useUser() and trust that the value is present — the guard never
 * renders children until the user is loaded.
 */
const UserContext = createContext(null);

export function UserProvider({ user, children }) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>;
}

export function useUser() {
  return useContext(UserContext);
}
