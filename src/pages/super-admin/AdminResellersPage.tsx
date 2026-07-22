import { Add, VisibilityOutlined } from "@mui/icons-material";
import {
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  CircularProgress,
  IconButton,
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
import { useEffect, useState, type FormEvent } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { apiRequest } from "../../lib/api";
import { notifyError, notifySuccess } from "../../lib/notify";
import { useAppDispatch } from "../../store";
import { setResellers as setResellersStore } from "../../store/slices/platformSlice";
import { saColors } from "../../theme/superAdminTheme";
import type { ResellerDetail, ResellerRow, TenantRow } from "./types";

export function AdminResellersPage() {
  const { accessToken } = useAuth();
  const dispatch = useAppDispatch();
  const [resellers, setResellers] = useState<ResellerRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    apiRequest<ResellerRow[]>("/platform/resellers", accessToken)
      .then((data) => {
        setResellers(data);
        dispatch(setResellersStore(data));
      })
      .catch((cause) => notifyError(cause instanceof Error ? cause.message : "Failed to load resellers"))
      .finally(() => setLoading(false));
  }, [accessToken, dispatch]);

  return (
    <Stack spacing={3}>
      <Stack direction={{ xs: "column", sm: "row" }} justifyContent="space-between" spacing={2}>
        <Box>
          <Typography variant="h4" fontWeight={800}>
            Resellers Management
          </Typography>
          <Typography color="text.secondary" mt={0.5}>
            Manage channel partners, commission structures, and white-label distributions.
          </Typography>
        </Box>
        <Button component={Link} to="/admin/resellers/new" variant="contained" startIcon={<Add />}>
          Add New Reseller
        </Button>
      </Stack>

      <Grid container spacing={2}>
        {[
          { label: "Total Partners", value: resellers.length },
          { label: "Active Sub-Tenants", value: resellers.reduce((sum, r) => sum + r.tenants, 0) },
          { label: "Partner Users", value: resellers.reduce((sum, r) => sum + r.users, 0) },
          { label: "White-Label Ready", value: resellers.length },
        ].map((kpi) => (
          <Grid key={kpi.label} size={{ xs: 12, sm: 6, md: 3 }}>
            <Card elevation={0} sx={{ border: `1px solid ${saColors.border}` }}>
              <CardContent>
                <Typography variant="overline" color="text.secondary">
                  {kpi.label}
                </Typography>
                <Typography variant="h4" fontWeight={800}>
                  {kpi.value}
                </Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      <Card elevation={0} sx={{ border: `1px solid ${saColors.border}` }}>
        {loading ? (
          <Box sx={{ py: 8, display: "grid", placeItems: "center" }}>
            <CircularProgress sx={{ color: saColors.orange }} />
          </Box>
        ) : (
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Reseller Name</TableCell>
                <TableCell>Status</TableCell>
                <TableCell>Sub-Tenants</TableCell>
                <TableCell>Users</TableCell>
                <TableCell>Created</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {resellers.map((item) => (
                <TableRow key={item.id} hover>
                  <TableCell>
                    <Typography fontWeight={700}>{item.name}</Typography>
                    <Typography variant="caption" color="text.secondary">
                      /{item.slug}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Chip size="small" label="ACTIVE" sx={{ bgcolor: "#DCFCE7", color: "#15803D", fontWeight: 800 }} />
                  </TableCell>
                  <TableCell>{item.tenants}</TableCell>
                  <TableCell>{item.users}</TableCell>
                  <TableCell>{new Date(item.createdAt).toLocaleDateString()}</TableCell>
                  <TableCell align="right">
                    <IconButton component={Link} to={`/admin/resellers/${item.id}`} size="small">
                      <VisibilityOutlined fontSize="small" />
                    </IconButton>
                    <Button component={Link} to={`/admin/resellers/${item.id}/edit`} size="small">
                      Edit
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
              {resellers.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6}>
                    <Typography textAlign="center" color="text.secondary" py={4}>
                      No resellers yet.
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

export function AdminResellerFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const [form, setForm] = useState({
    name: "",
    slug: "",
    primaryColor: "#FF6B35",
    logoText: "",
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!id) return;
    apiRequest<ResellerDetail>(`/platform/resellers/${id}`, accessToken)
      .then((data) => {
        const branding = (data.branding ?? {}) as Record<string, unknown>;
        setForm({
          name: data.name,
          slug: data.slug,
          primaryColor: typeof branding.primaryColor === "string" ? branding.primaryColor : "#FF6B35",
          logoText: typeof branding.logoText === "string" ? branding.logoText : "",
        });
      })
      .catch((cause) => notifyError(cause instanceof Error ? cause.message : "Failed to load reseller"));
  }, [id, accessToken]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        slug: form.slug,
        branding: { primaryColor: form.primaryColor, logoText: form.logoText || form.name },
      };
      if (isEdit) {
        await apiRequest(`/platform/resellers/${id}`, accessToken, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        notifySuccess("Reseller updated");
        navigate(`/admin/resellers/${id}`);
      } else {
        const created = await apiRequest<{ id: string }>("/platform/resellers", accessToken, {
          method: "POST",
          body: JSON.stringify(payload),
        });
        notifySuccess("Reseller created");
        navigate(`/admin/resellers/${created.id}`);
      }
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Failed to save reseller");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Stack spacing={3} component="form" onSubmit={submit} maxWidth={720}>
      <Typography variant="h4" fontWeight={800}>
        {isEdit ? "Edit Reseller" : "New Reseller"}
      </Typography>
      <Card elevation={0} sx={{ border: `1px solid ${saColors.border}`, p: 2.5 }}>
        <Stack spacing={2}>
          <Box
            component="div"
            sx={{ display: "grid", gap: 2 }}
          >
            {/* fields */}
          </Box>
          <TextField
            label="Name"
            required
            value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
          />
          <TextField
            label="Slug"
            required
            disabled={isEdit}
            value={form.slug}
            onChange={(e) =>
              setForm((p) => ({ ...p, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))
            }
          />
          <TextField
            label="Primary Color"
            value={form.primaryColor}
            onChange={(e) => setForm((p) => ({ ...p, primaryColor: e.target.value }))}
          />
          <TextField
            label="Logo Text"
            value={form.logoText}
            onChange={(e) => setForm((p) => ({ ...p, logoText: e.target.value }))}
          />
          <Stack direction="row" spacing={1}>
            <Button component={Link} to="/admin/resellers" color="inherit">
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? "Saving…" : "Save"}
            </Button>
          </Stack>
        </Stack>
      </Card>
    </Stack>
  );
}

export function AdminResellerDetailPage() {
  const { id } = useParams();
  const { accessToken } = useAuth();
  const [reseller, setReseller] = useState<ResellerDetail | null>(null);
  const [allTenants, setAllTenants] = useState<TenantRow[]>([]);
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      apiRequest<ResellerDetail>(`/platform/resellers/${id}`, accessToken),
      apiRequest<TenantRow[]>("/platform/tenants", accessToken),
    ])
      .then(([detail, tenants]) => {
        setReseller(detail);
        setAllTenants(tenants);
        setSelected(detail.tenants.map((t) => t.id));
      })
      .catch((cause) => notifyError(cause instanceof Error ? cause.message : "Failed to load reseller"));
  }, [id, accessToken]);

  async function saveTenants() {
    if (!id) return;
    try {
      await apiRequest(`/platform/resellers/${id}/tenants`, accessToken, {
        method: "PUT",
        body: JSON.stringify({ tenantIds: selected }),
      });
      notifySuccess("Assigned tenants updated");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Failed to update tenants");
    }
  }

  if (!reseller) {
    return (
      <Box sx={{ py: 10, display: "grid", placeItems: "center" }}>
        <CircularProgress sx={{ color: saColors.orange }} />
      </Box>
    );
  }

  return (
    <Stack spacing={3}>
      <Stack direction="row" justifyContent="space-between" alignItems="center">
        <Box>
          <Typography variant="h4" fontWeight={800}>
            {reseller.name}
          </Typography>
          <Typography color="text.secondary">/{reseller.slug}</Typography>
        </Box>
        <Button component={Link} to={`/admin/resellers/${reseller.id}/edit`} variant="outlined" color="inherit">
          Edit
        </Button>
      </Stack>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card elevation={0} sx={{ border: `1px solid ${saColors.border}` }}>
            <CardContent>
              <Typography variant="overline">Tenants</Typography>
              <Typography variant="h4" fontWeight={800}>
                {reseller.tenantCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Card elevation={0} sx={{ border: `1px solid ${saColors.border}` }}>
            <CardContent>
              <Typography variant="overline">Users</Typography>
              <Typography variant="h4" fontWeight={800}>
                {reseller.userCount}
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      <Card elevation={0} sx={{ border: `1px solid ${saColors.border}`, p: 2 }}>
        <Typography fontWeight={700} mb={1}>
          Assign Tenants
        </Typography>
        <Stack spacing={1} maxHeight={320} overflow="auto" mb={2}>
          {allTenants.map((t) => {
            const checked = selected.includes(t.id);
            return (
              <Chip
                key={t.id}
                label={t.name}
                color={checked ? "primary" : "default"}
                variant={checked ? "filled" : "outlined"}
                onClick={() =>
                  setSelected((prev) => (checked ? prev.filter((x) => x !== t.id) : [...prev, t.id]))
                }
                sx={{ justifyContent: "flex-start" }}
              />
            );
          })}
        </Stack>
        <Button variant="contained" onClick={() => void saveTenants()}>
          Save Assignments
        </Button>
      </Card>
    </Stack>
  );
}
