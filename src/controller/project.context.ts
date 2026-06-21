// Copyright (c) 2025 Raj
// See LICENSE for details.

import express, { Request, Response } from "express";
import { IProject, Project } from "../model/project.js";
import { sendResponse } from "../types/apiResponse.js";
import { IProjectFile, ProjectContextNode, ProjectFile } from "../model/project_files.js";
import { buildContextTree, buildTree } from "../service/treeNodeBuilder.js";

export class ProjectContextController {
  /**
   *
   * @param req
   * @param res
   * @returns
   */
  public static getProject = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = req.params.projectId;
      const userId = req.userId;

      if (!userId) {
        sendResponse(res, 401, { success: false, message: "Unauthorized" });
        return;
      }

      if (!projectId) {
        sendResponse(res, 400, { success: false, message: "Missing or Invalid Project Id" });
        return;
      }

      const project = await Project.findById(projectId);

      if (!project) {
        sendResponse(res, 400, {
          success: false,
          message: "Project Not Found ! Make sure Id is Correct",
        });
        return;
      }

      const childFiles: IProjectFile[] = (await ProjectFile.find({
        projectId,
        userId,
      }).lean()) as unknown as IProjectFile[];

      const treeNode = buildContextTree(childFiles);

      // Root node
      const rootNode: ProjectContextNode = {
        _id: projectId,
        projectId: projectId,
        parent: undefined,
        userId: project.userId,
        name: project.name,
        path: "",
        type: "folder",
        version: 1,
        isDefault: true,
        createdAt: project.createdAt,
        updatedAt: project.updatedAt,
        child: treeNode,
      };

      const projectContext = {
        project,
        context: rootNode,
      };

      sendResponse(res, 200, {
        success: true,
        message: "Successfully fetched Project context",
        data: projectContext,
      });
    } catch (error) {
      console.error("Error while getting project Context:", error);
      sendResponse(res, 500, { success: false, message: "Internal Server Error" });
    }
  };

  public static getProjectChild = async (req: Request, res: Response): Promise<void> => {
    try {
      const projectId = req.params.projectId;
      const projectFileId = req.query.projectFileId;
      const userId = req.userId;

      if (!userId) {
        sendResponse(res, 401, { success: false, message: "Unauthorized" });
        return;
      }

      if (!projectId) {
        sendResponse(res, 400, { success: false, message: "Missing or Invalid Project Id" });
        return;
      }

      const parentProjectFile = await ProjectFile.findById(projectFileId).select("-content");

      if (!parentProjectFile) {
        sendResponse(res, 400, { success: false, message: "Project file Not found" });
        return;
      }

      if (parentProjectFile.type === "file" || parentProjectFile.type === "image") {
        sendResponse(res, 200, { success: true, message: "Folder has only child files", data: [] });
        return;
      }

      // Fetch direct children based on path
      const parentPath = parentProjectFile.path === "" ? "" : parentProjectFile.path;
      const regexPattern = `^${parentPath ? parentPath + "/" : ""}[^/]+$`; // direct children only

      const childrens = await ProjectFile.find({
        projectId,
        path: { $regex: regexPattern },
      }).select("-content");

      sendResponse(res, 200, {
        success: true,
        message: "Children fetched successfully",
        data: childrens,
      });
    } catch (error) {
      console.error("Error while getting project children:", error);
      sendResponse(res, 500, { success: false, message: "Internal Server Error" });
    }
  };
}
