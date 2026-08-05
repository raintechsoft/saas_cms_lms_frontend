import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { MOCK_CHILDREN, MOCK_PARENT_USER } from "./mockData";
import type { ParentChild, ParentUser } from "./types";

export interface ParentPortalContextValue {
  parent: ParentUser;
  children: ParentChild[];
  activeChild: ParentChild;
  activeChildIndex: number;
  setActiveChildIndex: (index: number) => void;
}

const ParentPortalContext = createContext<ParentPortalContextValue | null>(null);

export function ParentPortalProvider({ children: reactChildren }: { children: ReactNode }) {
  const [activeChildIndex, setActiveChildIndex] = useState(0);

  const value = useMemo<ParentPortalContextValue>(
    () => ({
      parent: MOCK_PARENT_USER,
      children: MOCK_CHILDREN,
      activeChild: MOCK_CHILDREN[activeChildIndex] ?? MOCK_CHILDREN[0],
      activeChildIndex,
      setActiveChildIndex,
    }),
    [activeChildIndex],
  );

  return <ParentPortalContext.Provider value={value}>{reactChildren}</ParentPortalContext.Provider>;
}

export function useParentPortal() {
  const ctx = useContext(ParentPortalContext);
  if (!ctx) throw new Error("useParentPortal must be used within ParentPortalProvider");
  return ctx;
}
