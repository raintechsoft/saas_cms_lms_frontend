import { useRef, useState } from "react";
import { PhotoCameraOutlined } from "@mui/icons-material";
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  FormControlLabel,
  MenuItem,
  Switch,
  TextField,
} from "@mui/material";
import ExpandMoreIcon from "@mui/icons-material/ExpandMore";
import { notifyError, notifySuccess } from "../../lib/notify";
import { PARENT_BORDER, PARENT_PRIMARY, PARENT_PRIMARY_SUBTLE } from "./ParentPortalLayout";
import { useParentPortal } from "./ParentPortalContext";
import { PageHeader } from "./components/PageHeader";

const inputSx = {
  "& .MuiOutlinedInput-root": {
    borderRadius: "12px",
    fontSize: 13.5,
    "& fieldset": { borderColor: PARENT_BORDER },
    "&.Mui-focused fieldset": { borderColor: PARENT_PRIMARY },
  },
};

export function ParentSettingsPage() {
  const { parent, children } = useParentPortal();
  const photoRef = useRef<HTMLInputElement>(null);

  const [profile, setProfile] = useState({
    name: parent.name,
    phone: "+91 98765 12345",
    email: "rahul.sharma@email.com",
    photoName: "",
  });
  const [prefs, setPrefs] = useState({
    fees: true,
    attendance: true,
    homework: true,
    announcements: false,
  });
  const [language, setLanguage] = useState("en");
  const [password, setPassword] = useState({ current: "", next: "", confirm: "" });

  function saveProfile() {
    notifySuccess("Parent profile saved");
  }

  function savePrefs() {
    notifySuccess("Notification preferences saved");
  }

  function saveLanguage() {
    notifySuccess("Language preference saved");
  }

  function savePassword() {
    if (!password.current || !password.next) {
      notifyError("Please fill all password fields");
      return;
    }
    if (password.next !== password.confirm) {
      notifyError("New passwords do not match");
      return;
    }
    setPassword({ current: "", next: "", confirm: "" });
    notifySuccess("Password updated successfully");
  }

  return (
    <div>
      <PageHeader title="Settings" subtitle="Manage your profile, children, and preferences" />

      <div className="flex flex-col gap-3">
        <Accordion
          defaultExpanded
          disableGutters
          elevation={0}
          sx={{
            borderRadius: "20px !important",
            border: `1px solid ${PARENT_BORDER}`,
            boxShadow: "0 4px 18px rgba(28,27,60,0.04)",
            "&:before": { display: "none" },
            overflow: "hidden",
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <span className="text-[15px] font-bold text-[#1A1A2E]">Parent Profile</span>
          </AccordionSummary>
          <AccordionDetails>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
              <div className="flex flex-col items-center gap-2">
                <div
                  className="grid size-20 place-items-center rounded-full text-[22px] font-bold text-white"
                  style={{ background: PARENT_PRIMARY }}
                >
                  {profile.name
                    .split(" ")
                    .map((p) => p[0])
                    .join("")
                    .slice(0, 2)}
                </div>
                <input
                  ref={photoRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) setProfile((p) => ({ ...p, photoName: file.name }));
                  }}
                />
                <button
                  type="button"
                  onClick={() => photoRef.current?.click()}
                  className="inline-flex items-center gap-1 text-[12px] font-semibold"
                  style={{ color: PARENT_PRIMARY }}
                >
                  <PhotoCameraOutlined sx={{ fontSize: 16 }} />
                  Upload photo
                </button>
                {profile.photoName && (
                  <p className="max-w-[140px] truncate text-[11px] text-[#9CA3AF]">{profile.photoName}</p>
                )}
              </div>
              <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
                <TextField
                  label="Full name"
                  size="small"
                  fullWidth
                  value={profile.name}
                  onChange={(e) => setProfile((p) => ({ ...p, name: e.target.value }))}
                  sx={inputSx}
                />
                <TextField
                  label="Phone"
                  size="small"
                  fullWidth
                  value={profile.phone}
                  onChange={(e) => setProfile((p) => ({ ...p, phone: e.target.value }))}
                  sx={inputSx}
                />
                <TextField
                  label="Email"
                  size="small"
                  fullWidth
                  className="sm:col-span-2"
                  value={profile.email}
                  onChange={(e) => setProfile((p) => ({ ...p, email: e.target.value }))}
                  sx={inputSx}
                />
                <div className="sm:col-span-2">
                  <button
                    type="button"
                    onClick={saveProfile}
                    className="h-10 rounded-xl px-5 text-[13px] font-bold text-white"
                    style={{ background: PARENT_PRIMARY }}
                  >
                    Save profile
                  </button>
                </div>
              </div>
            </div>
          </AccordionDetails>
        </Accordion>

        <Accordion
          disableGutters
          elevation={0}
          sx={{
            borderRadius: "20px !important",
            border: `1px solid ${PARENT_BORDER}`,
            boxShadow: "0 4px 18px rgba(28,27,60,0.04)",
            "&:before": { display: "none" },
            overflow: "hidden",
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <span className="text-[15px] font-bold text-[#1A1A2E]">Linked Children</span>
          </AccordionSummary>
          <AccordionDetails>
            <ul className="flex flex-col gap-3">
              {children.map((child) => (
                <li
                  key={child.id}
                  className="flex items-center gap-3 rounded-xl border p-3"
                  style={{ borderColor: PARENT_BORDER }}
                >
                  <div
                    className="grid size-10 place-items-center rounded-full text-[12px] font-bold"
                    style={{ background: PARENT_PRIMARY_SUBTLE, color: PARENT_PRIMARY }}
                  >
                    {child.name
                      .split(" ")
                      .map((p) => p[0])
                      .join("")
                      .slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-[13.5px] font-bold text-[#1A1A2E]">{child.name}</p>
                    <p className="text-[12px] text-[#6B7280]">
                      {child.className} — Section {child.section}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </AccordionDetails>
        </Accordion>

        <Accordion
          disableGutters
          elevation={0}
          sx={{
            borderRadius: "20px !important",
            border: `1px solid ${PARENT_BORDER}`,
            boxShadow: "0 4px 18px rgba(28,27,60,0.04)",
            "&:before": { display: "none" },
            overflow: "hidden",
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <span className="text-[15px] font-bold text-[#1A1A2E]">Notification Preferences</span>
          </AccordionSummary>
          <AccordionDetails>
            <div className="flex flex-col gap-1">
              {(
                [
                  ["fees", "Fees"],
                  ["attendance", "Attendance"],
                  ["homework", "Homework"],
                  ["announcements", "Announcements"],
                ] as const
              ).map(([key, label]) => (
                <FormControlLabel
                  key={key}
                  control={
                    <Switch
                      checked={prefs[key]}
                      onChange={(_, checked) => setPrefs((p) => ({ ...p, [key]: checked }))}
                      sx={{
                        "& .MuiSwitch-switchBase.Mui-checked": { color: PARENT_PRIMARY },
                        "& .MuiSwitch-switchBase.Mui-checked + .MuiSwitch-track": {
                          backgroundColor: PARENT_PRIMARY,
                        },
                      }}
                    />
                  }
                  label={<span className="text-[13.5px] font-medium text-[#1A1A2E]">{label}</span>}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={savePrefs}
              className="mt-3 h-10 rounded-xl px-5 text-[13px] font-bold text-white"
              style={{ background: PARENT_PRIMARY }}
            >
              Save preferences
            </button>
          </AccordionDetails>
        </Accordion>

        <Accordion
          disableGutters
          elevation={0}
          sx={{
            borderRadius: "20px !important",
            border: `1px solid ${PARENT_BORDER}`,
            boxShadow: "0 4px 18px rgba(28,27,60,0.04)",
            "&:before": { display: "none" },
            overflow: "hidden",
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <span className="text-[15px] font-bold text-[#1A1A2E]">Language</span>
          </AccordionSummary>
          <AccordionDetails>
            <TextField
              select
              label="Preferred language"
              size="small"
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              sx={{ ...inputSx, minWidth: 220 }}
            >
              <MenuItem value="en">English</MenuItem>
              <MenuItem value="hi">Hindi</MenuItem>
              <MenuItem value="mr">Marathi</MenuItem>
            </TextField>
            <div className="mt-3">
              <button
                type="button"
                onClick={saveLanguage}
                className="h-10 rounded-xl px-5 text-[13px] font-bold text-white"
                style={{ background: PARENT_PRIMARY }}
              >
                Save language
              </button>
            </div>
          </AccordionDetails>
        </Accordion>

        <Accordion
          disableGutters
          elevation={0}
          sx={{
            borderRadius: "20px !important",
            border: `1px solid ${PARENT_BORDER}`,
            boxShadow: "0 4px 18px rgba(28,27,60,0.04)",
            "&:before": { display: "none" },
            overflow: "hidden",
          }}
        >
          <AccordionSummary expandIcon={<ExpandMoreIcon />}>
            <span className="text-[15px] font-bold text-[#1A1A2E]">Change Password</span>
          </AccordionSummary>
          <AccordionDetails>
            <div className="grid max-w-md grid-cols-1 gap-3">
              <TextField
                label="Current password"
                type="password"
                size="small"
                fullWidth
                value={password.current}
                onChange={(e) => setPassword((p) => ({ ...p, current: e.target.value }))}
                sx={inputSx}
              />
              <TextField
                label="New password"
                type="password"
                size="small"
                fullWidth
                value={password.next}
                onChange={(e) => setPassword((p) => ({ ...p, next: e.target.value }))}
                sx={inputSx}
              />
              <TextField
                label="Confirm new password"
                type="password"
                size="small"
                fullWidth
                value={password.confirm}
                onChange={(e) => setPassword((p) => ({ ...p, confirm: e.target.value }))}
                sx={inputSx}
              />
              <button
                type="button"
                onClick={savePassword}
                className="h-10 w-fit rounded-xl px-5 text-[13px] font-bold text-white"
                style={{ background: PARENT_PRIMARY }}
              >
                Update password
              </button>
            </div>
          </AccordionDetails>
        </Accordion>
      </div>
    </div>
  );
}
