export const getApiUrl = () =>
  process.env.NEXT_PUBLIC_API_URL || "https://job-scraper-ai.onrender.com";

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
function getNetworkErrorMessage(url: string, isRetry = false): string {
  if (isRetry) {
    return `The server is waking up. This can take 30-60 seconds on free hosting. Please try again in a moment, or check if the backend is running at ${url}`;
  }
  return `Cannot reach the backend at ${url}. 1) Open ${url} in your browser — if you see JSON, the server is running. 2) If not, in a new terminal run: cd job-scraper-backend then .\\venv\\Scripts\\activate then uvicorn main:app --reload --port 8000`;
}

/** Check if error is a network/cold-start issue */
function isColdStartError(error: unknown): boolean {
  if (error instanceof TypeError && error.message === "Failed to fetch") return true;
  if (error instanceof Error && error.message.includes("network")) return true;
  return false;
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

  let res: Response | undefined;
  
  // Retry logic for cold start (Render free tier)
  const maxRetries = 2;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      res = await fetch(url, { ...init, headers });
      // If we get any response (even error), break the retry loop
      if (res) break;
    } catch (e) {
      // Only retry on network errors (cold start)
      const isNetworkError = e instanceof TypeError && e.message === "Failed to fetch";
      if (!isNetworkError || attempt === maxRetries) {
        const msg = isNetworkError
          ? getNetworkErrorMessage(baseUrl, attempt > 0)
          : e instanceof Error ? e.message : "Network error";
        throw new Error(msg);
      }
      // Wait before retry (cold start can take 30-60 seconds)
      await new Promise(resolve => setTimeout(resolve, 2000 * (attempt + 1)));
    }
  }

  if (!res || !res.ok) {
    const errorText = res?.statusText || "Request failed";
    try {
      const err = await res?.json().catch(() => ({ detail: errorText }));
      throw new Error(Array.isArray(err.detail) ? err.detail[0]?.msg ?? String(err.detail) : err.detail ?? errorText);
    } catch (e) {
      if (e instanceof Error) throw e;
      throw new Error(errorText);
    }
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
