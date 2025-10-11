import { BRICKS_AI_ENGINE } from "../service/bricksChat.js";
import BricksMessage from "../model/bricks_message.js";
import { Socket } from "socket.io";

export const bricksChatSocket = (socket: Socket) => {
    socket.on('bricks-chat:recall', async (req) => {
        try {
            const { chatId, projectId } = req;
            const userId = socket.data.userId;

            if (!userId) {
                socket.emit("bricks-chat:prompt:ack", { error: "User not authenticated." });
                return;
            }

            const chatHistory = await BricksMessage.find({ userId, chatId, projectId })
                .sort({ createdAt: -1 })
                .lean();

            socket.emit("bricks-chat:recall:ack", chatHistory);
        } catch (error) {
            console.error("Error fetching chat history:", error);
            socket.emit("bricks-chat:recall:ack", error);
        }
    });

    socket.on('bicks-chat:prompt', async (req) => {
        try {
            const { chatId, projectId, prompt } = req;
            const userId = socket.data.userId;

            if (!userId) {
                socket.emit("bricks-chat:prompt:ack", { error: "User not authenticated." });
                return;
            }

            if (!prompt || prompt.trim().length === 0) {
                socket.emit("bricks-chat:prompt:ack", { error: "Prompt cannot be empty." });
                return;
            }
            const aiResponse = await BRICKS_AI_ENGINE.projectChatSupport(chatId, userId, projectId, prompt);

            socket.emit("bicks-chat:response", aiResponse);
        } catch (error) {
            console.error("Socket error in bicks-chat:prompt:", error);
            socket.emit("bricks-chat:prompt:ack", "Something went wrong while processing your request.");
        }
    });
}