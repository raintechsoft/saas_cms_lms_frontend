type Msg91OtpConfig = {
  widgetId: string;
  tokenAuth: string;
};

type Msg91SuccessPayload = {
  message?: string | Record<string, unknown>;
  accessToken?: string;
  "access-token"?: string;
  data?: {
    accessToken?: string;
    "access-token"?: string;
    message?: string;
  };
};

declare global {
  interface Window {
    initSendOTP?: (config: Record<string, unknown>) => void;
    sendOtp?: (
      identifier: string,
      success?: (data: unknown) => void,
      failure?: (error: unknown) => void,
    ) => void;
    verifyOtp?: (
      otp: string | number,
      success?: (data: unknown) => void,
      failure?: (error: unknown) => void,
      reqId?: string,
    ) => void;
    retryOtp?: (
      channel: string | null,
      success?: (data: unknown) => void,
      failure?: (error: unknown) => void,
      reqId?: string,
    ) => void;
  }
}

const SCRIPT_URLS = [
  "https://verify.msg91.com/otp-provider.js",
  "https://verify.phone91.com/otp-provider.js",
];

let scriptPromise: Promise<void> | null = null;

function loadMsg91Script() {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("MSG91 OTP is browser-only"));
  }
  if (typeof window.initSendOTP === "function") {
    return Promise.resolve();
  }
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise<void>((resolve, reject) => {
    let index = 0;
    const attempt = () => {
      const script = document.createElement("script");
      script.src = SCRIPT_URLS[index];
      script.async = true;
      script.onload = () => {
        if (typeof window.initSendOTP === "function") {
          resolve();
          return;
        }
        index += 1;
        if (index < SCRIPT_URLS.length) attempt();
        else reject(new Error("MSG91 OTP script loaded but initSendOTP is missing"));
      };
      script.onerror = () => {
        index += 1;
        if (index < SCRIPT_URLS.length) attempt();
        else reject(new Error("Unable to load MSG91 OTP script"));
      };
      document.head.appendChild(script);
    };
    attempt();
  });

  return scriptPromise;
}

function extractAccessToken(data: Msg91SuccessPayload | string | null | undefined) {
  if (!data) return "";
  if (typeof data === "string") return data.trim();
  const nested = data.data;
  return String(
    data.accessToken ||
      data["access-token"] ||
      nested?.accessToken ||
      nested?.["access-token"] ||
      (typeof data.message === "string" && data.message.length > 40 ? data.message : "") ||
      "",
  ).trim();
}

/** Opens MSG91 OTP widget and resolves with the verified access token. */
export async function verifyWithMsg91Widget(
  config: Msg91OtpConfig,
  identifier?: string,
): Promise<string> {
  await loadMsg91Script();

  return new Promise((resolve, reject) => {
    if (typeof window.initSendOTP !== "function") {
      reject(new Error("MSG91 OTP widget is unavailable"));
      return;
    }

    window.initSendOTP({
      widgetId: config.widgetId,
      tokenAuth: config.tokenAuth,
      identifier: identifier || undefined,
      exposeMethods: false,
      success: (data: Msg91SuccessPayload) => {
        const accessToken = extractAccessToken(data);
        if (!accessToken) {
          reject(new Error("MSG91 did not return an access token"));
          return;
        }
        resolve(accessToken);
      },
      failure: (error: unknown) => {
        const message =
          typeof error === "string"
            ? error
            : error && typeof error === "object" && "message" in error
              ? String((error as { message: unknown }).message)
              : "MSG91 OTP verification failed";
        reject(new Error(message));
      },
    });
  });
}
