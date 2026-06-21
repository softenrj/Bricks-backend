// Copyright (c) 2025 Raj
// See LICENSE for details.

import { AI_MODULE } from "../config/groqSdkConfig.js";

export const __projectDescription = async (
  _projectName: string,
  __projectDes: string
): Promise<string> => {
  try {
    const response = await AI_MODULE.chat.completions.create({
      model: "llama-3.1-8b-instant",
      messages: [
        {
          role: "system",
          content: `You are a professional AI assistant that writes concise and engaging project descriptions.
  Keep the tone clear, modern, and relevant to developers and potential users.
  Limit to 2 short sentences or a tagline.
  Respond with the description **only**, no explanations, quotes, or introductory phrases.`,
        },
        {
          role: "user",
          content: `Generate a short project description for a project named "${_projectName}". 
          Here is the existing description: "${__projectDes}". 
          Keep it under 40 words, and make it sound appealing and professional.`,
        },
      ],
      temperature: 0.7,
      max_tokens: 80,
    });

    const _des = response?.choices?.[0]?.message?.content?.replace(/^["'`]+|["'`]+$/g, "")?.trim();
    const fallback = __projectDes || _projectName;
    return _des && _des.length > 0 ? _des : fallback;
  } catch (error) {
    console.error("Error generating project Description:", error);
    return __projectDes || _projectName;
  }
};
