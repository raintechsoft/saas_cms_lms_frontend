import { Navigate, useLocation, useParams } from "react-router-dom";
import { ERP_DEFAULT_SLUG, findErpNavItem } from "./erpNav";
import { ErpSettingsPlaceholderPage } from "./ErpSettingsPlaceholderPage";
import { SchoolProfilePage } from "./SchoolProfilePage";

/** Resolves /erp/:slug to a concrete settings child page. */
export function ErpSettingsPageRouter() {
  const params = useParams<{ slug?: string }>();
  const location = useLocation();
  const slugFromPath =
    location.pathname.replace(/^\/erp\/?/, "").split("/").filter(Boolean)[0] || ERP_DEFAULT_SLUG;
  const slug = params.slug || slugFromPath;

  if (!findErpNavItem(slug)) {
    return <Navigate to={`/erp/${ERP_DEFAULT_SLUG}`} replace />;
  }

  if (slug === "school-profile") {
    return <SchoolProfilePage />;
  }

  return <ErpSettingsPlaceholderPage />;
}
