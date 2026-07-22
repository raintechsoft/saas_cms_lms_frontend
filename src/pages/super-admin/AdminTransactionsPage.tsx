import {
  AccountBalanceWalletOutlined,
  CheckCircleOutline,
  DownloadOutlined,
  ErrorOutline,
  ReplayOutlined,
  CalendarMonthOutlined,
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
import { SaGhostButton, SaKpi, SaPageHeader, SaPrimaryButton, SaStatusChip } from "./saUi";

const ROWS = [
  { id: "TXN-88201", tenant: "Horizon Academy", amount: 12500, method: "Bank Transfer", status: "Success", at: "Oct 25, 2023, 02:45 PM" },
  { id: "TXN-88200", tenant: "Global Coaching Hub", amount: 3200, method: "Card", status: "Pending", at: "Oct 25, 2023, 01:12 PM" },
  { id: "TXN-88199", tenant: "Northwest University", amount: 8900, method: "UPI", status: "Success", at: "Oct 24, 2023, 11:08 AM" },
  { id: "TXN-88198", tenant: "Bright Minds School", amount: 1500, method: "Card", status: "Failed", at: "Oct 24, 2023, 09:41 AM" },
  { id: "TXN-88197", tenant: "Vertex Institute", amount: 4500, method: "Bank Transfer", status: "Refunded", at: "Oct 23, 2023, 04:20 PM" },
  { id: "TXN-88196", tenant: "Stellar Learning", amount: 6700, method: "Card", status: "Success", at: "Oct 23, 2023, 02:05 PM" },
  { id: "TXN-88195", tenant: "Nexus Systems", amount: 2100, method: "UPI", status: "Pending", at: "Oct 22, 2023, 08:33 PM" },
  { id: "TXN-88194", tenant: "Apex Coaching", amount: 980, method: "Card", status: "Failed", at: "Oct 22, 2023, 06:15 PM" },
  { id: "TXN-88193", tenant: "Summit College", amount: 11200, method: "Bank Transfer", status: "Success", at: "Oct 21, 2023, 10:02 AM" },
  { id: "TXN-88192", tenant: "Orbit Tutor", amount: 740, method: "UPI", status: "Success", at: "Oct 21, 2023, 09:18 AM" },
];

function tone(status: string) {
  if (status === "Success") return "success" as const;
  if (status === "Pending") return "warning" as const;
  if (status === "Failed") return "danger" as const;
  return "neutral" as const;
}

export function AdminTransactionsPage() {
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("All");
  const [method, setMethod] = useState("All");
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const filtered = useMemo(
    () =>
      ROWS.filter((row) => {
        const q = search.trim().toLowerCase();
        const matchQ = !q || row.id.toLowerCase().includes(q) || row.tenant.toLowerCase().includes(q);
        const matchS = status === "All" || row.status === status;
        const matchM = method === "All" || row.method === method;
        return matchQ && matchS && matchM;
      }),
    [search, status, method],
  );

  const pageRows = filtered.slice(page * rowsPerPage, page * rowsPerPage + rowsPerPage);

  return (
    <Box>
      <SaPageHeader
        eyebrow="Financial Management"
        title="Transactions"
        description="Platform-wide payment activity across all tenants."
        actions={
          <>
            <SaGhostButton startIcon={<CalendarMonthOutlined />} onClick={() => notifyInfo("Date range picker coming soon")}>
              Select Date Range
            </SaGhostButton>
            <SaPrimaryButton startIcon={<DownloadOutlined />} onClick={() => notifyInfo("CSV export coming soon")}>
              Export CSV
            </SaPrimaryButton>
          </>
        }
      />

      <Grid container spacing={2} mb={2.5}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="Total Revenue (30D)" value="$452,900" hint="Ledger reconciled" icon={<AccountBalanceWalletOutlined />} tone="success" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="Successful Payments" value="1,842" icon={<CheckCircleOutline />} tone="success" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="Failed Payments" value="24" icon={<ErrorOutline />} tone="danger" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="Refunds Issued" value="6" icon={<ReplayOutlined />} />
        </Grid>
      </Grid>

      <Box sx={{ border: `1px solid ${saColors.border}`, borderRadius: 2, bgcolor: "#fff", overflow: "hidden" }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} p={2} alignItems={{ md: "center" }}>
          <TextField size="small" placeholder="Search by tenant, transaction ID..." value={search} onChange={(e) => { setSearch(e.target.value); setPage(0); }} sx={{ minWidth: 260 }} />
          <TextField select size="small" label="Status" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ minWidth: 140 }}>
            {["All", "Success", "Pending", "Failed", "Refunded"].map((s) => (
              <MenuItem key={s} value={s}>{s === "All" ? "All Status" : s}</MenuItem>
            ))}
          </TextField>
          <TextField select size="small" label="Method" value={method} onChange={(e) => setMethod(e.target.value)} sx={{ minWidth: 140 }}>
            {["All", "Card", "Bank Transfer", "UPI"].map((s) => (
              <MenuItem key={s} value={s}>{s === "All" ? "All Methods" : s}</MenuItem>
            ))}
          </TextField>
          <Box flex={1} />
          <Typography variant="body2" color="text.secondary" fontWeight={700}>
            Records: {filtered.length}
          </Typography>
        </Stack>

        <Stack direction="row" justifyContent="space-between" alignItems="center" px={2} pb={1}>
          <Box>
            <Typography fontWeight={800}>Transaction Registry</Typography>
            <Typography variant="body2" color="text.secondary">Live payment stream across tenants</Typography>
          </Box>
          <SaStatusChip label="LIVE STREAM" tone="success" />
        </Stack>

        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Txn ID</TableCell>
              <TableCell>Tenant</TableCell>
              <TableCell>Amount</TableCell>
              <TableCell>Method</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Date & Time</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {pageRows.map((row) => (
              <TableRow key={row.id} hover>
                <TableCell><Typography color={saColors.info} fontWeight={700}>{row.id}</Typography></TableCell>
                <TableCell>{row.tenant}</TableCell>
                <TableCell><Typography fontWeight={800}>${row.amount.toLocaleString()}</Typography></TableCell>
                <TableCell>{row.method}</TableCell>
                <TableCell><SaStatusChip label={row.status} tone={tone(row.status)} /></TableCell>
                <TableCell><Typography variant="body2" color="text.secondary">{row.at}</Typography></TableCell>
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
