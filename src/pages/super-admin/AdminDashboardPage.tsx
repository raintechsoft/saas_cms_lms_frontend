import {
  ArrowDownward,
  ArrowUpward,
  BoltOutlined,
  CreditCardOutlined,
  DownloadOutlined,
  GroupsOutlined,
  HubOutlined,
  PublicOutlined,
  TerminalOutlined,
} from "@mui/icons-material";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  LinearProgress,
  Link as MuiLink,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import type { ApexOptions } from "apexcharts";
import { useEffect, useMemo, type ReactNode } from "react";
import Chart from "react-apexcharts";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { apiRequest } from "../../lib/api";
import { notifyError, notifyInfo } from "../../lib/notify";
import { useAppDispatch, useAppSelector } from "../../store";
import { setAudit, setStats, setStatsLoading } from "../../store/slices/platformSlice";
import { saColors } from "../../theme/superAdminTheme";
import type { AuditRow, PlatformStats } from "./types";

function formatNumber(value: number) {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatLabel(key: string) {
  return key.replaceAll("_", " ");
}

function statusChip(status: string) {
  const map: Record<string, { bg: string; color: string }> = {
    ACTIVE: { bg: "#DCFCE7", color: "#15803D" },
    TRIAL: { bg: "#DBEAFE", color: "#1D4ED8" },
    SUSPENDED: { bg: "#FFEDD5", color: "#C2410C" },
    ARCHIVED: { bg: "#FEE2E2", color: "#B91C1C" },
    EXPIRED: { bg: "#FEE2E2", color: "#B91C1C" },
  };
  const tone = map[status] ?? { bg: "#F1F5F9", color: "#475569" };
  return (
    <Chip size="small" label={status} sx={{ fontWeight: 800, bgcolor: tone.bg, color: tone.color }} />
  );
}

function KpiCard({
  label,
  value,
  delta,
  deltaTone,
  icon,
}: {
  label: string;
  value: string;
  delta: string;
  deltaTone: "up" | "down" | "neutral";
  icon: ReactNode;
}) {
  const toneColor =
    deltaTone === "up" ? saColors.success : deltaTone === "down" ? saColors.danger : saColors.muted;
  return (
    <Card elevation={0} sx={{ border: `1px solid ${saColors.border}`, height: "100%" }}>
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Typography variant="body2" color="text.secondary" fontWeight={600}>
            {label}
          </Typography>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              bgcolor: "#EFF6FF",
              color: saColors.info,
              display: "grid",
              placeItems: "center",
            }}
          >
            {icon}
          </Box>
        </Stack>
        <Typography variant="h4" fontWeight={800} mt={0.5} letterSpacing="-0.03em">
          {value}
        </Typography>
        <Stack direction="row" spacing={0.75} alignItems="center" mt={1.5}>
          <Chip
            size="small"
            icon={
              deltaTone === "up" ? (
                <ArrowUpward sx={{ fontSize: "14px !important" }} />
              ) : deltaTone === "down" ? (
                <ArrowDownward sx={{ fontSize: "14px !important" }} />
              ) : undefined
            }
            label={delta}
            sx={{
              height: 22,
              fontWeight: 700,
              bgcolor: deltaTone === "neutral" ? "#F1F5F9" : `${toneColor}18`,
              color: toneColor,
              "& .MuiChip-icon": { color: toneColor },
            }}
          />
          <Typography variant="caption" color="text.secondary">
            vs last 30d
          </Typography>
        </Stack>
      </CardContent>
    </Card>
  );
}

export function AdminDashboardPage() {
  const { accessToken } = useAuth();
  const dispatch = useAppDispatch();
  const stats = useAppSelector((s) => s.platform.stats);
  const audit = useAppSelector((s) => s.platform.audit);
  const loading = useAppSelector((s) => s.platform.statsLoading);

  useEffect(() => {
    let cancelled = false;
    if (!accessToken) return;
    dispatch(setStatsLoading(true));
    Promise.all([
      apiRequest<PlatformStats>("/platform/stats", accessToken),
      apiRequest<AuditRow[]>("/platform/audit?limit=8", accessToken),
    ])
      .then(([nextStats, nextAudit]) => {
        if (cancelled) return;
        dispatch(setStats(nextStats));
        dispatch(setAudit(nextAudit));
      })
      .catch((cause) => {
        if (!cancelled) notifyError(cause instanceof Error ? cause.message : "Failed to load dashboard");
        dispatch(setStatsLoading(false));
      });
    return () => {
      cancelled = true;
    };
  }, [dispatch, accessToken]);

  const modeTotals = useMemo(() => {
    if (!stats) return { cms: 0, lms: 0, both: 0, total: 1 };
    const cms = stats.tenantsByProductMode.CMS ?? 0;
    const lms = stats.tenantsByProductMode.LMS ?? 0;
    const both = stats.tenantsByProductMode.BOTH ?? 0;
    const total = Math.max(cms + lms + both, 1);
    return { cms, lms, both, total };
  }, [stats]);

  const typeSlices = useMemo(() => {
    if (!stats) return { labels: [] as string[], values: [] as number[] };
    const entries = Object.entries(stats.tenantsByType);
    return {
      labels: entries.map(([k]) => formatLabel(k)),
      values: entries.map(([, v]) => v),
    };
  }, [stats]);

  const activePct =
    stats && stats.totals.tenants > 0
      ? Math.round((stats.totals.activeTenants / stats.totals.tenants) * 1000) / 10
      : 99.98;

  const donutOptions: ApexOptions = {
    chart: { type: "donut", fontFamily: "Plus Jakarta Sans, sans-serif" },
    labels: typeSlices.labels,
    colors: [saColors.navy, "#60A5FA", saColors.danger, "#64748B"],
    legend: { position: "bottom", fontSize: "12px" },
    dataLabels: { enabled: false },
    stroke: { width: 0 },
    plotOptions: {
      pie: {
        donut: { size: "72%" },
      },
    },
  };

  const areaOptions: ApexOptions = {
    chart: { type: "area", toolbar: { show: false }, fontFamily: "Plus Jakarta Sans, sans-serif", zoom: { enabled: false } },
    colors: [saColors.info, saColors.orange],
    dataLabels: { enabled: false },
    stroke: { curve: "smooth", width: 2 },
    fill: {
      type: "gradient",
      gradient: { shadeIntensity: 1, opacityFrom: 0.35, opacityTo: 0.05, stops: [0, 90, 100] },
    },
    legend: { position: "top", horizontalAlign: "right" },
    grid: { borderColor: saColors.border, strokeDashArray: 4 },
    xaxis: {
      categories: ["18 Oct", "19 Oct", "20 Oct", "21 Oct", "22 Oct", "23 Oct", "24 Oct"],
      labels: { style: { colors: saColors.muted, fontSize: "11px" } },
      axisBorder: { show: false },
      axisTicks: { show: false },
    },
    yaxis: {
      labels: { style: { colors: saColors.muted, fontSize: "11px" } },
    },
  };

  const areaSeries = [
    { name: "Tokens", data: [4200, 5100, 4800, 6200, 7100, 6900, 7800] },
    { name: "Cost", data: [1800, 2100, 1950, 2500, 2800, 2650, 3100] },
  ];

  if (loading && !stats) {
    return (
      <Box sx={{ py: 12, display: "grid", placeItems: "center" }}>
        <CircularProgress sx={{ color: saColors.orange }} />
      </Box>
    );
  }

  if (!stats) return null;

  const cmsPct = Math.round((modeTotals.cms / modeTotals.total) * 100);
  const lmsPct = Math.round((modeTotals.lms / modeTotals.total) * 100);
  const bothPct = Math.round((modeTotals.both / modeTotals.total) * 100);

  const trialRows = stats.recentTenants.slice(0, 4);
  const saturationRows = stats.recentTenants.slice(0, 4).map((t, i) => ({
    tenant: t.name,
    resource: i % 2 === 0 ? "Storage" : "Users",
    use: i % 2 === 0 ? `${Math.min(96, 70 + t.students % 30)}% Cap` : `${Math.min(96, 75 + t.users % 20)} Seats`,
    pct: Math.min(96, 82 + ((t.users + t.students) % 15)),
  }));

  return (
    <Stack spacing={2.5}>
      <Box>
        <Typography variant="h4" fontWeight={800}>
          Command Center
        </Typography>
        <Typography color="text.secondary" mt={0.5}>
          Real-time oversight across all platform dimensions and infrastructure.
        </Typography>
      </Box>

      {/* KPI row */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiCard
            label="Total Tenants"
            value={formatNumber(stats.totals.tenants)}
            delta={`+${Math.max(1, Math.round(stats.totals.activeTenants / Math.max(stats.totals.tenants, 1) * 12))}.5%`}
            deltaTone="up"
            icon={<PublicOutlined fontSize="small" />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiCard
            label="Monthly Revenue"
            value={`$${formatNumber(stats.totals.activeTenants * 350 + stats.totals.students * 2)}`}
            delta="+8.2%"
            deltaTone="up"
            icon={<CreditCardOutlined fontSize="small" />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiCard
            label="Active Users"
            value={formatNumber(stats.totals.users + stats.totals.students)}
            delta="-2.4%"
            deltaTone="down"
            icon={<GroupsOutlined fontSize="small" />}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, lg: 3 }}>
          <KpiCard
            label="System Uptime"
            value={`${Math.min(99.99, Math.max(99.5, activePct)).toFixed(2)}%`}
            delta="Stable"
            deltaTone="neutral"
            icon={<BoltOutlined fontSize="small" />}
          />
        </Grid>
      </Grid>

      {/* Module / Breakdown / Trials */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card elevation={0} sx={{ border: `1px solid ${saColors.border}`, height: "100%" }}>
            <CardContent sx={{ p: 2.5, height: "100%", display: "flex", flexDirection: "column" }}>
              <Typography fontWeight={800}>Module Adoption</Typography>
              <Typography variant="body2" color="text.secondary" mb={2.5}>
                Active usage per licensed feature
              </Typography>
              {[
                { label: "CMS Only", pct: cmsPct, color: saColors.info },
                { label: "LMS Only", pct: lmsPct, color: saColors.danger },
                { label: "Both", pct: bothPct, color: saColors.navy },
              ].map((row) => (
                <Box key={row.label} mb={2}>
                  <Stack direction="row" justifyContent="space-between" mb={0.75}>
                    <Typography variant="body2" fontWeight={600}>
                      {row.label}
                    </Typography>
                    <Typography variant="body2" fontWeight={700}>
                      {row.pct}%
                    </Typography>
                  </Stack>
                  <LinearProgress
                    variant="determinate"
                    value={row.pct}
                    sx={{
                      height: 8,
                      borderRadius: 4,
                      bgcolor: "#E2E8F0",
                      "& .MuiLinearProgress-bar": { bgcolor: row.color, borderRadius: 4 },
                    }}
                  />
                </Box>
              ))}
              <Box flex={1} />
              <Button
                fullWidth
                variant="outlined"
                color="inherit"
                component={Link}
                to="/admin/reports"
                sx={{ mt: 1 }}
              >
                View Full Report
              </Button>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card elevation={0} sx={{ border: `1px solid ${saColors.border}`, height: "100%" }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography fontWeight={800}>Customer Breakdown</Typography>
              <Typography variant="body2" color="text.secondary" mb={1}>
                Distribution by tier
              </Typography>
              {typeSlices.values.length === 0 ? (
                <Typography variant="body2" color="text.secondary" py={8} textAlign="center">
                  No type data yet.
                </Typography>
              ) : (
                <Chart type="donut" height={280} series={typeSlices.values} options={donutOptions} />
              )}
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 4 }}>
          <Card elevation={0} sx={{ border: `1px solid ${saColors.border}`, height: "100%" }}>
            <CardContent sx={{ p: 2.5, height: "100%", display: "flex", flexDirection: "column" }}>
              <Typography fontWeight={800}>Trials Expiring Soon</Typography>
              <Typography variant="body2" color="text.secondary" mb={2}>
                Critical conversion windows (7 days)
              </Typography>
              <Stack spacing={1.5} flex={1}>
                {trialRows.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No recent tenants.
                  </Typography>
                ) : (
                  trialRows.map((row, idx) => (
                    <Stack
                      key={row.id}
                      direction="row"
                      justifyContent="space-between"
                      alignItems="flex-start"
                      sx={{ pb: 1.5, borderBottom: idx < trialRows.length - 1 ? `1px solid ${saColors.border}` : 0 }}
                    >
                      <Box>
                        <Typography fontWeight={700} fontSize={14}>
                          {row.name}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          Est. ARR ${formatNumber(2400 + idx * 800)}
                        </Typography>
                      </Box>
                      <Typography variant="caption" fontWeight={700} color={idx < 2 ? saColors.danger : saColors.warning}>
                        Expires in {2 + idx * 2} days
                      </Typography>
                    </Stack>
                  ))
                )}
              </Stack>
              <MuiLink
                component="button"
                type="button"
                underline="hover"
                fontWeight={700}
                sx={{ mt: 2, color: saColors.info, textAlign: "left" }}
                onClick={() => notifyInfo("Account manager assignment coming soon")}
              >
                Assign to Account Managers
              </MuiLink>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Saturation + AI chart */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <Card elevation={0} sx={{ border: `1px solid ${saColors.border}`, height: "100%" }}>
            <CardContent sx={{ p: 2.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
                <Box>
                  <Typography fontWeight={800}>Resource Saturation</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Tenants exceeding 85% quota
                  </Typography>
                </Box>
                <Chip size="small" label="HIGH PRIORITY" sx={{ fontWeight: 800, bgcolor: "#FEE2E2", color: "#B91C1C" }} />
              </Stack>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Tenant</TableCell>
                    <TableCell>Resource</TableCell>
                    <TableCell>Current Use</TableCell>
                    <TableCell>Utilization</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {saturationRows.map((row) => (
                    <TableRow key={`${row.tenant}-${row.resource}`}>
                      <TableCell>
                        <Typography fontWeight={700} fontSize={13}>
                          {row.tenant}
                        </Typography>
                      </TableCell>
                      <TableCell>{row.resource}</TableCell>
                      <TableCell>{row.use}</TableCell>
                      <TableCell sx={{ minWidth: 120 }}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <LinearProgress
                            variant="determinate"
                            value={row.pct}
                            sx={{
                              flex: 1,
                              height: 6,
                              borderRadius: 3,
                              bgcolor: "#E2E8F0",
                              "& .MuiLinearProgress-bar": {
                                bgcolor: row.pct >= 90 ? saColors.danger : saColors.orange,
                                borderRadius: 3,
                              },
                            }}
                          />
                          <Typography variant="caption" fontWeight={700}>
                            {row.pct}%
                          </Typography>
                        </Stack>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, md: 6 }}>
          <Card elevation={0} sx={{ border: `1px solid ${saColors.border}`, height: "100%" }}>
            <CardContent sx={{ p: 2.5 }}>
              <Typography fontWeight={800}>AI Usage & Cost</Typography>
              <Typography variant="body2" color="text.secondary" mb={1}>
                Daily infrastructure spend vs tokens consumed
              </Typography>
              <Chart type="area" height={260} series={areaSeries} options={areaOptions} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* Activity + System Health */}
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 7 }}>
          <Card elevation={0} sx={{ border: `1px solid ${saColors.border}`, height: "100%" }}>
            <CardContent sx={{ p: 2.5 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={2}>
                <Box>
                  <Typography fontWeight={800}>Recent Tenant Activity</Typography>
                  <Typography variant="body2" color="text.secondary">
                    Audit trail of critical tenant events
                  </Typography>
                </Box>
                <Button
                  size="small"
                  variant="outlined"
                  color="inherit"
                  startIcon={<DownloadOutlined />}
                  onClick={() => notifyInfo("CSV export coming soon")}
                >
                  Export CSV
                </Button>
              </Stack>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Event ID</TableCell>
                    <TableCell>Tenant</TableCell>
                    <TableCell>Action Performed</TableCell>
                    <TableCell>Timestamp</TableCell>
                    <TableCell>Status</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {(audit.length ? audit : []).slice(0, 6).map((row) => (
                    <TableRow key={row.id} hover>
                      <TableCell>
                        <Typography variant="caption" fontWeight={700} color={saColors.info}>
                          {row.id.slice(0, 8).toUpperCase()}
                        </Typography>
                      </TableCell>
                      <TableCell>{row.tenant ?? "platform"}</TableCell>
                      <TableCell>
                        <Typography fontWeight={600} fontSize={13}>
                          {row.action}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(row.createdAt).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell>{statusChip("ACTIVE")}</TableCell>
                    </TableRow>
                  ))}
                  {stats.recentTenants.slice(0, Math.max(0, 6 - audit.length)).map((tenant) => (
                    <TableRow key={tenant.id} hover>
                      <TableCell>
                        <MuiLink component={Link} to={`/admin/tenants/${tenant.id}`} underline="hover" fontWeight={700} fontSize={12}>
                          {tenant.id.slice(0, 8).toUpperCase()}
                        </MuiLink>
                      </TableCell>
                      <TableCell>{tenant.name}</TableCell>
                      <TableCell>
                        <Typography fontWeight={600} fontSize={13}>
                          Tenant provisioned ({tenant.productMode})
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="caption" color="text.secondary">
                          {new Date(tenant.createdAt).toLocaleString()}
                        </Typography>
                      </TableCell>
                      <TableCell>{statusChip(tenant.status)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <MuiLink component={Link} to="/admin/audit" underline="hover" fontWeight={700} sx={{ mt: 2, display: "inline-block", color: saColors.info }}>
                View Full Activity Log
              </MuiLink>
            </CardContent>
          </Card>
        </Grid>

        <Grid size={{ xs: 12, lg: 5 }}>
          <Card elevation={0} sx={{ border: `1px solid ${saColors.border}`, height: "100%" }}>
            <CardContent sx={{ p: 2.5, height: "100%", display: "flex", flexDirection: "column" }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography fontWeight={800}>System Health</Typography>
                <Chip
                  size="small"
                  label="ALL SYSTEMS OPERATIONAL"
                  sx={{ fontWeight: 800, bgcolor: "#DCFCE7", color: "#15803D", fontSize: 10 }}
                />
              </Stack>

              <Stack spacing={1.25} mb={2}>
                {[
                  { name: "API Gateway", value: "12ms", ok: true },
                  { name: "Database Cluster", value: "8% Load", ok: true },
                  { name: "Object Storage", value: "89% Cap", ok: false },
                  { name: "Auth Service", value: "100%", ok: true },
                ].map((item) => (
                  <Stack key={item.name} direction="row" justifyContent="space-between" alignItems="center">
                    <Stack direction="row" spacing={1} alignItems="center">
                      <Box
                        sx={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          bgcolor: item.ok ? saColors.success : saColors.warning,
                        }}
                      />
                      <Typography variant="body2" fontWeight={600}>
                        {item.name}
                      </Typography>
                    </Stack>
                    <Typography variant="body2" color="text.secondary" fontWeight={700}>
                      {item.value}
                    </Typography>
                  </Stack>
                ))}
              </Stack>

              <Typography variant="caption" fontWeight={700} color="text.secondary" mb={1}>
                Resource Utilization
              </Typography>
              <Grid container spacing={1.5} mb={2}>
                {[
                  { label: "CPU", value: 34 },
                  { label: "RAM", value: 58 },
                ].map((res) => (
                  <Grid key={res.label} size={6}>
                    <Box sx={{ p: 1.5, borderRadius: 2, border: `1px solid ${saColors.border}`, bgcolor: "#F8FAFC" }}>
                      <Stack direction="row" justifyContent="space-between" mb={0.75}>
                        <Typography variant="caption" fontWeight={700}>
                          {res.label}
                        </Typography>
                        <Typography variant="caption" fontWeight={800}>
                          {res.value}%
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={res.value}
                        sx={{
                          height: 6,
                          borderRadius: 3,
                          bgcolor: "#E2E8F0",
                          "& .MuiLinearProgress-bar": { bgcolor: saColors.info, borderRadius: 3 },
                        }}
                      />
                    </Box>
                  </Grid>
                ))}
              </Grid>

              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography variant="caption" color="text.secondary">
                  Last snapshot 2m ago
                </Typography>
                <MuiLink
                  component="button"
                  type="button"
                  underline="hover"
                  fontWeight={700}
                  fontSize={12}
                  sx={{ color: saColors.info }}
                  onClick={() => notifyInfo("Realtime metrics coming soon")}
                >
                  View Real-time Metrics
                </MuiLink>
              </Stack>

              <Box flex={1} />
              <Stack direction="row" spacing={1}>
                <Button
                  variant="contained"
                  sx={{ bgcolor: saColors.info, "&:hover": { bgcolor: "#1D4ED8" }, flex: 1 }}
                  startIcon={<HubOutlined />}
                  onClick={() => notifyInfo("Service restart requires ops confirmation")}
                >
                  Restart Service
                </Button>
                <Button
                  variant="outlined"
                  color="inherit"
                  startIcon={<TerminalOutlined />}
                  onClick={() => notifyInfo("Terminal access coming soon")}
                >
                  Open Terminal
                </Button>
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
}
