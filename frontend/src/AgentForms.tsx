import {
  type FormEvent,
  useState,
} from "react";
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  Check,
  CheckCircle2,
  Copy,
  Key,
  PlusCircle,
  Send,
  ShieldCheck,
  Sliders,
  Terminal,
  Wallet,
} from "lucide-react";

import { api } from "./api";

export interface AgentPermission {
  id: string;
  service: string;
  action: string;
  allowed: boolean;
  riskLevel: string;
  dailyLimit: number;
}

export interface AgentOption {
  id: string;
  name: string;
  type?: string;
  clientId?: string;
  permissions?: AgentPermission[];
}

interface Props {
  agents: AgentOption[];
  onChanged: () => Promise<void>;
}

interface Credentials {
  clientId: string;
  clientSecret: string;
}

export function AgentForms({
  agents,
  onChanged,
}: Props) {
  const [name, setName] = useState("");
  const [type, setType] = useState("CAMPUS_ASSISTANT");
  const [description, setDescription] = useState("");
  const [walletAddress, setWalletAddress] = useState("");

  const [selectedAgent, setSelectedAgent] = useState("");
  const [service, setService] = useState("LIBRARY");
  const [action, setAction] = useState("READ_BOOK");
  const [dailyLimit, setDailyLimit] = useState(100);
  const [riskLevel, setRiskLevel] = useState("LOW");

  // Simulator states
  const [simAgentId, setSimAgentId] = useState("");
  const [simService, setSimService] = useState("LIBRARY");
  const [simAction, setSimAction] = useState("READ_BOOK");
  const [simPayload, setSimPayload] = useState('{\n  "bookId": "BK-2024",\n  "reader": "Student #10294"\n}');
  const [simLoading, setSimLoading] = useState(false);
  const [simResult, setSimResult] = useState<{
    status: string;
    message: string;
    requestId?: string;
    payloadHash?: string;
    riskLevel?: string;
  } | null>(null);
  const [copiedCurl, setCopiedCurl] = useState(false);
  const [copiedPowerShell, setCopiedPowerShell] = useState(false);
  const [simRiskLevel, setSimRiskLevel] = useState<string>("LOW");

  const [credentials, setCredentials] = useState<Credentials | null>(null);
  const [copiedId, setCopiedId] = useState(false);
  const [copiedSecret, setCopiedSecret] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  function copyToClipboard(text: string, isSecret = false) {
    void navigator.clipboard.writeText(text);
    if (isSecret) {
      setCopiedSecret(true);
      setTimeout(() => setCopiedSecret(false), 2000);
    } else {
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
    }
  }

  async function createAgent(event: FormEvent) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      const response = await api.post("/agents", {
        name,
        type,
        description: description || undefined,
        walletAddress: walletAddress || undefined,
      });

      setCredentials(response.data.credentials);
      setMessage(`Đã đăng ký Agent "${name}" thành công trên hệ thống.`);
      setName("");
      setDescription("");
      setWalletAddress("");
      await onChanged();
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : "Không thể tạo Agent";
      setError(message || "Lỗi xử lý yêu cầu tạo Agent");
    } finally {
      setSaving(false);
    }
  }

  async function createPermission(event: FormEvent) {
    event.preventDefault();
    if (!selectedAgent) {
      setError("Vui lòng chọn một Agent để gán quyền");
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");

    try {
      await api.post(`/agents/${selectedAgent}/permissions`, {
        service,
        action,
        allowed: true,
        dailyLimit: Number(dailyLimit),
        riskLevel,
      });

      setMessage("Đã cập nhật chính sách phân quyền cho Agent.");
      await onChanged();
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : "Không thể cập nhật chính sách";
      setError(message || "Lỗi khi gán quyền cho Agent");
    } finally {
      setSaving(false);
    }
  }

  function handleSelectSimAgent(agentId: string) {
    setSimAgentId(agentId);
    setSimResult(null);
    const ag = agents.find((a) => a.id === agentId);
    if (ag && ag.permissions && ag.permissions.length > 0) {
      const p = ag.permissions[0];
      setSimService(p.service);
      setSimAction(p.action);
      setSimRiskLevel(p.riskLevel);
      updateSamplePayload(p.service, p.action);
    }
  }

  function handleSelectSimPermission(permId: string) {
    const ag = agents.find((a) => a.id === simAgentId);
    const p = ag?.permissions?.find((perm) => perm.id === permId);
    if (p) {
      setSimService(p.service);
      setSimAction(p.action);
      setSimRiskLevel(p.riskLevel);
      updateSamplePayload(p.service, p.action);
    }
  }

  function updateSamplePayload(srv: string, _act?: string) {
    const s = srv.toUpperCase();
    if (s.includes("LAB")) {
      setSimPayload('{\n  "labRoom": "B4-201",\n  "voltage": 380,\n  "purpose": "Thi nghiem dong co cao ap"\n}');
    } else if (s.includes("FINANCIAL")) {
      setSimPayload('{\n  "tuitionId": "TU-9921",\n  "amount": 5000000,\n  "student": "SV-10294"\n}');
    } else if (s.includes("ACADEMIC")) {
      setSimPayload('{\n  "studentId": "SV-2026",\n  "transcriptType": "OFFICIAL"\n}');
    } else {
      setSimPayload('{\n  "bookId": "BK-2024",\n  "reader": "Student #10294"\n}');
    }
  }

  async function handleSimulateAction(e: FormEvent) {
    e.preventDefault();
    if (!simAgentId) {
      setError("Vui lòng chọn một AI Agent để mô phỏng");
      return;
    }

    setSimLoading(true);
    setError("");
    setMessage("");
    setSimResult(null);

    let parsedPayload: Record<string, unknown> = {};
    try {
      parsedPayload = JSON.parse(simPayload) as Record<string, unknown>;
    } catch {
      setError("Payload phải là định dạng JSON hợp lệ");
      setSimLoading(false);
      return;
    }

    try {
      const res = await api.post("/actions/admin/simulate", {
        agentId: simAgentId,
        service: simService,
        action: simAction,
        payload: parsedPayload,
      });

      const data = res.data;
      setSimResult({
        status: data.actionRequest?.status ?? "UNKNOWN",
        message: data.message,
        requestId: data.actionRequest?.requestId,
        payloadHash: data.actionRequest?.payloadHash,
        riskLevel: data.permission?.riskLevel,
      });

      await onChanged();
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { message?: string } };
      };
      const errMsg = axiosErr.response?.data?.message || "Lỗi mô phỏng yêu cầu";
      setError(errMsg);
    } finally {
      setSimLoading(false);
    }
  }

  function copyPowerShellCommand() {
    const selected = agents.find((a) => a.id === simAgentId);
    const agentName = selected?.name || "AI_AGENT";
    const clientId = selected?.clientId || "CLIENT_ID_CUA_AGENT";
    let minified = "{}";
    try {
      minified = JSON.stringify(JSON.parse(simPayload));
    } catch {
      minified = '{"data":"sample"}';
    }
    const text = `# Kịch bản gọi API chuẩn Windows PowerShell (AI Agent: "${agentName}")
# Bước 1: Xác thực Client ID & Secret để nhận Bearer Token
$authBody = '{"clientId":"${clientId}","clientSecret":"<CLIENT_SECRET_KHI_KHOI_TAO>"}'
$auth = Invoke-RestMethod -Uri "http://localhost:3100/api/auth/agent" -Method Post -Body $authBody -ContentType "application/json"
$token = $auth.accessToken
Write-Host "Xác thực thành công! Token: $($token.Substring(0, 15))..." -ForegroundColor Green

# Bước 2: Gửi Action Request kèm Bearer Token từ Bước 1
$actionBody = '{"service":"${simService}","action":"${simAction}","payload":${minified}}'
$result = Invoke-RestMethod -Uri "http://localhost:3100/api/actions" -Method Post -Headers @{ Authorization = "Bearer $token" } -Body $actionBody -ContentType "application/json"
$result | ConvertTo-Json -Depth 5`;

    void navigator.clipboard.writeText(text);
    setCopiedPowerShell(true);
    setTimeout(() => setCopiedPowerShell(false), 2500);
  }

  function copyCurlCommand() {
    const selected = agents.find((a) => a.id === simAgentId);
    const agentName = selected?.name || "AI_AGENT";
    const clientId = selected?.clientId || "CLIENT_ID_CUA_AGENT";
    const text = `# Kịch bản gọi API chuẩn cURL / Bash (AI Agent: "${agentName}")
# Bước 1: Xác thực Client ID & Secret để nhận Bearer Token
curl -X POST http://localhost:3100/api/auth/agent \\
  -H "Content-Type: application/json" \\
  -d '{"clientId": "${clientId}", "clientSecret": "<CLIENT_SECRET_KHI_KHOI_TAO>"}'

# Bước 2: Gửi Action Request kèm Bearer Token từ Bước 1
curl -X POST http://localhost:3100/api/actions \\
  -H "Authorization: Bearer <TOKEN_BUOC_1>" \\
  -H "Content-Type: application/json" \\
  -d '{
    "service": "${simService}",
    "action": "${simAction}",
    "payload": ${simPayload.replace(/\n/g, "\n    ")}
  }'`;
    void navigator.clipboard.writeText(text);
    setCopiedCurl(true);
    setTimeout(() => setCopiedCurl(false), 2500);
  }

  const currentAgent = agents.find((a) => a.id === simAgentId);
  const selectedAgentObj = agents.find((a) => a.id === selectedAgent);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {/* Alert Banner */}
      {message && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          borderRadius: "var(--radius-md)",
          background: "var(--status-active-bg)",
          border: "1px solid var(--status-active-border)",
          color: "var(--status-active-text)",
          fontSize: "0.86rem",
          fontWeight: 600,
        }}>
          <ShieldCheck size={18} />
          <span>{message}</span>
        </div>
      )}

      {error && (
        <div style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "12px 16px",
          borderRadius: "var(--radius-md)",
          background: "var(--status-danger-bg)",
          border: "1px solid var(--status-danger-border)",
          color: "var(--status-danger-text)",
          fontSize: "0.86rem",
          fontWeight: 600,
        }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* Secret Issuance Modal / Card */}
      {credentials && (
        <div style={{
          background: "var(--bg-surface)",
          border: "1px solid var(--color-brand-border)",
          borderRadius: "var(--radius-lg)",
          padding: 24,
          boxShadow: "var(--glow-brand)",
          position: "relative",
          overflow: "hidden",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
            <div style={{
              width: 38,
              height: 38,
              borderRadius: "var(--radius-md)",
              background: "var(--color-brand-bg)",
              color: "var(--color-brand)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}>
              <Key size={20} />
            </div>
            <div>
              <h4 style={{ fontSize: "1.05rem", fontWeight: 800, color: "var(--text-primary)" }}>
                Chứng Chỉ API Khởi Tạo Thành Công
              </h4>
              <p style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                Hệ thống chỉ cung cấp Client Secret một lần duy nhất. Hãy sao chép và lưu trữ tại nơi an toàn.
              </p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginTop: 16 }}>
            <div style={{
              background: "var(--bg-input)",
              border: "1px solid var(--border-medium)",
              borderRadius: "var(--radius-md)",
              padding: 12,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                  Client ID (Công Khai)
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(credentials.clientId, false)}
                  className="btn-row-action"
                >
                  {copiedId ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                  <span>{copiedId ? "Đã sao chép" : "Sao chép"}</span>
                </button>
              </div>
              <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem", color: "var(--color-brand)", wordBreak: "break-all" }}>
                {credentials.clientId}
              </code>
            </div>

            <div style={{
              background: "var(--bg-input)",
              border: "1px solid var(--border-medium)",
              borderRadius: "var(--radius-md)",
              padding: 12,
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>
                  Client Secret (Bảo Mật)
                </span>
                <button
                  type="button"
                  onClick={() => copyToClipboard(credentials.clientSecret, true)}
                  className="btn-row-action btn-row-success"
                >
                  {copiedSecret ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                  <span>{copiedSecret ? "Đã sao chép" : "Sao chép"}</span>
                </button>
              </div>
              <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.82rem", color: "var(--status-active-text)", wordBreak: "break-all" }}>
                {credentials.clientSecret}
              </code>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
            <button
              type="button"
              className="btn-row-action"
              onClick={() => setCredentials(null)}
            >
              Tôi đã lưu trữ khóa an toàn
            </button>
          </div>
        </div>
      )}

      {/* Two-Column Registration & Policy Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
        {/* Form 1: Agent Registration */}
        <div className="content-box">
          <div className="content-box-header">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Bot size={18} color="var(--color-brand)" />
              <h3 className="content-box-title">Đăng ký Agent mới</h3>
            </div>
          </div>

          <form onSubmit={createAgent} style={{ padding: 16 }}>
            <div className="form-field-block">
              <label className="field-label-text">Tên AI Agent</label>
              <input
                className="text-input"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ví dụ: Campus Library Bot"
                required
              />
            </div>

            <div className="form-field-block">
              <label className="field-label-text">Phân loại Nghiệp vụ</label>
              <select
                className="text-input"
                value={type}
                onChange={(e) => setType(e.target.value)}
              >
                <option value="CAMPUS_ASSISTANT">Trợ lý Sinh viên (CAMPUS_ASSISTANT)</option>
                <option value="LIBRARY_AGENT">Thủ thư Tự động (LIBRARY_AGENT)</option>
                <option value="LAB_CONTROLLER">Bộ điều khiển Lab (LAB_CONTROLLER)</option>
                <option value="ACADEMIC_AUDITOR">Kiểm toán Học vụ (ACADEMIC_AUDITOR)</option>
                <option value="FINANCIAL_BOT">Thanh toán & Học phí (FINANCIAL_BOT)</option>
              </select>
            </div>

            <div className="form-field-block">
              <label className="field-label-text">Địa chỉ Ví EVM (On-chain Identity)</label>
              <div className="input-icon-wrapper">
                <span className="input-prefix-icon"><Wallet size={16} /></span>
                <input
                  className="text-input input-with-icon"
                  value={walletAddress}
                  onChange={(e) => setWalletAddress(e.target.value)}
                  placeholder="0x70997970C51812dc3A010C7d01b50e0d17dc79C8"
                />
              </div>
            </div>

            <div className="form-field-block">
              <label className="field-label-text">Mô tả Chức năng</label>
              <input
                className="text-input"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Mô tả phạm vi quyền hạn và mục đích hoạt động..."
              />
            </div>

            <button
              type="submit"
              className="btn-primary-action"
              style={{ marginTop: 12 }}
              disabled={saving}
            >
              <PlusCircle size={16} />
              <span>{saving ? "Đang xử lý..." : "Khởi tạo Agent"}</span>
            </button>
          </form>
        </div>

        {/* Form 2: Policy & Limit Configuration */}
        <div className="content-box">
          <div className="content-box-header">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Sliders size={18} color="var(--color-brand)" />
              <h3 className="content-box-title">Thiết lập quyền</h3>
            </div>
          </div>

          <form onSubmit={createPermission} style={{ padding: 16 }}>
            <div className="form-field-block">
              <label className="field-label-text">Chọn AI Agent Nhận Quyền</label>
              <select
                className="text-input"
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                required
              >
                <option value="">-- Chọn Agent từ danh bạ --</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} {agent.type ? `(${agent.type})` : ""}
                  </option>
                ))}
              </select>
            </div>

            {selectedAgentObj && (
              <div style={{
                marginTop: -4,
                marginBottom: 16,
                padding: "10px 14px",
                background: "var(--bg-surface-elevated)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "var(--radius-sm)",
                fontSize: "0.78rem",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                  <span style={{ fontWeight: 700, color: "var(--text-secondary)" }}>
                    Quyền hạn hiện có của {selectedAgentObj.name}:
                  </span>
                  <span style={{ color: "var(--color-brand)", fontWeight: 600 }}>
                    {selectedAgentObj.permissions?.length ?? 0} quyền
                  </span>
                </div>
                {(!selectedAgentObj.permissions || selectedAgentObj.permissions.length === 0) ? (
                  <div style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
                    Chưa có quyền nào được gán cho Agent này. Hãy điền form bên dưới để cấp quyền đầu tiên.
                  </div>
                ) : (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {selectedAgentObj.permissions.map((p) => (
                      <span key={p.id} style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        padding: "3px 8px",
                        background: "var(--bg-surface)",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "var(--radius-xs)",
                        fontSize: "0.75rem",
                      }}>
                        <strong>{p.service}:{p.action}</strong>
                        <span style={{
                          color: p.riskLevel === "HIGH" ? "var(--status-danger-text)" : p.riskLevel === "MEDIUM" ? "var(--status-pending-text)" : "var(--status-active-text)",
                          fontWeight: 700,
                          fontSize: "0.68rem"
                        }}>
                          [{p.riskLevel}]
                        </span>
                        <span style={{ color: "var(--text-muted)", fontSize: "0.68rem" }}>
                          ({p.dailyLimit}/ngày)
                        </span>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div className="form-field-block">
                <label className="field-label-text">Dịch vụ (Service)</label>
                <input
                  className="text-input"
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  placeholder="LIBRARY"
                  required
                />
              </div>

              <div className="form-field-block">
                <label className="field-label-text">Hành động (Action)</label>
                <input
                  className="text-input"
                  value={action}
                  onChange={(e) => setAction(e.target.value)}
                  placeholder="READ_BOOK"
                  required
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
              <div className="form-field-block">
                <label className="field-label-text">Hạn mức gọi/ngày</label>
                <input
                  type="number"
                  className="text-input"
                  value={dailyLimit}
                  onChange={(e) => setDailyLimit(Number(e.target.value))}
                  min={1}
                  required
                />
              </div>

              <div className="form-field-block">
                <label className="field-label-text">Cấp độ Rủi ro (Risk Level)</label>
                <select
                  className="text-input"
                  value={riskLevel}
                  onChange={(e) => setRiskLevel(e.target.value)}
                >
                  <option value="LOW">THẤP (Tự động duyệt)</option>
                  <option value="MEDIUM">TRUNG BÌNH (Cần HITL ký duyệt)</option>
                  <option value="HIGH">CAO (Cần Quản trị viên duyệt)</option>
                </select>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary-action"
              style={{ marginTop: 12 }}
              disabled={saving}
            >
              <ShieldCheck size={16} />
              <span>{saving ? "Đang lưu..." : "Lưu quyền"}</span>
            </button>
          </form>
        </div>
      </div>

      {/* Section 3: AI Agent Action Simulator */}
      <div className="content-box">
        <div className="content-box-header">
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Terminal size={18} color="var(--color-brand)" />
            <h3 className="content-box-title">Mô Phỏng Request Từ AI Agent (Action Simulator - Bước 3)</h3>
          </div>
          <span className="pill-count-subtle">Kiểm Thử & Demo Trực Quan</span>
        </div>

        <form onSubmit={handleSimulateAction} style={{ padding: 16 }}>
          <p style={{ fontSize: "0.82rem", color: "var(--text-secondary)", marginTop: 0, marginBottom: 12, lineHeight: 1.5 }}>
            Giả lập hành vi thực tế của một AI Agent gửi API request đến hệ thống trường học. Nếu tác vụ có rủi ro cao (HIGH) hoặc vượt quota, hệ thống sẽ kích hoạt hàng đợi <strong>Phê duyệt HITL</strong>. Nếu rủi ro thấp, hệ thống sẽ <strong>Tự động duyệt (Auto Approved)</strong> và ghi hash lên Smart Contract.
          </p>

          <div style={{
            padding: "10px 14px",
            background: "var(--color-brand-bg)",
            border: "1px solid var(--color-brand-border)",
            borderRadius: "var(--radius-md)",
            marginBottom: 14,
            fontSize: "0.78rem",
            color: "var(--text-secondary)",
            lineHeight: 1.55,
          }}>
            <div style={{ color: "var(--color-brand)", fontWeight: 700, display: "flex", alignItems: "center", gap: 6, marginBottom: 4 }}>
              <ShieldCheck size={15} />
              <span>Quy trình Kiểm thử Demo dành cho Giảng viên / Đánh giá viên:</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              <div>
                <strong>• Kịch bản 1 (Tự động duyệt):</strong> Chọn <code>Student Assistant</code> &rarr; Chọn quyền <code>LIBRARY / READ_BOOK</code> (Rủi ro LOW) &rarr; Bấm <em>Gửi Request</em> &rarr; Hệ thống tự động cấp phép và ghi hash kiểm toán ngay lập tức.
              </div>
              <div>
                <strong>• Kịch bản 2 (Bảo vệ an toàn HITL):</strong> Chọn <code>Lab Robotics Controller</code> &rarr; Chọn quyền <code>LAB / HIGH_VOLTAGE_POWER</code> (Rủi ro HIGH) &rarr; Bấm <em>Gửi Request</em> &rarr; Hệ thống đưa vào hàng đợi <code>PENDING</code> &rarr; Chuyển sang tab <strong>Phê duyệt HITL</strong> (có badge cảnh báo màu vàng) để đóng vai Admin ký duyệt &rarr; Chuyển sang tab <strong>Audit On-Chain</strong> để đối chiếu hash mật mã khớp 100% với Blockchain!
              </div>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
            <div className="form-field-block">
              <label className="field-label-text">1. Chọn AI Agent Phát Sinh Request</label>
              <select
                className="text-input"
                value={simAgentId}
                onChange={(e) => handleSelectSimAgent(e.target.value)}
                required
              >
                <option value="">-- Chọn Agent --</option>
                {agents.map((ag) => (
                  <option key={ag.id} value={ag.id}>
                    {ag.name} ({ag.type})
                  </option>
                ))}
              </select>
            </div>

            <div className="form-field-block">
              <label className="field-label-text">2. Chọn Quyền Đã Gán (Tự Động Điền Service & Action)</label>
              <select
                className="text-input"
                onChange={(e) => handleSelectSimPermission(e.target.value)}
                disabled={!simAgentId || !currentAgent?.permissions?.length}
              >
                {!simAgentId && <option>-- Vui lòng chọn Agent trước --</option>}
                {simAgentId && !currentAgent?.permissions?.length && (
                  <option>Agent này chưa được gán quyền nào</option>
                )}
                {currentAgent?.permissions?.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.service} / {p.action} (Hạn mức: {p.dailyLimit}/ngày, Rủi ro: {p.riskLevel})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Risk Level Explanation Callout */}
          {simAgentId && currentAgent?.permissions && currentAgent.permissions.length > 0 && (
            <div style={{
              padding: "10px 14px",
              borderRadius: "var(--radius-sm)",
              marginBottom: 14,
              fontSize: "0.8rem",
              display: "flex",
              alignItems: "center",
              gap: 8,
              background: simRiskLevel === "LOW" ? "var(--status-active-bg)" : "var(--status-pending-bg)",
              border: `1px solid ${simRiskLevel === "LOW" ? "var(--status-active-border)" : "var(--status-pending-border)"}`,
              color: simRiskLevel === "LOW" ? "var(--status-active-text)" : "var(--status-pending-text)",
            }}>
              {simRiskLevel === "LOW" ? <CheckCircle2 size={15} /> : <AlertTriangle size={15} />}
              <span>
                {simRiskLevel === "LOW"
                  ? "⚡ CƠ CHẾ TỰ ĐỘNG (LOW RISK): Thao tác đọc/ít nhạy cảm. Hệ thống tự động duyệt ngay (Auto Approved) & ghi log mà không cần can thiệp Admin."
                  : `🛡️ CƠ CHẾ HITL REVIEW (${simRiskLevel} RISK): Thao tác nhạy cảm hoặc rủi ro cao. Hệ thống đưa vào hàng đợi PENDING để Quản trị viên duyệt On-Chain!`}
              </span>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
            <div className="form-field-block">
              <label className="field-label-text">Dịch vụ (Service)</label>
              <input
                className="text-input"
                value={simService}
                onChange={(e) => setSimService(e.target.value)}
                required
              />
            </div>

            <div className="form-field-block">
              <label className="field-label-text">Hành động (Action)</label>
              <input
                className="text-input"
                value={simAction}
                onChange={(e) => setSimAction(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-field-block">
            <label className="field-label-text">3. Tham Số Yêu Cầu (Payload JSON)</label>
            <textarea
              className="text-input font-mono"
              rows={4}
              value={simPayload}
              onChange={(e) => setSimPayload(e.target.value)}
              style={{ resize: "vertical", fontSize: "0.8rem", lineHeight: 1.4 }}
              required
            />
          </div>

          {/* Simulation Feedback Alert */}
          {simResult && (
            <div style={{
              padding: "16px 18px",
              borderRadius: "var(--radius-md)",
              marginBottom: 16,
              background: simResult.status === "PENDING"
                ? "var(--status-pending-bg)"
                : simResult.status === "APPROVED"
                ? "var(--status-active-bg)"
                : "var(--status-danger-bg)",
              border: `1px solid ${
                simResult.status === "PENDING"
                  ? "var(--status-pending-border)"
                  : simResult.status === "APPROVED"
                  ? "var(--status-active-border)"
                  : "var(--status-danger-border)"
              }`,
              color: simResult.status === "PENDING"
                ? "var(--status-pending-text)"
                : simResult.status === "APPROVED"
                ? "var(--status-active-text)"
                : "var(--status-danger-text)",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, fontWeight: 700, fontSize: "0.92rem", marginBottom: 6 }}>
                {simResult.status === "PENDING" && <AlertTriangle size={18} />}
                {simResult.status === "APPROVED" && <CheckCircle2 size={18} />}
                {simResult.status !== "PENDING" && simResult.status !== "APPROVED" && <AlertCircle size={18} />}
                <span>
                  {simResult.status === "PENDING"
                    ? `ĐÃ KÍCH HOẠT HITL REVIEW (${simResult.riskLevel || "RỦI RO CAO"})`
                    : simResult.status === "APPROVED"
                    ? "TỰ ĐỘNG PHÊ DUYỆT THÀNH CÔNG (AUTO APPROVED)"
                    : `KẾT QUẢ: ${simResult.status}`}
                </span>
              </div>
              <p style={{ fontSize: "0.82rem", margin: "4px 0 8px 0", lineHeight: 1.4 }}>
                {simResult.message}
              </p>
              {simResult.requestId && (
                <div style={{ fontSize: "0.74rem", fontFamily: "var(--font-mono)", opacity: 0.9 }}>
                  Request ID: <strong>{simResult.requestId}</strong> | Keccak-256 Hash: <strong>{simResult.payloadHash?.slice(0, 18)}...</strong>
                </div>
              )}
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 12, flexWrap: "wrap", gap: 10 }}>
            <button
              type="submit"
              className="btn-primary-action"
              style={{ width: "auto", padding: "10px 22px" }}
              disabled={simLoading || !simAgentId}
            >
              <Send size={15} />
              <span>{simLoading ? "Đang gửi request..." : "Gửi Request Từ AI Agent (Simulate Call)"}</span>
            </button>

            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                className="btn-secondary-action"
                onClick={copyPowerShellCommand}
                title="Sao chép kịch bản lệnh chuẩn PowerShell (chạy trực tiếp trên Windows PowerShell không bị lỗi cú pháp)"
              >
                {copiedPowerShell ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                <span>{copiedPowerShell ? "Đã chép PowerShell!" : "Lệnh PowerShell (Windows)"}</span>
              </button>

              <button
                type="button"
                className="btn-secondary-action"
                onClick={copyCurlCommand}
                title="Sao chép kịch bản lệnh cURL chuẩn cho Git Bash, Linux hoặc macOS"
              >
                {copiedCurl ? <Check size={14} color="#10b981" /> : <Copy size={14} />}
                <span>{copiedCurl ? "Đã chép cURL!" : "Lệnh cURL (Bash/Linux)"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}