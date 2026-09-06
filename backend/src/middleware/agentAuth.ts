import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";

import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";

interface AgentTokenPayload extends jwt.JwtPayload {
  clientId: string;
  agentType: string;
  tokenType: "agent";
}

export async function agentAuth(
  request: Request,
  response: Response,
  next: NextFunction
) {
  const authorization = request.headers.authorization;

  if (!authorization?.startsWith("Bearer ")) {
    return response.status(401).json({
      message: "Thiếu Bearer token",
    });
  }

  const token = authorization.slice(7);

  try {
    const decoded = jwt.verify(
      token,
      env.JWT_SECRET
    ) as AgentTokenPayload;

    if (
      !decoded.sub ||
      decoded.tokenType !== "agent"
    ) {
      return response.status(401).json({
        message: "Token không hợp lệ",
      });
    }

    const agent = await prisma.agent.findUnique({
      where: {
        id: decoded.sub,
      },
    });

    if (
      !agent ||
      agent.clientId !== decoded.clientId
    ) {
      return response.status(401).json({
        message: "AI Agent không tồn tại",
      });
    }

    if (agent.status !== "ACTIVE") {
      return response.status(403).json({
        message: "AI Agent đã bị vô hiệu hóa",
      });
    }

    if (agent.expiresAt && agent.expiresAt <= new Date()) {
      return response.status(403).json({
        message: "AI Agent đã hết hạn",
      });
    }

    response.locals.agent = agent;
    next();
  } catch {
    return response.status(401).json({
      message: "Token không hợp lệ hoặc đã hết hạn",
    });
  }
}