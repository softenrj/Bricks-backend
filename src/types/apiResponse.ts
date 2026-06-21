// Copyright (c) 2025-2026 Raj
// See LICENSE for details.

import { Response } from "express";

/**
 * Api Response Interface For Bricks
 */
export interface ApiResponse<T> {
  success: boolean;
  message: string;
  data?: T;
  nextCursor?: Date | null;
}
/**
 *
 * @param res
 * @param status
 * @param response
 * @returns
 */
export const sendResponse = <T>(res: Response, status: number, response: ApiResponse<T>) => {
  return res.status(status).json(response);
};
