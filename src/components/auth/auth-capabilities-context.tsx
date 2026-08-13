"use client";

import { createContext, type ReactNode, useContext } from "react";

import type { AuthCapabilities } from "@/lib/env";

const AuthCapabilitiesContext = createContext<AuthCapabilities>({ github: true, email: true });

export function AuthCapabilitiesProvider({
  capabilities,
  children,
}: {
  capabilities: AuthCapabilities;
  children: ReactNode;
}) {
  return (
    <AuthCapabilitiesContext.Provider value={capabilities}>
      {children}
    </AuthCapabilitiesContext.Provider>
  );
}

export function useAuthCapabilities(): AuthCapabilities {
  return useContext(AuthCapabilitiesContext);
}
