import type {
  NextFunction,
  Request,
  Response,
} from "express";

import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";

interface AdminTokenPayload extends jwt.JwtPayload {
  username: string;
  role: string;
  tokenType: "user";
}

export async function adminAuth(
  request: Request,
  response: Response,
  next: NextFunction
) {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return response.status(401).json({
      message: "Thiếu Bearer token quản trị",
    });
  }

  const token = authorization.slice(7);

  try {
    const decoded = jwt.verify(
      token,
      env.JWT_SECRET
    ) as AdminTokenPayload;

    if (
      !decoded.sub ||
      decoded.tokenType !== "user" ||
      decoded.role !== "ADMIN"
    ) {
      return response.status(403).json({
        message: "Token không có quyền quản trị",
      });
    }

    const user = await prisma.user.findUnique({
      where: {
        id: decoded.sub,
      },
    });

    if (
      !user ||
      !user.active ||
      user.role !== "ADMIN"
    ) {
      return response.status(403).json({
        message: "Tài khoản quản trị không hợp lệ",
      });
    }

    response.locals.user = user;
    next();
  } catch {
    return response.status(401).json({
      message: "Token không hợp lệ hoặc đã hết hạn",
    });
  }
}