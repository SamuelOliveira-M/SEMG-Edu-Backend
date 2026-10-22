import { Request, Response, NextFunction } from "express";
import { verify } from "jsonwebtoken";

export function ensureAuthenticated(req: Request, res: Response, next: NextFunction) {
  const keyToken = process.env.KEY_TOKEN;
  if (!keyToken?.trim()) {
    return res.status(503).json({ message: "Authentication service unavailable" });
  }
  const match = req.headers.authorization?.match(/^Bearer\s+(\S+)$/i);
  if (!match) return res.status(401).json({ message: "Bearer token is required" });
  try {
    const payload = verify(match[1], keyToken, { algorithms: ["HS256"] });
    if (typeof payload === "string" || typeof payload.userId !== "string" ||
        !payload.userId || typeof payload.isAdmin !== "boolean" ||
        typeof payload.exp !== "number" || payload.sub !== payload.userId) {
      return res.status(401).json({ message: "Invalid token" });
    }
    res.locals.auth = { userId: payload.userId, isAdmin: payload.isAdmin };
    return next();
  } catch {
    return res.status(401).json({ message: "Invalid or expired token" });
  }
}
