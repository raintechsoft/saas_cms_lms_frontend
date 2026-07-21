import { useEffect, useRef, useState } from "react";

const GOOGLE_SCRIPT_ID = "google-gsi-client";
const GOOGLE_SCRIPT_SRC = "https://accounts.google.com/gsi/client";

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: {
            client_id: string;
            callback: (response: { credential: string }) => void;
            auto_select?: boolean;
          }) => void;
          renderButton: (
            parent: HTMLElement,
            options: {
              theme?: "outline" | "filled_blue" | "filled_black";
              size?: "large" | "medium" | "small";
              width?: number;
              text?: "signin_with" | "signup_with" | "continue_with" | "signin";
            },
          ) => void;
        };
      };
    };
  }
}

function loadGoogleScript() {
  if (document.getElementById(GOOGLE_SCRIPT_ID)) {
    return Promise.resolve();
  }
  return new Promise<void>((resolve, reject) => {
    const script = document.createElement("script");
    script.id = GOOGLE_SCRIPT_ID;
    script.src = GOOGLE_SCRIPT_SRC;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Unable to load Google Sign-In"));
    document.head.appendChild(script);
  });
}

interface GoogleSignInButtonProps {
  clientId: string;
  disabled?: boolean;
  onCredential: (idToken: string) => Promise<void>;
  onError: (message: string) => void;
}

export function GoogleSignInButton({
  clientId,
  disabled,
  onCredential,
  onError,
}: GoogleSignInButtonProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadGoogleScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.google) return;
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response) => {
            if (disabled) return;
            try {
              await onCredential(response.credential);
            } catch (cause) {
              onError(cause instanceof Error ? cause.message : "Google sign-in failed");
            }
          },
        });
        containerRef.current.innerHTML = "";
        window.google.accounts.id.renderButton(containerRef.current, {
          theme: "outline",
          size: "large",
          width: 360,
          text: "continue_with",
        });
        setReady(true);
      })
      .catch((cause) => {
        onError(cause instanceof Error ? cause.message : "Google Sign-In unavailable");
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, disabled, onCredential, onError]);

  if (!clientId) return null;

  return (
    <div className="space-y-2">
      <div
        ref={containerRef}
        className={`flex justify-center ${disabled ? "pointer-events-none opacity-50" : ""}`}
      />
      {!ready && (
        <p className="text-center text-xs text-slate-500">Loading Google Sign-In…</p>
      )}
    </div>
  );
}
