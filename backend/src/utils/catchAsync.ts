import type { NextFunction, Request, Response } from "express";

type AsyncRequestHandler = (
  req: Request,
  res: Response,
  next: NextFunction
) => Promise<unknown>;

const catchAsync = (fn: AsyncRequestHandler) => {
  return (req: Request, res: Response, next: NextFunction) => {
    fn(req, res, next).catch(next);
  };
};

export default catchAsync;
