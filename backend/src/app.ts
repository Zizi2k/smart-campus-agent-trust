import cors from "cors";
import express from "express";
import helmet from "helmet";
import { prisma } from "./lib/prisma.js";
import { checkBlockchainConnection } from "./lib/blockchain.js";
export const app = express();
import { agentsRouter } from "./routes/agents.js";
import { authRouter } from "./routes/auth.js";
import { actionsRouter } from "./routes/actions.js";
import { approvalsRouter } from "./routes/approvals.js";
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: "1mb" }));

app.get("/", (_request, response) => {
  response.json({
    name: "Smart Campus Agent Trust API",
    status: "running",
  });
});

app.get("/health", async (_request, response) => {
  try {
    await prisma.$queryRaw`SELECT 1`;

    response.status(200).json({
      status: "ok",
      database: "connected",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Database health check failed:", error);

    response.status(503).json({
      status: "error",
      database: "disconnected",
      timestamp: new Date().toISOString(),
    });
  }
});

app.get("/health/blockchain", async (_request, response) => {
  try {
    const blockchain = await checkBlockchainConnection();

    if (!blockchain.contractDeployed) {
      return response.status(503).json({
        status: "error",
        message: "Không tìm thấy contract tại địa chỉ đã cấu hình",
        blockchain,
      });
    }

    return response.status(200).json({
      status: "ok",
      blockchain,
    });
  } catch (error) {
    console.error("Blockchain health check failed:", error);

    return response.status(503).json({
      status: "error",
      message: "Không thể kết nối blockchain local",
    });
  }
});
app.use("/api/agents", agentsRouter);
app.use("/api/auth", authRouter);
app.use("/api/actions", actionsRouter);
app.use("/api/approvals", approvalsRouter);
app.use((_request, response) => {
  response.status(404).json({
    message: "Không tìm thấy API",
  });
});