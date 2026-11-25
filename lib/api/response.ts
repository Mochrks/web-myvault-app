import { NextResponse } from "next/server";
import type { ApiResponse } from "@/types/vault";

export function apiSuccess<T>(data: T, status = 200): NextResponse<ApiResponse<T>> {
  return NextResponse.json(
    {
      success: true,
      data,
      error: null,
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

export function apiError(
  code: string,
  message: string,
  status = 400,
  details?: unknown
): NextResponse<ApiResponse<never>> {
  return NextResponse.json(
    {
      success: false,
      data: null,
      error: {
        code,
        message,
        ...(details !== undefined ? { details } : {}),
      },
    },
    {
      status,
      headers: {
        "Cache-Control": "no-store",
      },
    }
  );
}

export class VaultAppError extends Error {
  readonly code: string;
  readonly status: number;

  constructor(code: string, message: string, status = 400) {
    super(message);
    this.name = "VaultAppError";
    this.code = code;
    this.status = status;
  }
}

export function handleRouteError(error: unknown): NextResponse<ApiResponse<never>> {
  if (error instanceof VaultAppError) {
    return apiError(error.code, error.message, error.status);
  }

  const message = error instanceof Error ? error.message : "Unexpected server error";
  console.error("[myvault-api-error]", message);
  return apiError("INTERNAL_ERROR", "An internal server error occurred.", 500);
}
