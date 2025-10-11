import { CodeCompletion } from "../service/bricksCodeCompletion.js";
import { Socket } from "socket.io";

export const CodeCompletionSocket = (socket: Socket) => {
    socket.on('bricks:code:comp', async (req) => {
        try {
            const userId = socket.data.userId;
            if (!userId) {
                socket.emit("bricks-chat:prompt:ack", { error: "User not authenticated." });
                return;
            }
            const { context } = req;
            const __sugges = await CodeCompletion.getCodeCompletion(context);
            socket.emit("bricks:code:comp:ack", __sugges);
        } catch (error) {
            console.error("Error While Code sugg:", error);
        }
    })
}