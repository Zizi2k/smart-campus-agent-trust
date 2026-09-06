import { randomUUID } from "node:crypto";

import {
  id,
  keccak256,
  toUtf8Bytes,
} from "ethers";

import { Router } from "express";
import { z } from "zod";
import type { Prisma } from "../generated/prisma/client.js";
import {
  registryContract,
  registryWriter,
} from "../lib/blockchain.js";
import { prisma } from "../lib/prisma.js";
import { agentAuth } from "../middleware/agentAuth.js";
import { adminAuth } from "../middleware/adminAuth.js";
export const actionsRouter = Router();

const actionRequestSchema = z.object({
  service: z.string().trim().min(2).max(100),
  action: z.string().trim().min(2).max(100),

  resourceId: z
    .string()
    .trim()
    .max(100)
    .optional(),

  payload: z.record(
    z.string(),
    z.unknown()
  ),
});
actionsRouter.post(
  "/:requestId/execute",
  agentAuth,
  async (request, response) => {
    const agent = response.locals.agent;

    const requestIdParam = Array.isArray(
      request.params.requestId
    )
      ? request.params.requestId[0]
      : request.params.requestId;

    if (!requestIdParam) {
      return response.status(400).json({
        message: "Thiếu mã yêu cầu",
      });
    }

    try {
      const actionRequest =
        await prisma.actionRequest.findUnique({
          where: {
            requestId: requestIdParam,
          },

          include: {
            execution: true,
          },
        });

      if (!actionRequest) {
        return response.status(404).json({
          message: "Không tìm thấy yêu cầu",
        });
      }

      if (actionRequest.agentId !== agent.id) {
        return response.status(403).json({
          message:
            "Agent không sở hữu yêu cầu này",
        });
      }

      if (actionRequest.execution) {
        return response.status(409).json({
          message:
            "Yêu cầu đã được thực thi trước đó",
        });
      }

      if (actionRequest.status !== "APPROVED") {
        return response.status(409).json({
          message:
            "Chỉ yêu cầu APPROVED mới được thực thi",
          currentStatus:
            actionRequest.status,
        });
      }

      await prisma.actionRequest.update({
        where: {
          id: actionRequest.id,
        },
        data: {
          status: "EXECUTING",
        },
      });

      // Đây là kết quả mô phỏng dịch vụ thư viện.
      // Sau này sẽ thay bằng lời gọi đến dịch vụ thật.
      const resultData = {
        outcome: "ACCESS_GRANTED",
        service: actionRequest.service,
        action: actionRequest.action,
        resourceId:
          actionRequest.resourceId,
        message:
          "Agent được phép truy cập tài nguyên",
        executedAt:
          new Date().toISOString(),
      };

      const resultHash = keccak256(
        toUtf8Bytes(
          JSON.stringify(resultData)
        )
      );

      const auditRequestId = id(
        actionRequest.requestId
      );

      const auditTransaction =
        await registryWriter.recordAudit(
          auditRequestId,
          agent.blockchainAgentId,
          actionRequest.payloadHash,
          resultHash,
          `${actionRequest.service}:${actionRequest.action}`,
          true
        );

      const auditReceipt =
        await auditTransaction.wait();

      const blockchainTxHash =
        auditReceipt?.hash ??
        auditTransaction.hash;

      const result =
        resultData as Prisma.InputJsonValue;

      const execution =
        await prisma.$transaction(
          async (transaction) => {
            const createdExecution =
              await transaction.execution.create({
                data: {
                  actionRequestId:
                    actionRequest.id,
                  result,
                  resultHash,
                  success: true,
                  blockchainTxHash,
                },
              });

            await transaction.actionRequest.update({
              where: {
                id: actionRequest.id,
              },
              data: {
                status: "EXECUTED",
                blockchainTxHash,
              },
            });

            return createdExecution;
          }
        );

      return response.json({
        message:
          "Thực thi và ghi nhật ký kiểm toán thành công",

        execution: {
          id: execution.id,
          success: execution.success,
          result: execution.result,
          resultHash:
            execution.resultHash,
          executedAt:
            execution.executedAt,
        },

        blockchain: {
          transactionHash:
            blockchainTxHash,
          blockNumber:
            auditReceipt?.blockNumber ??
            null,
        },
      });
    } catch (error) {
      console.error(
        "Execute action failed:",
        error
      );

      return response.status(500).json({
        message:
          "Không thể thực thi yêu cầu",
      });
    }
  }
);
actionsRouter.get(
  "/my",
  agentAuth,
  async (_request, response) => {
    const agent = response.locals.agent;

    const requests =
      await prisma.actionRequest.findMany({
        where: {
          agentId: agent.id,
        },

        include: {
          approval: {
            select: {
              decision: true,
              reason: true,
              decisionHash: true,
              blockchainTxHash: true,
              createdAt: true,
            },
          },

          execution: true,
        },

        orderBy: {
          createdAt: "desc",
        },

        take: 100,
      });

    return response.json({
      total: requests.length,
      requests,
    });
  }
);
actionsRouter.get(
  "/admin/all",
  adminAuth,
  async (_request, response) => {
    const requests =
      await prisma.actionRequest.findMany({
        include: {
          agent: {
            select: {
              id: true,
              name: true,
              type: true,
              walletAddress: true,
            },
          },

          approval: {
            include: {
              approver: {
                select: {
                  id: true,
                  username: true,
                  role: true,
                },
              },
            },
          },

          execution: true,
        },

        orderBy: {
          createdAt: "desc",
        },

        take: 200,
      });

    return response.json({
      total: requests.length,
      requests,
    });
  }
);
actionsRouter.get(
  "/:requestId/audit",
  adminAuth,
  async (request, response) => {
    const requestIdParam = Array.isArray(
      request.params.requestId
    )
      ? request.params.requestId[0]
      : request.params.requestId;

    if (!requestIdParam) {
      return response.status(400).json({
        message: "Thiếu mã yêu cầu",
      });
    }

    const actionRequest =
      await prisma.actionRequest.findUnique({
        where: {
          requestId: requestIdParam,
        },

        include: {
          agent: true,
          approval: true,
          execution: true,
        },
      });

    if (!actionRequest) {
      return response.status(404).json({
        message: "Không tìm thấy yêu cầu",
      });
    }

    try {
      const executionAuditId = id(
        actionRequest.requestId
      );

      const approvalAuditId = id(
        `approval:${actionRequest.requestId}`
      );

      const [
        executionAudit,
        approvalAudit,
      ] = await Promise.all([
        registryContract.getAuditRecord(
          executionAuditId
        ),

        registryContract.getAuditRecord(
          approvalAuditId
        ),
      ]);

      const executionTimestamp =
        BigInt(executionAudit.timestamp);

      const approvalTimestamp =
        BigInt(approvalAudit.timestamp);

      return response.json({
        requestId:
          actionRequest.requestId,

        database: {
          status:
            actionRequest.status,
          payloadHash:
            actionRequest.payloadHash,

          resultHash:
            actionRequest.execution
              ?.resultHash ?? null,

          decisionHash:
            actionRequest.approval
              ?.decisionHash ?? null,
        },

        blockchain: {
          execution: {
            exists:
              executionTimestamp > 0n,

            payloadHash:
              executionAudit.payloadHash,

            resultHash:
              executionAudit.resultHash,

            action:
              executionAudit.action,

            success:
              executionAudit.success,

            timestamp:
              executionTimestamp.toString(),

            recordedBy:
              executionAudit.recordedBy,
          },

          approval: {
            exists:
              approvalTimestamp > 0n,

            payloadHash:
              approvalAudit.payloadHash,

            decisionHash:
              approvalAudit.resultHash,

            action:
              approvalAudit.action,

            success:
              approvalAudit.success,

            timestamp:
              approvalTimestamp.toString(),

            recordedBy:
              approvalAudit.recordedBy,
          },
        },

        verification: {
          payloadHashMatches:
            actionRequest.payloadHash ===
            executionAudit.payloadHash,

          resultHashMatches:
            actionRequest.execution
              ? actionRequest.execution
                  .resultHash ===
                executionAudit.resultHash
              : null,

          decisionHashMatches:
            actionRequest.approval
              ? actionRequest.approval
                  .decisionHash ===
                approvalAudit.resultHash
              : null,
        },
      });
    } catch (error) {
      console.error(
        "Audit verification failed:",
        error
      );

      return response.status(500).json({
        message:
          "Không thể xác minh audit blockchain",
      });
    }
  }
);
actionsRouter.post(
  "/",
  agentAuth,
  async (request, response) => {
    const parsed = actionRequestSchema.safeParse(
      request.body
    );

    if (!parsed.success) {
      return response.status(400).json({
        message:
          "Dữ liệu yêu cầu hành động không hợp lệ",
        errors:
          parsed.error.flatten().fieldErrors,
      });
    }

    const agent = response.locals.agent;
    const input = parsed.data;
const payload =
  input.payload as Prisma.InputJsonValue;
    const requestId = `req_${randomUUID()}`;
    const nonce = randomUUID();

    const payloadHash = keccak256(
  toUtf8Bytes(JSON.stringify(input.payload))
);

    const permissionKey = id(
      `${input.service}:${input.action}`
    );

    try {
      const databasePermission =
        await prisma.permission.findUnique({
          where: {
            agentId_service_action: {
              agentId: agent.id,
              service: input.service,
              action: input.action,
            },
          },
        });

      const blockchainAuthorized =
        await registryContract.isAuthorized(
          agent.blockchainAgentId,
          permissionKey
        );

      if (
        !databasePermission ||
        !databasePermission.allowed ||
        !blockchainAuthorized
      ) {
        const rejected =
          await prisma.actionRequest.create({
            data: {
              requestId,
              agentId: agent.id,
              service: input.service,
              action: input.action,
              resourceId: input.resourceId,
              payload,
              payloadHash,
              nonce,
              status: "REJECTED",
            },
          });

        return response.status(403).json({
          message:
            "AI Agent không có quyền thực hiện hành động",
          requestId: rejected.requestId,
          checks: {
            database:
              databasePermission?.allowed ??
              false,
            blockchain:
              blockchainAuthorized,
          },
        });
      }

      const startOfToday = new Date();
      startOfToday.setUTCHours(0, 0, 0, 0);

      const dailyUsage =
        await prisma.actionRequest.count({
          where: {
            agentId: agent.id,
            service: input.service,
            action: input.action,
            createdAt: {
              gte: startOfToday,
            },
            status: {
              not: "REJECTED",
            },
          },
        });

      if (
        databasePermission.dailyLimit > 0 &&
        dailyUsage >=
          databasePermission.dailyLimit
      ) {
        const rejected =
          await prisma.actionRequest.create({
            data: {
              requestId,
              agentId: agent.id,
              service: input.service,
              action: input.action,
              resourceId: input.resourceId,
              payload,
              payloadHash,
              nonce,
              status: "REJECTED",
            },
          });

        return response.status(429).json({
          message:
            "AI Agent đã đạt hạn mức hành động trong ngày",
          requestId: rejected.requestId,
          dailyUsage,
          dailyLimit:
            databasePermission.dailyLimit,
        });
      }

      const status =
        databasePermission.riskLevel === "LOW"
          ? "APPROVED"
          : "PENDING";

      const actionRequest =
        await prisma.actionRequest.create({
          data: {
            requestId,
            agentId: agent.id,
            service: input.service,
            action: input.action,
            resourceId: input.resourceId,
            payload,
            payloadHash,
            nonce,
            status,
          },
        });

      return response.status(201).json({
        message:
          status === "APPROVED"
            ? "Yêu cầu đã được tự động phê duyệt"
            : "Yêu cầu đang chờ người có thẩm quyền phê duyệt",

        actionRequest: {
          id: actionRequest.id,
          requestId:
            actionRequest.requestId,
          service:
            actionRequest.service,
          action:
            actionRequest.action,
          resourceId:
            actionRequest.resourceId,
          payloadHash:
            actionRequest.payloadHash,
          status:
            actionRequest.status,
          createdAt:
            actionRequest.createdAt,
        },

        permission: {
          riskLevel:
            databasePermission.riskLevel,
          dailyUsage: dailyUsage + 1,
          dailyLimit:
            databasePermission.dailyLimit,
        },

        checks: {
          database: true,
          blockchain: true,
        },
      });
    } catch (error) {
      console.error(
        "Create action request failed:",
        error
      );

      return response.status(500).json({
        message:
          "Không thể xử lý yêu cầu hành động",
      });
    }
  }
);