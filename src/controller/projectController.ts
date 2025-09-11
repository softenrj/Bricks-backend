import { Project } from "@/model/project.js";
import { sendResponse } from "@/types/apiResponse.js";
import express, { Request, Response } from "express"

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

        sendResponse(res, 201, { success: true, message: " Project is successfully Created ", data: project })
    } catch (error) {
        sendResponse(res, 500, { success: false, message: "Internal Server Error" })
        console.error("Error creating project:", error);
    }
}

export const getProjects = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.userId;
        const { limit = 12, lastCreatedAt, filter } = req.query;

        if (!userId) {
            sendResponse(res, 401, { success: false, message: "Unauthorized" });
            return;
        }

        let query: Record<string, any> = { userId };

        if (lastCreatedAt) {
            const date = new Date(lastCreatedAt as string);
            if (!isNaN(date.getTime())) {
                query.createdAt = { $lt: date }; // ✅ use date instead of string
            }
        }

        if (filter) {
            // TODO: add filter conditions (e.g. by technology, language, etc.)
        }

        const projects = await Project.find(query)
            .sort({ createdAt: -1 })
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