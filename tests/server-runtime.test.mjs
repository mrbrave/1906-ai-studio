import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import ts from "typescript";

test("compiled API routes load in native Node ESM and Gemini returns a reply", () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const output = mkdtempSync(join(tmpdir(), "studio-runtime-"));
  try {
    const config = ts.readConfigFile(join(root, "tsconfig.json"), ts.sys.readFile);
    assert.equal(config.error, undefined);
    const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
    const program = ts.createProgram(
      ["dialogue", "archetype", "evaluate"].map((name) => join(root, "api", `${name}.ts`)),
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
    assert.deepEqual(diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, "\n")), []);
    assert.equal(program.emit().emitSkipped, false);
    writeFileSync(join(output, "package.json"), JSON.stringify({ type: "module" }));

    // A fresh process without tsx is essential: tsx resolves extensionless imports
    // which native Node rejects in Vercel's emitted JavaScript.
    const script = `
      import assert from "node:assert/strict";
      import dialogue from "./api/dialogue.js";
      import archetype from "./api/archetype.js";
      import evaluate from "./api/evaluate.js";
      async function invoke(handler, method, body) {
        let data;
        const response = { setHeader() {}, end(value) { data = JSON.parse(value); } };
        await handler({ method, body }, response);
        return { status: response.statusCode, data };
      }
      delete process.env.STUDIO_ENABLE_LIVE;
      for (const handler of [dialogue, archetype, evaluate]) {
        assert.equal((await invoke(handler, "GET")).status, 405);
        assert.equal((await invoke(handler, "POST", {})).status, 503);
      }
      process.env.STUDIO_ENABLE_LIVE = "true";
      process.env.GEMINI_API_KEY = "test-key";
      process.env.GEMINI_MODEL = "test-model";
      let calls = 0;
      globalThis.fetch = async (url, options) => {
        calls++;
        assert.equal(url, "https://generativelanguage.googleapis.com/v1beta/models/test-model:generateContent");
        assert.equal(options.headers["x-goog-api-key"], "test-key");
        assert.equal(JSON.parse(options.body).contents.at(-1).parts[0].text, "Challenge my value proposition");
        return Response.json({ candidates: [{ content: { parts: [{ text: "Show me evidence." }] } }] });
      };
      const result = await invoke(dialogue, "POST", {
        provider: "gemini", history: [], pitch: "Challenge my value proposition",
        archetype: { name: "Sam", role: "Buyer", budget_sensitivity: "Medium", system_prompt: "You are a cautious buyer." }
      });
      assert.deepEqual(result, { status: 200, data: { text: "Show me evidence." } });
      assert.equal(calls, 1);
    `;
    const { NODE_OPTIONS, ...env } = process.env;
    const result = spawnSync(process.execPath, ["--input-type=module", "-e", script], {
      cwd: output,
      env,
      encoding: "utf8",
      timeout: 15000,
    });
    assert.ifError(result.error);
    assert.equal(result.status, 0, result.stderr || result.stdout);
  } finally {
    rmSync(output, { recursive: true, force: true });
  }
});
