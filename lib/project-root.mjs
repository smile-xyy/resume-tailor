import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Resolve bundled assets for both supported layouts:
 * - a standalone clone, where the current directory is this repository;
 * - a workspace checkout, where this repository lives in ./resume-tailor.
 */
export function resolveProjectRoot(workspaceRoot, requiredPath, moduleUrl) {
  const scriptRoot = path.dirname(path.dirname(fileURLToPath(moduleUrl)));
  const candidates = [
    path.resolve(workspaceRoot),
    path.resolve(workspaceRoot, "resume-tailor"),
    scriptRoot,
  ];

  const resolved = candidates.find((candidate) => fs.existsSync(path.join(candidate, requiredPath)));
  if (!resolved) {
    throw new Error(`Missing bundled asset: ${requiredPath}`);
  }
  return resolved;
}
