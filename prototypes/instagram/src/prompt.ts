// The instructions every candidate gets, word for word, so the comparison is
// between models and not between prompts. Keep one copy: never tune it per
// candidate.

export const INSTRUCTIONS = `You read one Instagram post and extract the recipe it holds.

You may be given its caption, a transcript of its speech, frames from its video, the video itself, or the images of a carousel. The recipe can be in any of them.

Answer in the given JSON schema:
- Keep the post's language. Never translate. Set "language" to its BCP 47 tag.
- Use only what the post gives. Never invent an ingredient, a quantity or a step.
- Set "quantity" and "unit" to null when the post doesn't state them, and "servings" and "time" to null when it doesn't state them.
- Write the steps in order.
- If the post holds no recipe, answer {"recipe": null}.`;

/** The text part of a request: the caption, and the transcript when the candidate has one. */
export function postText(caption: string, transcript: string | null): string {
  const parts = [`Caption:\n${caption || "(none)"}`];
  if (transcript !== null) parts.push(`Transcript of the speech:\n${transcript || "(none)"}`);
  return parts.join("\n\n");
}
