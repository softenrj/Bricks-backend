import { Google_GenAI } from "../config/groqSdkConfig.js";

export class FullCodeCompletion {
    public static async getCodeCompletion(
        userCode: string,
        fileName: string,
        fileLanguage: string
    ): Promise<string> {
        try {
            if (!userCode.trim()) return "";

            const systemPrompt = `
You are an expert AI code generation assistant. Your sole purpose is to take the user's code, fix, improve, or complete it into a single, production-ready file.

FILE CONTEXT:
- File Name: ${fileName}
- Language: ${fileLanguage}

STRICT INSTRUCTIONS:
1. **Analyze and Generate:** Analyze the user's code. Based on the context, provide the **full, complete, and correct** code for the specified file. This may involve fixing bugs, completing snippets, or refactoring for best practices.
2. **Quality:** The code *must* be clean, modern, stable, and production-ready.
3. **React/Tailwind:** If the file is a React component (.tsx or .jsx):
   * You **MUST** use **Tailwind CSS** for all styling.
   * You **MUST** generate a **single-file component**. All logic, TSX/JSX, and styling (via Tailwind class names) must be contained within this one file. Do not suggest other files.
   * If the user's code includes "use client", maintain it as it signifies a Next.js Client Component.
4. **CRITICAL OUTPUT FORMAT:**
   * Your response **MUST** contain *only* the raw code for the file.
   * ABSOLUTELY NO markdown code fences (\`\`\`tsx, \`\`\`javascript, or \`\`\`).
   * ABSOLUTELY NO explanations, apologies, or conversational text (e.g., "Here is the code:", "I have fixed...").

Start generating the code immediately.
      `.trim();

            const response = await Google_GenAI.models.generateContent({
                model: "gemini-2.5-flash",
                contents: [
                    {
                        role: "user",
                        parts: [
                            { text: systemPrompt },
                            { text: userCode },
                        ],
                    },
                ],
            });

            const text = response?.text?.trim() || "";
            const cleaned = text.replace(/^(```[\w]*\n)|(\n```)$|(```)$/g, "").trim();

            return cleaned;
        } catch (error) {
            console.error("Error in CodeCompletion.getCodeCompletion:", error);
            return "";
        }
    }
}
