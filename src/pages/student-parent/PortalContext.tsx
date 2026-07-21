import { createContext, useContext, type ReactNode } from "react";
import type { PortalChild, PortalOverview } from "./portalTypes";

export interface PortalContextValue {
  overview: PortalOverview | null;
  activeChild: number;
  setActiveChild: (index: number) => void;
  child: PortalChild | null;
  reload: () => Promise<void>;
  accessToken: string;
  role: "STUDENT" | "PARENT";
  productMode: "CMS" | "LMS" | "BOTH" | null;
  canSubmitHomework: boolean;
  loading: boolean;
  error: string;
  basePath: string;
}

const PortalContext = createContext<PortalContextValue | null>(null);

export function PortalProvider({
  value,
  children,
}: {
  value: PortalContextValue;
  children: ReactNode;
}) {
  return <PortalContext.Provider value={value}>{children}</PortalContext.Provider>;
}

export function usePortal() {
  const ctx = useContext(PortalContext);
  if (!ctx) throw new Error("usePortal must be used within PortalShell");
  return ctx;
}
