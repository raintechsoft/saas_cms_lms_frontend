import {
  BoltOutlined,
  FunctionsOutlined,
  PlayArrowOutlined,
  SpeedOutlined,
} from "@mui/icons-material";
import {
  Box,
  Stack,
  Switch,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { useState } from "react";
import { notifyInfo, notifySuccess } from "../../lib/notify";
import { saColors } from "../../theme/superAdminTheme";
import { SaCard, SaGhostButton, SaKpi, SaPageHeader, SaPrimaryButton, SaStatusChip } from "./saUi";

const INITIAL = [
  { name: "tenant-provision", runtime: "Node 20", invocations: "128K", p99: "42ms", status: true, region: "global" },
  { name: "webhook-dispatch", runtime: "Node 20", invocations: "890K", p99: "18ms", status: true, region: "us-east-1" },
  { name: "pdf-render", runtime: "Python 3.12", invocations: "44K", p99: "1.2s", status: true, region: "eu-west-1" },
  { name: "media-transcode", runtime: "Go 1.22", invocations: "12K", p99: "4.8s", status: false, region: "us-west-2" },
  { name: "ai-moderation", runtime: "Node 20", invocations: "210K", p99: "96ms", status: true, region: "global" },
];

export function AdminEdgeFunctionsPage() {
  const [rows, setRows] = useState(INITIAL);

  return (
    <Box>
      <SaPageHeader
        eyebrow="Infrastructure"
        title="Edge Functions"
        description="Serverless workers serving tenant APIs, webhooks, and media jobs."
        actions={
          <>
            <SaGhostButton startIcon={<PlayArrowOutlined />} onClick={() => notifyInfo("Dry-run suite started")}>
              Run Suite
            </SaGhostButton>
            <SaPrimaryButton color="secondary" startIcon={<FunctionsOutlined />} onClick={() => notifyInfo("Deploy function wizard coming soon")}>
              Deploy Function
            </SaPrimaryButton>
          </>
        }
      />

      <Grid container spacing={2} mb={2.5}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="Active Functions" value="24" hint="4 paused" icon={<FunctionsOutlined />} tone="success" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="Invocations (24h)" value="1.28M" hint="+12% vs yesterday" icon={<BoltOutlined />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="p99 Latency" value="96ms" hint="Within SLO" icon={<SpeedOutlined />} tone="success" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="Error Rate" value="0.04%" hint="Last 1h" icon={<BoltOutlined />} tone="warning" />
        </Grid>
      </Grid>

      <Box sx={{ border: `1px solid ${saColors.border}`, borderRadius: 2, bgcolor: "#fff", overflow: "hidden", mb: 2.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" p={2}>
          <Box>
            <Typography fontWeight={800}>Function Registry</Typography>
            <Typography variant="body2" color="text.secondary">Edge & region-pinned workers</Typography>
          </Box>
          <SaStatusChip label="RUNTIME HEALTHY" tone="success" />
        </Stack>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Function</TableCell>
              <TableCell>Runtime</TableCell>
              <TableCell>Region</TableCell>
              <TableCell>Invocations</TableCell>
              <TableCell>p99</TableCell>
              <TableCell>Enabled</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, idx) => (
              <TableRow key={row.name} hover>
                <TableCell><Typography fontWeight={700} color={saColors.info}>{row.name}</Typography></TableCell>
                <TableCell>{row.runtime}</TableCell>
                <TableCell>{row.region}</TableCell>
                <TableCell>{row.invocations}</TableCell>
                <TableCell>{row.p99}</TableCell>
                <TableCell>
                  <Switch
                    checked={row.status}
                    onChange={() => {
                      setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, status: !r.status } : r)));
                      notifySuccess(`${row.name} ${row.status ? "paused" : "enabled"}`);
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      <SaCard title="Cold Start Budget" subtitle="Warm pool policy">
        <Typography variant="body2" color="text.secondary">
          Keep 2 warm instances for tenant-provision and webhook-dispatch. Remaining functions scale from zero with 250ms budget.
        </Typography>
      </SaCard>
    </Box>
  );
}
