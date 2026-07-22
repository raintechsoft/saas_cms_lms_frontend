import {
  Box,
  Button,
  Card,
  CircularProgress,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from "@mui/material";
import { useEffect, useState } from "react";
import { useAuth } from "../../auth/AuthContext";
import { apiRequest } from "../../lib/api";
import { notifyError } from "../../lib/notify";
import { useAppDispatch } from "../../store";
import { setAudit } from "../../store/slices/platformSlice";
import { saColors } from "../../theme/superAdminTheme";
import type { AuditRow, TenantRow } from "./types";

export function AdminAuditPage() {
  const { accessToken } = useAuth();
  const dispatch = useAppDispatch();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [tenantId, setTenantId] = useState("");
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [limit, setLimit] = useState("100");
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (tenantId) params.set("tenantId", tenantId);
      if (action.trim()) params.set("action", action.trim());
      if (actor.trim()) params.set("actor", actor.trim());
      if (from) params.set("from", new Date(from).toISOString());
      if (to) params.set("to", new Date(`${to}T23:59:59`).toISOString());
      params.set("limit", limit);
      const [nextRows, nextTenants] = await Promise.all([
        apiRequest<AuditRow[]>(`/platform/audit?${params}`, accessToken),
        apiRequest<TenantRow[]>("/platform/tenants", accessToken),
      ]);
      setRows(nextRows);
      dispatch(setAudit(nextRows));
      setTenants(nextTenants);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Failed to load audit trail");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  return (
    <Stack spacing={3}>
      <Box>
        <Typography variant="h4" fontWeight={800}>
          Audit Logs
        </Typography>
        <Typography color="text.secondary" mt={0.5}>
          Platform and tenant activity timeline for compliance and forensics.
        </Typography>
      </Box>

      <Card elevation={0} sx={{ border: `1px solid ${saColors.border}`, p: 2 }}>
        <Stack direction={{ xs: "column", md: "row" }} spacing={1.5} flexWrap="wrap" useFlexGap>
          <TextField select size="small" label="Tenant" value={tenantId} onChange={(e) => setTenantId(e.target.value)} sx={{ minWidth: 180 }}>
            <MenuItem value="">All tenants</MenuItem>
            {tenants.map((t) => (
              <MenuItem key={t.id} value={t.id}>
                {t.name}
              </MenuItem>
            ))}
          </TextField>
          <TextField size="small" label="Action" value={action} onChange={(e) => setAction(e.target.value)} />
          <TextField size="small" label="Actor" value={actor} onChange={(e) => setActor(e.target.value)} />
          <TextField size="small" type="date" label="From" InputLabelProps={{ shrink: true }} value={from} onChange={(e) => setFrom(e.target.value)} />
          <TextField size="small" type="date" label="To" InputLabelProps={{ shrink: true }} value={to} onChange={(e) => setTo(e.target.value)} />
          <TextField select size="small" label="Limit" value={limit} onChange={(e) => setLimit(e.target.value)} sx={{ minWidth: 100 }}>
            {["50", "100", "200", "500"].map((n) => (
              <MenuItem key={n} value={n}>
                {n}
              </MenuItem>
            ))}
          </TextField>
          <Button variant="contained" onClick={() => void load()}>
            Search
          </Button>
        </Stack>
      </Card>

      <Card elevation={0} sx={{ border: `1px solid ${saColors.border}` }}>
        {loading ? (
          <Box sx={{ py: 8, display: "grid", placeItems: "center" }}>
            <CircularProgress sx={{ color: saColors.orange }} />
          </Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>When</TableCell>
                <TableCell>Action</TableCell>
                <TableCell>Entity</TableCell>
                <TableCell>Tenant</TableCell>
                <TableCell>Actor</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {rows.map((row) => (
                <TableRow key={row.id} hover>
                  <TableCell>{new Date(row.createdAt).toLocaleString()}</TableCell>
                  <TableCell>
                    <Typography fontWeight={700}>{row.action}</Typography>
                  </TableCell>
                  <TableCell>{row.entityType}</TableCell>
                  <TableCell>{row.tenant ?? "platform"}</TableCell>
                  <TableCell>{row.actor ?? row.actorEmail ?? "system"}</TableCell>
                </TableRow>
              ))}
              {rows.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography textAlign="center" color="text.secondary" py={4}>
                      No audit events found.
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        )}
      </Card>
    </Stack>
  );
}
