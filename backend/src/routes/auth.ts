import bcrypt from "bcryptjs";
import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { randomBytes } from "node:crypto";
import { agentAuth } from "../middleware/agentAuth.js";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";

export const authRouter = Router();

const agentLoginSchema = z.object({
  clientId: z.string().trim().min(1),
  clientSecret: z.string().trim().min(1),
});
const adminLoginSchema = z.object({
  username: z.string().trim().min(1),
  password: z.string().min(1),
});

authRouter.post("/agent", async (request, response) => {
  const parsed = agentLoginSchema.safeParse(request.body);

  if (!parsed.success) {
    return response.status(400).json({
      message: "Thiếu clientId hoặc clientSecret",
    });
  }

  const { clientId, clientSecret } = parsed.data;

  const agent = await prisma.agent.findUnique({
    where: {
      clientId,
    },
  });

  if (!agent) {
    return response.status(401).json({
      message: "Thông tin xác thực không hợp lệ",
    });
  }

  const secretValid = await bcrypt.compare(
    clientSecret,
    agent.clientSecretHash
  );

  if (!secretValid) {
    return response.status(401).json({
      message: "Thông tin xác thực không hợp lệ",
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

  const accessToken = jwt.sign(
    {
      sub: agent.id,
      clientId: agent.clientId,
      agentType: agent.type,
      tokenType: "agent",
    },
    env.JWT_SECRET,
    {
      expiresIn: 3600,
    }
  );

  return response.json({
    message: "Xác thực AI Agent thành công",
    tokenType: "Bearer",
    expiresIn: 3600,
    accessToken,
    agent: {
      id: agent.id,
      name: agent.name,
      type: agent.type,
      status: agent.status,
    },
  });
});authRouter.get(
  "/agent/me",
  agentAuth,
  async (_request, response) => {
    const agent = response.locals.agent;

    return response.json({
      agent: {
        id: agent.id,
        blockchainAgentId: agent.blockchainAgentId,
        walletAddress: agent.walletAddress,
        name: agent.name,
        type: agent.type,
        status: agent.status,
        expiresAt: agent.expiresAt,
        createdAt: agent.createdAt,
      },
    });
  }
);
authRouter.post("/admin", async (request, response) => {
  const parsed = adminLoginSchema.safeParse(request.body);

  if (!parsed.success) {
    return response.status(400).json({
      message: "Thiếu username hoặc password",
    });
  }

  const { username, password } = parsed.data;

  const user = await prisma.user.findUnique({
    where: {
      username,
    },
  });

  if (!user) {
    return response.status(401).json({
      message: "Thông tin đăng nhập không hợp lệ",
    });
  }

  const passwordValid = await bcrypt.compare(
    password,
    user.passwordHash
  );

  if (!passwordValid) {
    return response.status(401).json({
      message: "Thông tin đăng nhập không hợp lệ",
    });
  }

  if (!user.active || user.role !== "ADMIN") {
    return response.status(403).json({
      message: "Tài khoản không có quyền quản trị",
    });
  }

  const accessToken = jwt.sign(
    {
      sub: user.id,
      username: user.username,
      role: user.role,
      tokenType: "user",
    },
    env.JWT_SECRET,
    {
      expiresIn: 3600,
    }
  );

  return response.json({
    message: "Đăng nhập quản trị thành công",
    tokenType: "Bearer",
    expiresIn: 3600,
    accessToken,
    user: {
      id: user.id,
      username: user.username,
      role: user.role,
    },
  });
});

authRouter.post(
  "/agent/rotate-secret",
  agentAuth,
  async (_request, response) => {
    const agent = response.locals.agent;

    const newClientSecret =
      randomBytes(32).toString("hex");

    const newClientSecretHash =
      await bcrypt.hash(newClientSecret, 12);

    await prisma.agent.update({
      where: {
        id: agent.id,
      },
      data: {
        clientSecretHash: newClientSecretHash,
      },
    });

    return response.json({
      message: "Đã thay clientSecret thành công",
      clientId: agent.clientId,
      clientSecret: newClientSecret,
      warning:
        "Hãy lưu secret mới ngay; hệ thống sẽ không hiển thị lại.",
    });
  }
);