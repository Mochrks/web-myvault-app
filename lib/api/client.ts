import type { ApiResponse } from "@/types/vault";

export class ClientApiError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status: number) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export async function apiRequest<T>(
  input: RequestInfo | URL,
  init?: RequestInit
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(input, {
      ...init,
      headers: {
        ...(init?.body instanceof FormData
          ? {}
          : { "Content-Type": "application/json" }),
        ...init?.headers,
      },
    });
  } catch {
    throw new ClientApiError(
      "NETWORK_ERROR",
      "Network error. Please check your connection and try again.",
      0
    );
  }

  let payload: ApiResponse<T>;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ClientApiError(
      "INVALID_RESPONSE",
      `Server returned an unexpected response (${response.status}).`,
      response.status
    );
  }

  if (!response.ok || !payload.success) {
    const code = !payload.success ? payload.error.code : "REQUEST_FAILED";
    const message = !payload.success
      ? payload.error.message
      : `Request failed (${response.status}).`;

    if (response.status === 401 && typeof window !== "undefined") {
      if (!window.location.pathname.startsWith("/login")) {
        window.location.href = "/login";
      }
    }

    throw new ClientApiError(code, message, response.status);
  }

  return payload.data;
}
