/**
 * tests/installer-sync.test.ts — public installer copies stay byte-identical
 * to the canonical provider/scripts/install.sh.
 * Run: npx tsx --test tests/installer-sync.test.ts
 */
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const SRC = path.join(ROOT, "provider/scripts/install.sh");
const COPY_A = path.join(ROOT, "public/install.sh");
const COPY_B = path.join(ROOT, "public/provider/install.sh");

describe("installer sync", () => {
  it("canonical source exists", () => {
    assert.ok(fs.existsSync(SRC), SRC);
  });

  it("public/install.sh is byte-identical to provider/scripts/install.sh", () => {
    assert.deepEqual(fs.readFileSync(COPY_A), fs.readFileSync(SRC));
  });

  it("public/provider/install.sh is byte-identical to provider/scripts/install.sh", () => {
    assert.deepEqual(fs.readFileSync(COPY_B), fs.readFileSync(SRC));
  });
});
