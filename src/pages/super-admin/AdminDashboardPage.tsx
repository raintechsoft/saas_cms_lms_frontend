import {
  ArrowForward,
  GroupsOutlined,
  HubOutlined,
  PeopleAltOutlined,
  SchoolOutlined,
} from "@mui/icons-material";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  Link as MuiLink,
  Stack,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import type { ApexOptions } from "apexcharts";
import { useEffect, type ReactNode } from "react";
import Chart from "react-apexcharts";
import { Link } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { apiRequest } from "../../lib/api";
import { notifyError } from "../../lib/notify";
import { useAppDispatch, useAppSelector } from "../../store";
import { setAudit, setStats, setStatsLoading } from "../../store/slices/platformSlice";
import { saColors } from "../../theme/superAdminTheme";
import type { AuditRow, PlatformStats } from "./types";

function KpiCard({
  label,
  value,
  hint,
  icon,
  color,
}: {
  label: string;
  value: number | string;
  hint: string;
  icon: ReactNode;
  color: string;
}) {
  return (
    <Card elevation={0} sx={{ border: `1px solid ${saColors.border}`, height: "100%" }}>
      <CardContent>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="overline" color="text.secondary">
              {label}
            </Typography>
            <Typography variant="h4" fontWeight={800} mt={0.5}>
              {value}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {hint}
            </Typography>
          </Box>
          <Box
            sx={{
              width: 40,
              height: 40,
              borderRadius: 2,
              bgcolor: `${color}18`,
              color,
              display: "grid",
              placeItems: "center",
            }}
          >
            {icon}
          </Box>
        </Stack>
      </CardContent>
    </Card>
  );
}

export function AdminDashboardPage() {
  const { accessToken, user } = useAuth();
  const dispatch = useAppDispatch();
  const stats = useAppSelector((s) => s.platform.stats);
  const audit = useAppSelector((s) => s.platform.audit);
  const loading = useAppSelector((s) => s.platform.statsLoading);

  useEffect(() => {
    let cancelled = false;
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
  }, [accessToken, dispatch]);

  if (loading && !stats) {
    return (
      <Box sx={{ py: 10, display: "grid", placeItems: "center" }}>
        <CircularProgress sx={{ color: saColors.orange }} />
      </Box>
    );
  }

  if (!stats) return null;

  const activePct =
    stats.totals.tenants > 0
      ? Math.round((stats.totals.activeTenants / stats.totals.tenants) * 100)
      : 0;

  const statusLabels = Object.keys(stats.tenantsByStatus);
  const statusValues = Object.values(stats.tenantsByStatus);
  const modeLabels = Object.keys(stats.tenantsByProductMode);
  const modeValues = Object.values(stats.tenantsByProductMode);
  const typeLabels = Object.keys(stats.tenantsByType).map((k) => k.replaceAll("_", " "));
  const typeValues = Object.values(stats.tenantsByType);

  const donutOptions = (labels: string[], colors: string[]): ApexOptions => ({
    chart: { type: "donut", fontFamily: "Plus Jakarta Sans, sans-serif" },
    labels,
    colors,
    legend: { position: "bottom" },
    dataLabels: { enabled: false },
    plotOptions: {
      pie: {
        donut: {
          size: "68%",
          labels: {
            show: true,
            total: {
              show: true,
              label: "Active",
              formatter: () => `${activePct}%`,
            },
          },
        },
      },
    },
  });

  const barOptions: ApexOptions = {
    chart: { type: "bar", toolbar: { show: false }, fontFamily: "Plus Jakarta Sans, sans-serif" },
    plotOptions: { bar: { borderRadius: 6, columnWidth: "45%", distributed: true } },
    colors: [saColors.orange, saColors.navy, saColors.info, saColors.warning],
    dataLabels: { enabled: false },
    legend: { show: false },
    xaxis: { categories: typeLabels },
    grid: { borderColor: saColors.border },
  };

  return (
    <Stack spacing={3}>
      <Card
        elevation={0}
        sx={{
          border: `1px solid ${saColors.border}`,
          background: `linear-gradient(135deg, ${saColors.navy} 0%, #0B3A6E 55%, ${saColors.orange} 160%)`,
          color: "#fff",
        }}
      >
        <CardContent sx={{ p: { xs: 2.5, md: 3.5 } }}>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ md: "flex-end" }}
            spacing={2}
          >
            <Box>
              <Typography variant="overline" sx={{ color: "rgba(255,255,255,0.7)" }}>
                Command Center · {new Date().toISOString().slice(0, 10)}
              </Typography>
              <Typography variant="h4" fontWeight={800} mt={0.5}>
                Platform network status
              </Typography>
              <Typography variant="body2" sx={{ mt: 1, color: "rgba(255,255,255,0.75)", maxWidth: 560 }}>
                Welcome back, {user?.firstName ?? "Admin"}. Monitor tenants, resellers, and platform health from
                one console.
              </Typography>
            </Box>
            <Stack direction="row" spacing={1}>
              <Button
                component={Link}
                to="/admin/tenants/new"
                variant="contained"
                endIcon={<ArrowForward />}
                sx={{ bgcolor: saColors.orange, "&:hover": { bgcolor: saColors.orangeDark } }}
              >
                Create Tenant
              </Button>
              <Button
                component={Link}
                to="/admin/audit"
                variant="outlined"
                sx={{ color: "#fff", borderColor: "rgba(255,255,255,0.35)" }}
              >
                Audit Logs
              </Button>
            </Stack>
          </Stack>
          <Grid container spacing={2} sx={{ mt: 2 }}>
            {[
              { label: "Fleet health", value: `${activePct}%` },
              { label: "Live tenants", value: stats.totals.activeTenants },
              { label: "Network users", value: stats.totals.users },
              { label: "Students served", value: stats.totals.students },
            ].map((item) => (
              <Grid key={item.label} size={{ xs: 6, md: 3 }}>
                <Box sx={{ bgcolor: "rgba(255,255,255,0.08)", borderRadius: 2, p: 1.5 }}>
                  <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.65)" }}>
                    {item.label}
                  </Typography>
                  <Typography variant="h5" fontWeight={800} color="#FFD7C2">
                    {item.value}
                  </Typography>
                </Box>
              </Grid>
            ))}
          </Grid>
        </CardContent>
      </Card>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Tenants"
            value={stats.totals.tenants}
            hint="All institutions"
            icon={<HubOutlined />}
            color={saColors.orange}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Active"
            value={stats.totals.activeTenants}
            hint="Online workspaces"
            icon={<SchoolOutlined />}
            color={saColors.success}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Resellers"
            value={stats.totals.resellers}
            hint="Channel partners"
            icon={<PeopleAltOutlined />}
            color={saColors.navy}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <KpiCard
            label="Users"
            value={stats.totals.users}
            hint="All accounts"
            icon={<GroupsOutlined />}
            color={saColors.info}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card elevation={0} sx={{ border: `1px solid ${saColors.border}`, height: "100%" }}>
            <CardContent>
              <Typography fontWeight={700} mb={1}>
                Tenant fleet health
              </Typography>
              <Chart
                type="donut"
                height={280}
                series={statusValues}
                options={donutOptions(statusLabels, [saColors.success, saColors.warning, saColors.danger])}
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card elevation={0} sx={{ border: `1px solid ${saColors.border}`, height: "100%" }}>
            <CardContent>
              <Typography fontWeight={700} mb={1}>
                Entitlement mix
              </Typography>
              <Chart
                type="donut"
                height={280}
                series={modeValues}
                options={{
                  ...donutOptions(modeLabels, [saColors.info, saColors.orange, saColors.navy]),
                  plotOptions: {
                    pie: {
                      donut: {
                        size: "68%",
                        labels: {
                          show: true,
                          total: {
                            show: true,
                            label: "Total",
                            formatter: () => String(stats.totals.tenants),
                          },
                        },
                      },
                    },
                  },
                }}
              />
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card elevation={0} sx={{ border: `1px solid ${saColors.border}`, height: "100%" }}>
            <CardContent>
              <Typography fontWeight={700} mb={1}>
                Institution typology
              </Typography>
              <Chart type="bar" height={280} series={[{ name: "Tenants", data: typeValues }]} options={barOptions} />
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <Card elevation={0} sx={{ border: `1px solid ${saColors.border}` }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography fontWeight={700}>Recent fleet changes</Typography>
                <MuiLink component={Link} to="/admin/tenants" underline="hover" fontWeight={600}>
                  Registry →
                </MuiLink>
              </Stack>
              <Stack spacing={1.25}>
                {stats.recentTenants.map((tenant) => (
                  <Stack
                    key={tenant.id}
                    direction="row"
                    justifyContent="space-between"
                    alignItems="center"
                    sx={{ p: 1.25, borderRadius: 2, bgcolor: "#F8FAFC", border: `1px solid ${saColors.border}` }}
                  >
                    <Box>
                      <MuiLink
                        component={Link}
                        to={`/admin/tenants/${tenant.id}`}
                        underline="hover"
                        fontWeight={700}
                        color="inherit"
                      >
                        {tenant.name}
                      </MuiLink>
                      <Typography variant="caption" color="text.secondary" display="block">
                        /{tenant.slug} · {tenant.productMode}
                      </Typography>
                    </Box>
                    <Chip
                      size="small"
                      label={tenant.status}
                      sx={{
                        fontWeight: 700,
                        bgcolor: tenant.status === "ACTIVE" ? "#DCFCE7" : "#FEE2E2",
                        color: tenant.status === "ACTIVE" ? "#15803D" : "#B91C1C",
                      }}
                    />
                  </Stack>
                ))}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <Card elevation={0} sx={{ border: `1px solid ${saColors.border}`, height: "100%" }}>
            <CardContent>
              <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                <Typography fontWeight={700}>Audit stream</Typography>
                <MuiLink component={Link} to="/admin/audit" underline="hover" fontWeight={600}>
                  Full log →
                </MuiLink>
              </Stack>
              <Stack spacing={2} sx={{ borderLeft: `2px solid ${saColors.border}`, pl: 2 }}>
                {audit.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    No events yet.
                  </Typography>
                ) : (
                  audit.map((row) => (
                    <Box key={row.id} sx={{ position: "relative" }}>
                      <Box
                        sx={{
                          position: "absolute",
                          left: -25,
                          top: 6,
                          width: 10,
                          height: 10,
                          borderRadius: "50%",
                          bgcolor: saColors.orange,
                          border: "2px solid #fff",
                        }}
                      />
                      <Typography variant="body2" fontWeight={700}>
                        {row.action}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {row.actor ?? "system"} · {row.tenant ?? "platform"} ·{" "}
                        {new Date(row.createdAt).toLocaleString()}
                      </Typography>
                    </Box>
                  ))
                )}
              </Stack>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Stack>
  );
}
