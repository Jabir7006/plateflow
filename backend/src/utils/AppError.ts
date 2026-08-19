import { HTTP_STATUS } from "../constants/http.js";

export interface ValidationError {
  field: string;
  message: string;
}

class AppError extends Error {
  statusCode: number;
  isOperational: boolean;
  errors?: ValidationError[] | undefined;
  constructor(
    message: string,
    statusCode: number = HTTP_STATUS.INTERNAL_SERVER_ERROR,
    isOperational: boolean = true,
    errors?: ValidationError[]
  ) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errors = errors;
    Error.captureStackTrace(this, this.constructor);
  }
}

export default AppError;
