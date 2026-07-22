import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Switch,
  FormControlLabel,
  TextField,
  Typography,
  CircularProgress,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import { apiRequest } from "../../lib/api";
import { notifyError, notifySuccess } from "../../lib/notify";
import { saColors } from "../../theme/superAdminTheme";
import type { AuditRow, PlatformSettings } from "./types";

export function AdminSettingsPage() {
  const { accessToken, user } = useAuth();
  const [settings, setSettings] = useState<PlatformSettings | null>(null);
  const [audit, setAudit] = useState<AuditRow[]>([]);
  const [primaryColor, setPrimaryColor] = useState("#FF6B35");
  const [logoText, setLogoText] = useState("SaaS CMS LMS");
  const [platformName, setPlatformName] = useState("Enterprise SaaS Super Admin");
  const [supportEmail, setSupportEmail] = useState("infrastructure-support@enterprise.io");
  const [maintenance, setMaintenance] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    Promise.all([
      apiRequest<PlatformSettings>("/platform/settings", accessToken),
      apiRequest<AuditRow[]>("/platform/audit?limit=5", accessToken),
    ])
      .then(([data, nextAudit]) => {
        setSettings(data);
        setPrimaryColor(data.brandingDefaults.primaryColor);
        setLogoText(data.brandingDefaults.logoText);
        setAudit(nextAudit);
      })
      .catch((cause) => notifyError(cause instanceof Error ? cause.message : "Failed to load settings"));
  }, [accessToken]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const next = await apiRequest<PlatformSettings>("/platform/settings", accessToken, {
        method: "PUT",
        body: JSON.stringify({ branding: { primaryColor, logoText } }),
      });
      setSettings(next);
      notifySuccess("Configuration saved successfully");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Failed to save settings");
    } finally {
      setSubmitting(false);
    }
  }

  if (!settings) {
    return (
      <Box sx={{ py: 10, display: "grid", placeItems: "center" }}>
        <CircularProgress sx={{ color: saColors.orange }} />
      </Box>
    );
  }

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, md: 3 }}>
        <Card elevation={0} sx={{ border: `1px solid ${saColors.border}`, height: "100%" }}>
          <CardContent>
            <Typography fontWeight={800}>Platform Settings</Typography>
            <Typography variant="body2" color="text.secondary" mb={2}>
              Global infrastructure configuration.
            </Typography>
            {["General", "Notifications", "Payments", "Security", "Languages", "API Management"].map(
              (item, idx) => (
                <Box
                  key={item}
                  sx={{
                    px: 1.5,
                    py: 1,
                    mb: 0.5,
                    borderRadius: 1.5,
                    bgcolor: idx === 0 ? "#DBEAFE" : "transparent",
                    color: idx === 0 ? saColors.navy : saColors.text,
                    fontWeight: idx === 0 ? 700 : 500,
                    fontSize: 14,
                  }}
                >
                  {item}
                </Box>
              ),
            )}
            <Typography variant="overline" color="text.secondary" display="block" mt={3} mb={1}>
              Audit History
            </Typography>
            <Stack spacing={1.25}>
              {audit.map((row) => (
                <Box key={row.id} sx={{ p: 1.25, borderRadius: 1.5, bgcolor: "#F8FAFC", border: `1px solid ${saColors.border}` }}>
                  <Typography variant="body2" fontWeight={700}>
                    {row.action}
                  </Typography>
                  <Typography variant="caption" color="text.secondary">
                    {row.actor ?? "system"} · {new Date(row.createdAt).toLocaleString()}
                  </Typography>
                </Box>
              ))}
            </Stack>
          </CardContent>
        </Card>
      </Grid>

      <Grid size={{ xs: 12, md: 9 }}>
        <Stack spacing={2} component="form" onSubmit={submit}>
          <Box>
            <Typography variant="h5" fontWeight={800}>
              General Platform Configuration
            </Typography>
            <Typography color="text.secondary">Identity, accessibility, and default branding.</Typography>
          </Box>

          <Card elevation={0} sx={{ border: `1px solid ${saColors.border}` }}>
            <CardContent>
              <Typography fontWeight={700} mb={2}>
                Identity & Accessibility
              </Typography>
              <Grid container spacing={2}>
                <Grid size={{ xs: 12 }}>
                  <TextField
                    fullWidth
                    label="Platform Name"
                    value={platformName}
                    onChange={(e) => setPlatformName(e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="Support Contact Email"
                    value={supportEmail}
                    onChange={(e) => setSupportEmail(e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField fullWidth label="Logo Text" value={logoText} onChange={(e) => setLogoText(e.target.value)} />
                </Grid>
                <Grid size={{ xs: 12, md: 6 }}>
                  <TextField
                    fullWidth
                    label="Primary Brand Color"
                    value={primaryColor}
                    onChange={(e) => setPrimaryColor(e.target.value)}
                  />
                </Grid>
                <Grid size={{ xs: 12 }}>
                  <FormControlLabel
                    control={<Switch checked={maintenance} onChange={(e) => setMaintenance(e.target.checked)} />}
                    label="Maintenance Mode — System Accessibility State"
                  />
                </Grid>
              </Grid>
            </CardContent>
          </Card>

          <Card elevation={0} sx={{ border: `1px solid ${saColors.border}` }}>
            <CardContent>
              <Typography fontWeight={700} mb={1}>
                Environment
              </Typography>
              <Typography variant="body2" color="text.secondary">
                Node: {settings.environment.nodeEnv} · API Port: {settings.environment.apiPort} · Origin:{" "}
                {settings.environment.webOrigin} · Version: {settings.environment.version}
              </Typography>
            </CardContent>
          </Card>

          <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" alignItems={{ sm: "center" }} spacing={1}>
            <Typography variant="caption" color="text.secondary">
              Last updated by {user?.firstName} {user?.lastName}
            </Typography>
            <Stack direction="row" spacing={1}>
              <Button
                variant="outlined"
                color="inherit"
                onClick={() => {
                  setPrimaryColor(settings.brandingDefaults.primaryColor);
                  setLogoText(settings.brandingDefaults.logoText);
                }}
              >
                Reset Changes
              </Button>
              <Button type="submit" variant="contained" disabled={submitting}>
                {submitting ? "Saving…" : "Save Configuration"}
              </Button>
            </Stack>
          </Stack>
        </Stack>
      </Grid>
    </Grid>
  );
}
