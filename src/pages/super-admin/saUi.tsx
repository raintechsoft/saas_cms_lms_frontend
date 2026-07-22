import { Box, Button, Card, CardContent, Chip, Stack, Typography } from "@mui/material";
import type { ReactNode } from "react";
import { saColors } from "../../theme/superAdminTheme";

export function SaPageHeader({
  eyebrow,
  title,
  description,
  actions,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <Stack
      direction={{ xs: "column", md: "row" }}
      justifyContent="space-between"
      alignItems={{ md: "flex-start" }}
      spacing={2}
      mb={2.5}
    >
      <Box>
        {eyebrow && (
          <Typography
            variant="overline"
            sx={{ color: saColors.info, fontWeight: 800, letterSpacing: "0.08em" }}
          >
            {eyebrow}
          </Typography>
        )}
        <Typography variant="h4" fontWeight={800}>
          {title}
        </Typography>
        {description && (
          <Typography color="text.secondary" mt={0.5}>
            {description}
          </Typography>
        )}
      </Box>
      {actions && (
        <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
          {actions}
        </Stack>
      )}
    </Stack>
  );
}

export function SaKpi({
  label,
  value,
  hint,
  icon,
  tone = "default",
}: {
  label: string;
  value: string;
  hint?: string;
  icon?: ReactNode;
  tone?: "default" | "success" | "danger" | "warning";
}) {
  const iconBg =
    tone === "success"
      ? "#DCFCE7"
      : tone === "danger"
        ? "#FEE2E2"
        : tone === "warning"
          ? "#FFEDD5"
          : "#EFF6FF";
  const iconColor =
    tone === "success"
      ? saColors.success
      : tone === "danger"
        ? saColors.danger
        : tone === "warning"
          ? saColors.warning
          : saColors.info;
  return (
    <Card elevation={0} sx={{ border: `1px solid ${saColors.border}`, height: "100%" }}>
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
          <Box>
            <Typography variant="body2" color="text.secondary" fontWeight={600}>
              {label}
            </Typography>
            <Typography variant="h4" fontWeight={800} mt={0.5} letterSpacing="-0.03em">
              {value}
            </Typography>
            {hint && (
              <Typography variant="caption" color="text.secondary" display="block" mt={1}>
                {hint}
              </Typography>
            )}
          </Box>
          {icon && (
            <Box
              sx={{
                width: 40,
                height: 40,
                borderRadius: 2,
                bgcolor: iconBg,
                color: iconColor,
                display: "grid",
                placeItems: "center",
              }}
            >
              {icon}
            </Box>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

export function SaStatusChip({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "success" | "danger" | "warning" | "info" | "neutral";
}) {
  const styles = {
    success: { bg: "#DCFCE7", color: "#15803D" },
    danger: { bg: "#FEE2E2", color: "#B91C1C" },
    warning: { bg: "#FFEDD5", color: "#C2410C" },
    info: { bg: "#DBEAFE", color: "#1D4ED8" },
    neutral: { bg: "#F1F5F9", color: "#475569" },
  }[tone];
  return (
    <Chip size="small" label={label} sx={{ fontWeight: 800, bgcolor: styles.bg, color: styles.color }} />
  );
}

export function SaCard({
  title,
  subtitle,
  action,
  children,
  tone,
}: {
  title?: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
  tone?: "default" | "muted";
}) {
  return (
    <Card
      elevation={0}
      sx={{
        border: `1px solid ${saColors.border}`,
        bgcolor: tone === "muted" ? "#F8FAFC" : "#fff",
        height: "100%",
      }}
    >
      <CardContent sx={{ p: 2.5, "&:last-child": { pb: 2.5 } }}>
        {(title || action) && (
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start" mb={title ? 2 : 0}>
            <Box>
              {title && (
                <Typography fontWeight={800} fontSize={17}>
                  {title}
                </Typography>
              )}
              {subtitle && (
                <Typography variant="body2" color="text.secondary">
                  {subtitle}
                </Typography>
              )}
            </Box>
            {action}
          </Stack>
        )}
        {children}
      </CardContent>
    </Card>
  );
}

export function SaPrimaryButton(props: React.ComponentProps<typeof Button>) {
  return <Button variant="contained" {...props} />;
}

export function SaGhostButton(props: React.ComponentProps<typeof Button>) {
  return <Button variant="outlined" color="inherit" {...props} />;
}
