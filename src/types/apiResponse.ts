import { Response } from "express"

export interface ApiResponse <T> {
    success: boolean;
    message: string;
    data?: T;
    nextCursor?: Date | null;
}

export const sendResponse = <T>(
  res: Response,
  status: number,
  response: ApiResponse<T>
) => {
  return res.status(status).json(response);
};