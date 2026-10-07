import { endpoint } from "../server/http.js";
import { runOperation } from "../server/turn.js";
import { createRepository } from "../server/repository.js";
export default endpoint((body) =>
  runOperation("assessment", body, createRepository()),
);
