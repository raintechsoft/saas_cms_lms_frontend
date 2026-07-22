import {
  CheckCircleOutline,
  ErrorOutline,
  FilterList,
  TerminalOutlined,
} from "@mui/icons-material";
import {
  Box,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TablePagination,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { useMemo, useState } from "react";
import { notifyInfo } from "../../lib/notify";
import { saColors } from "../../theme/superAdminTheme";
import { SaGhostButton, SaKpi, SaPageHeader, SaStatusChip } from "./saUi";

const LOGS = [
  { id: "dep-9912", env: "production", service: "api-gateway", status: "Success", by: "ci-bot", at: "Oct 25, 2023 · 14:22", msg: "Rollout v4.12.0 completed" },
  { id: "dep-9911", env: "production", service: "worker-queue", status: "Success", by: "ci-bot", at: "Oct 25, 2023 · 14:18", msg: "Canary promoted 100%" },
  { id: "dep-9910", env: "staging", service: "web-admin", status: "Failed", by: "a.rivera", at: "Oct 25, 2023 · 13:05", msg: "Health check timeout on /ready" },
  { id: "dep-9909", env: "production", service: "edge-cdn", status: "Success", by: "ci-bot", at: "Oct 24, 2023 · 22:41", msg: "Cache purge + config sync" },
  { id: "dep-9908", env: "staging", service: "api-gateway", status: "Success", by: "m.chen", at: "Oct 24, 2023 · 18:12", msg: "Feature flag: billing-v2" },
  { id: "dep-9907", env: "production", service: "db-migrator", status: "Warning", by: "ci-bot", at: "Oct 24, 2023 · 11:02", msg: "Migration took 4m 12s (SLA 3m)" },
  { id: "dep-9906", env: "production", service: "media-pipeline", status: "Success", by: "ci-bot", at: "Oct 23, 2023 · 09:44", msg: "Image v4.11.8 live" },
  { id: "dep-9905", env: "staging", service: "ai-moderation", status: "Failed", by: "s.patel", at: "Oct 23, 2023 · 08:01", msg: "Model artifact missing" },
];

function tone(status: string) {
  if (status === "Success") return "success" as const;
  if (status === "Failed") return "danger" as const;
  return "warning" as const;
}

export function AdminDeploymentLogsPage() {
  const [env, setEnv] = useState("All");
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(8);

  const filtered = useMemo(
    () =>
      LOGS.filter((row) => {
        const matchE = env === "All" || row.env === env;
        const matchS = status === "All" || row.status === status;
        return matchE && matchS;
      }),
    [env, status],
  );

  const pageRows = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box>
      <SaPageHeader
        eyebrow="Infrastructure"
        title="Deployment Logs"
        description="CI/CD rollouts, canaries, and migration history across environments."
        actions={
          <SaGhostButton startIcon={<FilterList />} onClick={() => notifyInfo("Saved filters coming soon")}>
            Saved Filters
          </SaGhostButton>
        }
      />

      <Grid container spacing={2} mb={2.5}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="Deploys (7d)" value="48" icon={<TerminalOutlined />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="Success Rate" value="94%" icon={<CheckCircleOutline />} tone="success" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="Failed" value="3" icon={<ErrorOutline />} tone="danger" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="Avg Duration" value="3m 42s" icon={<TerminalOutlined />} />
        </Grid>
      </Grid>

      <Box sx={{ border: `1px solid ${saColors.border}`, borderRadius: 2, bgcolor: "#fff", overflow: "hidden" }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} p={2}>
          <TextField select size="small" label="Environment" value={env} onChange={(e) => { setEnv(e.target.value); setPage(0); }} sx={{ minWidth: 160 }}>
            {["All", "production", "staging"].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
          </TextField>
          <TextField select size="small" label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} sx={{ minWidth: 140 }}>
            {["All", "Success", "Failed", "Warning"].map((v) => <MenuItem key={v} value={v}>{v}</MenuItem>)}
          </TextField>
        </Stack>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Deploy ID</TableCell>
              <TableCell>Environment</TableCell>
              <TableCell>Service</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Actor</TableCell>
              <TableCell>Timestamp</TableCell>
              <TableCell>Message</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pageRows.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell><Typography fontWeight={700} color={saColors.info}>{row.id}</Typography></TableCell>
                <TableCell><SaStatusChip label={row.env} tone="neutral" /></TableCell>
                <TableCell>{row.service}</TableCell>
                <TableCell><SaStatusChip label={row.status} tone={tone(row.status)} /></TableCell>
                <TableCell>{row.by}</TableCell>
                <TableCell><Typography variant="body2" color="text.secondary">{row.at}</Typography></TableCell>
                <TableCell><Typography variant="body2">{row.msg}</Typography></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <TablePagination
          component="div"
          count={filtered.length}
          page={page}
          onPageChange={(_, p) => setPage(p)}
          rowsPerPage={rowsPerPage}
          onRowsPerPageChange={(e) => { setRowsPerPage(parseInt(e.target.value, 10)); setPage(0); }}
        />
      </Box>
    </Box>
  );
}
