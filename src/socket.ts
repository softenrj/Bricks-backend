import { DefaultEventsMap, Server, Socket } from "socket.io";
import { projectSocket } from "./sockets/projectSink.js";

export const SocketModule = (socket: Socket) => {
    projectSocket(socket)
}

export const broadCast = (io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>) => {

}
