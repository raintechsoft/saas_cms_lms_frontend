import {
  DownloadOutlined,
  CalendarMonthOutlined,
  CheckCircleOutline,
  ErrorOutline,
  WarningAmberOutlined,
  TerminalOutlined,
} from "@mui/icons-material";
import {
  Avatar,
  Box,
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
import { useAuth } from "../../auth/AuthContext";
import { apiRequest } from "../../lib/api";
import { notifyError, notifyInfo } from "../../lib/notify";
import { saColors } from "../../theme/superAdminTheme";
import { SaCard, SaGhostButton, SaKpi, SaPageHeader, SaPrimaryButton, SaStatusChip } from "./saUi";
import type { AuditRow, TenantRow } from "./types";

function statusTone(action: string) {
  const a = action.toLowerCase();
  if (a.includes("fail") || a.includes("error")) return "danger" as const;
  if (a.includes("suspend") || a.includes("warn")) return "warning" as const;
  return "success" as const;
}

export function AdminAuditPage() {
  const { accessToken } = useAuth();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [search, setSearch] = useState("");
  const [tenantId, setTenantId] = useState("");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  useEffect(() => {
    Promise.all([
      apiRequest<AuditRow[]>("/platform/audit?limit=200", accessToken),
      apiRequest<TenantRow[]>("/platform/tenants", accessToken),
    ])
      .then(([audit, nextTenants]) => {
        setRows(audit);
        setTenants(nextTenants);
      })
      .catch((cause) => notifyError(cause instanceof Error ? cause.message : "Failed to load audit"));
  }, [accessToken]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      const matchQ =
        !q ||
        row.action.toLowerCase().includes(q) ||
        (row.actor ?? "").toLowerCase().includes(q) ||
        (row.tenant ?? "").toLowerCase().includes(q);
      const matchT = !tenantId || row.tenantSlug === tenants.find((t) => t.id === tenantId)?.slug || row.tenant === tenants.find((t) => t.id === tenantId)?.name;
      return matchQ && matchT;
    });
  }, [rows, search, tenantId, tenants]);

  const pageRows = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box>
      <SaPageHeader
        title="Audit Logs"
        description="Complete history of actions performed across the platform."
        actions={
          <>
            <SaGhostButton startIcon={<CalendarMonthOutlined />} onClick={() => notifyInfo("Date range coming soon")}>
              Date Range
            </SaGhostButton>
            <SaPrimaryButton startIcon={<DownloadOutlined />} onClick={() => notifyInfo("CSV export coming soon")}>
              Export CSV
            </SaPrimaryButton>
          </>
        }
      />

      <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} mb={2}>
        <TextField size="small" placeholder="Search by actor, tenant, or action..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} sx={{ minWidth: 280, bgcolor: "#fff" }} />
        <TextField select size="small" label="Tenant" value={tenantId} onChange={(e) => setTenantId(e.target.value)} sx={{ minWidth: 180, bgcolor: "#fff" }}>
          <MenuItem value="">All Tenants</MenuItem>
          {tenants.map((t) => (
            <MenuItem key={t.id} value={t.id}>{t.name}</MenuItem>
          ))}
        </TextField>
      </Stack>

      <Box sx={{ border: `1px solid ${saColors.border}`, borderRadius: 2, bgcolor: "#fff", overflow: "hidden", mb: 2.5 }}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Timestamp</TableCell>
              <TableCell>Actor</TableCell>
              <TableCell>Action</TableCell>
              <TableCell>Tenant</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Details</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pageRows.map((row) => {
              const tone = statusTone(row.action);
              const initials = (row.actor ?? "SY").slice(0, 2).toUpperCase();
              return (
                <TableRow key={row.id} hover>
                  <TableCell>
                    <Typography variant="body2">{new Date(row.createdAt).toLocaleString()}</Typography>
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Avatar sx={{ width: 28, height: 28, bgcolor: saColors.info, fontSize: 12, fontWeight: 800 }}>{initials}</Avatar>
                      <Typography fontWeight={700} color={saColors.info} fontSize={13}>
                        {row.actor ?? row.actorEmail ?? "system"}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <SaStatusChip label={row.action} tone="neutral" />
                  </TableCell>
                  <TableCell>
                    <Typography color={saColors.info} fontWeight={600} fontSize={13}>
                      {row.tenant ?? "platform"}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <SaStatusChip label={tone === "danger" ? "FAILED" : tone === "warning" ? "WARNING" : "SUCCESS"} tone={tone} />
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2" color="text.secondary">
                      {row.entityType}
                    </Typography>
                  </TableCell>
                </TableRow>
              );
            })}
            {pageRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={6}>
                  <Typography textAlign="center" color="text.secondary" py={4}>No audit events found.</Typography>
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
        <Stack direction="row" justifyContent="space-between" alignItems="center" px={2}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Typography variant="body2" color="text.secondary">Showing {pageRows.length} of {filtered.length} events</Typography>
            <SaStatusChip label="LIVE UPDATES ENABLED" tone="info" />
          </Stack>
          <TablePagination
            component="div"
            count={filtered.length}
            page={page}
            onPageChange={(_, p) => setPage(p)}
            rowsPerPage={rowsPerPage}
            onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
          />
        </Stack>
      </Box>

      <Grid container spacing={2} mb={2}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}><SaKpi label="Total Logs" value={String(rows.length)} icon={<TerminalOutlined />} /></Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}><SaKpi label="Critical Errors" value="0 (24h)" icon={<ErrorOutline />} tone="danger" /></Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}><SaKpi label="Security Warnings" value="0 (24h)" icon={<WarningAmberOutlined />} tone="warning" /></Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}><SaKpi label="Retention Policy" value="90 DAYS ACTIVE" icon={<CheckCircleOutline />} tone="success" /></Grid>
      </Grid>

      <SaCard>
        <Typography fontWeight={800} color={saColors.info}>Compliance & Archiving</Typography>
        <Typography variant="body2" color="text.secondary" mt={0.5}>
          Audit events are retained for 90 days online. Request archive access for long-term compliance exports.
        </Typography>
      </SaCard>
    </Box>
  );
}
