/**
 * Build script: merges per-language pattern files into a single patterns.json
 * for serving via Vercel/CDN.
 *
 * Usage: npx tsx scripts/build.ts
 */

import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join } from "path";

interface Detection {
  match: string;
  kind: "connection" | "endpoint";
  protocol: string;
  confidence: "high" | "medium" | "low";
  target_extraction: string;
}

interface Pattern {
  id: string;
  name: string;
  description: string;
  import_gate: string[];
  detections: Detection[];
}

interface LanguagePatterns {
  language: string;
  patterns: Pattern[];
}

interface PatternBundle {
  version: string;
  updated_at: string;
  languages: LanguagePatterns[];
  total_patterns: number;
  total_detections: number;
}

const PATTERNS_DIR = join(__dirname, "..", "patterns");
const OUTPUT_FILE = join(__dirname, "..", "public", "v1", "patterns.json");

function build(): void {
  const files = readdirSync(PATTERNS_DIR).filter((f) => f.endsWith(".json"));
  const languages: LanguagePatterns[] = [];
  let totalPatterns = 0;
  let totalDetections = 0;

  for (const file of files.sort()) {
    const language = file.replace(".json", "");
    const content = readFileSync(join(PATTERNS_DIR, file), "utf-8");
    const patterns: Pattern[] = JSON.parse(content);

    // Validate
    for (const pattern of patterns) {
      if (!pattern.id || !pattern.name || !Array.isArray(pattern.import_gate)) {
        throw new Error(
          `Invalid pattern in ${file}: ${JSON.stringify(pattern)}`
        );
      }
      if (!pattern.detections?.length) {
        throw new Error(`Pattern ${pattern.id} in ${file} has no detections`);
      }
      for (const det of pattern.detections) {
        if (!det.match || !det.protocol || !det.confidence) {
          throw new Error(
            `Invalid detection in ${pattern.id}: ${JSON.stringify(det)}`
          );
        }
      }
      totalDetections += pattern.detections.length;
    }

    totalPatterns += patterns.length;
    languages.push({ language, patterns });
  }

  const bundle: PatternBundle = {
    version: "1.0",
    updated_at: new Date().toISOString(),
    languages,
    total_patterns: totalPatterns,
    total_detections: totalDetections,
  };

  writeFileSync(OUTPUT_FILE, JSON.stringify(bundle, null, 2));
  console.log(
    `Built ${OUTPUT_FILE}: ${totalPatterns} patterns, ${totalDetections} detections across ${languages.length} languages`
  );
}

build();
