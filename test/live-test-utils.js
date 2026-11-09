export async function probeLiveProvider(url, {
  fetchFn = globalThis.fetch,
  headers,
  required = false,
  timeoutMs = 3000
} = {}) {
  let reason;
  try {
    const response = await fetchFn(url, {
      headers,
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (response.ok) {
      return { available: true, reason: null };
    }
    reason = `HTTP ${response.status}${response.statusText ? ` ${response.statusText}` : ''}`;
  } catch (error) {
    reason = error instanceof Error ? error.message : String(error);
  }

  if (required) {
    throw new Error(`Live provider preflight failed: ${reason}`);
  }
  return { available: false, reason };
}
