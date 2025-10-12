import { AI_MODULE } from "../config/groqSdkConfig.js";
import { ChatCompletionMessageParam } from "groq-sdk/resources/chat.mjs";

const MAX_TOKENS = 40; // small for inline completion
const TEMPERATURE = 0.2; // deterministic

export class CodeCompletion {
  public static async getCodeCompletion(codeBeforeCursor: string): Promise<string> {
    try {
      if (!codeBeforeCursor.trim()) return "";

      const messages: ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: `
You are an expert AI coding assistant for inline completions.
Rules:
1. Only continue from the cursor position; do not modify preceding code.
2. Never rewrite or duplicate existing code.
3. Output **valid, syntactically correct code** only.
4. Complete only the partially typed statement, expression, or line.
5. Do not redeclare variables, functions, or imports that already exist in the current scope.
6. If the cursor is at the end of a complete line or statement, return an empty string.
7. Never include explanations, comments, or markdown; return raw code only.
8. Avoid introducing unnecessary whitespace or new lines.
9. If uncertain how to complete, return the minimal valid continuation.
10. Assume the language context is provided (e.g., JavaScript, TypeScript, Python, etc.) and follow its syntax strictly.
        `.trim(),
        },
        {
          role: "user",
          content: codeBeforeCursor,
        },
      ];

      const response = await AI_MODULE.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages,
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
      });

      return response.choices?.[0]?.message?.content?.replace(/^(\s*)(const|let|var)\s+\1\2\s+/, "$1$2 ").trim() || "";
    } catch (error) {
      console.error("Error in CodeCompletion.getCodeCompletion:", error);
      return "";
    }
  }
}
