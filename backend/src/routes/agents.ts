import {
  randomBytes,
  randomUUID,
} from "node:crypto";

import bcrypt from "bcryptjs";
import { id, isAddress } from "ethers";
import { Router } from "express";
import { z } from "zod";

import { registryWriter } from "../lib/blockchain.js";
import { prisma } from "../lib/prisma.js";
import { adminAuth } from "../middleware/adminAuth.js";

export const agentsRouter = Router();

const createAgentSchema = z.object({
  name: z.string().trim().min(2).max(100),

  type: z.string().trim().min(2).max(50),

  description: z
    .string()
    .trim()
    .max(500)
    .optional(),

  walletAddress: z
    .string()
    .refine(isAddress, "Địa chỉ ví không hợp lệ"),

  expiresAt: z
    .string()
    .datetime()
    .optional(),
});

const permissionSchema = z.object({
  service: z
    .string()
    .trim()
    .min(2)
    .max(100),

  action: z
    .string()
    .trim()
    .min(2)
    .max(100),

  allowed: z.boolean().default(true),

  dailyLimit: z
    .number()
    .int()
    .min(0)
    .max(1_000_000),

  riskLevel: z.enum([
    "LOW",
    "MEDIUM",
    "HIGH",
  ]),
});
const agentStatusSchema = z.object({
  status: z.enum([
    "ACTIVE",
    "REVOKED",
    "EXPIRED",
  ]),
});

const statusToContract = {
  ACTIVE: 0,
  REVOKED: 1,
  EXPIRED: 2,
} as const;

const riskLevelToContract = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
} as const;

// Đăng ký AI Agent mới
agentsRouter.post(
  "/",
  adminAuth,
  async (request, response) => {
    const parsed = createAgentSchema.safeParse(
      request.body
    );

    if (!parsed.success) {
      return response.status(400).json({
        message:
          "Dữ liệu đăng ký Agent không hợp lệ",
        errors:
          parsed.error.flatten().fieldErrors,
      });
    }

    const input = parsed.data;

    try {
      const existingWallet =
        await prisma.agent.findUnique({
          where: {
            walletAddress:
              input.walletAddress,
          },
        });

      if (existingWallet) {
        return response.status(409).json({
          message:
            "Địa chỉ ví đã được đăng ký",
        });
      }

      const clientId =
        `agent_${randomUUID()}`;

      const clientSecret =
        randomBytes(32).toString("hex");

      const clientSecretHash =
        await bcrypt.hash(clientSecret, 12);

      const blockchainAgentId =
        id(clientId);

      const expirationDate =
        input.expiresAt
          ? new Date(input.expiresAt)
          : null;

      const expirationTimestamp =
        expirationDate
          ? BigInt(
              Math.floor(
                expirationDate.getTime() /
                  1000
              )
            )
          : 0n;

      const transaction =
        await registryWriter.registerAgent(
          blockchainAgentId,
          input.walletAddress,
          input.name,
          input.type,
          expirationTimestamp
        );

      const receipt =
        await transaction.wait();

      const agent =
        await prisma.agent.create({
          data: {
            blockchainAgentId,
            walletAddress:
              input.walletAddress,
            name: input.name,
            type: input.type,
            description:
              input.description,
            clientId,
            clientSecretHash,
            status: "ACTIVE",
            expiresAt:
              expirationDate,
          },

          select: {
            id: true,
            blockchainAgentId: true,
            walletAddress: true,
            name: true,
            type: true,
            description: true,
            clientId: true,
            status: true,
            expiresAt: true,
            createdAt: true,
          },
        });

      return response.status(201).json({
        message:
          "Đăng ký AI Agent thành công",

        agent,

        credentials: {
          clientId,
          clientSecret,
          warning:
            "Hãy lưu clientSecret ngay; hệ thống sẽ không hiển thị lại.",
        },

        blockchain: {
          transactionHash:
            receipt?.hash ??
            transaction.hash,

          blockNumber:
            receipt?.blockNumber ??
            null,
        },
      });
    } catch (error) {
      console.error(
        "Create Agent failed:",
        error
      );

      return response.status(500).json({
        message:
          "Không thể đăng ký AI Agent",
      });
    }
  }
);

// Cấp hoặc cập nhật quyền cho Agent
agentsRouter.post(
  "/:agentId/permissions",
  adminAuth,
  async (request, response) => {
    const parsed =
      permissionSchema.safeParse(
        request.body
      );

    if (!parsed.success) {
      return response.status(400).json({
        message:
          "Dữ liệu quyền không hợp lệ",
        errors:
          parsed.error.flatten().fieldErrors,
      });
    }

    const agentIdParam = Array.isArray(
      request.params.agentId
    )
      ? request.params.agentId[0]
      : request.params.agentId;

    if (!agentIdParam) {
      return response.status(400).json({
        message: "Thiếu mã AI Agent",
      });
    }

    const agent =
      await prisma.agent.findUnique({
        where: {
          id: agentIdParam,
        },
      });

    if (!agent) {
      return response.status(404).json({
        message:
          "Không tìm thấy AI Agent",
      });
    }

    const input = parsed.data;

    try {
      const permissionKey = id(
        `${input.service}:${input.action}`
      );

      const transaction =
        await registryWriter.setPermission(
          agent.blockchainAgentId,
          permissionKey,
          input.allowed,
          input.dailyLimit,
          riskLevelToContract[
            input.riskLevel
          ]
        );

      const receipt =
        await transaction.wait();

      const permission =
        await prisma.permission.upsert({
          where: {
            agentId_service_action: {
              agentId: agent.id,
              service: input.service,
              action: input.action,
            },
          },

          update: {
            allowed: input.allowed,
            dailyLimit:
              input.dailyLimit,
            riskLevel:
              input.riskLevel,
          },

          create: {
            agentId: agent.id,
            service: input.service,
            action: input.action,
            allowed: input.allowed,
            dailyLimit:
              input.dailyLimit,
            riskLevel:
              input.riskLevel,
          },
        });

      return response.json({
        message:
          "Cấp quyền AI Agent thành công",

        permission: {
          ...permission,
          permissionKey,
        },

        blockchain: {
          transactionHash:
            receipt?.hash ??
            transaction.hash,

          blockNumber:
            receipt?.blockNumber ??
            null,
        },
      });
    } catch (error) {
      console.error(
        "Set permission failed:",
        error
      );

      return response.status(500).json({
        message:
          "Không thể cấp quyền AI Agent",
      });
    }
  }
);
agentsRouter.patch(
  "/:agentId/status",
  adminAuth,
  async (request, response) => {
    const parsed =
      agentStatusSchema.safeParse(
        request.body
      );

    if (!parsed.success) {
      return response.status(400).json({
        message:
          "Trạng thái Agent không hợp lệ",
        errors:
          parsed.error.flatten().fieldErrors,
      });
    }

    const agentIdParam = Array.isArray(
      request.params.agentId
    )
      ? request.params.agentId[0]
      : request.params.agentId;

    if (!agentIdParam) {
      return response.status(400).json({
        message: "Thiếu mã AI Agent",
      });
    }

    const agent =
      await prisma.agent.findUnique({
        where: {
          id: agentIdParam,
        },
      });

    if (!agent) {
      return response.status(404).json({
        message:
          "Không tìm thấy AI Agent",
      });
    }

    try {
      const transaction =
        await registryWriter.setAgentStatus(
          agent.blockchainAgentId,
          statusToContract[
            parsed.data.status
          ]
        );

      const receipt =
        await transaction.wait();

      const updatedAgent =
        await prisma.agent.update({
          where: {
            id: agent.id,
          },
          data: {
            status:
              parsed.data.status,
          },
          select: {
            id: true,
            name: true,
            type: true,
            walletAddress: true,
            status: true,
            updatedAt: true,
          },
        });

      return response.json({
        message:
          "Cập nhật trạng thái Agent thành công",

        agent: updatedAgent,

        blockchain: {
          transactionHash:
            receipt?.hash ??
            transaction.hash,

          blockNumber:
            receipt?.blockNumber ??
            null,
        },
      });
    } catch (error) {
      console.error(
        "Update Agent status failed:",
        error
      );

      return response.status(500).json({
        message:
          "Không thể cập nhật trạng thái Agent",
      });
    }
  }
);
agentsRouter.get(
  "/:agentId",
  adminAuth,
  async (request, response) => {
    const agentIdParam = Array.isArray(
      request.params.agentId
    )
      ? request.params.agentId[0]
      : request.params.agentId;

    if (!agentIdParam) {
      return response.status(400).json({
        message: "Thiếu mã AI Agent",
      });
    }

    const agent =
      await prisma.agent.findUnique({
        where: {
          id: agentIdParam,
        },

        select: {
          id: true,
          blockchainAgentId: true,
          walletAddress: true,
          name: true,
          type: true,
          description: true,
          status: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true,

          permissions: true,

          actionRequests: {
            select: {
              id: true,
              requestId: true,
              service: true,
              action: true,
              resourceId: true,
              status: true,
              payloadHash: true,
              blockchainTxHash: true,
              createdAt: true,
              updatedAt: true,
            },

            orderBy: {
              createdAt: "desc",
            },

            take: 50,
          },
        },
      });

    if (!agent) {
      return response.status(404).json({
        message:
          "Không tìm thấy AI Agent",
      });
    }

    return response.json({
      agent,
    });
  }
);
// Xem danh sách Agent
agentsRouter.get(
  "/",
  adminAuth,
  async (_request, response) => {
    const agents =
      await prisma.agent.findMany({
        select: {
          id: true,
          blockchainAgentId: true,
          walletAddress: true,
          name: true,
          type: true,
          description: true,
          status: true,
          expiresAt: true,
          createdAt: true,
          updatedAt: true,

          permissions: {
            select: {
              id: true,
              service: true,
              action: true,
              allowed: true,
              riskLevel: true,
              dailyLimit: true,
            },
          },
        },

        orderBy: {
          createdAt: "desc",
        },
      });

    return response.json({
      total: agents.length,
      agents,
    });
  }
);