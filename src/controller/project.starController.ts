import { Request, Response } from "express";
import { Project } from "@/model/project.js";
import { sendResponse } from "@/types/apiResponse.js";


// Class Responsible for Project Archieve or UnArchieve //
class ProjectStarHandler {

    /**
     * 
     * @param req 
     * @param res 
     * @returns 
     */
    public static markStar = async (req: Request, res: Response): Promise<void> => {
        try {
            const projectId: string = req.params.projectId;
            const userId = req.userId;

            if (!userId) {
                sendResponse(res, 401, { success: false, message: "Unauthorized" });
                return;
            }

            if (!projectId) {
                sendResponse(res, 400, { success: false, message: "Missing or Invalid Project Id" });
                return;
            }

            const project = await Project.findByIdAndUpdate(projectId, {
                $set: {
                    starred: true
                }
            })

            sendResponse(res, 201, { success: true, data: project, message: "Project is Marked Starred" })
        } catch (error) {
            console.error("Error while mark project Like:", error);
            sendResponse(res, 500, { success: false, message: "Internal Server Error" });
        }
    }


    /**
     * 
     * @param req 
     * @param res 
     * @returns 
     */
    public static unStar = async (req: Request, res: Response): Promise<void> => {
        try {
            const projectId: string = req.params.projectId;
            const userId = req.userId;

            if (!userId) {
                sendResponse(res, 401, { success: false, message: "Unauthorized" });
                return;
            }

            if (!projectId) {
                sendResponse(res, 400, { success: false, message: "Missing or Invalid Project Id" });
                return;
            }

            const project = await Project.findByIdAndUpdate(projectId, {
                $set: {
                    starred: false
                }
            })

            sendResponse(res, 201, { success: true, data: project, message: "Project is Marked Starred" })
        } catch (error) {
            console.error("Error while mark project UnLike:", error);
            sendResponse(res, 500, { success: false, message: "Internal Server Error" });
        }
    }
}

export default ProjectStarHandler;