import { AI_MODULE } from "../config/groqSdkConfig.js";
import { ChatCompletionMessageParam } from "groq-sdk/resources/chat.mjs";

const TEMPERATURE = 0.4;

export class FullCodeCompletion {
    public static async getCodeCompletion(userCode: string): Promise<string> {
        try {
            if (!userCode.trim()) return "";

            const messages: ChatCompletionMessageParam[] = [
                {
                    role: "system",
                    content: `You are an expert full-stack developer specializing in React, Next.js (App Router), TypeScript, Tailwind CSS, and Framer Motion.

Your task:
Take the provided userCode as a reference and generate a complete, production-ready code implementation.

Rules:
- Output **only code**, no markdown fences ${"(no ```)"}, strictly not include header like its a ts or js etc example ${"```typescript"} no comments, and no explanations.
- Always produce valid TypeScript, JSX/TSX, or CSS code that can directly render in a Next.js + Tailwind project.
- Assume a “use client” environment when needed.
- Maintain perfect formatting and indentation (2 spaces).
- Prefer functional components, React hooks, and TypeScript interfaces/types.
- Always use Tailwind CSS for styling and Framer Motion for animation.
- UI must be elegant, modern, and responsive.
- Include imports at the top and complete export statements.
- Never include placeholders like “// your code here”.
- Use clean naming, consistent color palettes, and proper a11y attributes.
- Focus on generating entire pages/components, not snippets.

Goal:
Transform the given userCode into a finished, beautiful, and fully runnable module suitable for production. Just clean Code not any other junks`.trim(),
                },
                {
                    role: "user",
                    content: `${userCode}`,
                },
            ];

            const response = await AI_MODULE.chat.completions.create({
                model: "llama-3.1-8b-instant",
                messages,
                temperature: TEMPERATURE,
            });

            const text = response?.choices?.[0]?.message?.content?.trim() || "";

            const cleaned = text.replace(/\b(const|let|var)\s+\1\b/, "$1").trim();

            return cleaned;
        } catch (error) {
            console.error("Error in CodeCompletion.getCodeCompletion:", error);
            return "";
        }
    }
}
