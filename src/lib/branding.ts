export interface TenantBranding {
  primaryColor?: string;
  logoText?: string;
  logoUrl?: string;
  faviconUrl?: string;
  customDomain?: string;
  frontDisplayName?: string;
  tagline?: string;
}

const DEFAULT_PRIMARY = "#534AB7";

export function parseBranding(value: Record<string, unknown> | null | undefined): TenantBranding {
  if (!value || typeof value !== "object") {
    return { primaryColor: DEFAULT_PRIMARY, logoText: "SaaS CMS LMS" };
  }
  const brandName =
    (typeof value.brandName === "string" && value.brandName) ||
    (typeof value.frontDisplayName === "string" && value.frontDisplayName) ||
    (typeof value.logoText === "string" && value.logoText) ||
    "SaaS CMS LMS";
  return {
    primaryColor: typeof value.primaryColor === "string" ? value.primaryColor : DEFAULT_PRIMARY,
    logoText: brandName,
    logoUrl: typeof value.logoUrl === "string" ? value.logoUrl : undefined,
    faviconUrl: typeof value.faviconUrl === "string" ? value.faviconUrl : undefined,
    customDomain: typeof value.customDomain === "string" ? value.customDomain : undefined,
    frontDisplayName:
      typeof value.frontDisplayName === "string" ? value.frontDisplayName : undefined,
    tagline: typeof value.tagline === "string" ? value.tagline : undefined,
  };
}

export function applyBrandingToDocument(branding: TenantBranding) {
  const root = document.documentElement;
  root.style.setProperty("--brand-primary", branding.primaryColor || DEFAULT_PRIMARY);

  if (branding.faviconUrl) {
    let link = document.querySelector<HTMLLinkElement>("link[rel='icon'][data-tenant-favicon='1']");
    if (!link) {
      link = document.createElement("link");
      link.rel = "icon";
      link.dataset.tenantFavicon = "1";
      document.head.appendChild(link);
    }
    link.href = branding.faviconUrl;
  }
}
