import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AuditRow, PlatformStats, PlatformUser, ResellerRow, TenantRow } from "../../pages/super-admin/types";

interface PlatformState {
  stats: PlatformStats | null;
  tenants: TenantRow[];
  resellers: ResellerRow[];
  users: PlatformUser[];
  audit: AuditRow[];
  tenantsLoading: boolean;
  statsLoading: boolean;
}

const initialState: PlatformState = {
  stats: null,
  tenants: [],
  resellers: [],
  users: [],
  audit: [],
  tenantsLoading: false,
  statsLoading: false,
};

const platformSlice = createSlice({
  name: "platform",
  initialState,
  reducers: {
    setStats(state, action: PayloadAction<PlatformStats | null>) {
      state.stats = action.payload;
      state.statsLoading = false;
    },
    setStatsLoading(state, action: PayloadAction<boolean>) {
      state.statsLoading = action.payload;
    },
    setTenants(state, action: PayloadAction<TenantRow[]>) {
      state.tenants = action.payload;
      state.tenantsLoading = false;
    },
    setTenantsLoading(state, action: PayloadAction<boolean>) {
      state.tenantsLoading = action.payload;
    },
    setResellers(state, action: PayloadAction<ResellerRow[]>) {
      state.resellers = action.payload;
    },
    setUsers(state, action: PayloadAction<PlatformUser[]>) {
      state.users = action.payload;
    },
    setAudit(state, action: PayloadAction<AuditRow[]>) {
      state.audit = action.payload;
    },
  },
});

export const {
  setStats,
  setStatsLoading,
  setTenants,
  setTenantsLoading,
  setResellers,
  setUsers,
  setAudit,
} = platformSlice.actions;
export default platformSlice.reducer;
