import { AI_MODULE } from "../config/groqSdkConfig.js";
import { ChatCompletionMessageParam } from "groq-sdk/resources/chat.mjs";

const MAX_TOKENS = 500;
const TEMPERATURE = 0.3; // lower temperature for deterministic code

export class CodeCompletion {
  //! Generate code completion for a given code context
  public static async getCodeCompletion(codeContext: string): Promise<string> {
    try {
      if (!codeContext || codeContext.trim().length === 0) return "";

      //? Prepare messages
      const messages: ChatCompletionMessageParam[] = [
        {
          role: "system",
          content:
            "You are a helpful AI coding assistant. Generate code completions or suggestions based on the provided code context.",
        },
        {
          role: "user",
          content: codeContext,
        },
      ];

      //? Call AI
      const response = await AI_MODULE.chat.completions.create({
        model: "mixtral-8x7b-32768",
        messages,
        temperature: TEMPERATURE,
        max_tokens: MAX_TOKENS,
      });

      //? Extract AI-generated code
      const codeSuggestion = response.choices?.[0]?.message?.content?.trim() || "";
      return codeSuggestion;
    } catch (error) {
      console.error("Error in CodeCompletion.getCodeCompletion:", error);
      return "";
    }
  }
}
