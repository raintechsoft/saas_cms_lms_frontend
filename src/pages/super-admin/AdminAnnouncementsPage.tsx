import {
  Add,
  CampaignOutlined,
  NotificationsActiveOutlined,
  ScheduleSendOutlined,
  VisibilityOutlined,
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
  { id: "ANN-21", title: "Scheduled maintenance — Oct 28", audience: "All tenants", status: "Scheduled", live: false, reach: "—" },
  { id: "ANN-20", title: "New LMS quiz analytics", audience: "LMS tenants", status: "Published", live: true, reach: "842" },
  { id: "ANN-19", title: "Billing invoice format update", audience: "Paid plans", status: "Published", live: true, reach: "1.2K" },
  { id: "ANN-18", title: "Security: rotate API keys", audience: "Admins", status: "Draft", live: false, reach: "—" },
  { id: "ANN-17", title: "Diwali holiday support hours", audience: "All tenants", status: "Expired", live: false, reach: "2.4K" },
];

function statusTone(s: string) {
  if (s === "Published") return "success" as const;
  if (s === "Scheduled") return "info" as const;
  if (s === "Draft") return "warning" as const;
  return "neutral" as const;
}

export function AdminAnnouncementsPage() {
  const [rows, setRows] = useState(INITIAL);

  return (
    <Box>
      <SaPageHeader
        eyebrow="System"
        title="Announcements"
        description="Broadcast platform notices to tenants, admins, and reseller portals."
        actions={
          <>
            <SaGhostButton startIcon={<ScheduleSendOutlined />} onClick={() => notifyInfo("Schedule composer coming soon")}>
              Schedule
            </SaGhostButton>
            <SaPrimaryButton color="secondary" startIcon={<Add />} onClick={() => notifyInfo("Compose announcement coming soon")}>
              New Announcement
            </SaPrimaryButton>
          </>
        }
      />

      <Grid container spacing={2} mb={2.5}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="Active Banners" value="2" icon={<CampaignOutlined />} tone="success" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="Scheduled" value="1" icon={<ScheduleSendOutlined />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="Impressions (7d)" value="18.4K" icon={<VisibilityOutlined />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="Push Enabled" value="On" icon={<NotificationsActiveOutlined />} tone="success" />
        </Grid>
      </Grid>

      <Box sx={{ border: `1px solid ${saColors.border}`, borderRadius: 2, bgcolor: "#fff", overflow: "hidden", mb: 2.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" p={2}>
          <Box>
            <Typography fontWeight={800}>Announcement Registry</Typography>
            <Typography variant="body2" color="text.secondary">Banner & inbox messages</Typography>
          </Box>
        </Stack>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>ID</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Audience</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Reach</TableCell>
              <TableCell>Live Banner</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {rows.map((row, idx) => (
              <TableRow key={row.id} hover>
                <TableCell><Typography fontWeight={700} color={saColors.info}>{row.id}</Typography></TableCell>
                <TableCell><Typography fontWeight={600}>{row.title}</Typography></TableCell>
                <TableCell>{row.audience}</TableCell>
                <TableCell><SaStatusChip label={row.status} tone={statusTone(row.status)} /></TableCell>
                <TableCell>{row.reach}</TableCell>
                <TableCell>
                  <Switch
                    checked={row.live}
                    disabled={row.status === "Expired" || row.status === "Draft"}
                    onChange={() => {
                      setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, live: !r.live } : r)));
                      notifySuccess(row.live ? "Banner hidden" : "Banner live");
                    }}
                  />
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Box>

      <SaCard title="Delivery Channels" subtitle="Where announcements appear">
        <Typography variant="body2" color="text.secondary">
          In-app banner · Admin inbox · Reseller portal · Optional email digest for High priority notices.
        </Typography>
      </SaCard>
    </Box>
  );
}
