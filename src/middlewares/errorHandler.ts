import { ErrorRequestHandler } from "express";

export const errorHandler: ErrorRequestHandler = (error, _request, response, next) => {
  if (response.headersSent) return next(error);
  const candidate = error?.status ?? error?.statusCode;
  const status = Number.isInteger(candidate) && candidate >= 400 && candidate <= 599
    ? candidate : 500;
  const message = status >= 500 ? "Internal server error" : "Invalid request";
  return response.status(status).json({ status: "error", message });
};
