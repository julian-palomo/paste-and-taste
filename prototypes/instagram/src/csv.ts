import { readFile } from "node:fs/promises";

/** The rows of a header-first CSV whose cells hold no commas, without the header. */
export async function readCsv(path: string): Promise<string[][]> {
  return (await readFile(path, "utf8"))
    .split("\n")
    .slice(1)
    .filter((line) => line.trim() !== "")
    .map((line) => line.split(",").map((cell) => cell.trim()));
}
