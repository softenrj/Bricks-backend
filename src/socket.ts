import { DefaultEventsMap, Server, Socket } from "socket.io";
import { projectSocket } from "./sockets/projectSink.js";
import { bricksChatSocket } from "./sockets/bricksChats.js";
import { CodeCompletionSocket } from "./sockets/codeComp.js";

export const SocketModule = (socket: Socket) => {
    projectSocket(socket),
    bricksChatSocket(socket),
    CodeCompletionSocket(socket)
}

export const broadCast = (io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>) => {

}
