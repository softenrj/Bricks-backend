// Copyright (c) 2025-2026 Raj
// See LICENSE for details.

import { DefaultEventsMap, Server, Socket } from "socket.io";
import { projectSocket } from "./sockets/projectSink.js";
import { bricksChatSocket } from "./sockets/bricksChats.js";

export const SocketModule = (socket: Socket) => {
  (projectSocket(socket), bricksChatSocket(socket));
};

export const broadCast = (
  io: Server<DefaultEventsMap, DefaultEventsMap, DefaultEventsMap, any>
) => {};
