import {
  Add,
  CreditCardOutlined,
  GroupsOutlined,
  TrendingUpOutlined,
  WorkspacePremiumOutlined,
} from "@mui/icons-material";
import {
  Box,
  LinearProgress,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { notifyInfo } from "../../lib/notify";
import { saColors } from "../../theme/superAdminTheme";
import { SaCard, SaGhostButton, SaKpi, SaPageHeader, SaPrimaryButton, SaStatusChip } from "./saUi";

const PLANS = [
  { name: "Starter", price: "$49", tenants: 42, seats: "Up to 200", modules: "CMS", color: "#64748B" },
  { name: "Growth", price: "$149", tenants: 86, seats: "Up to 1,000", modules: "CMS + LMS", color: saColors.info },
  { name: "Enterprise", price: "Custom", tenants: 28, seats: "Unlimited", modules: "Full suite", color: saColors.navy },
];

const SUBS = [
  { tenant: "Horizon Academy", plan: "Enterprise", mrr: 4200, status: "Active", renews: "Nov 12, 2023" },
  { tenant: "Bright Minds School", plan: "Growth", mrr: 149, status: "Active", renews: "Oct 30, 2023" },
  { tenant: "Vertex Institute", plan: "Growth", mrr: 149, status: "Past Due", renews: "Oct 18, 2023" },
  { tenant: "Orbit Tutor", plan: "Starter", mrr: 49, status: "Trial", renews: "Oct 28, 2023" },
  { tenant: "Northwest University", plan: "Enterprise", mrr: 8900, status: "Active", renews: "Jan 01, 2024" },
];

function tone(s: string) {
  if (s === "Active") return "success" as const;
  if (s === "Past Due") return "danger" as const;
  return "info" as const;
}

export function AdminBillingPage() {
  return (
    <Box>
      <SaPageHeader
        eyebrow="Financial Management"
        title="Billing & Plans"
        description="Subscription plans, MRR, and tenant plan assignments."
        actions={
          <>
            <SaGhostButton onClick={() => notifyInfo("Plan editor coming soon")}>Edit Catalog</SaGhostButton>
            <SaPrimaryButton color="secondary" startIcon={<Add />} onClick={() => notifyInfo("Create plan coming soon")}>
              New Plan
            </SaPrimaryButton>
          </>
        }
      />

      <Grid container spacing={2} mb={2.5}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="MRR" value="$128.4K" hint="+6.2% MoM" icon={<TrendingUpOutlined />} tone="success" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="ARR" value="$1.54M" icon={<CreditCardOutlined />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="Paid Tenants" value="156" icon={<GroupsOutlined />} tone="success" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="Trials" value="18" icon={<WorkspacePremiumOutlined />} tone="warning" />
        </Grid>
      </Grid>

      <Grid container spacing={2} mb={2.5}>
        {PLANS.map((p) => (
          <Grid key={p.name} size={{ xs: 12, md: 4 }}>
            <SaCard title={p.name} subtitle={`${p.modules} · ${p.seats}`} action={<SaStatusChip label={p.price} tone="info" />}>
              <Typography variant="h4" fontWeight={800} color={p.color} my={1}>
                {p.tenants}
              </Typography>
              <Typography variant="body2" color="text.secondary" mb={1}>
                active subscriptions
              </Typography>
              <LinearProgress
                variant="determinate"
                value={Math.min(100, (p.tenants / 100) * 100)}
                sx={{ height: 8, borderRadius: 1, bgcolor: "#E2E8F0", "& .MuiLinearProgress-bar": { bgcolor: p.color } }}
              />
            </SaCard>
          </Grid>
        ))}
      </Grid>

      <Box sx={{ border: `1px solid ${saColors.border}`, borderRadius: 2, bgcolor: "#fff", overflow: "hidden" }}>
        <Stack p={2}>
          <Typography fontWeight={800}>Active Subscriptions</Typography>
          <Typography variant="body2" color="text.secondary">Tenant plan assignments</Typography>
        </Stack>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Tenant</TableCell>
              <TableCell>Plan</TableCell>
              <TableCell>MRR</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Renews</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {SUBS.map((s) => (
              <TableRow key={s.tenant} hover>
                <TableCell><Typography fontWeight={700}>{s.tenant}</Typography></TableCell>
                <TableCell>{s.plan}</TableCell>
                <TableCell><Typography fontWeight={800}>${s.mrr.toLocaleString()}</Typography></TableCell>
                <TableCell><SaStatusChip label={s.status} tone={tone(s.status)} /></TableCell>
                <TableCell><Typography variant="body2" color="text.secondary">{s.renews}</Typography></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>
    </Box>
  );
}
