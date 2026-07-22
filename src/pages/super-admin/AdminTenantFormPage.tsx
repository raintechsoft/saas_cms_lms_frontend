import {
  BusinessOutlined,
  CheckCircle,
  GroupsOutlined,
  SchoolOutlined,
  SportsOutlined,
  StorefrontOutlined,
} from "@mui/icons-material";
import {
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  FormControlLabel,
  Stack,
  Step,
  StepLabel,
  Stepper,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../auth/AuthContext";
import { apiRequest } from "../../lib/api";
import { notifyError, notifySuccess } from "../../lib/notify";
import { saColors } from "../../theme/superAdminTheme";
import {
  DISTRIBUTION_MODELS,
  PRODUCT_MODES,
  type DistributionModel,
  type ProductMode,
  type ResellerRow,
  type TenantDetail,
  type TenantType,
} from "./types";

const STEPS = ["Type & Modules", "Plan & Limits", "Branding", "Review"];

const CUSTOMER_TYPES: Array<{
  type: TenantType | "RESELLER";
  label: string;
  description: string;
  icon: ReactNode;
}> = [
  { type: "SCHOOL", label: "School", description: "K-12 institutions", icon: <SchoolOutlined /> },
  { type: "COACHING_CENTER", label: "Coaching Center", description: "Training institutes", icon: <SportsOutlined /> },
  { type: "COLLEGE_UNIVERSITY", label: "College/University", description: "Higher education", icon: <BusinessOutlined /> },
  { type: "INDIVIDUAL", label: "Individual", description: "Tutors & creators", icon: <GroupsOutlined /> },
  { type: "RESELLER", label: "Reseller", description: "Channel partners", icon: <StorefrontOutlined /> },
];

const CMS_MODULES = [
  "Student Management",
  "Academics",
  "Examination",
  "Homework",
  "Fees",
  "Attendance",
  "HR",
  "Certificates",
];

const LMS_MODULES = [
  "Academic Calendar",
  "Live Classes",
  "Question Bank",
  "NCERT Content",
  "Lesson Planning",
  "AI Tutor",
  "Test Series",
];

const emptyForm = {
  name: "",
  slug: "",
  type: "SCHOOL" as TenantType,
  productMode: "BOTH" as ProductMode,
  distributionModel: "UNIVERSE_AI" as DistributionModel,
  resellerId: "",
  primaryColor: "#FF6B35",
  logoText: "",
  customDomain: "",
  adminEmail: "",
  adminFirstName: "",
  adminLastName: "",
  adminPassword: "",
};

export function AdminTenantFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();
  const { accessToken } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(emptyForm);
  const [resellers, setResellers] = useState<ResellerRow[]>([]);
  const [cmsOn, setCmsOn] = useState<Record<string, boolean>>(
    Object.fromEntries(CMS_MODULES.map((m) => [m, !["HR", "Certificates"].includes(m)])),
  );
  const [lmsOn, setLmsOn] = useState<Record<string, boolean>>(
    Object.fromEntries(LMS_MODULES.map((m) => [m, ["Academic Calendar", "NCERT Content"].includes(m)])),
  );
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    apiRequest<ResellerRow[]>("/platform/resellers", accessToken)
      .then(setResellers)
      .catch(() => setResellers([]));
  }, [accessToken]);

  useEffect(() => {
    if (!id) return;
    apiRequest<TenantDetail>(`/platform/tenants/${id}`, accessToken)
      .then((tenant) => {
        const branding = (tenant.branding ?? {}) as Record<string, unknown>;
        setForm({
          ...emptyForm,
          name: tenant.name,
          slug: tenant.slug,
          type: tenant.type,
          productMode: tenant.productMode,
          distributionModel: tenant.distributionModel,
          resellerId: tenant.reseller?.id ?? "",
          primaryColor: typeof branding.primaryColor === "string" ? branding.primaryColor : "#FF6B35",
          logoText: typeof branding.logoText === "string" ? branding.logoText : "",
          customDomain: typeof branding.customDomain === "string" ? branding.customDomain : "",
        });
      })
      .catch((cause) => notifyError(cause instanceof Error ? cause.message : "Failed to load tenant"));
  }, [id, accessToken]);

  function selectType(type: TenantType | "RESELLER") {
    if (type === "RESELLER") {
      notifyError("Create resellers from the Resellers module");
      return;
    }
    setForm((prev) => ({
      ...prev,
      type,
      productMode: type === "INDIVIDUAL" ? "LMS" : prev.productMode === "LMS" ? "BOTH" : prev.productMode,
    }));
  }

  function syncProductMode() {
    const cmsEnabled = Object.values(cmsOn).some(Boolean);
    const lmsEnabled = Object.values(lmsOn).some(Boolean);
    let productMode: ProductMode = "CMS";
    if (cmsEnabled && lmsEnabled) productMode = "BOTH";
    else if (lmsEnabled) productMode = "LMS";
    else productMode = "CMS";
    if (form.type === "INDIVIDUAL") productMode = "LMS";
    setForm((prev) => ({ ...prev, productMode }));
  }

  useEffect(() => {
    syncProductMode();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cmsOn, lmsOn, form.type]);

  async function submit(event?: FormEvent) {
    event?.preventDefault();
    setSubmitting(true);
    try {
      const payload = {
        name: form.name,
        slug: form.slug,
        type: form.type,
        productMode: form.productMode,
        distributionModel: form.distributionModel,
        resellerId: form.resellerId || null,
        branding: {
          primaryColor: form.primaryColor,
          logoText: form.logoText || form.name,
          customDomain: form.customDomain || undefined,
        },
        ...(isEdit
          ? {}
          : {
              adminEmail: form.adminEmail,
              adminFirstName: form.adminFirstName || "Admin",
              adminLastName: form.adminLastName || "User",
              adminPassword: form.adminPassword || undefined,
            }),
      };

      if (isEdit) {
        await apiRequest(`/platform/tenants/${id}`, accessToken, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
        notifySuccess("Tenant updated");
        navigate(`/admin/tenants/${id}`);
      } else {
        const created = await apiRequest<{ id: string; admin?: { temporaryPassword?: string } }>(
          "/platform/tenants",
          accessToken,
          {
            method: "POST",
            body: JSON.stringify(payload),
          },
        );
        notifySuccess(
          created.admin?.temporaryPassword
            ? `Tenant created. Temp password: ${created.admin.temporaryPassword}`
            : "Tenant created",
        );
        navigate(`/admin/tenants/${created.id}`);
      }
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Failed to save tenant");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Stack spacing={3} component="form" onSubmit={submit}>
      <Box>
        <Typography variant="overline" color="text.secondary">
          {isEdit ? "Edit Tenant" : "New Tenant"}
        </Typography>
        <Typography variant="h4" fontWeight={800}>
          {isEdit ? "Update tenant workspace" : "Provision a new tenant"}
        </Typography>
      </Box>

      {!isEdit && (
        <Stepper activeStep={step} alternativeLabel sx={{ mb: 1 }}>
          {STEPS.map((label) => (
            <Step key={label}>
              <StepLabel
                StepIconProps={{
                  sx: {
                    "&.Mui-active, &.Mui-completed": { color: saColors.navy },
                  },
                }}
              >
                {label}
              </StepLabel>
            </Step>
          ))}
        </Stepper>
      )}

      {(isEdit || step === 0) && (
        <Card elevation={0} sx={{ border: `1px solid ${saColors.border}` }}>
          <CardContent>
            <Typography fontWeight={700} mb={2}>
              Identity Details
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Tenant Name"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  required
                />
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <TextField
                  fullWidth
                  label="Unique Subdomain"
                  value={form.slug}
                  onChange={(e) =>
                    setForm((p) => ({
                      ...p,
                      slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""),
                    }))
                  }
                  required
                  disabled={isEdit}
                  InputProps={{
                    endAdornment: (
                      <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: "nowrap", ml: 1 }}>
                        .platform.saas
                      </Typography>
                    ),
                  }}
                />
              </Grid>
            </Grid>

            <Stack direction="row" justifyContent="space-between" alignItems="center" mt={3} mb={1.5}>
              <Typography fontWeight={700}>Select Customer Type</Typography>
              <Typography variant="caption" sx={{ bgcolor: "#DBEAFE", color: "#1D4ED8", px: 1, py: 0.5, borderRadius: 1, fontWeight: 700 }}>
                Affects pre-selected modules
              </Typography>
            </Stack>
            <Grid container spacing={1.5}>
              {CUSTOMER_TYPES.map((item) => {
                const selected = form.type === item.type;
                return (
                  <Grid key={item.label} size={{ xs: 12, sm: 6, md: 2.4 }}>
                    <Card
                      elevation={0}
                      sx={{
                        border: `2px solid ${selected ? saColors.navy : saColors.border}`,
                        bgcolor: selected ? "#F0F6FF" : "#fff",
                        height: "100%",
                      }}
                    >
                      <CardActionArea onClick={() => selectType(item.type)} sx={{ height: "100%", p: 1.5 }}>
                        <Stack spacing={1}>
                          <Stack direction="row" justifyContent="space-between">
                            <Box sx={{ color: selected ? saColors.navy : saColors.muted }}>{item.icon}</Box>
                            {selected && <CheckCircle sx={{ color: saColors.navy, fontSize: 18 }} />}
                          </Stack>
                          <Typography fontWeight={700} fontSize={14}>
                            {item.label}
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            {item.description}
                          </Typography>
                        </Stack>
                      </CardActionArea>
                    </Card>
                  </Grid>
                );
              })}
            </Grid>

            <Typography fontWeight={700} mt={3} mb={1.5}>
              Enable Modules
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined" sx={{ p: 2, bgcolor: "#FAFBFC" }}>
                  <Typography fontWeight={700} mb={0.5}>
                    Content Management System (CMS)
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                    Administrative and operational modules
                  </Typography>
                  {CMS_MODULES.map((mod) => (
                    <FormControlLabel
                      key={mod}
                      control={
                        <Switch
                          checked={!!cmsOn[mod]}
                          onChange={(e) => setCmsOn((p) => ({ ...p, [mod]: e.target.checked }))}
                          disabled={form.type === "INDIVIDUAL"}
                        />
                      }
                      label={<Typography variant="body2">{mod}</Typography>}
                      sx={{ display: "flex", justifyContent: "space-between", ml: 0, width: "100%" }}
                      labelPlacement="start"
                    />
                  ))}
                </Card>
              </Grid>
              <Grid size={{ xs: 12, md: 6 }}>
                <Card variant="outlined" sx={{ p: 2, bgcolor: "#FAFBFC" }}>
                  <Typography fontWeight={700} mb={0.5}>
                    Learning Management System (LMS)
                  </Typography>
                  <Typography variant="caption" color="text.secondary" display="block" mb={1}>
                    Digital learning and engagement tools
                  </Typography>
                  {LMS_MODULES.map((mod) => (
                    <FormControlLabel
                      key={mod}
                      control={
                        <Switch
                          checked={!!lmsOn[mod]}
                          onChange={(e) => setLmsOn((p) => ({ ...p, [mod]: e.target.checked }))}
                        />
                      }
                      label={<Typography variant="body2">{mod}</Typography>}
                      sx={{ display: "flex", justifyContent: "space-between", ml: 0, width: "100%" }}
                      labelPlacement="start"
                    />
                  ))}
                </Card>
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {(isEdit || step === 1) && (
        <Card elevation={0} sx={{ border: `1px solid ${saColors.border}` }}>
          <CardContent>
            <Typography fontWeight={700} mb={2}>
              Plan & Limits
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  select
                  fullWidth
                  label="Product Mode"
                  value={form.productMode}
                  onChange={(e) => setForm((p) => ({ ...p, productMode: e.target.value as ProductMode }))}
                  SelectProps={{ native: true }}
                >
                  {PRODUCT_MODES.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode}
                    </option>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  select
                  fullWidth
                  label="Distribution Model"
                  value={form.distributionModel}
                  onChange={(e) =>
                    setForm((p) => ({ ...p, distributionModel: e.target.value as DistributionModel }))
                  }
                  SelectProps={{ native: true }}
                >
                  {DISTRIBUTION_MODELS.map((mode) => (
                    <option key={mode} value={mode}>
                      {mode.replaceAll("_", " ")}
                    </option>
                  ))}
                </TextField>
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  select
                  fullWidth
                  label="Reseller"
                  value={form.resellerId}
                  onChange={(e) => setForm((p) => ({ ...p, resellerId: e.target.value }))}
                  SelectProps={{ native: true }}
                >
                  <option value="">None</option>
                  {resellers.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name}
                    </option>
                  ))}
                </TextField>
              </Grid>
              {!isEdit && (
                <>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      fullWidth
                      label="Admin Email"
                      type="email"
                      required
                      value={form.adminEmail}
                      onChange={(e) => setForm((p) => ({ ...p, adminEmail: e.target.value }))}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      fullWidth
                      label="Admin First Name"
                      value={form.adminFirstName}
                      onChange={(e) => setForm((p) => ({ ...p, adminFirstName: e.target.value }))}
                    />
                  </Grid>
                  <Grid size={{ xs: 12, md: 4 }}>
                    <TextField
                      fullWidth
                      label="Admin Password (optional)"
                      type="password"
                      value={form.adminPassword}
                      onChange={(e) => setForm((p) => ({ ...p, adminPassword: e.target.value }))}
                    />
                  </Grid>
                </>
              )}
            </Grid>
          </CardContent>
        </Card>
      )}

      {(isEdit || step === 2) && (
        <Card elevation={0} sx={{ border: `1px solid ${saColors.border}` }}>
          <CardContent>
            <Typography fontWeight={700} mb={2}>
              Branding & UI
            </Typography>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Primary Theme Color"
                  value={form.primaryColor}
                  onChange={(e) => setForm((p) => ({ ...p, primaryColor: e.target.value }))}
                  InputProps={{
                    startAdornment: (
                      <Box
                        sx={{
                          width: 22,
                          height: 22,
                          borderRadius: 1,
                          bgcolor: form.primaryColor,
                          mr: 1,
                          border: `1px solid ${saColors.border}`,
                        }}
                      />
                    ),
                  }}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Logo Text"
                  value={form.logoText}
                  onChange={(e) => setForm((p) => ({ ...p, logoText: e.target.value }))}
                />
              </Grid>
              <Grid size={{ xs: 12, md: 4 }}>
                <TextField
                  fullWidth
                  label="Custom Domain"
                  value={form.customDomain}
                  onChange={(e) => setForm((p) => ({ ...p, customDomain: e.target.value }))}
                />
              </Grid>
            </Grid>
          </CardContent>
        </Card>
      )}

      {(isEdit || step === 3) && (
        <Card elevation={0} sx={{ border: `1px solid ${saColors.border}` }}>
          <CardContent>
            <Typography fontWeight={700} mb={2}>
              Review
            </Typography>
            <Grid container spacing={2}>
              {[
                ["Name", form.name],
                ["Slug", form.slug],
                ["Type", form.type],
                ["Product Mode", form.productMode],
                ["Distribution", form.distributionModel],
                ["Primary Color", form.primaryColor],
              ].map(([label, value]) => (
                <Grid key={label} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Typography variant="caption" color="text.secondary">
                    {label}
                  </Typography>
                  <Typography fontWeight={700}>{value || "—"}</Typography>
                </Grid>
              ))}
            </Grid>
          </CardContent>
        </Card>
      )}

      <Stack direction="row" justifyContent="space-between" alignItems="center">
        {isEdit ? (
          <Button component={Link} to={`/admin/tenants/${id}`} color="inherit">
            Cancel
          </Button>
        ) : (
          <Button
            color="inherit"
            onClick={() => (step === 0 ? navigate("/admin/tenants") : setStep((s) => s - 1))}
          >
            {step === 0 ? "Cancel Wizard" : "Back"}
          </Button>
        )}
        <Stack direction="row" spacing={1} alignItems="center">
          {!isEdit && (
            <Typography variant="body2" color="text.secondary">
              Step {step + 1} of {STEPS.length}
            </Typography>
          )}
          {!isEdit && step < STEPS.length - 1 ? (
            <Button
              variant="contained"
              onClick={() => {
                if (step === 0 && (!form.name.trim() || !form.slug.trim())) {
                  notifyError("Enter tenant name and subdomain");
                  return;
                }
                setStep((s) => s + 1);
              }}
            >
              Continue →
            </Button>
          ) : (
            <Button type="submit" variant="contained" disabled={submitting}>
              {submitting ? "Saving…" : isEdit ? "Save Changes" : "Create Tenant"}
            </Button>
          )}
        </Stack>
      </Stack>
    </Stack>
  );
}
