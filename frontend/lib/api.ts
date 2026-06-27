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
  is_admin: boolean;
  created_at: string;
}

export interface AdminStats {
  users_total: number;
  users_verified: number;
  licenses_total: number;
  licenses_free: number;
  licenses_reserved: number;
  licenses_sold: number;
  payments_succeeded: number;
  payments_pending: number;
  revenue_total: string;
}

export interface AdminLicense {
  id: string;
  filename: string;
  status: string;
  user_email: string | null;
  sold_at: string | null;
  created_at: string;
}

export interface AdminClient {
  id: string;
  email: string;
  is_email_verified: boolean;
  is_admin: boolean;
  created_at: string;
  has_license: boolean;
  license_filename: string | null;
  sold_at: string | null;
  payments_count: number;
  total_paid: string;
}

export interface AdminPayment {
  id: string;
  user_email: string | null;
  yookassa_payment_id: string;
  amount: string;
  status: string;
  license_filename: string | null;
  created_at: string;
}

export interface Paged<T> {
  items: T[];
  total: number;
}

export interface LicenseUploadResult {
  created: number;
  skipped: number;
  errors: string[];
  free_total: number;
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

  admin: {
    stats: () => request<AdminStats>("/api/admin/stats"),

    licenses: (params: { status?: string; limit?: number; offset?: number } = {}) =>
      request<Paged<AdminLicense>>(`/api/admin/licenses${qs(params)}`),

    deleteLicense: (id: string) =>
      request<void>(`/api/admin/licenses/${id}`, { method: "DELETE" }),

    clients: (params: { search?: string; limit?: number; offset?: number } = {}) =>
      request<Paged<AdminClient>>(`/api/admin/clients${qs(params)}`),

    payments: (params: { status?: string; limit?: number; offset?: number } = {}) =>
      request<Paged<AdminPayment>>(`/api/admin/payments${qs(params)}`),

    uploadLicenses: async (files: FileList | File[]): Promise<LicenseUploadResult> => {
      const form = new FormData();
      Array.from(files).forEach((f) => form.append("files", f, f.name));
      const res = await fetch("/api/admin/licenses/upload", {
        method: "POST",
        body: form,
        credentials: "include",
      });
      if (!res.ok) {
        let detail = "Не удалось загрузить файлы";
        try {
          const data = await res.json();
          detail = data.detail || detail;
        } catch {
          // ignore
        }
        throw new ApiError(res.status, detail);
      }
      return res.json();
    },
  },
};

function qs(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(
    ([, v]) => v !== undefined && v !== ""
  );
  if (entries.length === 0) return "";
  const sp = new URLSearchParams();
  entries.forEach(([k, v]) => sp.set(k, String(v)));
  return `?${sp.toString()}`;
}
