import { AI_MODULE } from "../config/groqSdkConfig.js";
import { ChatCompletionMessageParam } from "groq-sdk/resources/chat.mjs";

const MAX_TOKENS = 500;
const TEMPERATURE = 0.4;

export class CodeCompletion {
  public static async getCodeCompletion(codeBeforeCursor: string): Promise<string> {
    try {
      if (!codeBeforeCursor.trim()) return "";

      const messages: ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: `
You are an AI pair programmer providing inline code completions.
Follow these rules strictly:
1. You only write the *next part of code* after the <CURSOR> marker.
2. Never repeat, modify, or rewrite existing code before <CURSOR>.
3. If <CURSOR> is at the end of a complete statement or declaration, respond with an empty string.
4. Never include comments, markdown, or explanations — return raw code only.
5. Produce concise, syntactically correct continuations.
6. Do not redeclare variables (e.g., if "const" already typed, do not start with "const" again).
7. Prefer completing the line or statement the user has started.
8. Minimize whitespace; don't add extra blank lines.
          `.trim(),
        },
        {
          role: "user",
          content: `${codeBeforeCursor}<CURSOR>`,
        },
      ];

      const response = await AI_MODULE.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages,
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
      });

      const text = response?.choices?.[0]?.message?.content?.trim() || "";

      // Cleanup redundancy like "const const" or repeating keywords
      const cleaned = text.replace(/\b(const|let|var)\s+\1\b/, "$1").trim();

      return cleaned;
    } catch (error) {
      console.error("Error in CodeCompletion.getCodeCompletion:", error);
      return "";
    }
  }
}
