import mongoose from "mongoose";
import { ProjectFile } from "../model/project_files.js";
import { Socket } from "socket.io";
import { CortexPipeline } from "pipelines/CortexPipeline.js";

const projectUpdate = async (path: string, fsContent: string, name: string, userId: mongoose.Types.ObjectId): Promise<boolean> => {
  try {
    const projectFile = await ProjectFile.findOneAndUpdate(
      { path, name, userId },
      { content: fsContent },
    );

    // background Cortext PipeLine
    if (projectFile) {
      CortexPipeline(projectFile)
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
    const { path, fsContent, name } = req;
    const userId = socket.data.userId;
    const success = await projectUpdate(path.trim(), fsContent, name.trim(), userId);    
    socket.emit("file:update:ack", { path, name, success });
  });

  // Add new file
  socket.on("file:add", async (req) => {
    const { path, name, projectId } = req;
    const userId = socket.data.userId;
    try {
      const newFile = await ProjectFile.create({ path, name, content: "", type: 'file', userId, projectId });
      socket.emit("file:add:ack", { path, name, success: !!newFile });
    } catch (err) {
      console.error(err);
      socket.emit("file:add:ack", { path, name, success: false });
    }
  });

  // New Folder
  socket.on("folder:add", async (req) => {
    const { path, name, projectId } = req;
    const userId = socket.data.userId;
    try {
      const newFile = await ProjectFile.create({ path, name, type: "folder", projectId, userId });
      socket.emit("file:add:ack", { path, name, success: !!newFile });
    } catch (err) {
      console.error(err);
      socket.emit("file:add:ack", { path, name, success: false });
    }
  });

  // Remove a file
  socket.on("file:remove", async (req) => {
    const { path, name } = req;
    const userId = socket.data.userId;
    try {
      const result = await ProjectFile.deleteOne({ path, name, userId });
      console.log(path,name,result)
      socket.emit("file:remove:ack", { path, name, success: result.deletedCount > 0 });
    } catch (err) {
      console.error(err);
      socket.emit("file:remove:ack", { path, name, success: false });
    }
  });

  // Rename a file
  socket.on("file:rename", async (req) => {
    const { path, oldName, name } = req;
    const userId = socket.data.userId;
    try {
      const result = await ProjectFile.findOneAndUpdate(
        { path, name: oldName, userId },
        { name },
      );
      socket.emit("file:rename:ack", { path, oldName, name, success: !!result });
    } catch (err) {
      console.error(err);
      socket.emit("file:rename:ack", { path, oldName, name, success: false });
    }
  });
};
