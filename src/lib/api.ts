export const API_URL =
  import.meta.env.VITE_API_URL ?? "https://saas-cms-lms-backend.onrender.com/api/v1";
export const API_ORIGIN = API_URL.replace(/\/api\/v1\/?$/, "");

export function assetUrl(path: string | null | undefined) {
  if (!path) return "";
  if (/^https?:\/\//i.test(path) || path.startsWith("data:")) return path;
  return `${API_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

export interface LoginUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string | null;
  avatarUrl?: string | null;
  roles: string[];
  permissions: string[];
  moduleSettings: Array<{
    moduleKey: string;
    adminEnabled: boolean;
    studentEnabled: boolean;
    parentEnabled: boolean;
  }>;
  tenant: {
    id: string;
    name: string;
    slug: string;
    type: string;
    productMode: "CMS" | "LMS" | "BOTH";
    branding: Record<string, unknown> | null;
  } | null;
}

export interface LoginResult {
  accessToken: string;
  user: LoginUser;
}

export interface DashboardResult {
  modules: string[];
  currentSession: {
    id: string;
    name: string;
    startDate: string;
    endDate: string;
  } | null;
  roles: string[];
  permissions: string[];
  stats?: {
    students: number;
    staff: number;
    classSections: number;
    homeworkOpen: number;
    notices: number;
    attendanceToday: { present: number; absent: number; total: number };
  };
  trends?: {
    studentsPct: number;
    staffPct: number;
    collectionPct: number;
    attendancePct: number;
    enrollmentByMonth: number[];
  };
}

import { ApiError, type ZodIssueLike } from "./formErrors";

export { ApiError, isApiError } from "./formErrors";

interface ApiEnvelope<T> {
  data: T;
}

interface ApiFailure {
  error?: {
    message?: string;
    code?: string;
    details?: ZodIssueLike[];
  };
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });

  const text = await response.text();
  let body: (ApiEnvelope<T> & ApiFailure) | null = null;
  if (text) {
    try {
      body = JSON.parse(text) as ApiEnvelope<T> & ApiFailure;
    } catch {
      throw new ApiError("Server returned an invalid response", { status: response.status });
    }
  }
  if (!response.ok) {
    throw new ApiError(body?.error?.message ?? `Request failed (${response.status})`, {
      code: body?.error?.code,
      details: body?.error?.details,
      status: response.status,
    });
  }
  if (response.status === 204 || !text) {
    return undefined as T;
  }
  if (!body?.data) {
    throw new ApiError("Server returned an empty response", { status: response.status });
  }
  return body.data;
}

export function apiRequest<T>(path: string, accessToken: string, init: RequestInit = {}) {
  return request<T>(path, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...init.headers,
    },
  });
}

export function login(payload: { email: string; password: string; tenantSlug?: string }) {
  return request<LoginResult>("/auth/login", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getAuthConfig() {
  return request<{
    googleClientId: string | null;
    mailConfigured: boolean;
    msg91Otp: { widgetId: string; tokenAuth: string } | null;
  }>("/auth/config");
}

export function requestLoginOtp(payload: { email: string; tenantSlug?: string }) {
  return request<{ message: string; devCode?: string }>("/auth/otp/request", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function verifyLoginOtp(payload: { email: string; code: string; tenantSlug?: string }) {
  return request<LoginResult>("/auth/otp/verify", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function loginWithMsg91Otp(payload: { accessToken: string; tenantSlug?: string }) {
  return request<LoginResult>("/auth/otp/msg91", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function forgotPassword(payload: { email: string; tenantSlug?: string }) {
  return request<{ message: string; devResetUrl?: string }>("/auth/forgot-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function resetPassword(payload: {
  email: string;
  token: string;
  password: string;
  tenantSlug?: string;
}) {
  return request<{ message: string }>("/auth/reset-password", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function loginWithGoogle(payload: { idToken: string; tenantSlug?: string }) {
  return request<LoginResult>("/auth/google", {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export function getDashboard(accessToken: string) {
  return apiRequest<DashboardResult>("/dashboard", accessToken);
}

export async function uploadAvatar(accessToken: string, file: File) {
  const form = new FormData();
  form.append("avatar", file);
  const response = await fetch(`${API_URL}/auth/profile/avatar`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  const body = (await response.json()) as ApiEnvelope<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    avatarUrl: string | null;
  }> & ApiFailure;
  if (!response.ok) {
    throw new Error(body?.error?.message ?? `Upload failed (${response.status})`);
  }
  if (!body?.data) throw new Error("Server returned an empty response");
  return body.data;
}

export function updateAuthProfile(
  accessToken: string,
  payload: { firstName?: string; lastName?: string; phone?: string | null },
) {
  return apiRequest<{
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    phone: string | null;
    avatarUrl: string | null;
  }>("/auth/profile", accessToken, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}

export function changeOwnPassword(
  accessToken: string,
  payload: { currentPassword?: string; newPassword: string },
) {
  return apiRequest<{ message: string }>("/auth/change-password", accessToken, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export async function uploadStudentPhoto(accessToken: string, studentId: string, file: File) {
  const form = new FormData();
  form.append("avatar", file);
  const response = await fetch(`${API_URL}/portal/children/${studentId}/profile/photo`, {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  const body = (await response.json()) as ApiEnvelope<{
    id: string;
    firstName: string;
    lastName: string | null;
    mobile: string | null;
    email: string | null;
    currentAddress: string | null;
    photoUrl: string | null;
    admissionNumber: string;
  }> & ApiFailure;
  if (!response.ok) {
    throw new Error(body?.error?.message ?? `Upload failed (${response.status})`);
  }
  if (!body?.data) throw new Error("Server returned an empty response");
  return body.data;
}

export function updateStudentProfile(
  accessToken: string,
  studentId: string,
  payload: {
    firstName?: string;
    lastName?: string | null;
    mobile?: string | null;
    email?: string | null;
    currentAddress?: string | null;
  },
) {
  return apiRequest<{
    id: string;
    firstName: string;
    lastName: string | null;
    mobile: string | null;
    email: string | null;
    currentAddress: string | null;
    photoUrl: string | null;
    admissionNumber: string;
  }>(`/portal/children/${studentId}/profile`, accessToken, {
    method: "PUT",
    body: JSON.stringify(payload),
  });
}
