import type { Store } from "./repository";
import { upgradePersonaData } from "../src/services/personaCompatibility.js";

/** Read adapter; persisted only by an ordinary, revision-checked write. */
export function upgradePersonaStore(state: Store): Store {
  if (state.schemaVersion !== 1 || state.data.version !== 1)
    throw new Error("Unsupported Studio schema.");
  const next = structuredClone(state);
  next.data = upgradePersonaData(state.data);
  // Historical conversation snapshots, private priors and ledger are deliberately untouched.
  return next;
}
