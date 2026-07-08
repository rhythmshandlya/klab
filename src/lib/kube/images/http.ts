import type { HttpResponse } from "@ngrok/webernetes";

/** Small helpers for building HTTP responses inside fake images. */

export function textResponse(status: number, body: string): HttpResponse {
  return {
    status,
    header: { "content-type": ["text/plain; charset=utf-8"] },
    body: body.endsWith("\n") ? body : `${body}\n`,
  };
}

export function jsonResponse(status: number, value: unknown): HttpResponse {
  return {
    status,
    header: { "content-type": ["application/json"] },
    body: `${JSON.stringify(value)}\n`,
  };
}

export function htmlResponse(status: number, body: string): HttpResponse {
  return {
    status,
    header: { "content-type": ["text/html; charset=utf-8"] },
    body,
  };
}
