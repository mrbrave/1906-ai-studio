import { endpoint } from "../server/http.js";
import { complete, parseProvider } from "../server/provider.js";
import { nonEmpty, parseDraft, record } from "../src/api/validation.js";
export default endpoint(async (value) => {
  const body = record(value);
  const text = await complete(
    parseProvider(body.provider),
    "Create a synthetic buyer from the description. Return only a JSON object with name (string), role (string), budget_sensitivity (Low, Medium or High), system_prompt (string of concise in-character buyer instructions).",
    [{ role: "user", content: nonEmpty(body.description, 4000) }],
    true,
  );
  return parseDraft(JSON.parse(text));
});
