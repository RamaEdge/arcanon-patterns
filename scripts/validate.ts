/**
 * Validates all pattern files against the schema.
 * Run as CI check: npx tsx scripts/validate.ts
 * Exit 0 = valid, Exit 1 = errors found.
 */

import { readFileSync, readdirSync } from "fs";
import { join } from "path";

const PATTERNS_DIR = join(__dirname, "..", "patterns");

const VALID_CONFIDENCES = ["high", "medium", "low"];
const VALID_KINDS = ["connection", "endpoint"];
const VALID_EXTRACTIONS = [
  "none",
  "first_string_arg",
  "url_hostname",
  "env_default",
  // named_arg:<name> is dynamic, checked separately
];

let errors = 0;

function err(file: string, msg: string): void {
  console.error(`ERROR [${file}]: ${msg}`);
  errors++;
}

function warn(file: string, msg: string): void {
  console.warn(`WARN  [${file}]: ${msg}`);
}

const allIds = new Set<string>();

const files = readdirSync(PATTERNS_DIR).filter((f) => f.endsWith(".json"));

for (const file of files) {
  const content = readFileSync(join(PATTERNS_DIR, file), "utf-8");
  let patterns: any[];

  try {
    patterns = JSON.parse(content);
  } catch (e) {
    err(file, `Invalid JSON: ${e}`);
    continue;
  }

  if (!Array.isArray(patterns)) {
    err(file, "Root must be an array");
    continue;
  }

  for (const p of patterns) {
    // Required fields
    if (!p.id) err(file, `Pattern missing 'id'`);
    if (!p.name) err(file, `Pattern ${p.id || "?"} missing 'name'`);
    if (!p.description)
      err(file, `Pattern ${p.id || "?"} missing 'description'`);

    // Unique ID check
    if (p.id && allIds.has(p.id)) {
      err(file, `Duplicate pattern ID: ${p.id}`);
    }
    allIds.add(p.id);

    // ID format: lowercase with hyphens
    if (p.id && !/^[a-z0-9-]+$/.test(p.id)) {
      err(file, `Pattern ID '${p.id}' must be lowercase alphanumeric with hyphens`);
    }

    // Import gate — must be present as an array; empty is allowed for patterns
    // that match globally available APIs (e.g. process.env, ENV[], IConfiguration)
    if (!Array.isArray(p.import_gate)) {
      err(file, `Pattern ${p.id} must have an 'import_gate' array (use [] if no import needed)`);
    }

    // Detections
    if (!Array.isArray(p.detections) || p.detections.length === 0) {
      err(file, `Pattern ${p.id} must have non-empty 'detections' array`);
    }

    for (const d of p.detections || []) {
      if (!d.match) err(file, `Detection in ${p.id} missing 'match'`);
      if (!d.protocol) err(file, `Detection in ${p.id} missing 'protocol'`);

      if (d.confidence && !VALID_CONFIDENCES.includes(d.confidence)) {
        err(file, `Detection in ${p.id} has invalid confidence: ${d.confidence}`);
      }

      if (d.kind && !VALID_KINDS.includes(d.kind)) {
        err(file, `Detection in ${p.id} has invalid kind: ${d.kind}`);
      }

      if (d.target_extraction) {
        const isNamedArg = d.target_extraction.startsWith("named_arg:");
        if (!isNamedArg && !VALID_EXTRACTIONS.includes(d.target_extraction)) {
          err(file, `Detection in ${p.id} has invalid target_extraction: ${d.target_extraction}`);
        }
      }

      // Warn on very short match strings (high false positive risk)
      if (d.match && d.match.length < 4) {
        warn(file, `Detection in ${p.id} has very short match '${d.match}' — may cause false positives`);
      }
    }
  }
}

console.log(`\nValidated ${files.length} files, ${allIds.size} patterns`);

if (errors > 0) {
  console.error(`\n${errors} error(s) found`);
  process.exit(1);
} else {
  console.log("All patterns valid");
  process.exit(0);
}
