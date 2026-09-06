import {
  Contract,
  JsonRpcProvider,
  Wallet,
} from "ethers";

import { env } from "../config/env.js";

export const registryAbi = [
  "function ADMIN_ROLE() view returns (bytes32)",
  "function AUDITOR_ROLE() view returns (bytes32)",
  "function hasRole(bytes32 role, address account) view returns (bool)",

  "function registerAgent(bytes32 agentId, address wallet, string name, string agentType, uint256 expiresAt)",
  "function setAgentStatus(bytes32 agentId, uint8 status)",
  "function setPermission(bytes32 agentId, bytes32 permissionKey, bool allowed, uint256 dailyLimit, uint8 riskLevel)",

  "function isAgentActive(bytes32 agentId) view returns (bool)",
  "function isAuthorized(bytes32 agentId, bytes32 permissionKey) view returns (bool)",

  "function getAgent(bytes32 agentId) view returns (tuple(bytes32 agentId, address wallet, string name, string agentType, uint8 status, uint256 expiresAt, uint256 createdAt, bool exists))",

  "function getPermission(bytes32 agentId, bytes32 permissionKey) view returns (tuple(bool allowed, uint256 dailyLimit, uint8 riskLevel, bool exists))",

  "function getAuditRecord(bytes32 requestId) view returns (tuple(bytes32 requestId, bytes32 agentId, bytes32 payloadHash, bytes32 resultHash, string action, bool success, uint256 timestamp, address recordedBy))",
  
  "function recordAudit(bytes32 requestId, bytes32 agentId, bytes32 payloadHash, bytes32 resultHash, string action, bool success)"
  
] as const;

export const blockchainProvider = new JsonRpcProvider(
  env.RPC_URL
);

export const backendSigner = new Wallet(
  env.BACKEND_SIGNER_PRIVATE_KEY,
  blockchainProvider
);

export const registryContract = new Contract(
  env.CONTRACT_ADDRESS,
  registryAbi,
  blockchainProvider
);

export const registryWriter = new Contract(
  env.CONTRACT_ADDRESS,
  registryAbi,
  backendSigner
);

export async function checkBlockchainConnection() {
  const network = await blockchainProvider.getNetwork();
  const blockNumber =
    await blockchainProvider.getBlockNumber();

  const bytecode = await blockchainProvider.getCode(
    env.CONTRACT_ADDRESS
  );

  const signerAddress =
    await backendSigner.getAddress();

  const adminRole =
    await registryContract.ADMIN_ROLE();

  const signerHasAdminRole =
    await registryContract.hasRole(
      adminRole,
      signerAddress
    );

  return {
    connected: true,
    chainId: network.chainId.toString(),
    blockNumber,
    contractAddress: env.CONTRACT_ADDRESS,
    contractDeployed: bytecode !== "0x",
    signerAddress,
    signerHasAdminRole,
  };
}