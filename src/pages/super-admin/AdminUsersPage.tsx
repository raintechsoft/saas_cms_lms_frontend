import {
  Box,
  Button,
  Card,
  Chip,
  CircularProgress,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { apiRequest } from "../../lib/api";
import { notifyError, notifySuccess } from "../../lib/notify";
import { useAppDispatch } from "../../store";
import { setUsers as setUsersStore } from "../../store/slices/platformSlice";
import { saColors } from "../../theme/superAdminTheme";
import type { PlatformUser, TenantRow, UserStatus } from "./types";

const ROLE_OPTIONS = [
  "UNIVERSE_SUPER_ADMIN",
  "RESELLER_ADMIN",
  "INSTITUTION_ADMIN",
  "TEACHER",
  "ACCOUNTANT",
  "STAFF",
  "STUDENT",
  "PARENT",
];

export function AdminUsersPage() {
  const { accessToken, user: me } = useAuth();
  const dispatch = useAppDispatch();
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [role, setRole] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (status) params.set("status", status);
      if (role) params.set("role", role);
      if (tenantId) params.set("tenantId", tenantId);
      const qs = params.toString() ? `?${params}` : "";
      const [nextUsers, nextTenants] = await Promise.all([
        apiRequest<PlatformUser[]>(`/platform/users${qs}`, accessToken),
        apiRequest<TenantRow[]>("/platform/tenants", accessToken),
      ]);
      setUsers(nextUsers);
      dispatch(setUsersStore(nextUsers));
      setTenants(nextTenants);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  async function setUserStatus(id: string, next: UserStatus) {
    try {
      await apiRequest(`/platform/users/${id}/status`, accessToken, {
        method: "PUT",
        body: JSON.stringify({ status: next }),
      });
      notifySuccess(`User ${next === "ACTIVE" ? "enabled" : "disabled"}`);
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Failed to update user");
    }
  }

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" fontWeight={800}>
          User Management
        </Typography>
        <Typography color="text.secondary" mt={0.5}>
          Platform-wide directory across tenants, resellers, and ops accounts.
        </Typography>
      </Box>

      <Card elevation={0} sx={{ border: `1px solid ${saColors.border}`, p: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5}>
          <TextField
            size="small"
            label="Search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 220 }}
          />
          <TextField select size="small" label="Status" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ minWidth: 140 }}>
            <MenuItem value="">All</MenuItem>
            <MenuItem value="ACTIVE">ACTIVE</MenuItem>
            <MenuItem value="DISABLED">DISABLED</MenuItem>
          </TextField>
          <TextField select size="small" label="Role" value={role} onChange={(e) => setRole(e.target.value)} sx={{ minWidth: 180 }}>
            <MenuItem value="">All roles</MenuItem>
            {ROLE_OPTIONS.map((r) => (
              <MenuItem key={r} value={r}>
                {r}
              </MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label="Tenant" value={tenantId} onChange={(e) => setTenantId(e.target.value)} sx={{ minWidth: 180 }}>
            <MenuItem value="">All tenants</MenuItem>
            {tenants.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.name}
              </MenuItem>
            ))}
          </TextField>
          <Button variant="contained" onClick={() => void load()}>
            Apply
          </Button>
        </Stack>
      </Card>

      <Card elevation={0} sx={{ border: `1px solid ${saColors.border}` }}>
        {loading ? (
          <Box sx={{ py: 8, display: "grid", placeItems: "center" }}>
            <CircularProgress sx={{ color: saColors.orange }} />
          </Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Name</TableCell>
                <TableCell>Email</TableCell>
                <TableCell>Tenant</TableCell>
                <TableCell>Roles</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {users.map((u) => (
                <TableRow key={u.id} hover>
                  <TableCell>
                    <Typography fontWeight={700}>
                      {u.firstName} {u.lastName}
                    </Typography>
                  </TableCell>
                  <TableCell>{u.email}</TableCell>
                  <TableCell>{u.tenant?.name ?? u.reseller?.name ?? "Platform"}</TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5} flexWrap="wrap" useFlexGap>
                      {u.roles.map((r) => (
                        <Chip key={r} size="small" label={r} />
                      ))}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Chip
                      size="small"
                      label={u.status}
                      sx={{
                        fontWeight: 800,
                        bgcolor: u.status === "ACTIVE" ? "#DCFCE7" : "#FEE2E2",
                        color: u.status === "ACTIVE" ? "#15803D" : "#B91C1C",
                      }}
                    />
                  </TableCell>
                  <TableCell align="right">
                    {u.id !== me?.id && (
                      <Button
                        size="small"
                        variant="outlined"
                        color="inherit"
                        onClick={() =>
                          void setUserStatus(u.id, u.status === "ACTIVE" ? "DISABLED" : "ACTIVE")
                        }
                      >
                        {u.status === "ACTIVE" ? "Disable" : "Enable"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
              {users.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography textAlign="center" color="text.secondary" py={4}>
                      No users found.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </Stack>
  );
}
