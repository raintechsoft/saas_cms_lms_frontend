import {
  AccountBalanceOutlined,
  CreditCardOutlined,
  LinkOutlined,
  SecurityOutlined,
} from "@mui/icons-material";
import {
  Box,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from "@mui/material";
import Grid from "@mui/material/Grid2";
import { useState } from "react";
import { notifySuccess } from "../../lib/notify";
import { SaCard, SaGhostButton, SaKpi, SaPageHeader, SaPrimaryButton, SaStatusChip } from "./saUi";

export function AdminPaymentGatewayPage() {
  const [stripeLive, setStripeLive] = useState(true);
  const [razorpayLive, setRazorpayLive] = useState(true);
  const [webhookUrl] = useState("https://api.saas.local/webhooks/payments");

  return (
    <Box>
      <SaPageHeader
        eyebrow="System"
        title="Payment Gateway"
        description="Configure processors, webhooks, and settlement preferences."
        actions={
          <>
            <SaGhostButton startIcon={<SecurityOutlined />} onClick={() => notifySuccess("Keys rotated (demo)")}>
              Rotate Keys
            </SaGhostButton>
            <SaPrimaryButton color="secondary" onClick={() => notifySuccess("Gateway settings saved")}>
              Save Changes
            </SaPrimaryButton>
          </>
        }
      />

      <Grid container spacing={2} mb={2.5}>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="Primary Processor" value="Stripe" icon={<CreditCardOutlined />} tone="success" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="Secondary" value="Razorpay" icon={<AccountBalanceOutlined />} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="Webhook Success" value="99.7%" icon={<LinkOutlined />} tone="success" />
        </Grid>
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <SaKpi label="Mode" value="Live" icon={<SecurityOutlined />} tone="warning" />
        </Grid>
      </Grid>

      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}>
          <SaCard
            title="Stripe"
            subtitle="Cards · bank transfers · wallets"
            action={<SaStatusChip label={stripeLive ? "LIVE" : "TEST"} tone={stripeLive ? "success" : "warning"} />}
          >
            <Stack spacing={2}>
              <TextField size="small" label="Publishable key" defaultValue="pk_live_••••••••••••4521" fullWidth />
              <TextField size="small" label="Secret key" type="password" defaultValue="sk_live_••••••••" fullWidth />
              <FormControlLabel
                control={<Switch checked={stripeLive} onChange={(e) => setStripeLive(e.target.checked)} />}
                label="Live mode"
              />
            </Stack>
          </SaCard>
        </Grid>
        <Grid size={{ xs: 12, md: 6 }}>
          <SaCard
            title="Razorpay"
            subtitle="UPI · netbanking · cards (IN)"
            action={<SaStatusChip label={razorpayLive ? "LIVE" : "TEST"} tone={razorpayLive ? "success" : "warning"} />}
          >
            <Stack spacing={2}>
              <TextField size="small" label="Key ID" defaultValue="rzp_live_••••••••" fullWidth />
              <TextField size="small" label="Key Secret" type="password" defaultValue="••••••••••••" fullWidth />
              <FormControlLabel
                control={<Switch checked={razorpayLive} onChange={(e) => setRazorpayLive(e.target.checked)} />}
                label="Live mode"
              />
            </Stack>
          </SaCard>
        </Grid>
        <Grid size={{ xs: 12 }}>
          <SaCard title="Webhooks" subtitle="Payment lifecycle events">
            <Stack spacing={2} maxWidth={640}>
              <TextField size="small" label="Endpoint URL" value={webhookUrl} fullWidth InputProps={{ readOnly: true }} />
              <Typography variant="body2" color="text.secondary">
                Events: payment.succeeded · payment.failed · refund.created · subscription.updated
              </Typography>
            </Stack>
          </SaCard>
        </Grid>
      </Grid>
    </Box>
  );
}
