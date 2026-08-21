import { Response } from "express";

interface ApiResponsePayload<T> {
  success: boolean;
  message: string;
  data: T;
}

export const sendResponse = <T>(
  res: Response,
  statusCode: number,
  data: T,
  message = "Success"
): void => {
  const payload: ApiResponsePayload<T> = {
    success: statusCode >= 200 && statusCode < 300,
    message,
    data,
  };

  res.status(statusCode).json(payload);
};
