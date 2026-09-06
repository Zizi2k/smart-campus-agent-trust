import bcrypt from "bcryptjs";

import { env } from "../config/env.js";
import { prisma } from "../lib/prisma.js";

async function main() {
  const passwordHash = await bcrypt.hash(
    env.ADMIN_PASSWORD,
    12
  );

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

  console.log("Đã tạo/cập nhật admin:", admin);
}

main()
  .catch((error) => {
    console.error("Không thể tạo admin:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });