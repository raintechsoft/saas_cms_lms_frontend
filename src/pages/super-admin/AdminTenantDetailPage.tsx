import {
  EditOutlined,
  LanguageOutlined,
  LoginOutlined,
  PauseCircleOutline,
} from "@mui/icons-material";
import {
  Box,
  Breadcrumbs,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  FormControlLabel,
  LinearProgress,
  Link as MuiLink,
  Stack,
  Switch,
  Tab,
  Tabs,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { apiRequest } from "../../lib/api";
import { notifyError, notifyInfo, notifySuccess } from "../../lib/notify";
import { saColors } from "../../theme/superAdminTheme";
import type { TenantDetail, TenantStatus } from "./types";

const TABS = [
  "Overview",
  "Modules & Add-ons",
  "Users & Limits",
  "Plan & Billing",
  "Branding & UI",
  "Security",
] as const;

const CMS_MODULES = [
  "Student Management",
  "Fees",
  "Academics",
  "Attendance",
  "Examination",
  "HR",
  "Homework",
  "Certificates",
];

const LMS_MODULES = [
  "Academic Calendar",
  "Lesson Planning",
  "Live Classes",
  "AI Tutor",
  "Question Bank",
  "Test Series",
  "NCERT Content",
  "Classroom Management",
  "Video Gallery",
  "Preparation & Practice",
  "Voice AI Agent",
  "Results & Performance",
];

export function AdminTenantDetailPage() {
  const { id } = useParams();
  const { accessToken } = useAuth();
  const navigate = useNavigate();
  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [tab, setTab] = useState(0);
  const [loading, setLoading] = useState(true);
  const [cms, setCms] = useState<Record<string, boolean>>({});
  const [lms, setLms] = useState<Record<string, boolean>>({});
  const [primaryColor, setPrimaryColor] = useState("#FF6B35");
  const [logoText, setLogoText] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [enforce2fa, setEnforce2fa] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    apiRequest<TenantDetail>(`/platform/tenants/${id}`, accessToken)
      .then((data) => {
        setTenant(data);
        const branding = (data.branding ?? {}) as Record<string, unknown>;
        setPrimaryColor(typeof branding.primaryColor === "string" ? branding.primaryColor : "#FF6B35");
        setLogoText(typeof branding.logoText === "string" ? branding.logoText : data.name);
        setCustomDomain(typeof branding.customDomain === "string" ? branding.customDomain : "");
        const cmsDefault = data.productMode !== "LMS";
        const lmsDefault = data.productMode !== "CMS";
        setCms(Object.fromEntries(CMS_MODULES.map((m) => [m, cmsDefault && !["HR", "Certificates", "Examination"].includes(m)])));
        setLms(
          Object.fromEntries(
            LMS_MODULES.map((m) => [
              m,
              lmsDefault &&
                ["Academic Calendar", "Lesson Planning", "Question Bank", "NCERT Content", "Classroom Management", "Preparation & Practice", "Results & Performance"].includes(m),
            ]),
          ),
        );
      })
      .catch((cause) => notifyError(cause instanceof Error ? cause.message : "Failed to load tenant"))
      .finally(() => setLoading(false));
  }, [id, accessToken]);

  async function setStatus(status: TenantStatus) {
    if (!tenant) return;
    try {
      await apiRequest(`/platform/tenants/${tenant.id}/status`, accessToken, {
        method: "PUT",
        body: JSON.stringify({ status }),
      });
      setTenant({ ...tenant, status });
      notifySuccess(`Tenant ${status.toLowerCase()}`);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Failed to update status");
    }
  }

  async function saveBranding() {
    if (!tenant) return;
    try {
      const next = await apiRequest<TenantDetail>(`/platform/tenants/${tenant.id}`, accessToken, {
        method: "PUT",
        body: JSON.stringify({
          branding: { primaryColor, logoText, customDomain: customDomain || undefined },
        }),
      });
      setTenant(next);
      notifySuccess("Branding saved");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Failed to save branding");
    }
  }

  if (loading) {
    return (
      <Box sx={{ py: 10, display: "grid", placeItems: "center" }}>
        <CircularProgress sx={{ color: saColors.orange }} />
      </Box>
    );
  }
  if (!tenant) return null;

  const statusColor =
    tenant.status === "ACTIVE" ? { bg: "#DCFCE7", color: "#15803D" } : { bg: "#FEE2E2", color: "#B91C1C" };

  const studentLimit = Math.max(tenant.students + 200, 5000);
  const staffLimit = Math.max(tenant.users + 50, 250);
  const studentPct = Math.min(100, Math.round((tenant.students / studentLimit) * 100));
  const staffPct = Math.min(100, Math.round((tenant.users / staffLimit) * 100));

  return (
    <Stack spacing={2.5}>
      <Breadcrumbs>
        <MuiLink component={Link} to="/admin/tenants" underline="hover" color="inherit">
          Tenants Management
        </MuiLink>
        <Typography color="text.primary">{tenant.id.slice(0, 8).toUpperCase()}</Typography>
      </Breadcrumbs>

      <Card elevation={0} sx={{ border: `1px solid ${saColors.border}` }}>
        <CardContent>
          <Stack
            direction={{ xs: "column", md: "row" }}
            justifyContent="space-between"
            alignItems={{ md: "flex-start" }}
            spacing={2}
          >
            <Stack direction="row" spacing={1.5} alignItems="flex-start">
              <Box
                sx={{
                  width: 48,
                  height: 48,
                  borderRadius: 2,
                  bgcolor: "#DBEAFE",
                  color: saColors.info,
                  display: "grid",
                  placeItems: "center",
                }}
              >
                <LanguageOutlined />
              </Box>
              <Box>
                <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
                  <Typography variant="h5" fontWeight={800}>
                    {tenant.name}
                  </Typography>
                  <Chip size="small" label={tenant.type.replaceAll("_", " ")} />
                  <Chip
                    size="small"
                    label={tenant.status}
                    sx={{ bgcolor: statusColor.bg, color: statusColor.color, fontWeight: 800 }}
                  />
                </Stack>
                <Typography variant="body2" color="text.secondary" mt={0.5}>
                  Subdomain: {tenant.slug}.platform.saas · Mode: {tenant.productMode}
                </Typography>
              </Box>
            </Stack>
            <Stack direction="row" spacing={1} flexWrap="wrap">
              <Button
                variant="contained"
                startIcon={<LoginOutlined />}
                onClick={() => notifyInfo("Impersonation will be enabled in a later release")}
              >
                Login as Tenant
              </Button>
              {tenant.status === "ACTIVE" ? (
                <Button
                  variant="outlined"
                  color="inherit"
                  startIcon={<PauseCircleOutline />}
                  onClick={() => void setStatus("SUSPENDED")}
                >
                  Suspend
                </Button>
              ) : (
                <Button variant="outlined" color="inherit" onClick={() => void setStatus("ACTIVE")}>
                  Activate
                </Button>
              )}
              <Button
                variant="outlined"
                color="inherit"
                startIcon={<EditOutlined />}
                onClick={() => navigate(`/admin/tenants/${tenant.id}/edit`)}
              >
                Edit
              </Button>
            </Stack>
          </Stack>

          <Tabs
            value={tab}
            onChange={(_, v) => setTab(v)}
            variant="scrollable"
            sx={{
              mt: 2,
              borderBottom: `1px solid ${saColors.border}`,
              "& .Mui-selected": { color: `${saColors.navy} !important`, fontWeight: 700 },
              "& .MuiTabs-indicator": { backgroundColor: saColors.navy, height: 3 },
            }}
          >
            {TABS.map((label) => (
              <Tab key={label} label={label} />
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {tab === 0 && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Stack spacing={2}>
              <Card elevation={0} sx={{ border: `1px solid ${saColors.border}` }}>
                <CardContent>
                  <Typography fontWeight={700} mb={2}>
                    Tenant Lifecycle
                  </Typography>
                  <Grid container spacing={2}>
                    {[
                      ["Creation Date", new Date(tenant.createdAt).toLocaleDateString()],
                      ["Distribution", tenant.distributionModel.replaceAll("_", " ")],
                      ["Reseller", tenant.reseller?.name ?? "Direct"],
                      ["SLA Tier", "99.9% Uptime"],
                    ].map(([label, value]) => (
                      <Grid key={label} size={{ xs: 6, md: 3 }}>
                        <Typography variant="caption" color="text.secondary">
                          {label}
                        </Typography>
                        <Typography fontWeight={700}>{value}</Typography>
                      </Grid>
                    ))}
                  </Grid>
                </CardContent>
              </Card>

              <Card elevation={0} sx={{ border: `1px solid ${saColors.border}` }}>
                <CardContent>
                  <Typography fontWeight={700} mb={2}>
                    Resource Saturation
                  </Typography>
                  <Stack spacing={2}>
                    <Box>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2">Student Accounts</Typography>
                        <Typography variant="body2" fontWeight={700}>
                          {tenant.students} / {studentLimit}
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={studentPct}
                        sx={{ mt: 0.75, height: 8, borderRadius: 4, bgcolor: "#E2E8F0", "& .MuiLinearProgress-bar": { bgcolor: studentPct > 80 ? saColors.warning : saColors.info } }}
                      />
                    </Box>
                    <Box>
                      <Stack direction="row" justifyContent="space-between">
                        <Typography variant="body2">Staff / Admin Accounts</Typography>
                        <Typography variant="body2" fontWeight={700}>
                          {tenant.users} / {staffLimit}
                        </Typography>
                      </Stack>
                      <LinearProgress
                        variant="determinate"
                        value={staffPct}
                        sx={{ mt: 0.75, height: 8, borderRadius: 4, bgcolor: "#E2E8F0", "& .MuiLinearProgress-bar": { bgcolor: saColors.navy } }}
                      />
                    </Box>
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card elevation={0} sx={{ border: `1px solid ${saColors.border}`, height: "100%" }}>
              <CardContent>
                <Typography fontWeight={700} mb={2}>
                  Recent Activity
                </Typography>
                <Stack spacing={1.5}>
                  {tenant.activity.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No activity yet.
                    </Typography>
                  ) : (
                    tenant.activity.slice(0, 8).map((row) => (
                      <Box key={row.id}>
                        <Typography variant="body2" fontWeight={700}>
                          {row.action}
                        </Typography>
                        <Typography variant="caption" color="text.secondary">
                          {row.actor ?? "system"} · {new Date(row.createdAt).toLocaleString()}
                        </Typography>
                      </Box>
                    ))
                  )}
                </Stack>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {tab === 1 && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card elevation={0} sx={{ border: `1px solid ${saColors.border}` }}>
              <CardContent>
                <Typography fontWeight={700}>CMS Modules</Typography>
                <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                  Core management
                </Typography>
                {CMS_MODULES.map((mod) => (
                  <FormControlLabel
                    key={mod}
                    control={
                      <Switch
                        checked={!!cms[mod]}
                        onChange={(e) => {
                          setCms((p) => ({ ...p, [mod]: e.target.checked }));
                          notifyInfo("Module preference saved locally — wire to entitlements next");
                        }}
                      />
                    }
                    label={<Typography variant="body2">{mod}</Typography>}
                    labelPlacement="start"
                    sx={{ display: "flex", justifyContent: "space-between", ml: 0, width: "100%" }}
                  />
                ))}
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 6 }}>
            <Card elevation={0} sx={{ border: `1px solid ${saColors.border}` }}>
              <CardContent>
                <Typography fontWeight={700}>LMS Modules</Typography>
                <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                  Learning experience
                </Typography>
                {LMS_MODULES.map((mod) => (
                  <FormControlLabel
                    key={mod}
                    control={
                      <Switch
                        checked={!!lms[mod]}
                        onChange={(e) => {
                          setLms((p) => ({ ...p, [mod]: e.target.checked }));
                          notifyInfo("Module preference saved locally — wire to entitlements next");
                        }}
                      />
                    }
                    label={<Typography variant="body2">{mod}</Typography>}
                    labelPlacement="start"
                    sx={{ display: "flex", justifyContent: "space-between", ml: 0, width: "100%" }}
                  />
                ))}
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {tab === 2 && (
        <Card elevation={0} sx={{ border: `1px solid ${saColors.border}` }}>
          <CardContent>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
              <Box>
                <Typography fontWeight={700}>Tenant Admin Users</Typography>
                <Typography variant="body2" color="text.secondary">
                  Users with access to this institution workspace
                </Typography>
              </Box>
              <Button variant="contained" onClick={() => notifyInfo("Add admin from Users module")}>
                + Add Admin
              </Button>
            </Stack>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Name</TableCell>
                  <TableCell>Email</TableCell>
                  <TableCell>Role</TableCell>
                  <TableCell>Status</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {tenant.recentUsers.map((u) => (
                  <TableRow key={u.id}>
                    <TableCell>
                      <Typography fontWeight={700}>
                        {u.firstName} {u.lastName}
                      </Typography>
                    </TableCell>
                    <TableCell>{u.email}</TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5} flexWrap="wrap">
                        {u.roles.map((role) => (
                          <Chip key={role} size="small" label={role} />
                        ))}
                      </Stack>
                    </TableCell>
                    <TableCell>
                      <Switch checked={u.status === "ACTIVE"} disabled />
                    </TableCell>
                  </TableRow>
                ))}
                {tenant.recentUsers.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={4}>
                      <Typography textAlign="center" color="text.secondary" py={3}>
                        No users yet.
                      </Typography>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {tab === 3 && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 8 }}>
            <Card elevation={0} sx={{ border: `1px solid ${saColors.border}` }}>
              <CardContent>
                <Typography fontWeight={700}>{tenant.distributionModel.replaceAll("_", " ")}</Typography>
                <Typography variant="h4" fontWeight={800} color={saColors.navy} mt={1}>
                  {tenant.productMode} Plan
                </Typography>
                <Typography color="text.secondary" mt={1}>
                  Billing APIs are not connected yet — this tab mirrors the redesigned layout.
                </Typography>
                <Stack direction="row" spacing={1} mt={2}>
                  <Button variant="contained" onClick={() => notifyInfo("Billing upgrade coming soon")}>
                    Upgrade Plan
                  </Button>
                  <Button variant="outlined" color="inherit" onClick={() => notifyInfo("Add-ons coming soon")}>
                    Modify Add-ons
                  </Button>
                </Stack>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 4 }}>
            <Card elevation={0} sx={{ border: `1px solid ${saColors.border}`, bgcolor: "#EFF6FF" }}>
              <CardContent>
                <Typography fontWeight={700}>Secure Billing</Typography>
                <Typography variant="body2" color="text.secondary" mt={1}>
                  Payment information will be encrypted and PCI-compliant when gateway is connected.
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}

      {tab === 4 && (
        <Card elevation={0} sx={{ border: `1px solid ${saColors.border}` }}>
          <CardContent>
            <Typography fontWeight={700} mb={2}>
              Visual Identity
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Primary Theme Color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField fullWidth label="Logo Text" value={logoText} onChange={(e) => setLogoText(e.target.value)} />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Custom Domain"
                  value={customDomain}
                  onChange={(e) => setCustomDomain(e.target.value)}
                />
              </Grid>
            </Grid>
            <Button variant="contained" sx={{ mt: 2 }} onClick={() => void saveBranding()}>
              Save Branding
            </Button>
          </CardContent>
        </Card>
      )}

      {tab === 5 && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Card elevation={0} sx={{ border: `1px solid ${saColors.border}` }}>
              <CardContent>
                <Typography fontWeight={700} mb={2}>
                  Access Security
                </Typography>
                <FormControlLabel
                  control={<Switch checked={enforce2fa} onChange={(e) => setEnforce2fa(e.target.checked)} />}
                  label="Enforce Two-Factor Authentication (2FA)"
                />
                <Box mt={2}>
                  <Button variant="contained" onClick={() => notifySuccess("Force logout queued (UI only)")}>
                    Force Logout All Sessions
                  </Button>
                </Box>
              </CardContent>
            </Card>
          </Grid>
          <Grid size={{ xs: 12, md: 5 }}>
            <Card elevation={0} sx={{ border: `1px solid ${saColors.border}`, bgcolor: saColors.navy, color: "#fff" }}>
              <CardContent>
                <Typography fontWeight={700}>Live Infrastructure</Typography>
                <Typography variant="body2" sx={{ mt: 1, color: "rgba(255,255,255,0.75)" }}>
                  Database Cluster · Application Node · Storage Class
                </Typography>
                <Chip
                  size="small"
                  label="STABLE"
                  sx={{ mt: 2, bgcolor: "#166534", color: "#fff", fontWeight: 800 }}
                />
              </CardContent>
            </Card>
          </Grid>
        </Grid>
      )}
    </Stack>
  );
}
