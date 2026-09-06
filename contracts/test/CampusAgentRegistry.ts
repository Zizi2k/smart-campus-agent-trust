import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { network } from "hardhat";

describe("CampusAgentRegistry", async function () {
  const { ethers } = await network.getOrCreate();

  let registry: any;
  let admin: any;
  let agentWallet: any;
  let unauthorizedUser: any;

  beforeEach(async function () {
    [admin, agentWallet, unauthorizedUser] =
      await ethers.getSigners();

    registry = await ethers.deployContract(
      "CampusAgentRegistry",
      [admin.address]
    );

    await registry.waitForDeployment();
  });

  it("triển khai contract với đúng quản trị viên", async function () {
    const adminRole = await registry.ADMIN_ROLE();

    const hasAdminRole = await registry.hasRole(
      adminRole,
      admin.address
    );

    assert.equal(hasAdminRole, true);
  });

  it("quản trị viên có thể đăng ký AI Agent", async function () {
    const agentId = ethers.id("library-agent-001");

    const latestBlock = await ethers.provider.getBlock("latest");
    const expiresAt = BigInt(latestBlock!.timestamp + 86400);

    const transaction = await registry.registerAgent(
      agentId,
      agentWallet.address,
      "Library Assistant",
      "LIBRARY_AGENT",
      expiresAt
    );

    await transaction.wait();

    const agent = await registry.getAgent(agentId);

    assert.equal(agent.agentId, agentId);
    assert.equal(agent.wallet, agentWallet.address);
    assert.equal(agent.name, "Library Assistant");
    assert.equal(agent.agentType, "LIBRARY_AGENT");
    assert.equal(agent.status, 0n);
    assert.equal(agent.exists, true);

    const active = await registry.isAgentActive(agentId);
    assert.equal(active, true);
  });

  it("quản trị viên có thể cấp quyền cho AI Agent", async function () {
    const agentId = ethers.id("library-agent-001");
    const permissionKey = ethers.id("LIBRARY:READ_BOOK");

    await (
      await registry.registerAgent(
        agentId,
        agentWallet.address,
        "Library Assistant",
        "LIBRARY_AGENT",
        0
      )
    ).wait();

    await (
      await registry.setPermission(
        agentId,
        permissionKey,
        true,
        100,
        0
      )
    ).wait();

    const permission = await registry.getPermission(
      agentId,
      permissionKey
    );

    assert.equal(permission.allowed, true);
    assert.equal(permission.dailyLimit, 100n);
    assert.equal(permission.riskLevel, 0n);
    assert.equal(permission.exists, true);

    const authorized = await registry.isAuthorized(
      agentId,
      permissionKey
    );

    assert.equal(authorized, true);
  });

  it("chặn người không có ADMIN_ROLE đăng ký Agent", async function () {
    const agentId = ethers.id("unauthorized-agent");

    await assert.rejects(async () => {
      const transaction = await registry
        .connect(unauthorizedUser)
        .registerAgent(
          agentId,
          agentWallet.address,
          "Unauthorized Agent",
          "UNKNOWN",
          0
        );

      await transaction.wait();
    });
  });
});