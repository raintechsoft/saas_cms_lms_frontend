import {
  AssessmentOutlined,
  DownloadOutlined,
  InsightsOutlined,
  PictureAsPdfOutlined,
  TableChartOutlined,
} from "@mui/icons-material";
import { Box, ListItemButton, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import { notifyInfo } from "../../lib/notify";
import { saColors } from "../../theme/superAdminTheme";
import { SaCard, SaGhostButton, SaKpi, SaPageHeader, SaPrimaryButton, SaStatusChip } from "./saUi";

const REPORTS = [
  { title: "Tenant Growth Summary", desc: "New, churned, and reactivated tenants by month", type: "PDF", tag: "Growth" },
  { title: "Revenue Recognition", desc: "Recognized MRR / ARR with deferred revenue bridge", type: "XLSX", tag: "Finance" },
  { title: "Module Adoption Matrix", desc: "CMS / LMS usage depth per tenant cohort", type: "PDF", tag: "Product" },
  { title: "Support SLA Compliance", desc: "Ticket response & resolution against SLAs", type: "CSV", tag: "Support" },
  { title: "Infrastructure Capacity", desc: "Node, storage, and edge utilization trends", type: "PDF", tag: "Infra" },
  { title: "Audit Completeness", desc: "Coverage of required compliance event classes", type: "XLSX", tag: "Compliance" },
];

export function AdminReportsPage() {
  return (
    <Box>
      <SaPageHeader
        eyebrow="System"
        title="Reports Hub"
        description="Generate, schedule, and export platform-wide operational reports."
        actions={
          <>
            <SaGhostButton startIcon={<DownloadOutlined />} onClick={() => notifyInfo("Bulk export coming soon")}>
              Bulk Export
            </SaGhostButton>
            <SaPrimaryButton color="secondary" startIcon={<AssessmentOutlined />} onClick={() => notifyInfo("Custom report builder coming soon")}>
              Build Report
            </SaPrimaryButton>
          </>
        }
      />

      <Grid container spacing={2} mb={2.5}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="Available Reports" value="24" icon={<AssessmentOutlined />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="Scheduled Jobs" value="8" icon={<InsightsOutlined />} tone="success" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="Exports (30d)" value="156" icon={<DownloadOutlined />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="Failed Jobs" value="1" icon={<TableChartOutlined />} tone="warning" />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        {REPORTS.map((r) => (
          <Grid key={r.title} size={{ xs: 12, md: 6, lg: 4 }}>
            <SaCard
              title={r.title}
              subtitle={r.desc}
              action={<SaStatusChip label={r.tag} tone="info" />}
            >
              <Stack direction="row" justifyContent="space-between" alignItems="center" mt={1}>
                <Stack direction="row" spacing={1} alignItems="center">
                  {r.type === "PDF" ? <PictureAsPdfOutlined fontSize="small" color="error" /> : <TableChartOutlined fontSize="small" color="info" />}
                  <Typography variant="body2" fontWeight={700}>{r.type}</Typography>
                </Stack>
                <SaPrimaryButton size="small" color="secondary" onClick={() => notifyInfo(`Generating ${r.title}`)}>
                  Generate
                </SaPrimaryButton>
              </Stack>
            </SaCard>
          </Grid>
        ))}
      </Grid>

      <Box mt={2.5}>
        <SaCard title="Recent Exports" subtitle="Last 5 completed jobs">
          {[
            "Revenue Recognition · Oct 2023 · a.rivera",
            "Tenant Growth Summary · Oct 2023 · system",
            "Module Adoption Matrix · Sep 2023 · m.chen",
          ].map((line) => (
            <ListItemButton
              key={line}
              onClick={() => notifyInfo("Download queued")}
              sx={{ borderBottom: `1px solid ${saColors.border}`, px: 0 }}
            >
              <Typography variant="body2" fontWeight={600}>{line}</Typography>
            </ListItemButton>
          ))}
        </SaCard>
      </Box>
    </Box>
  );
}
