import BricksMessage from "../model/bricks_message.js";
import BricksChat from "../model/bricks_chats.js";
import { IBricksChat } from "../model/bricks_chats.js";
import { ChatCompletionMessageParam } from "groq-sdk/resources/chat.mjs";
import { AI_MODULE } from "../config/groqSdkConfig.js";
import { FileVector } from "../model/file_vectors.js";
import getVectorEmbedding from "./vectorTransformer.js";

const MAX_MESSAGE_LENGTH = 2000;
const HISTORY_LIMIT = 3; 

export class BRICKS_AI_ENGINE {
    //! Generate a dynamic chat name from the first prompt
    /**
     * 
     * @param prompt 
     * @returns 
     */
    private static async _generateDynamicChatName(prompt: string): Promise<string> {
        if (!prompt || prompt.trim().length === 0) return "New Chat";

        try {
            const response = await AI_MODULE.chat.completions.create({
                model: "mixtral-8x7b-32768",
                messages: [
                    {
                        role: "system",
                        content:
                            "You are an AI assistant. Generate a short, 3–6 word title for a chat based on the user input. Make it readable and descriptive.",
                    },
                    { role: "user", content: prompt },
                ],
                temperature: 0.5,
                max_tokens: 20,
            });

            const title = response.choices?.[0]?.message?.content?.trim();
            return title && title.length > 0 ? title : "Project Chat";
        } catch (err) {
            console.error("Error generating dynamic chat name:", err);
            return "Project Chat";
        }
    }

    //! Initialize a new chat with dynamic name
    /**
     * 
     * @param userId 
     * @param projectId 
     * @param prompt 
     * @returns 
     */
    private static async _initialize_bricks_chat_(
        userId: string,
        projectId: string,
        prompt: string
    ): Promise<IBricksChat | null> {
        try {
            const chatName = await this._generateDynamicChatName(prompt);
            const chat = await BricksChat.create({ userId, projectId, name: chatName });
            return chat || null;
        } catch (error) {
            console.error("Error while initializing chat:", error);
            return null;
        }
    }

    //! Main project chat method
    /**
     * 
     * @param chatId 
     * @param userId 
     * @param projectId 
     * @param prompt 
     * @returns 
     */
    public static async projectChatSupport(
        chatId: string | undefined,
        userId: string,
        projectId: string,
        prompt: string
    ): Promise<string> {
        try {
            //? Ensure chat exists
            let chat = chatId
                ? await BricksChat.findById(chatId)
                : await this._initialize_bricks_chat_(userId, projectId, prompt);
            if (!chat) throw new Error("Failed to initialize chat");

            //? Fetch last N messages for context
            const history = await BricksMessage.find({ chatId: chat._id })
                .sort({ createdAt: -1 })
                .limit(HISTORY_LIMIT)
                .lean();

            //? Get file vector context for AI
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
                { $project: { fileId: 1, contextId: 1, score: 1 } },
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

            const contextText =
                populatedContexts.length > 0
                    ? populatedContexts.map((c) => c.context.snippet).join("\n---\n")
                    : "";

            //? Prepare messages for AI
            const messages: ChatCompletionMessageParam[] = [
                ...(contextText ? [{ role: "assistant" as "user" | "assistant", content: `Relevant file context:\n${contextText}` }] : []),
                ...history.reverse().map((msg) => ({
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


            //? Get AI response
            const response = await AI_MODULE.chat.completions.create({
                model: "mixtral-8x7b-32768",
                messages,
                temperature: 0.7,
            });

            const aiMessage = response.choices?.[0]?.message?.content?.trim() || "Hmm, I’m not sure about that.";

            //? Save user & assistant messages
            await BricksMessage.insertMany([
                { chatId: chat._id, userId, projectId, role: "user", content: prompt },
                { chatId: chat._id, userId, projectId, role: "assistant", content: aiMessage },
            ]);

            return aiMessage;
        } catch (error) {
            console.error("Error in projectChatSupport:", error);
            return "An error occurred while processing your request.";
        }
    }
}
