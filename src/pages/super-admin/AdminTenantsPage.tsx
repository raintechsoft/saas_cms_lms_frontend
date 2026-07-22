import {
  Add,
  FilterList,
  MoreVert,
  PublicOutlined,
  SpeedOutlined,
  TrendingUpOutlined,
} from "@mui/icons-material";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
  InputAdornment,
  Menu,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { apiRequest } from "../../lib/api";
import { notifyError, notifySuccess } from "../../lib/notify";
import { useAppDispatch, useAppSelector } from "../../store";
import { setTenants, setTenantsLoading } from "../../store/slices/platformSlice";
import { saColors } from "../../theme/superAdminTheme";
import type { TenantRow, TenantStatus } from "./types";

const STATUS_SX: Record<string, { bg: string; color: string }> = {
  ACTIVE: { bg: "#DCFCE7", color: "#15803D" },
  SUSPENDED: { bg: "#FFEDD5", color: "#C2410C" },
  ARCHIVED: { bg: "#FEE2E2", color: "#B91C1C" },
};

function moduleChips(mode: string) {
  if (mode === "BOTH") return ["CMS", "LMS"];
  return [mode];
}

export function AdminTenantsPage() {
  const { accessToken } = useAuth();
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const tenants = useAppSelector((s) => s.platform.tenants);
  const loading = useAppSelector((s) => s.platform.tenantsLoading);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [menuAnchor, setMenuAnchor] = useState<null | HTMLElement>(null);
  const [menuTenant, setMenuTenant] = useState<TenantRow | null>(null);

  async function load() {
    dispatch(setTenantsLoading(true));
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      const qs = params.toString() ? `?${params}` : "";
      const data = await apiRequest<TenantRow[]>(`/platform/tenants${qs}`, accessToken);
      dispatch(setTenants(data));
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Failed to load tenants");
      dispatch(setTenantsLoading(false));
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return tenants;
    return tenants.filter(
      (t) => t.name.toLowerCase().includes(q) || t.slug.toLowerCase().includes(q) || t.id.toLowerCase().includes(q),
    );
  }, [tenants, search]);

  const pageRows = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  async function changeStatus(id: string, next: TenantStatus) {
    try {
      await apiRequest(`/platform/tenants/${id}/status`, accessToken, {
        method: "PUT",
        body: JSON.stringify({ status: next }),
      });
      notifySuccess(`Tenant marked ${next.toLowerCase()}`);
      setMenuAnchor(null);
      await load();
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Failed to update status");
    }
  }

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="h4" fontWeight={800}>
            Tenants Management
          </Typography>
          <Typography color="text.secondary" mt={0.5}>
            Manage organization access, subscription lifecycle, and module licensing.
          </Typography>
        </Box>
        <Button
          component={Link}
          to="/admin/tenants/new"
          variant="contained"
          startIcon={<Add />}
          sx={{ alignSelf: { sm: "flex-start" } }}
        >
          Create Tenant
        </Button>
      </Stack>

      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} alignItems={{ md: "center" }}>
        <TextField
          size="small"
          placeholder="Filter by name or ID..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") void load();
          }}
          sx={{ minWidth: 280, bgcolor: "#fff" }}
          InputProps={{
            startAdornment: (
              <InputAdornment position="start">
                <FilterList fontSize="small" />
              </InputAdornment>
            ),
          }}
        />
        <Button variant="outlined" color="inherit" onClick={() => void load()}>
          Apply Filters
        </Button>
        <Box flex={1} />
        <Typography variant="body2" color="text.secondary">
          Sort by: Date Created
        </Typography>
      </Stack>

      <Card elevation={0} sx={{ border: `1px solid ${saColors.border}` }}>
        {loading && tenants.length === 0 ? (
          <Box sx={{ py: 8, display: "grid", placeItems: "center" }}>
            <CircularProgress sx={{ color: saColors.orange }} />
          </Box>
        ) : (
          <>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Tenant Name</TableCell>
                  <TableCell>Customer Type</TableCell>
                  <TableCell>Modules</TableCell>
                  <TableCell>Subscription</TableCell>
                  <TableCell>Status</TableCell>
                  <TableCell>Total Users</TableCell>
                  <TableCell>Created</TableCell>
                  <TableCell align="right" />
                </TableRow>
              </TableHead>
              <TableBody>
                {pageRows.map((tenant) => {
                  const status = STATUS_SX[tenant.status] ?? STATUS_SX.ARCHIVED;
                  return (
                    <TableRow key={tenant.id} hover sx={{ cursor: "pointer" }} onClick={() => navigate(`/admin/tenants/${tenant.id}`)}>
                      <TableCell>
                        <Typography fontWeight={700}>{tenant.name}</Typography>
                        <Typography variant="caption" color="text.secondary">
                          {tenant.slug} · {tenant.id.slice(0, 8).toUpperCase()}
                        </Typography>
                      </TableCell>
                      <TableCell>{tenant.type.replaceAll("_", " ")}</TableCell>
                      <TableCell>
                        <Stack direction="row" spacing={0.5}>
                          {moduleChips(tenant.productMode).map((m) => (
                            <Chip
                              key={m}
                              size="small"
                              label={m}
                              sx={{ bgcolor: "#DBEAFE", color: "#1D4ED8", fontWeight: 700 }}
                            />
                          ))}
                        </Stack>
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={tenant.distributionModel.replaceAll("_", " ")}
                          sx={{ bgcolor: "#E2E8F0", fontWeight: 700 }}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          size="small"
                          label={tenant.status}
                          sx={{ bgcolor: status.bg, color: status.color, fontWeight: 800 }}
                        />
                      </TableCell>
                      <TableCell>{tenant.users}</TableCell>
                      <TableCell>{new Date(tenant.createdAt).toLocaleDateString()}</TableCell>
                      <TableCell align="right" onClick={(e) => e.stopPropagation()}>
                        <IconButton
                          size="small"
                          onClick={(e) => {
                            setMenuAnchor(e.currentTarget);
                            setMenuTenant(tenant);
                          }}
                        >
                          <MoreVert fontSize="small" />
                        </IconButton>
                      </TableCell>
                    </TableRow>
                  );
                })}
                {pageRows.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={8}>
                      <Typography py={4} textAlign="center" color="text.secondary">
                        No tenants found.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <TablePagination
              component="div"
              count={filtered.length}
              page={page}
              onPageChange={(_, p) => setPage(p)}
              rowsPerPage={rowsPerPage}
              onRowsPerPageChange={(e) => {
                setRowsPerPage(parseInt(e.target.value, 10));
                setPage(0);
              }}
              rowsPerPageOptions={[5, 10, 25]}
            />
          </>
        )}
      </Card>

      <Grid container spacing={2}>
        {[
          { label: "Global Reach", value: `${tenants.length} Tenants`, icon: <PublicOutlined />, color: saColors.success },
          { label: "Growth Index", value: `${tenants.filter((t) => t.status === "ACTIVE").length} Active`, icon: <TrendingUpOutlined />, color: saColors.info },
          { label: "Sync Status", value: "99.9% Uptime", icon: <SpeedOutlined />, color: saColors.orange },
        ].map((card) => (
          <Grid key={card.label} size={{ xs: 12, md: 4 }}>
            <Card elevation={0} sx={{ border: `1px solid ${saColors.border}` }}>
              <CardContent>
                <Stack direction="row" spacing={1.5} alignItems="center">
                  <Box
                    sx={{
                      width: 42,
                      height: 42,
                      borderRadius: 2,
                      bgcolor: `${card.color}18`,
                      color: card.color,
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    {card.icon}
                  </Box>
                  <Box>
                    <Typography variant="overline" color="text.secondary">
                      {card.label}
                    </Typography>
                    <Typography variant="h6" fontWeight={800}>
                      {card.value}
                    </Typography>
                  </Box>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Menu anchorEl={menuAnchor} open={Boolean(menuAnchor)} onClose={() => setMenuAnchor(null)}>
        <MenuItem
          onClick={() => {
            if (menuTenant) navigate(`/admin/tenants/${menuTenant.id}`);
            setMenuAnchor(null);
          }}
        >
          View details
        </MenuItem>
        <MenuItem
          onClick={() => {
            if (menuTenant) navigate(`/admin/tenants/${menuTenant.id}/edit`);
            setMenuAnchor(null);
          }}
        >
          Edit
        </MenuItem>
        {menuTenant?.status === "ACTIVE" && (
          <MenuItem onClick={() => menuTenant && void changeStatus(menuTenant.id, "SUSPENDED")}>Suspend</MenuItem>
        )}
        {menuTenant?.status === "SUSPENDED" && (
          <MenuItem onClick={() => menuTenant && void changeStatus(menuTenant.id, "ACTIVE")}>Activate</MenuItem>
        )}
      </Menu>
    </Stack>
  );
}
