import { endpoint } from "../server/http.js";
import { evaluateWithJEV } from "../server/jev.js";
import {
  nonEmpty,
  parseDraft,
  parseTelemetry,
  record,
} from "../src/api/validation.js";
export default endpoint(async (value) => {
  const body = record(value);
  const a = record(body.archetype);
  const archetype = {
    ...parseDraft(a),
    id: nonEmpty(a.id),
    user_id: nonEmpty(a.user_id),
    avatar: nonEmpty(a.avatar),
    created_at: nonEmpty(a.created_at),
  };
  return parseTelemetry(
    await evaluateWithJEV({
      archetype,
      pitch: nonEmpty(body.pitch),
      response: nonEmpty(body.response),
    }),
  );
});
