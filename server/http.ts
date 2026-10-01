import type { IncomingMessage, ServerResponse } from "node:http";
export type Request = IncomingMessage & { body?: unknown };
export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export function endpoint(action: (body: unknown) => Promise<unknown>) {
  return async (req: Request, res: ServerResponse) => {
    res.setHeader("Content-Type", "application/json");
    res.setHeader("Cache-Control", "no-store");
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      res.statusCode = 405;
      res.end(JSON.stringify({ error: "Use POST." }));
      return;
    }
    try {
      if (process.env.STUDIO_ENABLE_LIVE !== "true")
        throw new HttpError(
          503,
          "Live engines are not enabled. Use demo mode or configure the server.",
        );
      let body: unknown = req.body;
      if (body === undefined) {
        let raw = "";
        for await (const chunk of req) {
          raw += chunk;
          if (Buffer.byteLength(raw) > 128000)
            throw new HttpError(413, "Request too large.");
        }
        try {
          body = JSON.parse(raw);
        } catch {
          throw new HttpError(400, "Invalid JSON.");
        }
      } else if (typeof body === "string") {
        if (Buffer.byteLength(body) > 128000)
          throw new HttpError(413, "Request too large.");
        try {
          body = JSON.parse(body);
        } catch {
          throw new HttpError(400, "Invalid JSON.");
        }
      } else if (Buffer.byteLength(JSON.stringify(body)) > 128000)
        throw new HttpError(413, "Request too large.");
      const result = await action(body);
      res.statusCode = 200;
      res.end(JSON.stringify(result));
    } catch (error) {
      res.statusCode = error instanceof HttpError ? error.status : 400;
      res.end(
        JSON.stringify({
          error:
            error instanceof HttpError
              ? error.message
              : "Invalid request or response data.",
        }),
      );
    }
  };
}
