import { HttpError } from "./http.js";
export class ProviderFailure extends HttpError {
  constructor(
    message: string,
    public uncertain: boolean,
  ) {
    super(502, message);
  }
}
export async function modelPost(
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<any> {
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...headers },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw new ProviderFailure(
      "The provider request was interrupted. Usage needs administrator review before retrying.",
      true,
    );
  }
  if (!response.ok) {
    // Conservatively retain the reservation for ambiguous server/payment outcomes.
    const uncertain = ![400, 401, 403, 422, 429].includes(response.status);
    throw new ProviderFailure(
      `The provider could not complete this request (${response.status}).${uncertain ? " Usage needs administrator review." : " Check configuration or retry later."}`,
      uncertain,
    );
  }
  try {
    return await response.json();
  } catch {
    throw new ProviderFailure(
      "The provider returned unreadable data. Usage needs administrator review.",
      true,
    );
  }
}
