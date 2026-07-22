import {
  Add,
  SupportAgentOutlined,
  AccessTimeOutlined,
  CheckCircleOutline,
  PriorityHighOutlined,
} from "@mui/icons-material";
import {
  Avatar,
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
import { SaGhostButton, SaKpi, SaPageHeader, SaPrimaryButton, SaStatusChip } from "./saUi";

const TICKETS = [
  { id: "SUP-4412", subject: "SSO login loop on reseller portal", tenant: "Horizon Academy", priority: "High", status: "Open", agent: "Alex Rivera", age: "2h" },
  { id: "SUP-4411", subject: "Invoice PDF missing school logo", tenant: "Bright Minds", priority: "Medium", status: "In Progress", agent: "Maya Chen", age: "5h" },
  { id: "SUP-4408", subject: "Need LMS seats increase", tenant: "Vertex Institute", priority: "Low", status: "Waiting", agent: "Sam Patel", age: "1d" },
  { id: "SUP-4402", subject: "Attendance sync delay", tenant: "Northwest University", priority: "High", status: "Open", agent: "Alex Rivera", age: "1d" },
  { id: "SUP-4399", subject: "White-label domain SSL renew", tenant: "Orbit Tutor", priority: "Medium", status: "Resolved", agent: "Maya Chen", age: "2d" },
  { id: "SUP-4391", subject: "Export student roster CSV", tenant: "Stellar Learning", priority: "Low", status: "Resolved", agent: "Sam Patel", age: "3d" },
];

function priorityTone(p: string) {
  if (p === "High") return "danger" as const;
  if (p === "Medium") return "warning" as const;
  return "neutral" as const;
}

function statusTone(s: string) {
  if (s === "Resolved") return "success" as const;
  if (s === "Open") return "danger" as const;
  if (s === "Waiting") return "warning" as const;
  return "info" as const;
}

export function AdminSupportPage() {
  const [status, setStatus] = useState("All");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const filtered = useMemo(
    () => TICKETS.filter((t) => status === "All" || t.status === status),
    [status],
  );
  const pageRows = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box>
      <SaPageHeader
        eyebrow="System"
        title="Support Center"
        description="Platform support tickets across tenants and resellers."
        actions={
          <>
            <SaGhostButton onClick={() => notifyInfo("Knowledge base coming soon")}>Knowledge Base</SaGhostButton>
            <SaPrimaryButton color="secondary" startIcon={<Add />} onClick={() => notifyInfo("Create ticket coming soon")}>
              New Ticket
            </SaPrimaryButton>
          </>
        }
      />

      <Grid container spacing={2} mb={2.5}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="Open Tickets" value="18" icon={<SupportAgentOutlined />} tone="danger" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="Avg First Response" value="42m" icon={<AccessTimeOutlined />} tone="success" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="Resolved (7d)" value="64" icon={<CheckCircleOutline />} tone="success" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="SLA Breaches" value="2" icon={<PriorityHighOutlined />} tone="warning" />
        </Grid>
      </Grid>

      <Box sx={{ border: `1px solid ${saColors.border}`, borderRadius: 2, bgcolor: "#fff", overflow: "hidden" }}>
        <Stack direction="row" spacing={1.5} p={2}>
          <TextField select size="small" label="Status" value={status} onChange={(e) => { setStatus(e.target.value); setPage(0); }} sx={{ minWidth: 160 }}>
            {["All", "Open", "In Progress", "Waiting", "Resolved"].map((s) => (
              <MenuItem key={s} value={s}>{s}</MenuItem>
            ))}
          </TextField>
        </Stack>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Ticket</TableCell>
              <TableCell>Subject</TableCell>
              <TableCell>Tenant</TableCell>
              <TableCell>Priority</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Agent</TableCell>
              <TableCell>Age</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pageRows.map((t) => (
              <TableRow key={t.id} hover sx={{ cursor: "pointer" }} onClick={() => notifyInfo(`Open ${t.id}`)}>
                <TableCell><Typography fontWeight={700} color={saColors.info}>{t.id}</Typography></TableCell>
                <TableCell><Typography fontWeight={600}>{t.subject}</Typography></TableCell>
                <TableCell>{t.tenant}</TableCell>
                <TableCell><SaStatusChip label={t.priority} tone={priorityTone(t.priority)} /></TableCell>
                <TableCell><SaStatusChip label={t.status} tone={statusTone(t.status)} /></TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    <Avatar sx={{ width: 24, height: 24, fontSize: 11, bgcolor: saColors.navy }}>{t.agent[0]}</Avatar>
                    <Typography fontSize={13}>{t.agent}</Typography>
                  </Stack>
                </TableCell>
                <TableCell><Typography variant="body2" color="text.secondary">{t.age}</Typography></TableCell>
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
