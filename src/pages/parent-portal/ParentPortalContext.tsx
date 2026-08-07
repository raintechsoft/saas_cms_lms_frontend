import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "../../auth/AuthContext";
import { apiRequest } from "../../lib/api";
import type { PortalChild, PortalOverview } from "../student-parent/portalTypes";
import { PORTAL_CHILD_STORAGE_KEY } from "../student-parent/portalTypes";
import type { ParentChild, ParentUser } from "./types";

function mapChild(child: PortalChild): ParentChild {
  const name = `${child.student.firstName} ${child.student.lastName ?? ""}`.trim();
  return {
    id: child.student.id,
    name,
    className: child.enrollment?.className ?? "—",
    section: child.enrollment?.section ?? "—",
    photoUrl: child.student.photoUrl,
    transportOptIn: child.student.transportOptIn,
    transportRoute: child.student.transportRoute,
    transport: child.student.transport
      ? {
          routeName: child.student.transport.routeName,
          vehicleNumber: child.student.transport.vehicleNumber,
          driverName: child.student.transport.driverName,
          driverPhone: child.student.transport.driverPhone,
        }
      : null,
  };
}

function readStoredChildIndex(length: number) {
  if (length <= 0) return 0;
  try {
    const raw = localStorage.getItem(PORTAL_CHILD_STORAGE_KEY);
    const index = raw == null ? 0 : Number(raw);
    if (Number.isFinite(index) && index >= 0 && index < length) return index;
  } catch {
    /* ignore */
  }
  return 0;
}

export interface ParentPortalContextValue {
  parent: ParentUser;
  children: ParentChild[];
  activeChild: ParentChild;
  activeChildIndex: number;
  setActiveChildIndex: (index: number) => void;
  /** Full portal child payload from /portal/overview */
  portalChild: PortalChild | null;
  overview: PortalOverview | null;
  accessToken: string;
  productMode: PortalOverview["productMode"];
  canSubmitHomework: boolean;
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
}

const ParentPortalContext = createContext<ParentPortalContextValue | null>(null);

export function ParentPortalProvider({ children: reactChildren }: { children: ReactNode }) {
  const { accessToken, user } = useAuth();
  const [overview, setOverview] = useState<PortalOverview | null>(null);
  const [activeChildIndex, setActiveChildIndexState] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const reload = useCallback(async () => {
    if (!accessToken) {
      setOverview(null);
      setLoading(false);
      return;
    }
    try {
      setError("");
      const data = await apiRequest<PortalOverview>("/portal/overview", accessToken);
      setOverview(data);
      setActiveChildIndexState((current) => {
        const stored = readStoredChildIndex(data.children.length);
        return current >= 0 && current < data.children.length ? current : stored;
      });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Unable to load parent portal");
      setOverview(null);
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    setLoading(true);
    void reload();
  }, [reload]);

  const setActiveChildIndex = useCallback(
    (index: number) => {
      setActiveChildIndexState(index);
      try {
        localStorage.setItem(PORTAL_CHILD_STORAGE_KEY, String(index));
      } catch {
        /* ignore */
      }
    },
    [],
  );

  const mappedChildren = useMemo(
    () => (overview?.children ?? []).map(mapChild),
    [overview?.children],
  );

  const portalChild = overview?.children[activeChildIndex] ?? overview?.children[0] ?? null;
  const activeChild =
    mappedChildren[activeChildIndex] ??
    mappedChildren[0] ??
    ({
      id: "",
      name: "No linked student",
      className: "—",
      section: "—",
    } satisfies ParentChild);

  const parent = useMemo<ParentUser>(
    () => ({
      id: user?.id ?? "",
      name: user ? `${user.firstName} ${user.lastName ?? ""}`.trim() : "Parent",
      role: "Parent",
      photoUrl: null,
    }),
    [user],
  );

  const value = useMemo<ParentPortalContextValue>(
    () => ({
      parent,
      children: mappedChildren,
      activeChild,
      activeChildIndex,
      setActiveChildIndex,
      portalChild,
      overview,
      accessToken,
      productMode: overview?.productMode ?? null,
      canSubmitHomework: overview?.canSubmitHomework ?? false,
      loading,
      error,
      reload,
    }),
    [
      parent,
      mappedChildren,
      activeChild,
      activeChildIndex,
      setActiveChildIndex,
      portalChild,
      overview,
      accessToken,
      loading,
      error,
      reload,
    ],
  );

  return <ParentPortalContext.Provider value={value}>{reactChildren}</ParentPortalContext.Provider>;
}

export function useParentPortal() {
  const ctx = useContext(ParentPortalContext);
  if (!ctx) throw new Error("useParentPortal must be used within ParentPortalProvider");
  return ctx;
}
