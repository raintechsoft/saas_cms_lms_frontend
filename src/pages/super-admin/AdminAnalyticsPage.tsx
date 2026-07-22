import {
  DownloadOutlined,
  InsightsOutlined,
  TrendingUpOutlined,
} from "@mui/icons-material";
import { Box, Stack, Typography } from "@mui/material";
import Grid from "@mui/material/Grid2";
import type { ApexOptions } from "apexcharts";
import Chart from "react-apexcharts";
import { notifyInfo } from "../../lib/notify";
import { saColors } from "../../theme/superAdminTheme";
import { SaCard, SaGhostButton, SaKpi, SaPageHeader, SaPrimaryButton } from "./saUi";

const areaOpts: ApexOptions = {
  chart: { type: "area", toolbar: { show: false }, zoom: { enabled: false } },
  colors: [saColors.orange, saColors.navy],
  dataLabels: { enabled: false },
  stroke: { curve: "smooth", width: 2 },
  fill: { type: "gradient", gradient: { opacityFrom: 0.35, opacityTo: 0.05 } },
  grid: { borderColor: saColors.border },
  xaxis: { categories: ["Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct"] },
  legend: { position: "top" },
};

const barOpts: ApexOptions = {
  chart: { type: "bar", toolbar: { show: false } },
  colors: [saColors.info],
  plotOptions: { bar: { borderRadius: 4, columnWidth: "45%" } },
  dataLabels: { enabled: false },
  grid: { borderColor: saColors.border },
  xaxis: { categories: ["CMS", "LMS", "Both", "Trial", "Suspended"] },
};

const donutOpts: ApexOptions = {
  chart: { type: "donut" },
  labels: ["Organic", "Reseller", "White-label"],
  colors: [saColors.navy, saColors.orange, saColors.info],
  legend: { position: "bottom" },
  dataLabels: { enabled: false },
};

export function AdminAnalyticsPage() {
  return (
    <Box>
      <SaPageHeader
        eyebrow="Infrastructure"
        title="Advanced Analytics"
        description="Platform growth, adoption, and revenue depth beyond the command center."
        actions={
          <>
            <SaGhostButton startIcon={<DownloadOutlined />} onClick={() => notifyInfo("Export analytics coming soon")}>
              Export
            </SaGhostButton>
            <SaPrimaryButton color="secondary" startIcon={<InsightsOutlined />} onClick={() => notifyInfo("Saved views coming soon")}>
              Saved Views
            </SaPrimaryButton>
          </>
        }
      />

      <Grid container spacing={2} mb={2.5}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="Active Tenants" value="312" hint="+18 this month" icon={<TrendingUpOutlined />} tone="success" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="MAU (platform)" value="48.2K" hint="+4.1%" icon={<InsightsOutlined />} tone="success" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="Net Revenue Retention" value="108%" hint="Last 12m" icon={<TrendingUpOutlined />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="Churn (logo)" value="1.8%" hint="Trailing 90d" icon={<InsightsOutlined />} tone="warning" />
        </Grid>
      </Grid>

      <Grid container spacing={2} mb={2.5}>
        <Grid size={{ xs: 12, lg: 8 }}>
          <SaCard title="Tenant & MAU Trend" subtitle="Last 7 months">
            <Chart
              type="area"
              height={280}
              options={areaOpts}
              series={[
                { name: "Tenants", data: [210, 228, 245, 268, 285, 298, 312] },
                { name: "MAU (k)", data: [32, 35, 38, 41, 43, 46, 48] },
              ]}
            />
          </SaCard>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <SaCard title="Acquisition Mix" subtitle="Current book">
            <Chart type="donut" height={280} options={donutOpts} series={[54, 32, 14]} />
          </SaCard>
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 7 }}>
          <SaCard title="Product Mode Distribution" subtitle="Tenant count by mode">
            <Chart type="bar" height={260} options={barOpts} series={[{ name: "Tenants", data: [118, 74, 86, 18, 16] }]} />
          </SaCard>
        </Grid>
        <Grid size={{ xs: 12, md: 5 }}>
          <SaCard title="Cohort Highlights" subtitle="October snapshot">
            <Stack spacing={1.5}>
              {[
                ["Activation rate (D7)", "72%"],
                ["LMS seat utilization", "61%"],
                ["Avg modules / tenant", "4.2"],
                ["Support tickets / 100 tenants", "6.1"],
              ].map(([k, v]) => (
                <Stack key={k} direction="row" justifyContent="space-between">
                  <Typography variant="body2" color="text.secondary">{k}</Typography>
                  <Typography fontWeight={800}>{v}</Typography>
                </Stack>
              ))}
            </Stack>
          </SaCard>
        </Grid>
      </Grid>
    </Box>
  );
}
