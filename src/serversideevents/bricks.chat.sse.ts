// Copyright (c) 2025-2026 Raj
// See LICENSE for details.

import { Request, Response } from "express";
import bricks_chats, { IBricksChat } from "../model/bricks_chats.js";
import { BRICKS_AI_ENGINE, HISTORY_LIMIT, MAX_MESSAGE_LENGTH } from "../service/bricksChat.js";
import bricks_message from "../model/bricks_message.js";
import getVectorEmbedding from "../service/vectorTransformer.js";
import { FileVector } from "../model/file_vectors.js";
import { ChatCompletionMessageParam } from "groq-sdk/resources/chat.mjs";
import { AI_MODULE } from "../config/groqSdkConfig.js";
import mongoose from "mongoose";

export class BRICKSCHATSSE_SERVICE {
  public static async getChatObject(
    chatId: mongoose.Types.ObjectId,
    userId: mongoose.Types.ObjectId,
    projectId: string,
    prompt: string
  ): Promise<IBricksChat | null> {
    try {
      let chat = chatId
        ? await bricks_chats.findById(chatId)
        : await BRICKS_AI_ENGINE._initialize_bricks_chat_(userId, projectId, prompt);

      return chat;
    } catch (error) {
      console.error("Error in getchat object:", error);
      return null;
    }
  }
  public static async processChat(req: Request, res: Response): Promise<void> {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    res.flushHeaders?.();

    const { chatId, prompt } = req.body;
    const userId = req.userId!;
    const projectId = req.params.projectId!;

    //? Detect client disconnect
    let clientDisconnected = false;
    req.on("close", () => {
      clientDisconnected = true;
      res.end();
    });

    try {
      const chat = await this.getChatObject(chatId, userId, projectId, prompt);

      if (!chat) throw new Error("Failed to initialize chat");

      //? Load history
      const history = await bricks_message
        .find({ chatId: chat._id })
        .sort({ createdAt: -1 })
        .limit(HISTORY_LIMIT)
        .lean();

      //? Vector search
      const queryVector = await getVectorEmbedding(prompt);
      const populatedContexts = await FileVector.aggregate([
        {
          $vectorSearch: {
            index: "vector_index",
            path: "vector",
            queryVector,
            numCandidates: 10,
            limit: 2,
          },
        },
        {
          $lookup: {
            from: "filecontexts",
            localField: "contextId",
            foreignField: "_id",
            as: "context",
          },
        },
        { $unwind: "$context" },
      ]);

      const contextText = populatedContexts.length
        ? populatedContexts.map((c) => c.context.snippet).join("\n---\n")
        : "";

      //? Build message sequence
      const messages: ChatCompletionMessageParam[] = [
        {
          role: "system",
          content: `
        You are Bricks AI — a highly expressive and helpful AI developer assistant. 
        Always respond clearly, concisely, and naturally.
        
        ✅ Use markdown formatting where relevant:
        - Use **bold**, *italics*, and \`inline code\` for clarity.  
        - Use bullet points or tables when listing things.  
        - Use lots of emojis when they make explanations friendlier or clearer (💡, ⚙️, ✅).  
        - Maintain readable line breaks — do not send giant paragraphs.  
        
        If the user asks for code, wrap it in proper fenced code blocks with language tags.
        If the question relates to files, use the provided context *only if clearly relevant*.
            `,
        },

        ...(contextText
          ? [
              {
                role: "assistant" as "user" | "assistant",
                content: `Relevant file context:\n${contextText}\n(Use only if it directly relates to the user's question)`,
              },
            ]
          : []),

        ...history.map((msg) => ({
          role: msg.role as "user" | "assistant",
          content:
            msg.content.length > MAX_MESSAGE_LENGTH
              ? msg.content.slice(-MAX_MESSAGE_LENGTH)
              : msg.content,
        })),

        {
          role: "user",
          content: prompt.length > MAX_MESSAGE_LENGTH ? prompt.slice(-MAX_MESSAGE_LENGTH) : prompt,
        },
      ];

      let finalResponse = "";

      //? AI Streaming
      const aiStream = await AI_MODULE.chat.completions.create({
        model: "llama-3.1-8b-instant",
        messages,
        temperature: 0.7,
        stream: true,
      });

      //? Heartbeat
      const heartbeat = setInterval(() => {
        if (!clientDisconnected) {
          res.write("data: [ping]\n\n");
          res.flush?.();
        }
      }, 15000);

      try {
        for await (const chunk of aiStream) {
          if (clientDisconnected) break;

          const delta = chunk?.choices?.[0]?.delta?.content;
          if (!delta) continue;

          finalResponse += delta;

          res.write(`data: ${delta}\n\n`);
          res.flush?.();
        }
      } finally {
        clearInterval(heartbeat);
      }

      //? Send final end signal
      if (!clientDisconnected) {
        res.end();
      }

      if (!clientDisconnected) {
        await bricks_message.insertMany([
          { chatId: chat._id, userId, projectId, role: "user", content: prompt },
          { chatId: chat._id, userId, projectId, role: "assistant", content: finalResponse },
        ]);
      }
    } catch (err) {
      console.error("Stream error:", err);
      if (!res.headersSent) {
        res.write(`data: [ERROR] ${String(err)}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
      }
    }
  }
}
