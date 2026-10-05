import { endpoint } from "../server/http.js";
import { studio } from "../server/studio.js";
import { createRepository } from "../server/repository.js";
export default endpoint((body) => studio(body, createRepository()));
