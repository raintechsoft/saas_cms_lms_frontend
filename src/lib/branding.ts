export interface TenantBranding {
  primaryColor?: string;
  logoText?: string;
  logoUrl?: string;
  customDomain?: string;
}

const DEFAULT_PRIMARY = "#534AB7";

export function parseBranding(value: Record<string, unknown> | null | undefined): TenantBranding {
  if (!value || typeof value !== "object") {
    return { primaryColor: DEFAULT_PRIMARY, logoText: "SaaS CMS LMS" };
  }
  return {
    primaryColor: typeof value.primaryColor === "string" ? value.primaryColor : DEFAULT_PRIMARY,
    logoText: typeof value.logoText === "string" ? value.logoText : "SaaS CMS LMS",
    logoUrl: typeof value.logoUrl === "string" ? value.logoUrl : undefined,
    customDomain: typeof value.customDomain === "string" ? value.customDomain : undefined,
  };
}

export function applyBrandingToDocument(branding: TenantBranding) {
  const root = document.documentElement;
  root.style.setProperty("--brand-primary", branding.primaryColor || DEFAULT_PRIMARY);
}
