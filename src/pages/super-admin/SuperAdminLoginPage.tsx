import {
  LockOutlined,
  ShieldOutlined,
  Visibility,
  VisibilityOff,
} from "@mui/icons-material";
import {
  Box,
  Button,
  IconButton,
  InputAdornment,
  Link as MuiLink,
  Paper,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { useState, type FormEvent } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
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
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated && user && isPlatformUser(user.permissions)) {
    return <Navigate to="/admin/dashboard" replace />;
  }
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      await login({ email: email.trim(), password });
      notifySuccess("Signed in to Super Admin");
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
          linear-gradient(180deg, #EEF2F6 0%, #F7F8FA 100%)
        `,
      }}
    >
      <Paper
        elevation={0}
        sx={{
          width: "100%",
          maxWidth: 420,
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
              Super Admin
            </Typography>
          </Stack>
          <Typography variant="h5" fontWeight={800} textAlign="center" mt={1.5}>
            Admin login
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Platform operators only. Schools use the institute login.
          </Typography>
        </Stack>

        <Box component="form" onSubmit={handleSubmit} noValidate>
          <Typography variant="overline" color="text.secondary" display="block" mb={0.5}>
            Email
          </Typography>
          <TextField
            fullWidth
            size="medium"
            type="email"
            name="email"
            autoComplete="username"
            placeholder="admin@your-platform.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            sx={{ mb: 2 }}
          />

          <Stack direction="row" justifyContent="space-between" alignItems="center" mb={0.5}>
            <Typography variant="overline" color="text.secondary">
              Password
            </Typography>
            <Button
              type="button"
              size="small"
              onClick={() => setShowPassword((v) => !v)}
              sx={{ minWidth: 0, px: 0.5, textTransform: "none", fontWeight: 700 }}
            >
              {showPassword ? "Hide" : "Show"}
            </Button>
          </Stack>
          <TextField
            fullWidth
            size="medium"
            name="password"
            autoComplete="current-password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            placeholder="Enter your password"
            InputProps={{
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    type="button"
                    edge="end"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    onClick={() => setShowPassword((v) => !v)}
                    onMouseDown={(e) => e.preventDefault()}
                  >
                    {showPassword ? <VisibilityOff /> : <Visibility />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
            sx={{ mb: 2.5 }}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={submitting || !email.trim() || !password}
            startIcon={<LockOutlined />}
            sx={{
              py: 1.35,
              bgcolor: saColors.info,
              "&:hover": { bgcolor: "#1D4ED8" },
            }}
          >
            {submitting ? "Signing in…" : "Sign in"}
          </Button>
        </Box>

        <Box sx={{ mt: 3, pt: 2.5, borderTop: `1px solid ${saColors.border}`, textAlign: "center" }}>
          <Typography variant="body2" color="text.secondary">
            School / staff / student?{" "}
            <MuiLink component={Link} to="/login" underline="hover" fontWeight={700}>
              Institute login
            </MuiLink>
          </Typography>
        </Box>
      </Paper>
    </Box>
  );
}
