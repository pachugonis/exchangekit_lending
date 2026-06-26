// Тонкая обёртка над fetch к backend. На клиенте идём через /api (next rewrites).
const BASE = "";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    },
    credentials: "include",
  });

  if (!res.ok) {
    let detail = "Ошибка запроса";
    try {
      const data = await res.json();
      detail = data.detail || detail;
    } catch {
      // ignore
    }
    throw new ApiError(res.status, detail);
  }

  if (res.status === 204) return undefined as T;
  const text = await res.text();
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

export interface User {
  id: string;
  email: string;
  is_email_verified: boolean;
  created_at: string;
}

export interface LicenseStatus {
  has_license: boolean;
  license_id: string | null;
  filename: string | null;
  sold_at: string | null;
}

export const api = {
  register: (email: string, password: string) =>
    request<{ message: string }>("/api/register", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  login: (email: string, password: string) =>
    request<User>("/api/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  logout: () => request<{ message: string }>("/api/logout", { method: "POST" }),

  me: () => request<User>("/api/me"),

  verify: (token: string) =>
    request<{ message: string }>(`/api/verify?token=${encodeURIComponent(token)}`),

  licenseStatus: () => request<LicenseStatus>("/api/license/me"),

  createPayment: () =>
    request<{ confirmation_url: string; payment_id: string }>(
      "/api/payment/create",
      { method: "POST" }
    ),
};
