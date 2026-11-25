import { isAbsolute, relative, resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "../../..");

/**
 * Whether a path is inside this repo. Answers, outputs and recordings hold
 * other people's content or describe it, so every folder a script writes or
 * reads them from must be outside it.
 */
export function insideRepo(path: string): boolean {
  const fromRepo = relative(repoRoot, path);
  return !fromRepo.startsWith("..") && !isAbsolute(fromRepo);
}
