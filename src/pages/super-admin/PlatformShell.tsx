import {
  AnalyticsOutlined,
  AssessmentOutlined,
  CampaignOutlined,
  DashboardOutlined,
  DnsOutlined,
  FunctionsOutlined,
  GavelOutlined,
  GroupsOutlined,
  HandshakeOutlined,
  HealthAndSafetyOutlined,
  HistoryOutlined,
  HubOutlined,
  Menu as MenuIcon,
  NotificationsNoneOutlined,
  PaymentOutlined,
  ReceiptLongOutlined,
  Search as SearchIcon,
  SettingsOutlined,
  ShieldOutlined,
  StorageOutlined,
  SupportAgentOutlined,
  TerminalOutlined,
} from "@mui/icons-material";
import {
  AppBar,
  Avatar,
  Badge,
  Box,
  Chip,
  Drawer,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Stack,
  TextField,
  Toolbar,
  Typography,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import { useState, type ReactNode } from "react";
import { NavLink, Navigate, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { isPlatformUser } from "../../components/AppShell";
import { assetUrl } from "../../lib/api";
import { notifyInfo } from "../../lib/notify";
import { useAppDispatch, useAppSelector } from "../../store";
import { setGlobalSearch } from "../../store/slices/uiSlice";
import { saColors } from "../../theme/superAdminTheme";
import { SuperAdminThemeProvider } from "./SuperAdminThemeProvider";

const DRAWER_WIDTH = 248;

type NavItem = {
  label: string;
  to?: string;
  icon: ReactNode;
  soon?: boolean;
};

type NavGroup = { title: string; items: NavItem[] };

const NAV_GROUPS: NavGroup[] = [
  {
    title: "Management",
    items: [
      { label: "Dashboard", to: "/admin/dashboard", icon: <DashboardOutlined fontSize="small" /> },
      { label: "Tenants", to: "/admin/tenants", icon: <HubOutlined fontSize="small" /> },
      { label: "Resellers", to: "/admin/resellers", icon: <HandshakeOutlined fontSize="small" /> },
      { label: "User Management", to: "/admin/users", icon: <GroupsOutlined fontSize="small" /> },
      { label: "Billing & Plans", to: "/admin/billing", icon: <ReceiptLongOutlined fontSize="small" />, soon: true },
      { label: "Transactions", to: "/admin/transactions", icon: <PaymentOutlined fontSize="small" />, soon: true },
    ],
  },
  {
    title: "Infrastructure",
    items: [
      { label: "Advanced Analytics", to: "/admin/analytics", icon: <AnalyticsOutlined fontSize="small" />, soon: true },
      { label: "Cluster Health", icon: <HealthAndSafetyOutlined fontSize="small" />, soon: true },
      { label: "Deployment Logs", icon: <TerminalOutlined fontSize="small" />, soon: true },
      { label: "Storage", icon: <StorageOutlined fontSize="small" />, soon: true },
      { label: "Edge Functions", icon: <FunctionsOutlined fontSize="small" />, soon: true },
    ],
  },
  {
    title: "System",
    items: [
      { label: "System Settings", to: "/admin/settings", icon: <SettingsOutlined fontSize="small" /> },
      { label: "Audit Logs", to: "/admin/audit", icon: <HistoryOutlined fontSize="small" /> },
      { label: "Payment Gateway", icon: <PaymentOutlined fontSize="small" />, soon: true },
      { label: "Support Center", icon: <SupportAgentOutlined fontSize="small" />, soon: true },
      { label: "Announcement", icon: <CampaignOutlined fontSize="small" />, soon: true },
      { label: "Reports", to: "/admin/reports", icon: <AssessmentOutlined fontSize="small" />, soon: true },
    ],
  },
];

function pathActive(pathname: string, to?: string) {
  if (!to) return false;
  if (to === "/admin/dashboard") return pathname === to;
  return pathname === to || pathname.startsWith(`${to}/`);
}

export function PlatformShell() {
  return (
    <SuperAdminThemeProvider>
      <PlatformShellInner />
    </SuperAdminThemeProvider>
  );
}

function PlatformShellInner() {
  const { user, isAuthenticated, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));
  const [mobileOpen, setMobileOpen] = useState(false);
  const dispatch = useAppDispatch();
  const globalSearch = useAppSelector((s) => s.ui.globalSearch);

  if (!isAuthenticated || !user) return <Navigate to="/admin/login" replace />;
  if (!isPlatformUser(user.permissions)) return <Navigate to="/dashboard" replace />;

  const drawer = (
    <Box
      sx={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        bgcolor: saColors.orange,
        color: "#fff",
      }}
    >
      <Stack direction="row" spacing={1.25} alignItems="center" sx={{ px: 2.25, py: 2.25 }}>
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: 1.5,
            bgcolor: "rgba(255,255,255,0.18)",
            display: "grid",
            placeItems: "center",
          }}
        >
          <ShieldOutlined sx={{ fontSize: 20 }} />
        </Box>
        <Typography fontWeight={800} letterSpacing="-0.02em">
          SuperAdmin
        </Typography>
      </Stack>

      <Box sx={{ flex: 1, overflowY: "auto", px: 1.25, pb: 2 }}>
        {NAV_GROUPS.map((group) => (
          <Box key={group.title} sx={{ mb: 1.5 }}>
            <Typography
              variant="overline"
              sx={{ px: 1.5, color: "rgba(255,255,255,0.65)", fontSize: "0.65rem" }}
            >
              {group.title}
            </Typography>
            <List dense disablePadding>
              {group.items.map((item) => {
                const active = pathActive(location.pathname, item.to);
                return (
                  <ListItemButton
                    key={item.label}
                    selected={active}
                    onClick={() => {
                      if (item.soon || !item.to) {
                        notifyInfo(`${item.label} is coming soon`);
                        return;
                      }
                      navigate(item.to);
                      setMobileOpen(false);
                    }}
                    sx={{
                      mx: 0.5,
                      mb: 0.35,
                      borderRadius: 1.5,
                      color: "#fff",
                      opacity: item.soon ? 0.72 : 1,
                      "&.Mui-selected": {
                        bgcolor: saColors.navy,
                        "&:hover": { bgcolor: saColors.navyDeep },
                      },
                      "&:hover": { bgcolor: "rgba(0,0,0,0.12)" },
                    }}
                  >
                    <ListItemIcon sx={{ minWidth: 34, color: "inherit" }}>{item.icon}</ListItemIcon>
                    <ListItemText
                      primary={item.label}
                      primaryTypographyProps={{ fontSize: 13.5, fontWeight: active ? 700 : 500 }}
                    />
                  </ListItemButton>
                );
              })}
            </List>
          </Box>
        ))}
      </Box>

      <Box sx={{ px: 2.25, py: 2, borderTop: "1px solid rgba(255,255,255,0.18)" }}>
        <Stack direction="row" spacing={1} alignItems="center">
          <Box sx={{ width: 8, height: 8, borderRadius: "50%", bgcolor: "#4ADE80" }} />
          <Typography variant="caption" sx={{ color: "rgba(255,255,255,0.9)" }}>
            Node-01 Stable · v4.12.0
          </Typography>
        </Stack>
        <Typography
          variant="caption"
          sx={{ mt: 1, display: "block", cursor: "pointer", color: "rgba(255,255,255,0.75)" }}
          onClick={logout}
        >
          Sign out
        </Typography>
      </Box>
    </Box>
  );

  return (
    <Box sx={{ display: "flex", minHeight: "100vh", bgcolor: saColors.bg }}>
      <AppBar
        position="fixed"
        elevation={0}
        sx={{
          bgcolor: "#fff",
          color: saColors.text,
          borderBottom: `1px solid ${saColors.border}`,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
        }}
      >
        <Toolbar sx={{ gap: 2, minHeight: 68 }}>
          {isMobile && (
            <IconButton edge="start" onClick={() => setMobileOpen(true)}>
              <MenuIcon />
            </IconButton>
          )}
          <TextField
            size="small"
            placeholder="Search tenants, users, or transactions..."
            value={globalSearch}
            onChange={(e) => dispatch(setGlobalSearch(e.target.value))}
            sx={{
              flex: 1,
              maxWidth: 560,
              mx: "auto",
              "& .MuiOutlinedInput-root": {
                bgcolor: "#F3F5F8",
                borderRadius: 2,
                "& fieldset": { borderColor: "transparent" },
              },
            }}
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <SearchIcon fontSize="small" sx={{ color: saColors.muted }} />
                </InputAdornment>
              ),
            }}
          />
          <Stack direction="row" spacing={1.5} alignItems="center">
            <Chip
              size="small"
              label="LIVE"
              sx={{ bgcolor: "#DCFCE7", color: "#15803D", fontWeight: 800, height: 24 }}
            />
            <Typography variant="caption" color="text.secondary" sx={{ display: { xs: "none", sm: "block" } }}>
              v4.12.0
            </Typography>
            <IconButton size="small">
              <Badge color="error" variant="dot">
                <NotificationsNoneOutlined />
              </Badge>
            </IconButton>
            <Stack
              direction="row"
              spacing={1}
              alignItems="center"
              component={NavLink}
              to="/admin/profile"
              sx={{ textDecoration: "none", color: "inherit" }}
            >
              <Avatar
                src={user.avatarUrl ? assetUrl(user.avatarUrl) : undefined}
                sx={{ width: 36, height: 36, bgcolor: saColors.navy }}
              >
                {user.firstName[0]}
              </Avatar>
              <Box sx={{ display: { xs: "none", sm: "block" } }}>
                <Typography variant="body2" fontWeight={700} lineHeight={1.2}>
                  {user.firstName} {user.lastName}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  Super Admin
                </Typography>
              </Box>
            </Stack>
          </Stack>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={() => setMobileOpen(false)}
          ModalProps={{ keepMounted: true }}
          sx={{
            display: { xs: "block", md: "none" },
            "& .MuiDrawer-paper": { width: DRAWER_WIDTH, border: 0 },
          }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: "none", md: "block" },
            "& .MuiDrawer-paper": { width: DRAWER_WIDTH, border: 0, boxSizing: "border-box" },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
        }}
      >
        <Toolbar sx={{ minHeight: "68px !important" }} />
        <Box sx={{ flex: 1, p: { xs: 2, md: 3 } }}>
          <Outlet />
        </Box>
        <Box
          component="footer"
          sx={{
            px: 3,
            py: 1.5,
            borderTop: `1px solid ${saColors.border}`,
            bgcolor: "#fff",
            display: "flex",
            flexWrap: "wrap",
            gap: 1,
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <Typography variant="caption" color="text.secondary">
            © {new Date().getFullYear()} Enterprise SaaS Admin · Privacy · Terms · Support
          </Typography>
          <Stack direction="row" spacing={1} alignItems="center">
            <Box sx={{ width: 7, height: 7, borderRadius: "50%", bgcolor: saColors.success }} />
            <Typography variant="caption" color="text.secondary">
              NODE HEALTH: 100% · VER: 4.12.0-STABLE
            </Typography>
          </Stack>
        </Box>
      </Box>
    </Box>
  );
}
