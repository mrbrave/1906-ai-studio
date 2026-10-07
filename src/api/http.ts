let accessCode = "";
export class ResponseError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function setStudioAccessCode(value: string) {
  accessCode = value;
}
// In memory only; never save provider keys or the access code in browser storage.
export async function postJSON(path: string, body: unknown): Promise<unknown> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 125000);
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessCode ? { Authorization: `Bearer ${accessCode}` } : {}),
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok)
      throw new ResponseError(
        response.status,
        data?.error ||
          `Request failed (${response.status}). Check the server configuration.`,
      );
    if (!data) throw new Error("The server returned an invalid response.");
    return data;
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error(
        "The request timed out. Refresh Studio status before retrying the same turn.",
      );
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}
