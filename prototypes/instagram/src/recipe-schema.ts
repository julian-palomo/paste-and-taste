// The recipe shape the candidates are measured against. Nothing outside the
// prototype imports it: it exists to measure with, not as the app's model.

import { z } from "zod";

const Ingredient = z
  .object({
    name: z.string().min(1),
    quantity: z.string().nullable(),
    unit: z.string().nullable(),
  })
  .strict();

const Recipe = z
  .object({
    title: z.string().min(1),
    /** BCP 47 tag of the post's language: recipes stay in the language they came in. */
    language: z.string().min(2),
    servings: z.string().nullable(),
    time: z.string().nullable(),
    ingredients: z.array(Ingredient).min(1),
    steps: z.array(z.string().min(1)).min(1),
  })
  .strict();

/** `recipe: null` is the right answer for a post that holds no recipe. */
const Answer = z.object({ recipe: Recipe.nullable() }).strict();

const { $schema: _dialect, ...jsonSchema } = z.toJSONSchema(Answer);

/** The JSON Schema each provider's structured output is given, without its `$schema` key. */
export const answerJsonSchema: Record<string, unknown> = jsonSchema;

export type Checked = { valid: boolean; answer: unknown };

/** Parses a model's text and validates it; an answer that doesn't is a failure, kept for the owner to see. */
export function checkAnswer(text: string): Checked {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return { valid: false, answer: text };
  }
  const result = Answer.safeParse(parsed);
  return { valid: result.success, answer: parsed };
}
