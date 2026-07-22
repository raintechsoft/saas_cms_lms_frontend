import {
  LockOutlined,
  ShieldOutlined,
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";
import {
  Box,
  Button,
  Checkbox,
  FormControlLabel,
  IconButton,
  InputAdornment,
  Link as MuiLink,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState, type FormEvent } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { isPlatformUser } from "../../components/AppShell";
import { notifyError, notifySuccess } from "../../lib/notify";
import { saColors } from "../../theme/superAdminTheme";
import { SuperAdminThemeProvider } from "./SuperAdminThemeProvider";

export function SuperAdminLoginPage() {
  return (
    <SuperAdminThemeProvider>
      <SuperAdminLoginInner />
    </SuperAdminThemeProvider>
  );
}

function SuperAdminLoginInner() {
  const { login, isAuthenticated, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("admin@saas-cms-lms.local");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [remember, setRemember] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated && user && isPlatformUser(user.permissions)) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await login({ email, password });
      notifySuccess("Signed in to Admin Portal");
      navigate("/admin/dashboard", { replace: true });
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to sign in");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        px: 2,
        py: 4,
        background: `
          radial-gradient(circle at 18% 22%, rgba(37,99,235,0.18), transparent 42%),
          radial-gradient(circle at 82% 18%, rgba(255,107,53,0.16), transparent 40%),
          radial-gradient(circle at 70% 78%, rgba(0,43,91,0.12), transparent 45%),
          linear-gradient(180deg, #EEF2F6 0%, #F7F8FA 100%)
        `,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: "100%",
          maxWidth: 440,
          p: { xs: 3, sm: 4 },
          borderRadius: 3,
          border: `1px solid ${saColors.border}`,
          boxShadow: "0 18px 50px rgba(15, 23, 42, 0.08)",
        }}
      >
        <Stack spacing={0.75} alignItems="center" mb={3}>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box
              sx={{
                width: 36,
                height: 36,
                borderRadius: 1.5,
                bgcolor: saColors.info,
                display: "grid",
                placeItems: "center",
                color: "#fff",
              }}
            >
              <ShieldOutlined fontSize="small" />
            </Box>
            <Typography fontWeight={800} color={saColors.info}>
              SaaS Super Admin
            </Typography>
          </Stack>
          <Typography variant="h5" fontWeight={800} textAlign="center" mt={1.5}>
            Sign in to Admin Portal
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Manage enterprise infrastructure and user access.
          </Typography>
        </Stack>

        <Box component="form" onSubmit={handleSubmit}>
          <Typography variant="overline" color="text.secondary" display="block" mb={0.5}>
            Admin Email
          </Typography>
          <TextField
            fullWidth
            size="medium"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            sx={{ mb: 2 }}
          />

          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
            <Typography variant="overline" color="text.secondary">
              Password
            </Typography>
            <MuiLink href="/forgot-password" underline="hover" variant="caption" fontWeight={600}>
              Forgot password?
            </MuiLink>
          </Stack>
          <TextField
            fullWidth
            size="medium"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton edge="end" onClick={() => setShowPassword((v) => !v)}>
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{ mb: 1 }}
          />

          <FormControlLabel
            control={
              <Checkbox
                checked={remember}
                onChange={(e) => setRemember(e.target.checked)}
                sx={{ color: saColors.info, "&.Mui-checked": { color: saColors.info } }}
              />
            }
            label={<Typography variant="body2">Remember this device</Typography>}
            sx={{ mb: 2 }}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={submitting}
            startIcon={<LockOutlined />}
            sx={{
              py: 1.35,
              bgcolor: saColors.info,
              "&:hover": { bgcolor: "#1D4ED8" },
            }}
          >
            {submitting ? "Signing in…" : "Sign In to Dashboard"}
          </Button>
        </Box>

        <Box sx={{ mt: 3, pt: 2.5, borderTop: `1px solid ${saColors.border}`, textAlign: "center" }}>
          <Typography variant="caption" color="text.secondary" display="block">
            System version: v4.12.0-stable
          </Typography>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: "block", letterSpacing: 0.6 }}>
            PRIVACY POLICY · SYSTEM STATUS
          </Typography>
        </Box>
      </Paper>

      <Typography variant="caption" color="text.secondary" sx={{ mt: 3, maxWidth: 480, textAlign: "center" }}>
        Authorized access only. All actions on this system are logged and monitored for security purposes.
      </Typography>
    </Box>
  );
}
