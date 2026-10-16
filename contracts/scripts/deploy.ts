import { ethers } from "ethers";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  const signer = await provider.getSigner(0);
  const signerAddress = await signer.getAddress();
  console.log("Deploying from account:", signerAddress);

  const artifactPath = path.resolve(__dirname, "../artifacts/contracts/CampusAgentRegistry.sol/CampusAgentRegistry.json");
  const artifact = JSON.parse(fs.readFileSync(artifactPath, "utf-8"));

  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
  const contract = await factory.deploy(signerAddress);
  await contract.waitForDeployment();

  const address = await contract.getAddress();
  console.log("CampusAgentRegistry deployed successfully at:", address);
}

main().catch((err) => {
  console.error("Deploy failed:", err);
  process.exit(1);
});
