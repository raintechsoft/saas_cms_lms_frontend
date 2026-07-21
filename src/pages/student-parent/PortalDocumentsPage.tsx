import { useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { apiRequest } from "../../lib/api";
import { isProductBucketAllowed } from "../../lib/productMode";
import { usePortal } from "./PortalContext";

interface PortalDocument {
  id: string;
  name: string;
  fileUrl: string;
  folder: string;
  createdAt: string;
}

interface PortalCertificate {
  id: string;
  name: string;
  createdAt: string;
  serialNumber: string | null;
}

interface DocumentsResponse {
  documents: PortalDocument[];
  certificates: PortalCertificate[];
}

export function PortalDocumentsPage() {
  const { accessToken, child, productMode, basePath } = usePortal();
  const [data, setData] = useState<DocumentsResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const showCms = isProductBucketAllowed(productMode, "CMS");

  useEffect(() => {
    if (!showCms || !child) {
      setLoading(false);
      return;
    }
    setLoading(true);
    apiRequest<DocumentsResponse>(`/portal/children/${child.student.id}/documents`, accessToken)
      .then(setData)
      .catch((cause: unknown) => {
        setError(cause instanceof Error ? cause.message : "Unable to load documents");
      })
      .finally(() => setLoading(false));
  }, [accessToken, child?.student.id, showCms]);

  if (!showCms) {
    return <Navigate to={basePath} replace />;
  }

  if (!child) {
    return <p className="text-sm text-slate-500">No student profile linked.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Documents</h1>
        <p className="mt-1 text-sm text-slate-500">Uploaded documents and generated certificates.</p>
      </div>

      {error && <p className="alert-error">{error}</p>}
      {loading ? (
        <p className="text-sm text-slate-500">Loading documents…</p>
      ) : (
        <>
          <section className="card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4 font-semibold">Documents</div>
            {!data?.documents.length ? (
              <p className="p-5 text-sm text-slate-500">No documents uploaded.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.documents.map((doc) => (
                  <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-sm" key={doc.id}>
                    <div>
                      <p className="font-medium">{doc.name}</p>
                      <p className="text-xs text-slate-500">
                        {doc.folder} · {new Date(doc.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <a className="text-sm font-semibold text-indigo-700" href={doc.fileUrl} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="card overflow-hidden">
            <div className="border-b border-slate-100 px-5 py-4 font-semibold">Certificates</div>
            {!data?.certificates.length ? (
              <p className="p-5 text-sm text-slate-500">No certificates generated.</p>
            ) : (
              <div className="divide-y divide-slate-100">
                {data.certificates.map((cert) => (
                  <div className="px-5 py-3 text-sm" key={cert.id}>
                    <p className="font-medium">{cert.name}</p>
                    <p className="text-xs text-slate-500">
                      {new Date(cert.createdAt).toLocaleDateString()}
                      {cert.serialNumber ? ` · ${cert.serialNumber}` : ""}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
