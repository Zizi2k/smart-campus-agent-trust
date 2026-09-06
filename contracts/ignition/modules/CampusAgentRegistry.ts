import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

export default buildModule("CampusAgentRegistryModule", (m) => {
  const initialAdmin = m.getAccount(0);

  const campusAgentRegistry = m.contract(
    "CampusAgentRegistry",
    [initialAdmin]
  );

  return { campusAgentRegistry };
});