import { endpoint, HttpError } from "../server/http.js";
export default endpoint(async () => {
  throw new HttpError(
    410,
    "JEV now runs before Gemini inside each Studio dialogue turn. Refresh the application.",
  );
});
