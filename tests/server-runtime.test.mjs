import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import ts from "typescript";

test("compiled private API routes load in native Node ESM and enforce access", () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const output = mkdtempSync(join(tmpdir(), "studio-runtime-"));
  try {
    const config = ts.readConfigFile(
      join(root, "tsconfig.json"),
      ts.sys.readFile,
    );
    assert.equal(config.error, undefined);
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
    const program = ts.createProgram(
      ["dialogue", "archetype", "evaluate", "studio", "assessment"].map(
        (name) => join(root, "api", `${name}.ts`),
      ),
      {
        ...parsed.options,
        noEmit: false,
        noEmitOnError: true,
        allowImportingTsExtensions: false,
        rootDir: root,
        outDir: output,
      },
    );
    const diagnostics = ts.getPreEmitDiagnostics(program);
    assert.deepEqual(
      diagnostics.map((d) =>
        ts.flattenDiagnosticMessageText(d.messageText, "\n"),
      ),
      [],
    );
    assert.equal(program.emit().emitSkipped, false);
    writeFileSync(
      join(output, "package.json"),
      JSON.stringify({ type: "module" }),
    );

    // A fresh process without tsx is essential: tsx resolves extensionless imports
    // which native Node rejects in Vercel's emitted JavaScript.
    const script = `
      import assert from "node:assert/strict";
      import dialogue from "./api/dialogue.js";
      import archetype from "./api/archetype.js";
      import evaluate from "./api/evaluate.js";
      import studio from "./api/studio.js";
      import assessment from "./api/assessment.js";
      async function invoke(handler, method, body) {
        let data;
        const response = { setHeader() {}, end(value) { data = JSON.parse(value); } };
        await handler({ method, body }, response);
        return { status: response.statusCode, data };
      }
      delete process.env.STUDIO_ENABLE_LIVE;
      for (const handler of [dialogue, archetype, evaluate, studio, assessment]) {
        assert.equal((await invoke(handler, "GET")).status, 405);
        assert.equal((await invoke(handler, "POST", {})).status, 503);
      }
      process.env.STUDIO_ENABLE_LIVE = "true";
      process.env.STUDIO_ACCESS_TOKEN = "private-test-access-code-32-characters";
      for (const handler of [dialogue, archetype, evaluate, studio, assessment]) {
        assert.equal((await invoke(handler, "POST", {})).status, 401);
      }
    `;
    const { NODE_OPTIONS, ...env } = process.env;
    const result = spawnSync(
      process.execPath,
      ["--input-type=module", "-e", script],
      {
        cwd: output,
        env,
        encoding: "utf8",
        timeout: 15000,
      },
    );
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr || result.stdout);
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});
