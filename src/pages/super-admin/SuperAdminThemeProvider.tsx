import { CssBaseline, ThemeProvider } from "@mui/material";
import type { ReactNode } from "react";
import { superAdminTheme } from "../../theme/superAdminTheme";

export function SuperAdminThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={superAdminTheme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
