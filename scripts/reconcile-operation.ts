/** Operator-only recovery. JSON on stdin: {operationId, unknownCostUsd, reason}.
 * Use only after checking provider usage. Requires the same server env as deployment.
 */
import { randomUUID } from "node:crypto";
import { createRepository, mutate } from "../server/repository.js";
import { dollars } from "../server/budget.js";
import { id } from "../server/studio.js";
let input = "";
for await (const chunk of process.stdin) input += chunk;
const request = JSON.parse(input),
  key = id(request.operationId);
const amount = dollars(request.unknownCostUsd);
if (typeof request.reason !== "string" || request.reason.trim().length < 10)
  throw new Error("A reconciliation reason is required.");
await mutate(createRepository(), (s) => {
  const op = s.operations.find((o) => o.id === key);
  if (!op) throw new Error("Operation not found.");
  if (!["running", "uncertain"].includes(op.status))
    throw new Error("Only interrupted operations can be reconciled.");
  if (op.status === "running" && Date.now() - Date.parse(op.startedAt) < 180000)
    throw new Error("Wait until the request is certainly no longer running.");
  for (const attempt of op.attempts)
    if (["started", "uncertain"].includes(attempt.status)) {
      attempt.status = "rejected";
      attempt.cost = 0;
    }
  s.adjustments.push({
    id: randomUUID(),
    operationId: key,
    cost: amount,
    reason: request.reason.trim(),
    at: new Date().toISOString(),
  });
  op.status = "failed";
  op.reserve = 0;
  op.error = "Usage reconciled by the administrator. Retry the saved request.";
  const message = s.data.messages.find((m) => m.id === key);
  if (message) {
    message.status = "failed";
    message.error = op.error;
  }
});
console.log(
  "Operation reconciled. Refresh Studio, then retry the saved request.",
);
