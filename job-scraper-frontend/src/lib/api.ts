export const getApiUrl = () =>
  process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000";

const API_PREFIX = "/api";

/** Full URL for profile image (backend stores path like uploads/xxx.jpg) */
export function getProfileImageUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${getApiUrl()}/${path.replace(/^\/+/, "")}`;
}

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("token");
}

/** User-friendly message when the request never reaches the server */
function getNetworkErrorMessage(url: string): string {
  return `Cannot reach the backend at ${url}. 1) Open ${url} in your browser — if you see JSON, the server is running. 2) If not, in a new terminal run: cd job-scraper-backend then .\\venv\\Scripts\\activate then uvicorn main:app --reload --port 8000`;
}

export async function fetchApi<T>(
  path: string,
  options: RequestInit & { token?: string | null } = {}
): Promise<T> {
  const { token = getToken(), ...init } = options;
  const baseUrl = getApiUrl();
  const url = `${baseUrl}${API_PREFIX}${path}`;
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    ...(init.headers as Record<string, string>),
  };
  if (token) (headers as Record<string, string>)["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(url, { ...init, headers });
  } catch (e) {
    const msg = e instanceof TypeError && e.message === "Failed to fetch"
      ? getNetworkErrorMessage(baseUrl)
      : e instanceof Error ? e.message : "Network error";
    throw new Error(msg);
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(Array.isArray(err.detail) ? err.detail[0]?.msg ?? String(err.detail) : err.detail ?? "Request failed");
  }
  return res.json();
}

/** Upload profile image (file); returns { profile_image: string } */
export async function uploadProfileImage(file: File): Promise<{ profile_image: string }> {
  const baseUrl = getApiUrl();
  const url = `${baseUrl}${API_PREFIX}/profile/image`;
  const token = getToken();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(url, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Upload failed");
  }
  return res.json();
}

/** Full URL for resume file */
export function getResumeUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (path.startsWith("http")) return path;
  return `${getApiUrl()}/${path.replace(/^\/+/, "")}`;
}

/** Upload resume file (file); returns { resume: string } */
export async function uploadResume(file: File): Promise<{ resume: string }> {
  const baseUrl = getApiUrl();
  const url = `${baseUrl}${API_PREFIX}/profile/resume`;
  const token = getToken();
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(url, {
    method: "POST",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: form,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Upload failed");
  }
  return res.json();
}

/** Delete resume */
export async function deleteResume(): Promise<void> {
  const baseUrl = getApiUrl();
  const url = `${baseUrl}${API_PREFIX}/profile/resume`;
  const token = getToken();
  const res = await fetch(url, {
    method: "DELETE",
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: res.statusText }));
    throw new Error(err.detail ?? "Delete failed");
  }
}
