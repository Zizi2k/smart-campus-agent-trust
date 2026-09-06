import { id } from "ethers";

import {
  registryContract,
  registryWriter,
} from "../lib/blockchain.js";

import { prisma } from "../lib/prisma.js";

const statusToContract = {
  ACTIVE: 0,
  REVOKED: 1,
  EXPIRED: 2,
} as const;

const riskToContract = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
} as const;

async function main() {
  const agents = await prisma.agent.findMany({
    include: {
      permissions: true,
    },
  });

  console.log(
    `Đang đồng bộ ${agents.length} Agent...`
  );

  for (const agent of agents) {
    let existsOnBlockchain = true;

    try {
      await registryContract.getAgent(
        agent.blockchainAgentId
      );
    } catch {
      existsOnBlockchain = false;
    }

    if (!existsOnBlockchain) {
      const expiresAt =
        agent.expiresAt &&
        agent.expiresAt.getTime() > Date.now()
          ? BigInt(
              Math.floor(
                agent.expiresAt.getTime() /
                  1000
              )
            )
          : 0n;

      const transaction =
        await registryWriter.registerAgent(
          agent.blockchainAgentId,
          agent.walletAddress,
          agent.name,
          agent.type,
          expiresAt
        );

      await transaction.wait();

      console.log(
        `Đã đăng ký: ${agent.name}`
      );
    }

    const statusTransaction =
      await registryWriter.setAgentStatus(
        agent.blockchainAgentId,
        statusToContract[agent.status]
      );

    await statusTransaction.wait();

    for (const permission of agent.permissions) {
      const permissionKey = id(
        `${permission.service}:${permission.action}`
      );

      const permissionTransaction =
        await registryWriter.setPermission(
          agent.blockchainAgentId,
          permissionKey,
          permission.allowed,
          permission.dailyLimit,
          riskToContract[
            permission.riskLevel
          ]
        );

      await permissionTransaction.wait();

      console.log(
        `Đã đồng bộ quyền ${permission.service}:${permission.action}`
      );
    }
  }

  console.log(
    "Đồng bộ blockchain hoàn tất."
  );
}

main()
  .catch((error) => {
    console.error(
      "Đồng bộ blockchain thất bại:",
      error
    );

    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
  