import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { HashRouter } from "react-router-dom";
import { App } from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { ToastContainer } from "./lib/notify";
import { store } from "./store";
import "./styles.css";

// Backend/email links may omit the hash. Rewrite deep-links for HashRouter.
{
  const path = window.location.pathname.replace(/\/$/, "") || "/";
  const search = window.location.search;
  const hashAuthPaths = new Set(["/reset-password", "/forgot-password", "/login", "/admin/login"]);
  const isPrintPath =
    path === "/print/documents" || path.startsWith("/print/documents/");
  const isParentPortalPath = path === "/parent" || path.startsWith("/parent/");
  if (!window.location.hash && (hashAuthPaths.has(path) || isPrintPath || isParentPortalPath)) {
    window.location.replace(`${window.location.origin}/#${path}${search}`);
  }
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.addEventListener("message", (event) => {
    if (event.data?.type === "PUSH_NAVIGATE") {
      window.location.hash = event.data.hash || "#/notifications";
    }
  });

  window.addEventListener("load", () => {
    void navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => registration.update())
      .catch((error) => {
        console.error("Service worker registration failed:", error);
      });
  });
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Provider store={store}>
      {/* HashRouter works in Electron packaged app (file://). BrowserRouter shows blank. */}
      <HashRouter>
        <AuthProvider>
          <App />
          <ToastContainer theme="colored" newestOnTop closeOnClick pauseOnHover />
        </AuthProvider>
      </HashRouter>
    </Provider>
  </StrictMode>,
);
