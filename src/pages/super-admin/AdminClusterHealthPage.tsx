import {
  ArrowDownward,
  ArrowUpward,
  DnsOutlined,
  MoreVert,
  RefreshOutlined,
  ScheduleOutlined,
  SecurityOutlined,
} from "@mui/icons-material";
import {
  Box,
  IconButton,
  LinearProgress,
  ListItemButton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { useMemo, useState } from "react";
import { notifyInfo, notifySuccess } from "../../lib/notify";
import { saColors } from "../../theme/superAdminTheme";
import { SaCard, SaGhostButton, SaKpi, SaPageHeader, SaPrimaryButton, SaStatusChip } from "./saUi";

const NODES = [
  { id: "node-us-east-01", region: "us-east-1a", status: "Healthy", cpu: 28, mem: 54, beat: "2s ago" },
  { id: "node-us-east-02", region: "us-east-1b", status: "Healthy", cpu: 41, mem: 61, beat: "3s ago" },
  { id: "node-eu-west-01", region: "eu-west-1a", status: "Healthy", cpu: 33, mem: 48, beat: "2s ago" },
  { id: "node-ap-se-01", region: "ap-southeast-1", status: "Degraded", cpu: 88, mem: 79, beat: "8s ago" },
  { id: "node-ap-south-01", region: "ap-south-1a", status: "Healthy", cpu: 22, mem: 44, beat: "1s ago" },
  { id: "node-us-west-01", region: "us-west-2a", status: "Down", cpu: 0, mem: 0, beat: "4m ago" },
];

const EVENTS = [
  { at: "14:22:01", tone: "danger" as const, text: "Node-ASIA-001 heartbeat lost — failover engaged" },
  { at: "14:18:44", tone: "info" as const, text: "Autoscaler provisioned node-us-east-03" },
  { at: "14:05:12", tone: "success" as const, text: "Security patch rolled to eu-west cluster" },
  { at: "13:51:09", tone: "warning" as const, text: "CPU saturation warning on ap-southeast-1" },
];

function statusTone(status: string) {
  if (status === "Healthy") return "success" as const;
  if (status === "Degraded") return "warning" as const;
  return "danger" as const;
}

export function AdminClusterHealthPage() {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return NODES;
    return NODES.filter(
      (n) => n.id.includes(q) || n.region.includes(q) || n.status.toLowerCase().includes(q),
    );
  }, [search]);

  return (
    <Box>
      <SaPageHeader
        eyebrow="Infrastructure Monitor"
        title="Cluster Health"
        description="Real-time status of platform infrastructure nodes."
        actions={
          <>
            <SaGhostButton startIcon={<RefreshOutlined />} onClick={() => notifySuccess("Cluster metrics refreshed")}>
              Refresh Data
            </SaGhostButton>
            <SaPrimaryButton color="secondary" startIcon={<SecurityOutlined />} onClick={() => notifyInfo("Security audit queued")}>
              Security Audit
            </SaPrimaryButton>
          </>
        }
      />

      <Grid container spacing={2} mb={2.5}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="Nodes Online" value="12/12" hint="All regions · 100%" icon={<DnsOutlined />} tone="success" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="Avg CPU Load" value="34%" hint="Aggregate · -4.2%" icon={<ArrowDownward />} tone="success" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="Avg Memory" value="58%" hint="Utilized · +2.1%" icon={<ArrowUpward />} tone="warning" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="Uptime" value="99.98%" hint="Last 30d · +0.02%" icon={<ScheduleOutlined />} tone="success" />
        </Grid>
      </Grid>

      <Box sx={{ border: `1px solid ${saColors.border}`, borderRadius: 2, bgcolor: "#fff", overflow: "hidden", mb: 2.5 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} p={2} alignItems={{ md: "center" }}>
          <TextField
            size="small"
            placeholder="Search by Node ID, Region, or Status..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            sx={{ minWidth: 280 }}
          />
          <SaGhostButton onClick={() => notifyInfo("Advanced filters coming soon")}>Advanced Filters</SaGhostButton>
          <Box flex={1} />
          <Typography variant="body2" color="text.secondary" fontWeight={700}>
            Cluster ID · cls-prod-01
          </Typography>
        </Stack>
        <Stack direction="row" justifyContent="space-between" alignItems="center" px={2} pb={1}>
          <Box>
            <Typography fontWeight={800}>Node Registry</Typography>
            <Typography variant="body2" color="text.secondary">Live compute inventory across regions</Typography>
          </Box>
          <SaStatusChip label="LIVE STREAM" tone="success" />
        </Stack>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Node Identifier</TableCell>
              <TableCell>Region / Zone</TableCell>
              <TableCell>Health Status</TableCell>
              <TableCell>CPU Usage</TableCell>
              <TableCell>Memory Util</TableCell>
              <TableCell>Last Heartbeat</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {filtered.map((node) => (
              <TableRow key={node.id} hover>
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <DnsOutlined sx={{ fontSize: 18, color: saColors.info }} />
                    <Typography fontWeight={700} fontSize={13}>{node.id}</Typography>
                  </Stack>
                </TableCell>
                <TableCell>{node.region}</TableCell>
                <TableCell><SaStatusChip label={node.status} tone={statusTone(node.status)} /></TableCell>
                <TableCell sx={{ minWidth: 140 }}>
                  <Typography fontWeight={700} fontSize={13} color={node.cpu >= 80 ? saColors.danger : "inherit"}>
                    {node.cpu}%
                  </Typography>
                  <LinearProgress variant="determinate" value={node.cpu} sx={{ height: 6, borderRadius: 1, mt: 0.5 }} color={node.cpu >= 80 ? "error" : "info"} />
                </TableCell>
                <TableCell sx={{ minWidth: 140 }}>
                  <Typography fontWeight={700} fontSize={13}>{node.mem}%</Typography>
                  <LinearProgress variant="determinate" value={node.mem} sx={{ height: 6, borderRadius: 1, mt: 0.5 }} color="info" />
                </TableCell>
                <TableCell><Typography variant="body2" color="text.secondary">{node.beat}</Typography></TableCell>
                <TableCell align="right">
                  <IconButton size="small" onClick={() => notifyInfo(`Actions for ${node.id}`)}>
                    <MoreVert fontSize="small" />
                  </IconButton>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <Box px={2} py={1.5}>
          <Typography variant="body2" color="text.secondary">
            Showing {filtered.length} of 12 cluster nodes active
          </Typography>
        </Box>
      </Box>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 5 }}>
          <SaCard title="Quick Actions" subtitle="Operational runbooks">
            {[
              { title: "Restart Failed Nodes", desc: "Automated recovery sequence" },
              { title: "Scale Cluster", desc: "Provision new compute instances" },
              { title: "Configure Autoscaling", desc: "Edit threshold policies" },
            ].map((item) => (
              <ListItemButton
                key={item.title}
                onClick={() => notifyInfo(`${item.title} queued`)}
                sx={{ border: `1px solid ${saColors.border}`, borderRadius: 1.5, mb: 1 }}
              >
                <Box>
                  <Typography fontWeight={700}>{item.title}</Typography>
                  <Typography variant="body2" color="text.secondary">{item.desc}</Typography>
                </Box>
              </ListItemButton>
            ))}
          </SaCard>
        </Grid>
        <Grid size={{ xs: 12, md: 7 }}>
          <SaCard title="Recent Infrastructure Events" subtitle="Incident & change stream" action={
            <Typography component="button" onClick={() => notifyInfo("Open full logs")} sx={{ border: 0, bgcolor: "transparent", color: saColors.info, fontWeight: 700, cursor: "pointer" }}>
              View Full System Logs
            </Typography>
          }>
            <Stack spacing={1.5}>
              {EVENTS.map((ev) => (
                <Stack key={ev.at} direction="row" spacing={1.5} alignItems="flex-start">
                  <Typography variant="caption" color="text.secondary" minWidth={64} fontWeight={700}>{ev.at}</Typography>
                  <SaStatusChip label={ev.tone.toUpperCase()} tone={ev.tone === "info" ? "info" : ev.tone} />
                  <Typography variant="body2">{ev.text}</Typography>
                </Stack>
              ))}
            </Stack>
          </SaCard>
        </Grid>
      </Grid>
    </Box>
  );
}
