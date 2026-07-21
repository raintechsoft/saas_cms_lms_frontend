import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { isProductBucketAllowed, type ProductBucket } from "../lib/productMode";

/** Redirects away when the tenant product mode does not include this feature bucket. */
export function RequireProductBucket({
  bucket,
  children,
}: {
  bucket: ProductBucket;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  if (!isProductBucketAllowed(user?.tenant?.productMode, bucket)) {
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}
