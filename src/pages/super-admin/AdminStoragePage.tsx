import {
  CloudUploadOutlined,
  FolderOutlined,
  MoreVert,
  StorageOutlined,
  WarningAmberOutlined,
} from "@mui/icons-material";
import {
  Box,
  IconButton,
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

const BUCKETS = [
  { name: "tenant-assets-prod", region: "us-east-1", used: 812, quota: 1024, objects: "2.4M", status: "Healthy" },
  { name: "media-lms-prod", region: "us-east-1", used: 1480, quota: 2048, objects: "890K", status: "Healthy" },
  { name: "backups-daily", region: "eu-west-1", used: 920, quota: 1024, objects: "12.1K", status: "Warning" },
  { name: "audit-archive", region: "ap-south-1", used: 310, quota: 512, objects: "4.8M", status: "Healthy" },
  { name: "edge-cache-warm", region: "global", used: 88, quota: 256, objects: "1.1M", status: "Healthy" },
];

export function AdminStoragePage() {
  return (
    <Box>
      <SaPageHeader
        eyebrow="Infrastructure"
        title="Storage"
        description="Object storage capacity, buckets, and retention across regions."
        actions={
          <>
            <SaGhostButton onClick={() => notifyInfo("Lifecycle policies coming soon")}>Lifecycle Policies</SaGhostButton>
            <SaPrimaryButton color="secondary" startIcon={<CloudUploadOutlined />} onClick={() => notifyInfo("Create bucket wizard coming soon")}>
              Create Bucket
            </SaPrimaryButton>
          </>
        }
      />

      <Grid container spacing={2} mb={2.5}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="Total Capacity" value="4.8 TB" hint="Provisioned" icon={<StorageOutlined />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="Used Storage" value="3.6 TB" hint="75% utilized" icon={<FolderOutlined />} tone="warning" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="Active Buckets" value="18" hint="5 regions" icon={<CloudUploadOutlined />} tone="success" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="Quota Alerts" value="1" hint="backups-daily" icon={<WarningAmberOutlined />} tone="danger" />
        </Grid>
      </Grid>

      <Box sx={{ border: `1px solid ${saColors.border}`, borderRadius: 2, bgcolor: "#fff", overflow: "hidden", mb: 2.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" p={2}>
          <Box>
            <Typography fontWeight={800}>Bucket Registry</Typography>
            <Typography variant="body2" color="text.secondary">Primary object stores for tenant & media assets</Typography>
          </Box>
          <SaStatusChip label="SYNCED" tone="success" />
        </Stack>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Bucket</TableCell>
              <TableCell>Region</TableCell>
              <TableCell>Usage</TableCell>
              <TableCell>Objects</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {BUCKETS.map((b) => {
              const pct = Math.round((b.used / b.quota) * 100);
              return (
                <TableRow key={b.name} hover>
                  <TableCell><Typography fontWeight={700} color={saColors.info}>{b.name}</Typography></TableCell>
                  <TableCell>{b.region}</TableCell>
                  <TableCell sx={{ minWidth: 180 }}>
                    <Typography fontSize={13} fontWeight={700}>{b.used} / {b.quota} GB · {pct}%</Typography>
                    <LinearProgress variant="determinate" value={pct} color={pct >= 85 ? "warning" : "info"} sx={{ height: 6, borderRadius: 1, mt: 0.5 }} />
                  </TableCell>
                  <TableCell>{b.objects}</TableCell>
                  <TableCell>
                    <SaStatusChip label={b.status} tone={b.status === "Warning" ? "warning" : "success"} />
                  </TableCell>
                  <TableCell align="right">
                    <IconButton size="small" onClick={() => notifyInfo(`Bucket actions: ${b.name}`)}>
                      <MoreVert fontSize="small" />
                    </IconButton>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Box>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <SaCard title="Retention" subtitle="Default lifecycle">
            <Typography variant="body2" color="text.secondary">
              Hot storage 30 days → Warm 90 days → Cold archive 365 days. Audit archives retain 7 years for compliance.
            </Typography>
          </SaCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <SaCard title="CDN Edge Cache" subtitle="Global warm layer">
            <Typography variant="body2" color="text.secondary">
              Edge cache hit ratio 94.2% · Purge queue idle · Origin shield healthy in 8 PoPs.
            </Typography>
          </SaCard>
        </Grid>
      </Grid>
    </Box>
  );
}
