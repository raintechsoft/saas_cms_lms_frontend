import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { HashRouter } from "react-router-dom";
import { App } from "./App";
import { AuthProvider } from "./auth/AuthContext";
import { ToastContainer } from "./lib/notify";
import { store } from "./store";
import "./styles.css";

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
