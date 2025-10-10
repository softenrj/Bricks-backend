
import express, { Request, Response } from "express"
import { Project } from "../model/project.js";
import { ProjectFile } from "../model/project_files.js";
import { ProjectInitializer } from "../service/projectInitializer.js";
import { buildTree, TreeNode } from "../service/treeNodeBuilder.js";
import { sendResponse } from "../types/apiResponse.js";

export const createNewProject = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.userId;
        const { project_name, project_description, web_tech, tech_lan } = req.body;

        if (!userId) {
            sendResponse(res, 401, { success: false, message: "Unauthorized" })
            return;
        }

        if (!project_name || !web_tech || !tech_lan) {
            sendResponse(res, 400, { success: false, message: "Missing required fields" })
            return;
        }

        const project = await Project.create({
            userId,
            name: project_name,
            description: project_description,
            web_technology: web_tech,
            tech_language: tech_lan
        })

        // initialize the projects
        if (project.id) await ProjectInitializer(project.id, userId, tech_lan);

        sendResponse(res, 201, { success: true, message: " Project is successfully Created ", data: project })
    } catch (error) {
        sendResponse(res, 500, { success: false, message: "Internal Server Error" })
        console.error("Error creating project:", error);
    }
}

export const getProjects = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.userId;
        const { limit = 12, lastCreatedAt, sort, q, att, created_after, created_before, ach } = req.query;

        if (!userId) {
            sendResponse(res, 401, { success: false, message: "Unauthorized" });
            return;
        }

        let query: Record<string, any> = { userId, archived: false, markDelete: false };

        if (lastCreatedAt) {
            const date = new Date(lastCreatedAt as string);
            if (!isNaN(date.getTime())) {
                query.createdAt = { $lt: date };
            }
        }

        if (created_after || created_before) {
            query.createdAt = {};
            if (created_after) query.createdAt.$gte = new Date(created_after as string);
            if (created_before) query.createdAt.$lte = new Date(created_before as string);
        }

        if (q) {
            query.$or = [
                { name: { $regex: q as string, $options: "i" } },
                { description: { $regex: q as string, $options: "i" } },
            ];
        }

        if (att) {
            query.starred = true;
        }

        if (ach) {
            query.archived = true;
        }

        let sort_filter: 1 | -1 = -1;
        if (sort) {
            sort_filter = sort === "asc" ? 1 : -1;
        }

        const projects = await Project.find(query)
            .sort({ createdAt: sort_filter })
            .limit(Number(limit) + 1);

        const hasNextPage = projects.length > Number(limit);
        const data = hasNextPage ? projects.slice(0, -1) : projects;

        sendResponse(res, 200, {
            success: true,
            message: "Projects fetched successfully",
            data,
            nextCursor: hasNextPage ? data[data.length - 1].createdAt : null,
        });
    } catch (error) {
        console.error("Error getting projects:", error);
        sendResponse(res, 500, { success: false, message: "Internal Server Error" });
    }
};

export const getProject = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.userId;
        const projectId = req.params.projectId;

        if (!userId) {
            sendResponse(res, 401, { success: false, message: "Unauthorized" });
            return;
        }

        const projects = await Project.findById(projectId)

        sendResponse(res, 200, {
            success: true,
            message: "Projects fetched successfully",
            data: projects
        });
    } catch (error) {
        console.error("Error getting projects:", error);
        sendResponse(res, 500, { success: false, message: "Internal Server Error" });
    }
};

export const getRecentProjects = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.userId;

        if (!userId) {
            sendResponse(res, 401, { success: false, message: "Unauthorized" });
            return;
        }

        const projects = await Project.find({ userId })
            .sort({ createdAt: -1 })
            .limit(4);


        sendResponse(res, 200, {
            success: true,
            message: "Recent Projects fetched successfully",
            data: projects
        });
    } catch (error) {
        console.error("Error getting Recent projects:", error);
        sendResponse(res, 500, { success: false, message: "Internal Server Error" });
    }
};

export const exportAllProject = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.userId;
        if (!userId) {
            sendResponse(res, 401, { success: false, message: "Unauthorized" });
            return;
        }

        const projects = await Project.find({});
        if (!projects) {
            sendResponse(res, 400, { success: false, message: "No Projects Found" });
            return;
        }

        sendResponse(res, 200, { success: true, data: projects, message: "Projects fetched successfully" });
        return;

    } catch (error) {
        console.error("Error getting ALL projects Export:", error);
        sendResponse(res, 500, { success: false, message: "Internal Server Error" });
    }
}

export const exportArchProject = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.userId;
        if (!userId) {
            sendResponse(res, 401, { success: false, message: "Unauthorized" });
            return;
        }

        const projects = await Project.find({ archived: true });
        if (!projects) {
            sendResponse(res, 400, { success: false, message: "No Archieve Projects Found" });
            return;
        }

        sendResponse(res, 200, { success: true, data: projects, message: "Projects fetched successfully" });
        return;

    } catch (error) {
        console.error("Error getting ALL projects Export:", error);
        sendResponse(res, 500, { success: false, message: "Internal Server Error" });
    }
}

export const markProjectDetete = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.userId;
        if (!userId) {
            sendResponse(res, 401, { success: false, message: "Unauthorized" });
            return;
        }

        const projectId = req.params.projectId;

        if (!projectId) {
            sendResponse(res, 400, { success: false, message: "None or Envalid Project id" });
            return;
        }

        // :: scheduler will remove the project after 10 days giving a chance to recover ::
        const project = await Project.findOneAndUpdate({
            userId, _id: projectId
        }, { markDelete: true }, { $upsert: true });

        sendResponse(res, 201, { success: true, message: "Project is Successfully Removed" });
    } catch (error) {
        console.error("Error un node Project:", error);
        sendResponse(res, 500, { success: false, message: "Internal Server Error" });
    }
}

export const projectFileTree = async (req: Request, res: Response) => {
    try {
        const userId = req.userId;
        if (!userId) {
            sendResponse(res, 401, { success: false, message: "Unauthorized" });
            return;
        }

        const projectId = req.params.projectId;

        if (!projectId) {
            sendResponse(res, 400, { success: false, message: "None or Envalid Project id" });
            return;
        }

        const projectFile = await ProjectFile.find({ projectId, userId }).lean();

        const treeNode: TreeNode = buildTree(projectFile);

        sendResponse(res, 201, { success: true, message: "Project FS is Successfully fetched", data: treeNode });
    } catch (error) {
        console.error("Error Getting FS: Project:", error);
        sendResponse(res, 500, { success: false, message: "Internal Server Error" });
    }
}