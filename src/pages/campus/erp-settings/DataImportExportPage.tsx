import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import {
  AddOutlined,
  CheckCircleOutline,
  CloudUploadOutlined,
  DescriptionOutlined,
  DownloadOutlined,
  ErrorOutline,
  HelpOutlineOutlined,
  HistoryOutlined,
  InfoOutlined,
  MenuBookOutlined,
  PeopleOutline,
  PersonOutline,
  PictureAsPdfOutlined,
  SchoolOutlined,
  TableChartOutlined,
  VisibilityOutlined,
} from "@mui/icons-material";
import { useOutletContext } from "react-router-dom";
import { useAuth } from "../../../auth/AuthContext";
import { API_URL, apiRequest } from "../../../lib/api";
import { notifyError, notifySuccess } from "../../../lib/notify";

type OutletCtx = { activeLabel?: string };

type ModuleKey =
  | "students"
  | "staff"
  | "parents"
  | "classes"
  | "subjects"
  | "fees"
  | "attendance"
  | "exams"
  | "homework"
  | "transport"
  | "hostel"
  | "library";

type ExportFormat = "XLSX" | "CSV" | "PDF" | "JSON";

type Setup = {
  modules: Array<{
    key: ModuleKey;
    label: string;
    description: string;
    fields: Array<{ key: string; label: string; required?: boolean }>;
  }>;
  exportTargets: Array<{ key: string; label: string; description: string }>;
  exportModules: Array<{
    key: ModuleKey;
    label: string;
    description: string;
    recordCount: number;
  }>;
  exportFormats: Array<{ key: ExportFormat; label: string; description: string }>;
  filterOptions: {
    sessions: Array<{ id: string; label: string; isCurrent: boolean }>;
    classes: Array<{ id: string; label: string }>;
    statuses: Array<{ id: string; label: string }>;
  };
  history: Array<{
    id: string;
    moduleKey: string;
    moduleLabel: string;
    fileName: string;
    status: string;
    statusLabel: string;
    totalRows: number;
    successRows: number;
    failedRows: number;
    errorMessage: string | null;
    createdAtLabel: string;
  }>;
  exportHistory: Array<{
    id: string;
    fileName: string;
    format: string;
    status: string;
    statusLabel: string;
    moduleKeys: string[];
    moduleLabel: string;
    totalRecords: number;
    estimatedSizeKb: number;
    errorMessage: string | null;
    createdAtLabel: string;
  }>;
  optionsDefaults: {
    hasHeaders: boolean;
    skipBlankRows: boolean;
    duplicateMode: "SKIP" | "UPDATE" | "REPLACE";
    encoding: string;
  };
  exportDefaults: {
    format: ExportFormat;
    includeHeaders: boolean;
    includeRelated: boolean;
    activeOnly: boolean;
    compressZip: boolean;
    encryptPassword: boolean;
  };
};

const inputClass =
  "w-full rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm text-[#1A1A1A] outline-none focus:border-primary";

function moduleIcon(key: string, size = "!text-[22px]") {
  if (key === "students" || key === "parents") {
    return <PeopleOutline className={`${size} text-primary`} />;
  }
  if (key === "staff") return <PersonOutline className={`${size} text-sky-600`} />;
  if (key === "classes" || key === "subjects" || key === "exams") {
    return <SchoolOutlined className={`${size} text-violet-600`} />;
  }
  if (key === "fees") return <DescriptionOutlined className={`${size} text-emerald-600`} />;
  if (key === "attendance") return <CheckCircleOutline className={`${size} text-rose-500`} />;
  return <MenuBookOutlined className={`${size} text-amber-600`} />;
}

function formatCount(n: number) {
  return n.toLocaleString("en-IN");
}

function formatSize(kb: number) {
  if (kb < 1024) return `~ ${kb} KB`;
  return `~ ${(kb / 1024).toFixed(1)} MB`;
}

function defaultExportFileName(format: ExportFormat) {
  const date = new Date().toISOString().slice(0, 10);
  const ext =
    format === "XLSX" ? "xlsx" : format === "PDF" ? "pdf" : format === "JSON" ? "json" : "csv";
  return `Export_${date}.${ext}`;
}

function parseCsvPreview(text: string, hasHeaders: boolean) {
  const lines = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 51);
  if (!lines.length) return { headers: [] as string[], rows: [] as Array<Record<string, string>> };

  const split = (line: string) => {
    const cells: string[] = [];
    let current = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i += 1) {
      const ch = line[i];
      if (ch === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }
      if (ch === "," && !inQuotes) {
        cells.push(current.trim());
        current = "";
        continue;
      }
      current += ch;
    }
    cells.push(current.trim());
    return cells;
  };

  const raw = lines.map(split);
  const colCount = Math.max(...raw.map((r) => r.length));
  const headers = hasHeaders
    ? raw[0].map((h, i) => h || `Column ${i + 1}`)
    : Array.from({ length: colCount }, (_, i) => `Column ${i + 1}`);
  const dataLines = hasHeaders ? raw.slice(1) : raw;
  const rows = dataLines.slice(0, 20).map((cells) => {
    const row: Record<string, string> = {};
    headers.forEach((header, index) => {
      row[header] = cells[index] ?? "";
    });
    return row;
  });
  return { headers, rows, totalRows: dataLines.length };
}

function guessMapping(headers: string[], fields: Array<{ key: string; label: string }>) {
  const mapping: Record<string, string> = {};
  for (const field of fields) {
    const match = headers.find((header) => {
      const h = header.toLowerCase().replace(/[\s_-]+/g, "");
      const k = field.key.toLowerCase().replace(/[\s_-]+/g, "");
      const l = field.label.toLowerCase().replace(/[\s_-]+/g, "");
      return h === k || h === l || h.includes(k) || k.includes(h);
    });
    mapping[field.key] = match || "";
  }
  return mapping;
}

function downloadTextFile(fileName: string, contentType: string, body: string) {
  const blob = new Blob([body], { type: contentType });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function DataImportExportPage() {
  const { accessToken, user } = useAuth();
  const outlet = useOutletContext<OutletCtx | null>();
  const activeLabel = outlet?.activeLabel ?? "Data Import/Export";
  const canManage = Boolean(
    user?.permissions.some((p) => ["erp.manage", "settings.manage"].includes(p)),
  );

  const fileRef = useRef<HTMLInputElement>(null);
  const [setup, setSetup] = useState<Setup | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [tab, setTab] = useState<"import" | "export">("import");
  const [moduleKey, setModuleKey] = useState<ModuleKey>("students");
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [previewRows, setPreviewRows] = useState<Array<Record<string, string>>>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [showPreview, setShowPreview] = useState(false);
  const [showExportPreview, setShowExportPreview] = useState(false);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [options, setOptions] = useState({
    hasHeaders: true,
    skipBlankRows: true,
    duplicateMode: "SKIP" as "SKIP" | "UPDATE" | "REPLACE",
    encoding: "UTF-8",
  });

  const [selectedExportKeys, setSelectedExportKeys] = useState<ModuleKey[]>([]);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("XLSX");
  const [exportFileName, setExportFileName] = useState(defaultExportFileName("XLSX"));
  const [exportOpts, setExportOpts] = useState({
    includeHeaders: true,
    includeRelated: true,
    activeOnly: true,
    compressZip: true,
    encryptPassword: false,
  });
  const [filters, setFilters] = useState({
    academicSessionId: "",
    classSectionId: "",
    statusFilter: "",
    dateFrom: "2025-04-01",
    dateTo: "2026-05-31",
  });

  async function load() {
    if (!accessToken) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiRequest<Setup>("/erp/data-import-export", accessToken);
      setSetup(data);
      setOptions({
        hasHeaders: data.optionsDefaults.hasHeaders,
        skipBlankRows: data.optionsDefaults.skipBlankRows,
        duplicateMode: data.optionsDefaults.duplicateMode,
        encoding: data.optionsDefaults.encoding,
      });
      setExportFormat(data.exportDefaults.format);
      setExportOpts({
        includeHeaders: data.exportDefaults.includeHeaders,
        includeRelated: data.exportDefaults.includeRelated,
        activeOnly: data.exportDefaults.activeOnly,
        compressZip: data.exportDefaults.compressZip,
        encryptPassword: data.exportDefaults.encryptPassword,
      });
      setSelectedExportKeys(data.exportModules.map((m) => m.key));
      setExportFileName(defaultExportFileName(data.exportDefaults.format));
      const currentSession = data.filterOptions.sessions.find((s) => s.isCurrent);
      setFilters((prev) => ({
        ...prev,
        academicSessionId: currentSession?.id || data.filterOptions.sessions[0]?.id || "",
      }));
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to load data import/export");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const selectedModule = useMemo(
    () => setup?.modules.find((m) => m.key === moduleKey) || null,
    [setup, moduleKey],
  );

  useEffect(() => {
    if (!selectedModule) return;
    if (headers.length) {
      setMapping(guessMapping(headers, selectedModule.fields));
    } else {
      setMapping({});
    }
  }, [selectedModule?.key, headers.join("|")]);

  useEffect(() => {
    setExportFileName((prev) => {
      const base = prev.replace(/\.[a-z0-9]+$/i, "");
      const ext =
        exportFormat === "XLSX"
          ? "xlsx"
          : exportFormat === "PDF"
            ? "pdf"
            : exportFormat === "JSON"
              ? "json"
              : "csv";
      return `${base || "Export"}.${ext}`;
    });
  }, [exportFormat]);

  const exportSummary = useMemo(() => {
    const modules = setup?.exportModules || [];
    const selected = modules.filter((m) => selectedExportKeys.includes(m.key));
    const totalRecords = selected.reduce((sum, m) => sum + m.recordCount, 0);
    const bytesPerRecord =
      exportFormat === "PDF" ? 180 : exportFormat === "JSON" ? 220 : 140;
    const estimatedSizeKb = Math.max(1, Math.round((totalRecords * bytesPerRecord) / 1024) || 1);
    const formatLabel =
      setup?.exportFormats.find((f) => f.key === exportFormat)?.label || exportFormat;
    return {
      moduleCount: selected.length,
      totalRecords,
      estimatedSizeKb,
      formatLabel,
    };
  }, [setup, selectedExportKeys, exportFormat]);

  async function onFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      notifyError("Maximum file size is 10 MB");
      return;
    }
    const lower = file.name.toLowerCase();
    if (!lower.endsWith(".csv") && !lower.endsWith(".xls") && !lower.endsWith(".xlsx")) {
      notifyError("Supported formats: CSV, XLS, XLSX");
      return;
    }

    setFileName(file.name);
    setShowPreview(false);

    if (lower.endsWith(".csv")) {
      const text = await file.text();
      const parsed = parseCsvPreview(text, options.hasHeaders);
      setHeaders(parsed.headers);
      setPreviewRows(parsed.rows);
      setTotalRows(parsed.totalRows ?? parsed.rows.length);
      if (selectedModule) setMapping(guessMapping(parsed.headers, selectedModule.fields));
    } else {
      const fallbackHeaders = selectedModule?.fields.map((f) => f.label) || ["Column 1", "Column 2"];
      setHeaders(fallbackHeaders);
      setPreviewRows([]);
      setTotalRows(0);
      if (selectedModule) {
        const map: Record<string, string> = {};
        selectedModule.fields.forEach((field, index) => {
          map[field.key] = fallbackHeaders[index] || "";
        });
        setMapping(map);
      }
      notifySuccess("Excel file selected. Map columns, then import.");
    }
  }

  function resetImport() {
    setFileName("");
    setHeaders([]);
    setPreviewRows([]);
    setTotalRows(0);
    setMapping({});
    setShowPreview(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function toggleExportModule(key: ModuleKey) {
    setSelectedExportKeys((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  function toggleSelectAllModules() {
    if (!setup) return;
    if (selectedExportKeys.length === setup.exportModules.length) {
      setSelectedExportKeys([]);
    } else {
      setSelectedExportKeys(setup.exportModules.map((m) => m.key));
    }
  }

  async function runImport() {
    if (!accessToken || !canManage || !selectedModule) return;
    if (!fileName) {
      notifyError("Please upload a file first");
      return;
    }
    setSaving(true);
    try {
      const data = await apiRequest<Setup>("/erp/data-import-export/import", accessToken, {
        method: "POST",
        body: JSON.stringify({
          moduleKey,
          fileName,
          ...options,
          columnMapping: mapping,
          previewRows,
          totalRows: totalRows || previewRows.length,
        }),
      });
      setSetup(data);
      resetImport();
      notifySuccess("Import completed");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to import data");
    } finally {
      setSaving(false);
    }
  }

  async function runExport() {
    if (!accessToken || !canManage) return;
    if (!selectedExportKeys.length) {
      notifyError("Select at least one module to export");
      return;
    }
    setExporting(true);
    try {
      const result = await apiRequest<{
        setup: Setup;
        download: { fileName: string; contentType: string; body: string };
      }>("/erp/data-import-export/export", accessToken, {
        method: "POST",
        body: JSON.stringify({
          moduleKeys: selectedExportKeys,
          format: exportFormat,
          fileName: exportFileName,
          ...exportOpts,
          academicSessionId: filters.academicSessionId || null,
          classSectionId: filters.classSectionId || null,
          statusFilter: filters.statusFilter || null,
          dateFrom: filters.dateFrom || null,
          dateTo: filters.dateTo || null,
        }),
      });
      setSetup(result.setup);
      downloadTextFile(
        result.download.fileName,
        result.download.contentType,
        result.download.body,
      );
      notifySuccess("Export ready — file downloaded");
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to export data");
    } finally {
      setExporting(false);
    }
  }

  async function downloadExport(key: string, label: string) {
    if (!accessToken) return;
    try {
      const response = await fetch(`${API_URL}/erp/data-import-export/export/${key}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        throw new Error(payload?.error?.message || "Export failed");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      const disposition = response.headers.get("Content-Disposition") || "";
      const match = /filename="([^"]+)"/.exec(disposition);
      anchor.href = url;
      anchor.download = match?.[1] || `${label.replace(/\s+/g, "_").toLowerCase()}.csv`;
      anchor.click();
      URL.revokeObjectURL(url);
      notifySuccess(`${label} exported`);
    } catch (cause) {
      notifyError(cause instanceof Error ? cause.message : "Unable to export");
    }
  }

  if (loading || !setup) {
    return <div className="p-6 text-sm text-[#6B7280]">Loading data import/export…</div>;
  }

  const canPreview = Boolean(fileName && headers.length);
  const canImport = Boolean(fileName && selectedModule);
  const allExportSelected = selectedExportKeys.length === setup.exportModules.length;
  const isExportTab = tab === "export";

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden bg-[#F6F7F9]">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-[#E5E7EB] bg-white px-4 py-3 sm:px-5">
        <div>
          <p className="text-xs text-[#6B7280]">
            Dashboard <span className="mx-1">/</span> ERP Settings <span className="mx-1">/</span>{" "}
            Data &amp; Security <span className="mx-1">/</span> {activeLabel}
            {isExportTab ? (
              <>
                {" "}
                <span className="mx-1">/</span>{" "}
                <span className="font-semibold text-[#1A1A1A]">Export Data</span>
              </>
            ) : (
              <>
                {" "}
                <span className="mx-1">/</span>{" "}
                <span className="font-semibold text-[#1A1A1A]">Import Data</span>
              </>
            )}
          </p>
          <h1 className="mt-1 text-lg font-bold text-[#1A1A1A]">
            {isExportTab ? "Export Data" : "Data Import/Export"}
          </h1>
          <p className="text-xs text-[#6B7280]">
            {isExportTab
              ? "Export system data for backup, migration or reporting purposes."
              : "Import data from external files or export system data for backup, migration or reporting."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              if (isExportTab) {
                notifySuccess("Latest export jobs are listed below after you export");
              } else {
                setTab("import");
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#374151]"
          >
            <HistoryOutlined className="!text-[18px]" />
            {isExportTab ? "Export History" : "Import History"}
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#E5E7EB] bg-white px-3 py-2 text-sm font-semibold text-[#374151]"
            onClick={() =>
              notifySuccess(
                isExportTab
                  ? "Choose modules, format, and filters, then click Export Data"
                  : "See column mapping help in Step 4",
              )
            }
          >
            <HelpOutlineOutlined className="!text-[18px]" />
            Help
          </button>
          <button
            type="button"
            disabled={!canManage}
            onClick={() => {
              if (isExportTab) {
                setSelectedExportKeys(setup.exportModules.map((m) => m.key));
                setExportFileName(defaultExportFileName(exportFormat));
                notifySuccess("New export draft ready");
              } else {
                setTab("import");
                resetImport();
                fileRef.current?.click();
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            <AddOutlined className="!text-[18px]" />
            {isExportTab ? "New Export" : "New Import"}
          </button>
        </div>
      </div>

      <div className="shrink-0 border-b border-[#E5E7EB] bg-white px-4 sm:px-5">
        <div className="flex gap-1">
          {(
            [
              ["import", "Import Data"],
              ["export", "Export Data"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`border-b-2 px-3 py-3 text-xs font-semibold ${
                tab === id ? "border-primary text-primary" : "border-transparent text-[#6B7280]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-4 sm:p-5">
        {tab === "import" ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
            <div className="space-y-4">
              <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
                <h2 className="mb-3 text-sm font-bold text-[#1A1A1A]">Step 1: Select Module</h2>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {setup.modules.map((module) => (
                    <button
                      key={module.key}
                      type="button"
                      onClick={() => {
                        setModuleKey(module.key);
                        setShowPreview(false);
                      }}
                      className={`rounded-xl border p-3 text-left transition ${
                        moduleKey === module.key
                          ? "border-primary bg-primary/5"
                          : "border-[#E5E7EB] bg-white hover:border-primary/40"
                      }`}
                    >
                      <div className="mb-2">{moduleIcon(module.key)}</div>
                      <p className="text-sm font-semibold text-[#1A1A1A]">{module.label}</p>
                      <p className="text-xs text-[#9CA3AF]">{module.description}</p>
                    </button>
                  ))}
                </div>
              </section>

              <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
                <h2 className="mb-3 text-sm font-bold text-[#1A1A1A]">Step 2: Upload File</h2>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv,.xls,.xlsx"
                  className="hidden"
                  onChange={(e) => void onFileChange(e)}
                />
                <button
                  type="button"
                  disabled={!canManage}
                  onClick={() => fileRef.current?.click()}
                  className="flex w-full flex-col items-center justify-center rounded-xl border border-dashed border-[#D1D5DB] bg-[#FAFAFA] px-4 py-10 text-center disabled:opacity-50"
                >
                  <CloudUploadOutlined className="mb-2 !text-[36px] text-primary" />
                  <p className="text-sm text-[#374151]">
                    Drag &amp; drop your file here or{" "}
                    <span className="font-semibold text-primary">Choose File</span>
                  </p>
                  <p className="mt-1 text-xs text-[#9CA3AF]">
                    Supported formats: CSV, XLS, XLSX · Max size: 10 MB
                  </p>
                  {fileName ? (
                    <p className="mt-3 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-[#1A1A1A] shadow-sm">
                      {fileName} {totalRows ? `· ${totalRows} rows` : ""}
                    </p>
                  ) : null}
                </button>
              </section>

              <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
                <h2 className="mb-3 text-sm font-bold text-[#1A1A1A]">Step 3: Import Options</h2>
                <div className="space-y-3 text-sm">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={options.hasHeaders}
                      onChange={(e) =>
                        setOptions((prev) => ({ ...prev, hasHeaders: e.target.checked }))
                      }
                    />
                    First row contains column headers
                  </label>
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={options.skipBlankRows}
                      onChange={(e) =>
                        setOptions((prev) => ({ ...prev, skipBlankRows: e.target.checked }))
                      }
                    />
                    Skip blank rows
                  </label>
                  <div>
                    <p className="mb-2 text-xs font-semibold text-[#6B7280]">On Duplicate Data</p>
                    <div className="space-y-2">
                      {(
                        [
                          ["SKIP", "Skip duplicate records"],
                          ["UPDATE", "Update existing records"],
                          ["REPLACE", "Replace existing records"],
                        ] as const
                      ).map(([value, label]) => (
                        <label key={value} className="flex items-center gap-2">
                          <input
                            type="radio"
                            name="duplicateMode"
                            checked={options.duplicateMode === value}
                            onChange={() =>
                              setOptions((prev) => ({ ...prev, duplicateMode: value }))
                            }
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                  <label className="block max-w-xs">
                    <span className="mb-1 block text-xs font-semibold text-[#6B7280]">
                      Character Encoding
                    </span>
                    <select
                      className={inputClass}
                      value={options.encoding}
                      onChange={(e) =>
                        setOptions((prev) => ({ ...prev, encoding: e.target.value }))
                      }
                    >
                      <option value="UTF-8">UTF-8 (Recommended)</option>
                      <option value="UTF-16">UTF-16</option>
                      <option value="ISO-8859-1">ISO-8859-1</option>
                    </select>
                  </label>
                </div>
              </section>

              <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
                <h2 className="mb-3 text-sm font-bold text-[#1A1A1A]">Step 4: Column Mapping</h2>
                {!headers.length ? (
                  <div className="rounded-lg border border-dashed border-[#E5E7EB] bg-[#FAFAFA] px-4 py-10 text-center text-sm text-[#9CA3AF]">
                    Please upload a file to view and map columns.
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-sm">
                      <thead className="border-b border-[#E5E7EB] text-xs uppercase text-[#9CA3AF]">
                        <tr>
                          <th className="px-2 py-2 font-semibold">System Field</th>
                          <th className="px-2 py-2 font-semibold">File Column</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedModule?.fields.map((field) => (
                          <tr key={field.key} className="border-b border-[#F3F4F6]">
                            <td className="px-2 py-2.5">
                              <span className="font-semibold text-[#1A1A1A]">{field.label}</span>
                              {field.required ? (
                                <span className="ml-1 text-rose-500">*</span>
                              ) : null}
                            </td>
                            <td className="px-2 py-2.5">
                              <select
                                className={inputClass}
                                value={mapping[field.key] || ""}
                                onChange={(e) =>
                                  setMapping((prev) => ({
                                    ...prev,
                                    [field.key]: e.target.value,
                                  }))
                                }
                              >
                                <option value="">— Not mapped —</option>
                                {headers.map((header) => (
                                  <option key={header} value={header}>
                                    {header}
                                  </option>
                                ))}
                              </select>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </section>

              {showPreview && previewRows.length ? (
                <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
                  <h2 className="mb-3 text-sm font-bold text-[#1A1A1A]">Preview Data</h2>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-left text-xs">
                      <thead className="bg-[#FAFAFA] text-[#9CA3AF]">
                        <tr>
                          {headers.map((header) => (
                            <th key={header} className="px-2 py-2 font-semibold">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {previewRows.slice(0, 8).map((row, index) => (
                          <tr key={index} className="border-t border-[#F3F4F6]">
                            {headers.map((header) => (
                              <td key={header} className="px-2 py-2 text-[#374151]">
                                {row[header] || "—"}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}

              <div className="flex flex-wrap items-center justify-end gap-2">
                <button
                  type="button"
                  disabled={!canPreview}
                  onClick={() => setShowPreview(true)}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#D1D5DB]"
                >
                  Preview Data
                </button>
                <button
                  type="button"
                  disabled={!canManage || !canImport || saving}
                  onClick={() => void runImport()}
                  className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#D1D5DB]"
                >
                  {saving ? "Importing…" : "Import Data"}
                </button>
              </div>

              <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
                <InfoOutlined className="mt-0.5 !text-[18px]" />
                <p>
                  <span className="font-semibold">Note:</span> Please take a system backup before
                  importing important data.
                </p>
              </div>
            </div>

            <aside className="space-y-4">
              <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-[#1A1A1A]">Import History</h2>
                  <HistoryOutlined className="!text-[18px] text-[#9CA3AF]" />
                </div>
                <ul className="space-y-3">
                  {setup.history.slice(0, 6).map((item) => (
                    <li key={item.id} className="flex items-start gap-2">
                      <div className="mt-0.5 rounded-lg bg-[#F3F4F6] p-1.5">
                        {item.status === "FAILED" ? (
                          <ErrorOutline className="!text-[16px] text-rose-600" />
                        ) : (
                          <CheckCircleOutline className="!text-[16px] text-emerald-600" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#1A1A1A]">
                          {item.moduleLabel}
                        </p>
                        <p className="text-xs text-[#9CA3AF]">{item.createdAtLabel}</p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          item.status === "FAILED"
                            ? "bg-rose-50 text-rose-700"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {item.statusLabel}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>

              <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
                <h2 className="mb-3 text-sm font-bold text-[#1A1A1A]">Export Quick Access</h2>
                <ul className="space-y-2">
                  {setup.exportTargets.slice(0, 5).map((item) => (
                    <li
                      key={item.key}
                      className="flex items-center justify-between gap-2 rounded-lg border border-[#F3F4F6] px-2 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <DownloadOutlined className="!text-[16px] text-[#9CA3AF]" />
                        <span className="truncate text-sm font-semibold text-[#1A1A1A]">
                          {item.label}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => void downloadExport(item.key, item.label)}
                        className="rounded border border-[#E5E7EB] px-2 py-1 text-[11px] font-semibold text-primary"
                      >
                        Export
                      </button>
                    </li>
                  ))}
                </ul>
              </section>
            </aside>
          </div>
        ) : (
          <div className="space-y-4">
            <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm sm:p-5">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-[#1A1A1A]">
                    1. Select Module / Data to Export
                  </h2>
                  <p className="text-xs text-[#6B7280]">
                    Choose the modules whose data you want to export.
                  </p>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 text-sm font-semibold text-[#374151]">
                  <input
                    type="checkbox"
                    checked={allExportSelected}
                    onChange={toggleSelectAllModules}
                    className="accent-primary"
                  />
                  Select All Modules
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {setup.exportModules.map((module) => {
                  const selected = selectedExportKeys.includes(module.key);
                  return (
                    <button
                      key={module.key}
                      type="button"
                      onClick={() => toggleExportModule(module.key)}
                      className={`relative rounded-xl border p-3 text-left transition ${
                        selected
                          ? "border-primary bg-primary/5"
                          : "border-[#E5E7EB] bg-white hover:border-primary/40"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selected}
                        readOnly
                        className="absolute right-3 top-3 accent-primary"
                        tabIndex={-1}
                      />
                      <div className="mb-2">{moduleIcon(module.key)}</div>
                      <p className="pr-6 text-sm font-semibold text-[#1A1A1A]">{module.label}</p>
                      <p className="text-xs text-[#9CA3AF]">
                        {formatCount(module.recordCount)} Records
                      </p>
                    </button>
                  );
                })}
              </div>

              <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-800">
                Total selected modules: {exportSummary.moduleCount}{" "}
                <span className="mx-2 text-emerald-400">|</span> Total records:{" "}
                {formatCount(exportSummary.totalRecords)} (Approx.)
              </div>
            </section>

            <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_260px]">
              <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
                <h2 className="text-sm font-bold text-[#1A1A1A]">2. Export Format</h2>
                <p className="mb-3 text-xs text-[#6B7280]">Choose the file format for export.</p>
                <div className="space-y-2">
                  {setup.exportFormats.map((fmt) => {
                    const Icon =
                      fmt.key === "PDF"
                        ? PictureAsPdfOutlined
                        : fmt.key === "JSON"
                          ? DescriptionOutlined
                          : TableChartOutlined;
                    return (
                      <label
                        key={fmt.key}
                        className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 ${
                          exportFormat === fmt.key
                            ? "border-primary bg-primary/5"
                            : "border-[#E5E7EB]"
                        }`}
                      >
                        <input
                          type="radio"
                          name="exportFormat"
                          checked={exportFormat === fmt.key}
                          onChange={() => setExportFormat(fmt.key)}
                          className="mt-1 accent-primary"
                        />
                        <Icon className="mt-0.5 !text-[18px] text-[#6B7280]" />
                        <span>
                          <span className="block text-sm font-semibold text-[#1A1A1A]">
                            {fmt.label}
                          </span>
                          <span className="block text-xs text-[#9CA3AF]">{fmt.description}</span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </section>

              <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
                <h2 className="text-sm font-bold text-[#1A1A1A]">3. Export Filters (Optional)</h2>
                <p className="mb-3 text-xs text-[#6B7280]">Filter the data you want to export.</p>
                <div className="space-y-3">
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-[#6B7280]">
                      Academic Session
                    </span>
                    <select
                      className={inputClass}
                      value={filters.academicSessionId}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, academicSessionId: e.target.value }))
                      }
                    >
                      {setup.filterOptions.sessions.length === 0 ? (
                        <option value="">No sessions</option>
                      ) : (
                        setup.filterOptions.sessions.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.label}
                          </option>
                        ))
                      )}
                    </select>
                  </label>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-[#6B7280]">Class</span>
                    <select
                      className={inputClass}
                      value={filters.classSectionId}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, classSectionId: e.target.value }))
                      }
                    >
                      {setup.filterOptions.classes.map((c) => (
                        <option key={c.id || "all"} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div>
                    <span className="mb-1 block text-xs font-semibold text-[#6B7280]">
                      Date Range (Created On)
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="date"
                        className={inputClass}
                        value={filters.dateFrom}
                        onChange={(e) =>
                          setFilters((prev) => ({ ...prev, dateFrom: e.target.value }))
                        }
                      />
                      <input
                        type="date"
                        className={inputClass}
                        value={filters.dateTo}
                        onChange={(e) =>
                          setFilters((prev) => ({ ...prev, dateTo: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <label className="block">
                    <span className="mb-1 block text-xs font-semibold text-[#6B7280]">Status</span>
                    <select
                      className={inputClass}
                      value={filters.statusFilter}
                      onChange={(e) =>
                        setFilters((prev) => ({ ...prev, statusFilter: e.target.value }))
                      }
                    >
                      {setup.filterOptions.statuses.map((s) => (
                        <option key={s.id || "all"} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </section>

              <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
                <h2 className="mb-3 text-sm font-bold text-[#1A1A1A]">4. Advanced Options</h2>
                <div className="space-y-2.5 text-sm text-[#374151]">
                  {(
                    [
                      ["includeHeaders", "Include column headers"],
                      ["includeRelated", "Include related data"],
                      ["activeOnly", "Export only active records"],
                      ["compressZip", "Compress file (ZIP)"],
                      ["encryptPassword", "Encrypt file with password"],
                    ] as const
                  ).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={exportOpts[key]}
                        onChange={(e) =>
                          setExportOpts((prev) => ({ ...prev, [key]: e.target.checked }))
                        }
                        className="accent-primary"
                      />
                      <span className="inline-flex items-center gap-1">
                        {label}
                        {key === "includeRelated" ? (
                          <InfoOutlined className="!text-[14px] text-[#9CA3AF]" />
                        ) : null}
                      </span>
                    </label>
                  ))}
                </div>
                <label className="mt-4 block">
                  <span className="mb-1 block text-xs font-semibold text-[#6B7280]">File Name</span>
                  <input
                    className={inputClass}
                    value={exportFileName}
                    onChange={(e) => setExportFileName(e.target.value)}
                  />
                </label>
              </section>

              <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
                <h2 className="mb-3 text-sm font-bold text-[#1A1A1A]">Estimated Summary</h2>
                <dl className="space-y-2.5 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-[#6B7280]">Modules Selected</dt>
                    <dd className="font-semibold text-[#1A1A1A]">{exportSummary.moduleCount}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-[#6B7280]">Total Records</dt>
                    <dd className="font-semibold text-[#1A1A1A]">
                      {formatCount(exportSummary.totalRecords)}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-[#6B7280]">File Format</dt>
                    <dd className="font-semibold text-[#1A1A1A]">{exportSummary.formatLabel}</dd>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <dt className="text-[#6B7280]">Estimated File Size</dt>
                    <dd className="font-semibold text-[#1A1A1A]">
                      {formatSize(exportSummary.estimatedSizeKb)}
                    </dd>
                  </div>
                </dl>
                <div className="mt-4 rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-xs text-sky-900">
                  The actual file size may vary based on the selected data and filters.
                </div>
              </section>
            </div>

            {showExportPreview ? (
              <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
                <h2 className="mb-3 text-sm font-bold text-[#1A1A1A]">Export Preview</h2>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-sm">
                    <thead className="border-b border-[#E5E7EB] text-xs uppercase text-[#9CA3AF]">
                      <tr>
                        <th className="px-2 py-2 font-semibold">Module</th>
                        <th className="px-2 py-2 font-semibold">Records</th>
                        <th className="px-2 py-2 font-semibold">Format</th>
                      </tr>
                    </thead>
                    <tbody>
                      {setup.exportModules
                        .filter((m) => selectedExportKeys.includes(m.key))
                        .map((m) => (
                          <tr key={m.key} className="border-b border-[#F3F4F6]">
                            <td className="px-2 py-2.5 font-semibold text-[#1A1A1A]">{m.label}</td>
                            <td className="px-2 py-2.5 text-[#374151]">
                              {formatCount(m.recordCount)}
                            </td>
                            <td className="px-2 py-2.5 text-[#374151]">
                              {exportSummary.formatLabel}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </section>
            ) : null}

            <div className="flex flex-wrap items-center justify-center gap-3">
              <button
                type="button"
                disabled={!canManage || !selectedExportKeys.length || exporting}
                onClick={() => void runExport()}
                className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-[#D1D5DB]"
              >
                <CloudUploadOutlined className="!text-[18px]" />
                {exporting ? "Exporting…" : "Export Data"}
              </button>
              <button
                type="button"
                disabled={!selectedExportKeys.length}
                onClick={() => setShowExportPreview(true)}
                className="inline-flex items-center gap-2 rounded-lg border border-[#E5E7EB] bg-white px-5 py-2.5 text-sm font-semibold text-[#374151] disabled:opacity-50"
              >
                <VisibilityOutlined className="!text-[18px]" />
                Preview Data
              </button>
            </div>

            <div className="flex items-start gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
              <InfoOutlined className="mt-0.5 !text-[18px]" />
              <p>
                <span className="font-semibold">Note:</span> Large exports will be processed in the
                background. You can download the file from Export History once completed.
              </p>
            </div>

            {setup.exportHistory.length ? (
              <section className="rounded-xl border border-[#E5E7EB] bg-white p-4 shadow-sm">
                <div className="mb-3 flex items-center justify-between">
                  <h2 className="text-sm font-bold text-[#1A1A1A]">Export History</h2>
                  <HistoryOutlined className="!text-[18px] text-[#9CA3AF]" />
                </div>
                <ul className="divide-y divide-[#F3F4F6]">
                  {setup.exportHistory.slice(0, 6).map((item) => (
                    <li key={item.id} className="flex items-center gap-3 py-2.5">
                      <div className="rounded-lg bg-[#F3F4F6] p-1.5">
                        {item.status === "FAILED" ? (
                          <ErrorOutline className="!text-[16px] text-rose-600" />
                        ) : (
                          <CheckCircleOutline className="!text-[16px] text-emerald-600" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-[#1A1A1A]">
                          {item.fileName}
                        </p>
                        <p className="text-xs text-[#9CA3AF]">
                          {item.moduleLabel} · {item.createdAtLabel}
                        </p>
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                          item.status === "FAILED"
                            ? "bg-rose-50 text-rose-700"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {item.statusLabel}
                      </span>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null}
          </div>
        )}
      </div>
    </div>
  );
}
