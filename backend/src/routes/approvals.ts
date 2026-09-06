import {
  id,
  keccak256,
  toUtf8Bytes,
} from "ethers";

import { Router } from "express";
import { z } from "zod";

import { registryWriter } from "../lib/blockchain.js";
import { prisma } from "../lib/prisma.js";
import { adminAuth } from "../middleware/adminAuth.js";

export const approvalsRouter = Router();

const decisionSchema = z.object({
  decision: z.enum([
    "APPROVED",
    "REJECTED",
  ]),

  reason: z
    .string()
    .trim()
    .min(3)
    .max(500),
});

// Danh sách yêu cầu đang chờ duyệt
approvalsRouter.get(
  "/pending",
  adminAuth,
  async (_request, response) => {
    const requests =
      await prisma.actionRequest.findMany({
        where: {
          status: "PENDING",
        },

        include: {
          agent: {
            select: {
              id: true,
              name: true,
              type: true,
              walletAddress: true,
            },
          },
        },

        orderBy: {
          createdAt: "asc",
        },
      });

    return response.json({
      total: requests.length,
      requests,
    });
  }
);

// Phê duyệt hoặc từ chối yêu cầu
approvalsRouter.post(
  "/:requestId",
  adminAuth,
  async (request, response) => {
    const parsed = decisionSchema.safeParse(
      request.body
    );

    if (!parsed.success) {
      return response.status(400).json({
        message:
          "Quyết định phê duyệt không hợp lệ",
        errors:
          parsed.error.flatten().fieldErrors,
      });
    }

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

    const approver = response.locals.user;
    const input = parsed.data;

    try {
      const actionRequest =
        await prisma.actionRequest.findUnique({
          where: {
            requestId: requestIdParam,
          },

          include: {
            agent: true,
            approval: true,
          },
        });

      if (!actionRequest) {
        return response.status(404).json({
          message: "Không tìm thấy yêu cầu",
        });
      }

      if (actionRequest.approval) {
        return response.status(409).json({
          message:
            "Yêu cầu đã có quyết định phê duyệt",
        });
      }

      if (actionRequest.status !== "PENDING") {
        return response.status(409).json({
          message:
            "Chỉ yêu cầu PENDING mới được phê duyệt",
          currentStatus:
            actionRequest.status,
        });
      }

      const decisionPayload = {
        requestId:
          actionRequest.requestId,
        decision: input.decision,
        reason: input.reason,
        approverId: approver.id,
        decidedAt: new Date().toISOString(),
      };

      const decisionHash = keccak256(
        toUtf8Bytes(
          JSON.stringify(decisionPayload)
        )
      );

      const approvalAuditId = id(
        `approval:${actionRequest.requestId}`
      );

      const blockchainTransaction =
        await registryWriter.recordAudit(
          approvalAuditId,
          actionRequest.agent.blockchainAgentId,
          actionRequest.payloadHash,
          decisionHash,
          `APPROVAL:${actionRequest.service}:${actionRequest.action}`,
          input.decision === "APPROVED"
        );

      const receipt =
        await blockchainTransaction.wait();

      const blockchainTxHash =
        receipt?.hash ??
        blockchainTransaction.hash;

      const result =
        await prisma.$transaction(
          async (transaction) => {
            const approval =
              await transaction.approval.create({
                data: {
                  actionRequestId:
                    actionRequest.id,
                  approverId:
                    approver.id,
                  decision:
                    input.decision,
                  reason:
                    input.reason,
                  decisionHash,
                  blockchainTxHash,
                },
              });

            const updatedRequest =
              await transaction.actionRequest.update({
                where: {
                  id: actionRequest.id,
                },

                data: {
                  status:
                    input.decision,
                  blockchainTxHash,
                },
              });

            return {
              approval,
              actionRequest:
                updatedRequest,
            };
          }
        );

      return response.json({
        message:
          input.decision === "APPROVED"
            ? "Đã phê duyệt yêu cầu"
            : "Đã từ chối yêu cầu",

        requestId:
          result.actionRequest.requestId,

        status:
          result.actionRequest.status,

        approval: {
          decision:
            result.approval.decision,
          reason:
            result.approval.reason,
          decisionHash:
            result.approval.decisionHash,
          createdAt:
            result.approval.createdAt,
        },

        blockchain: {
          transactionHash:
            blockchainTxHash,
          blockNumber:
            receipt?.blockNumber ?? null,
        },
      });
    } catch (error) {
      console.error(
        "Approval failed:",
        error
      );

      return response.status(500).json({
        message:
          "Không thể xử lý quyết định phê duyệt",
      });
    }
  }
);