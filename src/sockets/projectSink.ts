import { ProjectFile } from "../model/project_files.js";
import { Socket } from "socket.io";

const projectUpdate = async (path: string, fsContent: string, name: string): Promise<boolean> => {
  try {
    const projectFile = await ProjectFile.findOneAndUpdate(
      { path, name },
      { content: fsContent },
      { upsert: true, new: true }
    );

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
    const success = await projectUpdate(path, fsContent, name);
    socket.emit("file:update:ack", { path, name, success });
  });

  // Add new file
  socket.on("file:add", async (req) => {
    const { path, name } = req;
    try {
      const newFile = await ProjectFile.create({ path, name, content: "" });
      socket.emit("file:add:ack", { path, name, success: !!newFile });
    } catch (err) {
      console.error(err);
      socket.emit("file:add:ack", { path, name, success: false });
    }
  });

  // Remove a file
  socket.on("file:remove", async (req) => {
    const { path, name } = req;
    try {
      const result = await ProjectFile.deleteOne({ path, name });
      socket.emit("file:remove:ack", { path, name, success: result.deletedCount > 0 });
    } catch (err) {
      console.error(err);
      socket.emit("file:remove:ack", { path, name, success: false });
    }
  });

  // Rename a file
  socket.on("file:rename", async (req) => {
    const { path, oldName, name } = req;
    try {
      const result = await ProjectFile.findOneAndUpdate(
        { path, name: oldName },
        { name },
        { new: true }
      );
      socket.emit("file:rename:ack", { path, oldName, name, success: !!result });
    } catch (err) {
      console.error(err);
      socket.emit("file:rename:ack", { path, oldName, name, success: false });
    }
  });
};
