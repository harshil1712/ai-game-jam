/**
 * Return a JSON Response with proper Content-Type header.
 */
export function jsonResponse(
  data: unknown,
  status = 200,
  extraHeaders?: Record<string, string>
): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...extraHeaders }
  });
}

/**
 * Return a JSON error response: { error: string }.
 */
export function errorResponse(error: string, status: number): Response {
  return jsonResponse({ error }, status);
}

/**
 * Returns a 405 Response if request.method doesn't match, otherwise null.
 * Usage: const err = assertMethod(request, "POST"); if (err) return err;
 */
export function assertMethod(
  request: Request,
  method: string
): Response | null {
  if (request.method !== method) {
    return new Response("Method not allowed", { status: 405 });
  }
  return null;
}
