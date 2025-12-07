import mongoose from "mongoose";
import { ProjectFile } from "../model/project_files.js";
import { Socket } from "socket.io";
import { CortexPipeline } from "../pipelines/CortexPipeline.js";
import { RealtimeStatusSocket } from "./socket.RealTime.js";
import { uIdProvider } from "../service/user.uidProvider.js";
import { FLUCFlowService } from "../service/fileUpdateCreateSync.js";
import { pushProjectHistory } from "../service/BricksHistoryService.js";
import { BrickHistoryTypeEnum } from "../model/BricksHistory.js";

export const projectUpdate = async (path: string, fsContent: string, name: string, userId: mongoose.Types.ObjectId, projectId: mongoose.Types.ObjectId): Promise<boolean> => {
  try {
    const projectFile = await ProjectFile.findOneAndUpdate(
      { path, name, userId, projectId },
      { content: fsContent },
    );

    RealtimeStatusSocket.__push({
      id: uIdProvider(),
      type: 'info',
      message: "[Info] Project File is Updated"
    }, userId)

    // background Cortext PipeLine
    if (projectFile) {
      CortexPipeline(projectFile, userId)
    }

    return !!projectFile;
  } catch (error) {
    console.error("Error updating project file:", error);
    return false;
  }
};

export const projectSocket = (socket: Socket) => {
  // Update file content
  socket.on("file:update", async (req) => {
    const { path, fsContent, name, projectId } = req;
    const userId = socket.data.userId;
    const success = await projectUpdate(path.trim(), fsContent, name.trim(), userId, projectId);
    socket.emit("file:update:ack", { path, name, success });
  });

  // Add new file
  socket.on("file:add", async (req) => {
    const { path, name, projectId, content } = req;
    const userId = socket.data.userId;
    const fileContent = content || ""
    try {
      const newFile = await ProjectFile.create({ path, name, content: fileContent, type: 'file', userId, projectId });
      pushProjectHistory({ userId, projectId: new mongoose.Types.ObjectId(projectId), description: `Added new file "${name}" at path "${path}".`}, BrickHistoryTypeEnum.project);
      socket.emit("file:add:ack", { path, name, success: !!newFile });
    } catch (err) {
      console.error(err);
      socket.emit("file:add:ack", { path, name, success: false });
    }
  });

  // FLUC file
  socket.on("file:FLUC:FLOW", async (req) => {
    const { path, name, projectId, content, type } = req;
    const userId = socket.data.userId;
    const fileContent = content || ""
    try {
      const success = await FLUCFlowService.process({
        path: path,
        name: name,
        projectId: projectId,
        content: fileContent,
        userId: userId,
        type: type
      })
      pushProjectHistory({ userId, projectId: new mongoose.Types.ObjectId(projectId), description: `File "${name}" at path "${path}" has been ${type === 'create' ? 'created' : type === 'update' ? 'updated' : 'synchronized'}.`}, BrickHistoryTypeEnum.project);
      socket.emit("file:FLUC:FLOW", { path, name, success: success });
    } catch (err) {
      console.error(err);
      socket.emit("file:FLUC:FLOW", { path, name, success: false });
    }
  });

  // New Folder
  socket.on("folder:add", async (req) => {
    const { path, name, projectId } = req;
    const userId = socket.data.userId;
    try {
      const newFile = await ProjectFile.create({ path, name, type: "folder", projectId, userId });
      pushProjectHistory({ userId, projectId: new mongoose.Types.ObjectId(projectId), description: `Added new folder "${name}" at path "${path}".`}, BrickHistoryTypeEnum.project);
      socket.emit("file:add:ack", { path, name, success: !!newFile });
    } catch (err) {
      console.error(err);
      socket.emit("file:add:ack", { path, name, success: false });
    }
  });

  // Remove a file
  socket.on("file:remove", async (req) => {
    const { path, name, projectId } = req;
    const userId = socket.data.userId;
    try {
      const result = await ProjectFile.deleteOne({ path, name, userId, projectId });
      console.log(path, name, result)
      pushProjectHistory({ userId, projectId: new mongoose.Types.ObjectId(projectId), description: `Removed file "${name}" at path "${path}".`}, BrickHistoryTypeEnum.project);
      socket.emit("file:remove:ack", { path, name, success: result.deletedCount > 0 });
    } catch (err) {
      console.error(err);
      socket.emit("file:remove:ack", { path, name, success: false });
    }
  });

  // Rename a file
  socket.on("file:rename", async (req) => {
    const { path, oldName, name, projectId } = req;
    const userId = socket.data.userId;
    try {
      const result = await ProjectFile.findOneAndUpdate(
        { path, name: oldName, userId, projectId },
        { name },
      );
      pushProjectHistory({ userId, projectId: new mongoose.Types.ObjectId(projectId), description: `Renamed file from "${oldName}" to "${name}" at path "${path}".`}, BrickHistoryTypeEnum.project);
      socket.emit("file:rename:ack", { path, oldName, name, success: !!result });
    } catch (err) {
      console.error(err);
      socket.emit("file:rename:ack", { path, oldName, name, success: false });
    }
  });
};
