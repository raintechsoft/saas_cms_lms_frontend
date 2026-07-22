import {
  ComputerOutlined,
  EmailOutlined,
  KeyOutlined,
  LockOutlined,
  LogoutOutlined,
  NotificationsNoneOutlined,
  PhoneIphoneOutlined,
  ShieldOutlined,
  WarningAmberOutlined,
} from "@mui/icons-material";
import {
  Avatar,
  Box,
  Button,
  Card,
  CardContent,
  Checkbox,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Link as MuiLink,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../../auth/AuthContext";
import { apiRequest, assetUrl, forgotPassword, updateAuthProfile, uploadAvatar } from "../../lib/api";
import { notifyError, notifyInfo, notifySuccess } from "../../lib/notify";
import { saColors } from "../../theme/superAdminTheme";
import type { PlatformUser } from "./types";

type NotifKey =
  | "critical"
  | "security"
  | "onboarding"
  | "billing"
  | "maintenance";

const NOTIF_OPTIONS: Array<{ key: NotifKey; title: string; description: string; defaultOn: boolean }> = [
  {
    key: "critical",
    title: "Critical System Alerts",
    description: "Immediate notification for platform-wide outages or security breaches.",
    defaultOn: true,
  },
  {
    key: "security",
    title: "Security Audit Logs",
    description: "Daily digest of high-priority infrastructure and access changes.",
    defaultOn: true,
  },
  {
    key: "onboarding",
    title: "New Tenant Onboarding",
    description: "Get notified when a new organization completes the signup flow.",
    defaultOn: false,
  },
  {
    key: "billing",
    title: "Billing & Revenue Reports",
    description: "Weekly summary of platform revenue and failed payment attempts.",
    defaultOn: true,
  },
  {
    key: "maintenance",
    title: "Maintenance Schedule",
    description: "Advance notice for planned downtime and cluster upgrades.",
    defaultOn: true,
  },
];

const MOCK_SESSIONS = [
  {
    id: "current",
    title: "Chrome on macOS",
    meta: "New York, USA · Active now",
    current: true,
    icon: "desktop" as const,
  },
  {
    id: "mobile",
    title: "Mobile App on iPhone 14",
    meta: "New York, USA · 2 hours ago",
    current: false,
    icon: "mobile" as const,
  },
  {
    id: "safari",
    title: "Safari on MacBook Pro",
    meta: "San Francisco, USA · Yesterday",
    current: false,
    icon: "laptop" as const,
  },
];

export function AdminAccountPage() {
  const { accessToken, user, completeLogin } = useAuth();
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [sendingReset, setSendingReset] = useState(false);
  const [peers, setPeers] = useState<PlatformUser[]>([]);
  const [notifs, setNotifs] = useState<Record<NotifKey, boolean>>(
    Object.fromEntries(NOTIF_OPTIONS.map((o) => [o.key, o.defaultOn])) as Record<NotifKey, boolean>,
  );

  useEffect(() => {
    if (!user) return;
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setAvatarUrl(user.avatarUrl ?? null);
  }, [user]);

  useEffect(() => {
    apiRequest<PlatformUser[]>("/platform/users?role=UNIVERSE_SUPER_ADMIN&status=ACTIVE", accessToken)
      .then((rows) => setPeers(rows.filter((row) => row.id !== user?.id).slice(0, 6)))
      .catch(() => setPeers([]));
  }, [accessToken, user?.id]);

  if (!user) return null;

  const currentUser = user;
  const roleLabel = currentUser.roles[0]?.replaceAll("_", " ") ?? "Super Administrator";

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const updated = await updateAuthProfile(accessToken, { firstName, lastName });
      completeLogin({
        accessToken,
        user: {
          ...currentUser,
          firstName: updated.firstName,
          lastName: updated.lastName,
          phone: updated.phone,
          avatarUrl: updated.avatarUrl,
        },
      });
      notifySuccess("Profile changes saved");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to save profile");
    } finally {
      setSaving(false);
    }
  }

  async function handlePhoto(file: File | null) {
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      notifyError("Image must be 2MB or smaller");
      return;
    }
    setUploading(true);
    try {
      const updated = await uploadAvatar(accessToken, file);
      setAvatarUrl(updated.avatarUrl);
      completeLogin({
        accessToken,
        user: {
          ...currentUser,
          firstName: updated.firstName,
          lastName: updated.lastName,
          phone: updated.phone,
          avatarUrl: updated.avatarUrl,
        },
      });
      notifySuccess("Profile photo updated");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to upload photo");
    } finally {
      setUploading(false);
    }
  }

  async function sendPasswordReset() {
    setSendingReset(true);
    try {
      await forgotPassword({ email: currentUser.email });
      notifySuccess("Password reset link sent to your email");
      setPasswordOpen(false);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to send reset email");
    } finally {
      setSendingReset(false);
    }
  }

  return (
    <Box>
      <Typography variant="h4" fontWeight={800}>
        My Account
      </Typography>
      <Typography color="text.secondary" mt={0.5} mb={3}>
        Manage your personal profile, security preferences, and administrative settings.
      </Typography>

      <Grid container spacing={2.5}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <Stack spacing={2.5}>
            {/* Profile Details */}
            <Card elevation={0} sx={{ border: `1px solid ${saColors.border}` }} component="form" onSubmit={handleSave}>
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2.5}>
                  <Typography fontWeight={800} fontSize={18}>
                    Profile Details
                  </Typography>
                  <Chip size="small" label="READONLY ROLE" sx={{ fontWeight: 700, bgcolor: "#F1F5F9" }} />
                </Stack>

                <Stack direction={{ xs: "column", sm: "row" }} spacing={3} mb={3}>
                  <Stack alignItems="center" spacing={1} minWidth={120}>
                    <Avatar
                      src={avatarUrl ? assetUrl(avatarUrl) : undefined}
                      sx={{ width: 96, height: 96, bgcolor: saColors.navy, fontSize: 32, fontWeight: 700 }}
                    >
                      {user.firstName[0]}
                      {user.lastName?.[0] ?? ""}
                    </Avatar>
                    <Typography variant="caption" color="text.secondary" textAlign="center">
                      JPG or PNG. Max 2MB.
                    </Typography>
                    <Button component="label" size="small" variant="outlined" color="inherit" disabled={uploading}>
                      {uploading ? "Uploading…" : "Change photo"}
                      <input
                        hidden
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        onChange={(e) => void handlePhoto(e.target.files?.[0] ?? null)}
                      />
                    </Button>
                  </Stack>

                  <Box flex={1}>
                    <Grid container spacing={2}>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          fullWidth
                          label="First Name"
                          value={firstName}
                          onChange={(e) => setFirstName(e.target.value)}
                          required
                        />
                      </Grid>
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <TextField
                          fullWidth
                          label="Last Name"
                          value={lastName}
                          onChange={(e) => setLastName(e.target.value)}
                          required
                        />
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <TextField
                          fullWidth
                          label="Email Address"
                          value={user.email}
                          disabled
                          InputProps={{
                            startAdornment: <EmailOutlined sx={{ mr: 1, color: saColors.muted }} fontSize="small" />,
                          }}
                          helperText="Used for critical system alerts and account recovery."
                        />
                      </Grid>
                      <Grid size={{ xs: 12 }}>
                        <TextField
                          fullWidth
                          label="System Role"
                          value={`${roleLabel} (platform authority)`}
                          disabled
                          InputProps={{
                            startAdornment: <ShieldOutlined sx={{ mr: 1, color: saColors.muted }} fontSize="small" />,
                          }}
                        />
                      </Grid>
                    </Grid>
                  </Box>
                </Stack>

                <Stack direction="row" justifyContent="flex-end">
                  <Button type="submit" variant="contained" disabled={saving}>
                    {saving ? "Saving…" : "Save Changes"}
                  </Button>
                </Stack>
              </CardContent>
            </Card>

            {/* Password & Security */}
            <Card elevation={0} sx={{ border: `1px solid ${saColors.border}` }}>
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" spacing={1} alignItems="center" mb={2}>
                  <LockOutlined sx={{ color: saColors.muted }} />
                  <Typography fontWeight={800} fontSize={18}>
                    Password & Security
                  </Typography>
                </Stack>

                <Stack spacing={1.5}>
                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: `1px solid ${saColors.border}`,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 2,
                      flexWrap: "wrap",
                    }}
                  >
                    <Box>
                      <Typography fontWeight={700}>Login Password</Typography>
                      <Typography variant="body2" color="text.secondary">
                        Last changed recently · Use reset email to update
                      </Typography>
                    </Box>
                    <Button variant="outlined" color="inherit" startIcon={<KeyOutlined />} onClick={() => setPasswordOpen(true)}>
                      Change Password
                    </Button>
                  </Box>

                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: "1px solid #BBF7D0",
                      bgcolor: "#F0FDF4",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 2,
                      flexWrap: "wrap",
                    }}
                  >
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center">
                        <Typography fontWeight={700}>Two-Factor Authentication (2FA)</Typography>
                        <Chip size="small" label="ENABLED" sx={{ bgcolor: "#DCFCE7", color: "#15803D", fontWeight: 800 }} />
                      </Stack>
                      <Typography variant="body2" color="text.secondary" mt={0.5}>
                        Protects platform access with a second verification step.
                      </Typography>
                    </Box>
                    <Button
                      variant="outlined"
                      color="inherit"
                      onClick={() => notifyInfo("2FA management will connect to auth providers next")}
                    >
                      Disable 2FA
                    </Button>
                  </Box>

                  <Box
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      border: `1px solid ${saColors.border}`,
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: 2,
                      flexWrap: "wrap",
                    }}
                  >
                    <Box>
                      <Typography fontWeight={700}>Backup Recovery Codes</Typography>
                      <Typography variant="body2" color="text.secondary">
                        10 recovery codes remain for emergency account access.
                      </Typography>
                    </Box>
                    <Button
                      variant="outlined"
                      color="inherit"
                      onClick={() => notifyInfo("Recovery codes UI coming soon")}
                    >
                      View Codes
                    </Button>
                  </Box>
                </Stack>
              </CardContent>
            </Card>

            {/* Notification Preferences */}
            <Card elevation={0} sx={{ border: `1px solid ${saColors.border}` }}>
              <CardContent sx={{ p: 3 }}>
                <Stack direction="row" spacing={1} alignItems="center" mb={1.5}>
                  <NotificationsNoneOutlined sx={{ color: saColors.muted }} />
                  <Typography fontWeight={800} fontSize={18}>
                    Notification Preferences
                  </Typography>
                </Stack>

                <Stack>
                  {NOTIF_OPTIONS.map((item) => (
                    <FormControlLabel
                      key={item.key}
                      sx={{
                        alignItems: "flex-start",
                        mx: 0,
                        py: 1.25,
                        borderBottom: `1px solid ${saColors.border}`,
                        "&:last-of-type": { borderBottom: 0 },
                      }}
                      control={
                        <Checkbox
                          checked={notifs[item.key]}
                          onChange={(e) => {
                            setNotifs((prev) => ({ ...prev, [item.key]: e.target.checked }));
                            notifySuccess("Preference updated locally");
                          }}
                          sx={{ pt: 0 }}
                        />
                      }
                      label={
                        <Box>
                          <Typography fontWeight={700}>{item.title}</Typography>
                          <Typography variant="body2" color="text.secondary">
                            {item.description}
                          </Typography>
                        </Box>
                      }
                    />
                  ))}
                </Stack>

                <MuiLink
                  component="button"
                  type="button"
                  underline="hover"
                  fontWeight={700}
                  sx={{ mt: 1.5, color: saColors.info }}
                  onClick={() => notifyInfo("Push notification channels coming soon")}
                >
                  Configure Push Notifications →
                </MuiLink>
              </CardContent>
            </Card>
          </Stack>
        </Grid>

        <Grid size={{ xs: 12, lg: 4 }}>
          <Stack spacing={2.5}>
            <Card elevation={0} sx={{ border: `1px solid ${saColors.border}`, bgcolor: "#F8FAFC" }}>
              <CardContent>
                <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
                  <Typography fontWeight={800}>Active Sessions</Typography>
                  <Chip size="small" label="HEALTHY" sx={{ bgcolor: "#DCFCE7", color: "#15803D", fontWeight: 800 }} />
                </Stack>

                <Stack spacing={1.5}>
                  {MOCK_SESSIONS.map((session) => (
                    <Stack
                      key={session.id}
                      direction="row"
                      spacing={1.5}
                      alignItems="flex-start"
                      sx={{ p: 1.25, borderRadius: 2, bgcolor: "#fff", border: `1px solid ${saColors.border}` }}
                    >
                      <Box
                        sx={{
                          width: 36,
                          height: 36,
                          borderRadius: 1.5,
                          bgcolor: "#EEF2FF",
                          color: saColors.navy,
                          display: "grid",
                          placeItems: "center",
                        }}
                      >
                        {session.icon === "mobile" ? (
                          <PhoneIphoneOutlined fontSize="small" />
                        ) : (
                          <ComputerOutlined fontSize="small" />
                        )}
                      </Box>
                      <Box flex={1}>
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Typography fontWeight={700} fontSize={14}>
                            {session.title}
                          </Typography>
                          {session.current && (
                            <Chip
                              size="small"
                              label="CURRENT"
                              sx={{ height: 20, fontWeight: 800, bgcolor: "#DCFCE7", color: "#15803D" }}
                            />
                          )}
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {session.meta}
                        </Typography>
                      </Box>
                    </Stack>
                  ))}
                </Stack>

                <Button
                  fullWidth
                  color="error"
                  startIcon={<LogoutOutlined />}
                  sx={{ mt: 2, justifyContent: "flex-start" }}
                  onClick={() => notifySuccess("Other device sessions will be revoked when session APIs are connected")}
                >
                  Log out of all other devices
                </Button>
              </CardContent>
            </Card>

            <Card elevation={0} sx={{ border: `1px solid ${saColors.border}` }}>
              <CardContent>
                <Typography fontWeight={800} mb={2}>
                  Administrative Peers
                </Typography>
                <Stack spacing={1.5}>
                  {peers.length === 0 ? (
                    <Typography variant="body2" color="text.secondary">
                      No other super admins found.
                    </Typography>
                  ) : (
                    peers.map((peer) => (
                      <Stack key={peer.id} direction="row" spacing={1.5} alignItems="center">
                        <Avatar sx={{ bgcolor: saColors.orange, width: 40, height: 40, fontWeight: 700 }}>
                          {peer.firstName[0]}
                          {peer.lastName?.[0] ?? ""}
                        </Avatar>
                        <Box flex={1} minWidth={0}>
                          <Typography fontWeight={700} noWrap>
                            {peer.firstName} {peer.lastName}
                          </Typography>
                          <Typography variant="caption" color="text.secondary" noWrap display="block">
                            {peer.email}
                          </Typography>
                        </Box>
                        <Chip size="small" label="ADMIN" sx={{ fontWeight: 800 }} />
                      </Stack>
                    ))
                  )}
                </Stack>

                <Button
                  fullWidth
                  variant="outlined"
                  color="inherit"
                  sx={{ mt: 2 }}
                  onClick={() => notifyInfo("Invite flow will be added with platform user management")}
                >
                  + Invite New Super Admin
                </Button>

                <Box
                  sx={{
                    mt: 2,
                    p: 1.5,
                    borderRadius: 2,
                    bgcolor: "#FFF7ED",
                    border: "1px solid #FED7AA",
                    display: "flex",
                    gap: 1,
                  }}
                >
                  <WarningAmberOutlined sx={{ color: "#EA580C", fontSize: 20, mt: 0.25 }} />
                  <Typography variant="caption" color="text.secondary">
                    Inviting a Super Admin grants full access to infrastructure controls and financial data.
                  </Typography>
                </Box>
              </CardContent>
            </Card>
          </Stack>
        </Grid>
      </Grid>

      <Dialog open={passwordOpen} onClose={() => setPasswordOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle fontWeight={800}>Change Password</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary">
            We’ll email a secure reset link to <strong>{user.email}</strong>. Open the link to set a new password.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button color="inherit" onClick={() => setPasswordOpen(false)}>
            Cancel
          </Button>
          <Button variant="contained" disabled={sendingReset} onClick={() => void sendPasswordReset()}>
            {sendingReset ? "Sending…" : "Send Reset Link"}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
