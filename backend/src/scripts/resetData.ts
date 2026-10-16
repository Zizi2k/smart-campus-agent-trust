import bcrypt from "bcryptjs";
import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";

async function main() {
  console.log("Đang làm sạch toàn bộ dữ liệu kiểm thử...");

  await prisma.$transaction(async (tx) => {
    const deletedExecutions = await tx.execution.deleteMany({});
    const deletedApprovals = await tx.approval.deleteMany({});
    const deletedRequests = await tx.actionRequest.deleteMany({});
    const deletedPermissions = await tx.permission.deleteMany({});
    const deletedAgents = await tx.agent.deleteMany({});
    const deletedUsers = await tx.user.deleteMany({
      where: {
        role: {
          not: "ADMIN",
        },
      },
    });

    console.log(`- Đã xóa ${deletedExecutions.count} execution log`);
    console.log(`- Đã xóa ${deletedApprovals.count} approval log`);
    console.log(`- Đã xóa ${deletedRequests.count} action request`);
    console.log(`- Đã xóa ${deletedPermissions.count} permission policy`);
    console.log(`- Đã xóa ${deletedAgents.count} agent`);
    console.log(`- Đã xóa ${deletedUsers.count} non-admin user`);
  });

  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12);
  const admin = await prisma.user.upsert({
    where: {
      username: env.ADMIN_USERNAME,
    },
    update: {
      passwordHash,
      role: "ADMIN",
      active: true,
    },
    create: {
      username: env.ADMIN_USERNAME,
      passwordHash,
      role: "ADMIN",
      active: true,
    },
    select: {
      id: true,
      username: true,
      role: true,
      active: true,
    },
  });

  console.log(`✓ Đã bảo toàn và cập nhật tài khoản quản trị Admin: [${admin.username}]`);
  console.log("✓ Cơ sở dữ liệu sẵn sàng cho fresh test!");
}

main()
  .catch((error) => {
    console.error("Lỗi khi reset cơ sở dữ liệu:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
