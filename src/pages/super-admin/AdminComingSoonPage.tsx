import { ConstructionOutlined } from "@mui/icons-material";
import { Box, Button, Card, CardContent, Stack, Typography } from "@mui/material";
import { Link, useLocation } from "react-router-dom";
import { saColors } from "../../theme/superAdminTheme";

const TITLES: Record<string, string> = {
  "/admin/billing": "Billing & Plans",
  "/admin/transactions": "Transactions",
  "/admin/analytics": "Advanced Analytics",
  "/admin/reports": "Reports",
};

export function AdminComingSoonPage() {
  const location = useLocation();
  const title = TITLES[location.pathname] ?? "Feature";

  return (
    <Box sx={{ display: "grid", placeItems: "center", minHeight: "60vh" }}>
      <Card elevation={0} sx={{ border: `1px solid ${saColors.border}`, maxWidth: 520, width: "100%" }}>
        <CardContent>
          <Stack spacing={2} alignItems="center" textAlign="center" py={2}>
            <Box
              sx={{
                width: 56,
                height: 56,
                borderRadius: 2,
                bgcolor: `${saColors.orange}18`,
                color: saColors.orange,
                display: "grid",
                placeItems: "center",
              }}
            >
              <ConstructionOutlined />
            </Box>
            <Typography variant="h5" fontWeight={800}>
              {title}
            </Typography>
            <Typography color="text.secondary">
              This screen is in the redesigned Super Admin navigation and will be wired to live APIs next.
              Core tenant, reseller, user, audit, and settings flows are available now.
            </Typography>
            <Button component={Link} to="/admin/dashboard" variant="contained">
              Back to Dashboard
            </Button>
          </Stack>
        </CardContent>
      </Card>
    </Box>
  );
}
