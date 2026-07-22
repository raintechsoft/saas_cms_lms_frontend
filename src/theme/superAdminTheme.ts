import { createTheme } from "@mui/material/styles";

/** Super Admin design tokens from Redesigned SaaS PDF */
export const saColors = {
  orange: "#FF6B35",
  orangeDark: "#E85A28",
  navy: "#002B5B",
  navyDeep: "#001F3F",
  bg: "#F4F7F9",
  card: "#FFFFFF",
  border: "#E5EAF0",
  text: "#1A2332",
  muted: "#6B7A90",
  success: "#16A34A",
  warning: "#F59E0B",
  danger: "#DC2626",
  info: "#2563EB",
} as const;

export const superAdminTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: saColors.orange,
      dark: saColors.orangeDark,
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: saColors.navy,
      contrastText: "#FFFFFF",
    },
    success: { main: saColors.success },
    warning: { main: saColors.warning },
    error: { main: saColors.danger },
    info: { main: saColors.info },
    background: {
      default: saColors.bg,
      paper: saColors.card,
    },
    text: {
      primary: saColors.text,
      secondary: saColors.muted,
    },
    divider: saColors.border,
  },
  typography: {
    fontFamily: '"Plus Jakarta Sans", "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
    h4: { fontWeight: 700, letterSpacing: "-0.02em" },
    h5: { fontWeight: 700, letterSpacing: "-0.01em" },
    h6: { fontWeight: 700 },
    button: { textTransform: "none", fontWeight: 600 },
    overline: { fontWeight: 700, letterSpacing: "0.08em" },
  },
  shape: { borderRadius: 10 },
  components: {
    MuiButton: {
      styleOverrides: {
        root: { borderRadius: 8, boxShadow: "none", "&:hover": { boxShadow: "none" } },
        containedPrimary: {
          backgroundColor: saColors.orange,
          "&:hover": { backgroundColor: saColors.orangeDark },
        },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 700, borderRadius: 6 },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: "none" },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        head: {
          fontWeight: 700,
          fontSize: "0.7rem",
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          color: saColors.muted,
          backgroundColor: "#FAFBFC",
        },
      },
    },
  },
});
