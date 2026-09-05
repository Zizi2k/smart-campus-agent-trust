// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";

contract CampusAgentRegistry is AccessControl {
    bytes32 public constant ADMIN_ROLE = keccak256("ADMIN_ROLE");
    bytes32 public constant AUDITOR_ROLE = keccak256("AUDITOR_ROLE");

    enum AgentStatus {
        Active,
        Revoked,
        Expired
    }

    struct Agent {
        bytes32 agentId;
        address wallet;
        string name;
        string agentType;
        AgentStatus status;
        uint256 expiresAt;
        uint256 createdAt;
        bool exists;
    }

    struct Permission {
        bool allowed;
        uint256 dailyLimit;
        uint8 riskLevel;
        bool exists;
    }

    struct AuditRecord {
        bytes32 requestId;
        bytes32 agentId;
        bytes32 payloadHash;
        bytes32 resultHash;
        string action;
        bool success;
        uint256 timestamp;
        address recordedBy;
    }

    mapping(bytes32 => Agent) private agents;
    mapping(address => bytes32) private walletToAgentId;

    mapping(bytes32 => mapping(bytes32 => Permission))
        private agentPermissions;

    mapping(bytes32 => AuditRecord) private auditRecords;

    event AgentRegistered(
        bytes32 indexed agentId,
        address indexed wallet,
        string name,
        string agentType,
        uint256 expiresAt
    );

    event AgentStatusChanged(
        bytes32 indexed agentId,
        AgentStatus status
    );

    event PermissionUpdated(
        bytes32 indexed agentId,
        bytes32 indexed permissionKey,
        bool allowed,
        uint256 dailyLimit,
        uint8 riskLevel
    );

    event AuditRecorded(
        bytes32 indexed requestId,
        bytes32 indexed agentId,
        bytes32 payloadHash,
        bytes32 resultHash,
        string action,
        bool success,
        uint256 timestamp
    );

    error AgentAlreadyExists();
    error AgentNotFound();
    error WalletAlreadyAssigned();
    error InvalidWallet();
    error InvalidExpiration();
    error InvalidRiskLevel();
    error AuditRecordAlreadyExists();

    constructor(address initialAdmin) {
        if (initialAdmin == address(0)) {
            revert InvalidWallet();
        }

        _grantRole(DEFAULT_ADMIN_ROLE, initialAdmin);
        _grantRole(ADMIN_ROLE, initialAdmin);
        _grantRole(AUDITOR_ROLE, initialAdmin);
    }

    function registerAgent(
        bytes32 agentId,
        address wallet,
        string calldata name,
        string calldata agentType,
        uint256 expiresAt
    ) external onlyRole(ADMIN_ROLE) {
        if (agents[agentId].exists) {
            revert AgentAlreadyExists();
        }

        if (wallet == address(0)) {
            revert InvalidWallet();
        }

        if (walletToAgentId[wallet] != bytes32(0)) {
            revert WalletAlreadyAssigned();
        }

        if (expiresAt != 0 && expiresAt <= block.timestamp) {
            revert InvalidExpiration();
        }

        agents[agentId] = Agent({
            agentId: agentId,
            wallet: wallet,
            name: name,
            agentType: agentType,
            status: AgentStatus.Active,
            expiresAt: expiresAt,
            createdAt: block.timestamp,
            exists: true
        });

        walletToAgentId[wallet] = agentId;

        emit AgentRegistered(
            agentId,
            wallet,
            name,
            agentType,
            expiresAt
        );
    }

    function setAgentStatus(
        bytes32 agentId,
        AgentStatus status
    ) external onlyRole(ADMIN_ROLE) {
        _requireAgent(agentId);

        agents[agentId].status = status;

        emit AgentStatusChanged(agentId, status);
    }

    function setPermission(
        bytes32 agentId,
        bytes32 permissionKey,
        bool allowed,
        uint256 dailyLimit,
        uint8 riskLevel
    ) external onlyRole(ADMIN_ROLE) {
        _requireAgent(agentId);

        if (riskLevel > 2) {
            revert InvalidRiskLevel();
        }

        agentPermissions[agentId][permissionKey] = Permission({
            allowed: allowed,
            dailyLimit: dailyLimit,
            riskLevel: riskLevel,
            exists: true
        });

        emit PermissionUpdated(
            agentId,
            permissionKey,
            allowed,
            dailyLimit,
            riskLevel
        );
    }

    function recordAudit(
        bytes32 requestId,
        bytes32 agentId,
        bytes32 payloadHash,
        bytes32 resultHash,
        string calldata action,
        bool success
    ) external onlyRole(AUDITOR_ROLE) {
        _requireAgent(agentId);

        if (auditRecords[requestId].timestamp != 0) {
            revert AuditRecordAlreadyExists();
        }

        auditRecords[requestId] = AuditRecord({
            requestId: requestId,
            agentId: agentId,
            payloadHash: payloadHash,
            resultHash: resultHash,
            action: action,
            success: success,
            timestamp: block.timestamp,
            recordedBy: msg.sender
        });

        emit AuditRecorded(
            requestId,
            agentId,
            payloadHash,
            resultHash,
            action,
            success,
            block.timestamp
        );
    }

    function getAgent(
        bytes32 agentId
    ) external view returns (Agent memory) {
        _requireAgent(agentId);
        return agents[agentId];
    }

    function getAgentByWallet(
        address wallet
    ) external view returns (Agent memory) {
        bytes32 agentId = walletToAgentId[wallet];
        _requireAgent(agentId);
        return agents[agentId];
    }

    function getPermission(
        bytes32 agentId,
        bytes32 permissionKey
    ) external view returns (Permission memory) {
        _requireAgent(agentId);
        return agentPermissions[agentId][permissionKey];
    }

    function getAuditRecord(
        bytes32 requestId
    ) external view returns (AuditRecord memory) {
        return auditRecords[requestId];
    }

    function isAgentActive(
        bytes32 agentId
    ) public view returns (bool) {
        Agent memory agent = agents[agentId];

        if (!agent.exists || agent.status != AgentStatus.Active) {
            return false;
        }

        return agent.expiresAt == 0 || agent.expiresAt > block.timestamp;
    }

    function isAuthorized(
        bytes32 agentId,
        bytes32 permissionKey
    ) external view returns (bool) {
        Permission memory permission =
            agentPermissions[agentId][permissionKey];

        return isAgentActive(agentId) && permission.allowed;
    }

    function _requireAgent(bytes32 agentId) internal view {
        if (!agents[agentId].exists) {
            revert AgentNotFound();
        }
    }
}