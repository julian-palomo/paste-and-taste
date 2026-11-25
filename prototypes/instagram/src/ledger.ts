// What every paid call of the issue cost, in one file outside the repo. Every
// run uses the same ledger, so the budget check counts the dry runs too and
// the total needs no sum by hand.

import { readFile, writeFile } from "node:fs/promises";

type Entry = { at: string; post: number; step: string; model: string; costUsd: number };

export class Ledger {
  private readonly path: string;
  private readonly entries: Entry[];
  readonly budgetUsd: number;

  private constructor(path: string, entries: Entry[], budgetUsd: number) {
    this.path = path;
    this.entries = entries;
    this.budgetUsd = budgetUsd;
  }

  static async open(path: string, budgetUsd: number): Promise<Ledger> {
    let entries: Entry[] = [];
    try {
      entries = JSON.parse(await readFile(path, "utf8")).entries;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
    }
    return new Ledger(path, entries, budgetUsd);
  }

  get totalUsd(): number {
    return this.entries.reduce((sum, entry) => sum + entry.costUsd, 0);
  }

  /** Whether a call whose worst case is `estimateUsd` keeps the total within the budget. */
  allows(estimateUsd: number): boolean {
    return this.totalUsd + estimateUsd <= this.budgetUsd;
  }

  async add(entry: Omit<Entry, "at">): Promise<void> {
    this.entries.push({ at: new Date().toISOString(), ...entry });
    await writeFile(
      this.path,
      `${JSON.stringify({ totalUsd: this.totalUsd, entries: this.entries }, null, 2)}\n`,
    );
  }
}
