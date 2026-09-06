import {
  type FormEvent,
  useEffect,
  useState,
} from "react";
import { AgentForms } from "./AgentForms";
import { api, setAccessToken } from "./api";
import "./App.css";

type Tab =
  | "overview"
  | "agents"
  | "requests"
  | "approvals"
  | "audit";

interface Agent {
  id: string;
  name: string;
  type: string;
  walletAddress: string;
  status: string;
  permissions: Array<{
    id: string;
    service: string;
    action: string;
    allowed: boolean;
    riskLevel: string;
    dailyLimit: number;
  }>;
}

interface ActionRequest {
  id: string;
  requestId: string;
  service: string;
  action: string;
  resourceId: string | null;
  status: string;
  createdAt: string;
  agent?: {
    name: string;
    type: string;
  };
}

interface AuditResult {
  requestId: string;
  verification: {
    payloadHashMatches: boolean | null;
    resultHashMatches: boolean | null;
    decisionHashMatches: boolean | null;
  };
  database: {
    status: string;
    payloadHash: string;
    resultHash: string | null;
    decisionHash: string | null;
  };
}

function App() {
  const [token, setToken] = useState(
    localStorage.getItem("adminToken") ?? ""
  );

  const [username, setUsername] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [tab, setTab] =
    useState<Tab>("overview");

  const [agents, setAgents] =
    useState<Agent[]>([]);

  const [requests, setRequests] =
    useState<ActionRequest[]>([]);

  const [pending, setPending] =
    useState<ActionRequest[]>([]);

  const [audit, setAudit] =
    useState<AuditResult | null>(null);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  useEffect(() => {
    if (!token) return;

    setAccessToken(token);
    void loadDashboard();
  }, [token]);

  async function loadDashboard() {
    setLoading(true);
    setError("");

    try {
      const [
        agentResponse,
        requestResponse,
        pendingResponse,
      ] = await Promise.all([
        api.get("/api/agents"),
        api.get("/api/actions/admin/all"),
        api.get("/api/approvals/pending"),
      ]);

      setAgents(agentResponse.data.agents);
      setRequests(requestResponse.data.requests);
      setPending(pendingResponse.data.requests);
    } catch {
      setError(
        "Không thể tải dữ liệu dashboard."
      );
    } finally {
      setLoading(false);
    }
  }

  async function login(
    event: FormEvent
  ) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await api.post(
        "/api/auth/admin",
        {
          username: username.trim(),
          password,
        }
      );

      const accessToken =
        response.data.accessToken;

      localStorage.setItem(
        "adminToken",
        accessToken
      );

      setAccessToken(accessToken);
      setToken(accessToken);
      setPassword("");
    } catch {
      setError(
        "Tên đăng nhập hoặc mật khẩu không đúng."
      );
    } finally {
      setLoading(false);
    }
  }

  function logout() {
    localStorage.removeItem("adminToken");
    setAccessToken(null);
    setToken("");
    setAgents([]);
    setRequests([]);
    setPending([]);
  }

  async function updateStatus(
    agent: Agent,
    status: "ACTIVE" | "REVOKED"
  ) {
    try {
      await api.patch(
        `/api/agents/${agent.id}/status`,
        { status }
      );

      await loadDashboard();
    } catch {
      setError(
        "Không thể cập nhật trạng thái Agent."
      );
    }
  }

  async function decide(
    requestId: string,
    decision: "APPROVED" | "REJECTED"
  ) {
    const reason = window.prompt(
      decision === "APPROVED"
        ? "Nhập lý do phê duyệt:"
        : "Nhập lý do từ chối:"
    );

    if (!reason || reason.trim().length < 3) {
      return;
    }

    try {
      await api.post(
        `/api/approvals/${requestId}`,
        {
          decision,
          reason: reason.trim(),
        }
      );

      await loadDashboard();
    } catch {
      setError(
        "Không thể xử lý quyết định."
      );
    }
  }

  async function verifyAudit(
    requestId: string
  ) {
    setError("");

    try {
      const response = await api.get(
        `/api/actions/${requestId}/audit`
      );

      setAudit(response.data);
      setTab("audit");
    } catch {
      setError(
        "Không thể xác minh bằng chứng blockchain."
      );
    }
  }

  const executedCount = requests.filter(
    (item) => item.status === "EXECUTED"
  ).length;

  const activeAgents = agents.filter(
    (item) => item.status === "ACTIVE"
  ).length;

  if (!token) {
    return (
      <main className="login-page">
        <section className="login-card">
          <div className="brand-mark">
            SC
          </div>

          <p className="eyebrow">
            SMART CAMPUS
          </p>

          <h1>Agent Trust Platform</h1>

          <p className="login-description">
            Quản lý định danh, quyền hạn và
            bằng chứng kiểm toán của AI Agent.
          </p>

          <form onSubmit={login}>
            <label>
              Tên đăng nhập
              <input
                value={username}
                onChange={(event) =>
                  setUsername(
                    event.target.value
                  )
                }
                autoComplete="username"
                required
              />
            </label>

            <label>
              Mật khẩu
              <input
                type="password"
                value={password}
                onChange={(event) =>
                  setPassword(
                    event.target.value
                  )
                }
                autoComplete="current-password"
                required
              />
            </label>

            {error && (
              <p className="error-message">
                {error}
              </p>
            )}

            <button
              className="primary-button"
              disabled={loading}
            >
              {loading
                ? "Đang đăng nhập..."
                : "Đăng nhập quản trị"}
            </button>
          </form>
        </section>
      </main>
    );
  }

  return (
    <div className="dashboard">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark small">
            SC
          </div>

          <div>
            <strong>Agent Trust</strong>
            <span>Smart Campus</span>
          </div>
        </div>

        <nav>
          {[
            ["overview", "Tổng quan"],
            ["agents", "AI Agent"],
            ["requests", "Yêu cầu"],
            ["approvals", "Phê duyệt"],
            ["audit", "Kiểm toán"],
          ].map(([value, label]) => (
            <button
              key={value}
              className={
                tab === value
                  ? "nav-active"
                  : ""
              }
              onClick={() =>
                setTab(value as Tab)
              }
            >
              {label}

              {value === "approvals" &&
                pending.length > 0 && (
                  <span className="nav-badge">
                    {pending.length}
                  </span>
                )}
            </button>
          ))}
        </nav>

        <button
          className="logout-button"
          onClick={logout}
        >
          Đăng xuất
        </button>
      </aside>

      <main className="main-content">
        <header className="topbar">
          <div>
            <p className="eyebrow">
              BẢNG ĐIỀU KHIỂN
            </p>
            <h1>
              Hệ thống tin cậy AI Agent
            </h1>
          </div>

          <button
            className="secondary-button"
            onClick={() =>
              void loadDashboard()
            }
          >
            Làm mới dữ liệu
          </button>
        </header>

        {error && (
          <p className="error-banner">
            {error}
          </p>
        )}

        {loading && (
          <p className="loading">
            Đang tải dữ liệu...
          </p>
        )}

        {tab === "overview" && (
          <>
            <section className="stats-grid">
              <article className="stat-card">
                <span>Agent hoạt động</span>
                <strong>{activeAgents}</strong>
                <small>
                  / {agents.length} Agent
                </small>
              </article>

              <article className="stat-card">
                <span>Chờ phê duyệt</span>
                <strong>{pending.length}</strong>
                <small>
                  yêu cầu cần xử lý
                </small>
              </article>

              <article className="stat-card">
                <span>Đã thực thi</span>
                <strong>{executedCount}</strong>
                <small>
                  giao dịch hoàn tất
                </small>
              </article>

              <article className="stat-card accent">
                <span>Tổng yêu cầu</span>
                <strong>{requests.length}</strong>
                <small>
                  bản ghi kiểm toán
                </small>
              </article>
            </section>

            <section className="panel">
              <div className="panel-heading">
                <div>
                  <p className="eyebrow">
                    HOẠT ĐỘNG GẦN ĐÂY
                  </p>
                  <h2>Yêu cầu mới nhất</h2>
                </div>
              </div>

              <RequestTable
                requests={requests.slice(0, 6)}
                onVerify={verifyAudit}
              />
            </section>
          </>
        )}

        {tab === "agents" && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">
                  DANH TÍNH SỐ
                </p>
                <h2>AI Agent</h2>
              </div>
            </div>
            <AgentForms
  agents={agents}
  onChanged={loadDashboard}
/>
            <div className="agent-grid">
              {agents.map((agent) => (
                <article
                  className="agent-card"
                  key={agent.id}
                >
                  <div className="agent-title">
                    <div className="agent-icon">
                      {agent.name
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>

                    <div>
                      <h3>{agent.name}</h3>
                      <p>{agent.type}</p>
                    </div>

                    <StatusBadge
                      status={agent.status}
                    />
                  </div>

                  <p className="wallet">
                    {agent.walletAddress}
                  </p>

                  <div className="permission-list">
                    {agent.permissions.map(
                      (permission) => (
                        <span
                          key={permission.id}
                        >
                          {permission.service}:
                          {permission.action}
                        </span>
                      )
                    )}
                  </div>

                  <button
                    className={
                      agent.status === "ACTIVE"
                        ? "danger-button"
                        : "primary-button"
                    }
                    onClick={() =>
                      void updateStatus(
                        agent,
                        agent.status ===
                          "ACTIVE"
                          ? "REVOKED"
                          : "ACTIVE"
                      )
                    }
                  >
                    {agent.status === "ACTIVE"
                      ? "Thu hồi Agent"
                      : "Kích hoạt lại"}
                  </button>
                </article>
              ))}
            </div>
          </section>
        )}

        {tab === "requests" && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">
                  NHẬT KÝ HỆ THỐNG
                </p>
                <h2>
                  Tất cả yêu cầu
                </h2>
              </div>
            </div>

            <RequestTable
              requests={requests}
              onVerify={verifyAudit}
            />
          </section>
        )}

        {tab === "approvals" && (
          <section className="panel">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">
                  HUMAN-IN-THE-LOOP
                </p>
                <h2>Chờ phê duyệt</h2>
              </div>
            </div>

            {pending.length === 0 ? (
              <div className="empty-state">
                Không có yêu cầu đang chờ.
              </div>
            ) : (
              <div className="approval-list">
                {pending.map((item) => (
                  <article
                    className="approval-card"
                    key={item.id}
                  >
                    <div>
                      <StatusBadge
                        status={item.status}
                      />
                      <h3>
                        {item.service} ·{" "}
                        {item.action}
                      </h3>
                      <p>
                        {item.agent?.name ??
                          "AI Agent"}
                      </p>
                      <small>
                        {new Date(
                          item.createdAt
                        ).toLocaleString(
                          "vi-VN"
                        )}
                      </small>
                    </div>

                    <div className="approval-actions">
                      <button
                        className="danger-button"
                        onClick={() =>
                          void decide(
                            item.requestId,
                            "REJECTED"
                          )
                        }
                      >
                        Từ chối
                      </button>

                      <button
                        className="primary-button"
                        onClick={() =>
                          void decide(
                            item.requestId,
                            "APPROVED"
                          )
                        }
                      >
                        Phê duyệt
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}

        {tab === "audit" && (
          <section className="panel audit-panel">
            <p className="eyebrow">
              BLOCKCHAIN VERIFICATION
            </p>
            <h2>Xác minh kiểm toán</h2>

            {!audit ? (
              <div className="empty-state">
                Chọn “Xác minh” tại một yêu
                cầu đã thực thi.
              </div>
            ) : (
              <>
                <p className="request-id">
                  {audit.requestId}
                </p>

                <div className="verification-grid">
                  <VerificationItem
                    label="Payload hash"
                    value={
                      audit.verification
                        .payloadHashMatches
                    }
                  />

                  <VerificationItem
                    label="Result hash"
                    value={
                      audit.verification
                        .resultHashMatches
                    }
                  />

                  <VerificationItem
                    label="Decision hash"
                    value={
                      audit.verification
                        .decisionHashMatches
                    }
                  />
                </div>

                <div className="hash-box">
                  <span>Payload hash</span>
                  <code>
                    {audit.database.payloadHash}
                  </code>
                </div>

                <div className="hash-box">
                  <span>Result hash</span>
                  <code>
                    {audit.database.resultHash ??
                      "Chưa có"}
                  </code>
                </div>
              </>
            )}
          </section>
        )}
      </main>
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: string;
}) {
  return (
    <span
      className={`status status-${status.toLowerCase()}`}
    >
      {status}
    </span>
  );
}

function VerificationItem({
  label,
  value,
}: {
  label: string;
  value: boolean | null;
}) {
  return (
    <article className="verification-item">
      <span>{label}</span>
      <strong>
        {value === null
          ? "Không áp dụng"
          : value
            ? "Khớp dữ liệu"
            : "Không khớp"}
      </strong>
    </article>
  );
}

function RequestTable({
  requests,
  onVerify,
}: {
  requests: ActionRequest[];
  onVerify: (
    requestId: string
  ) => Promise<void>;
}) {
  return (
    <div className="table-wrapper">
      <table>
        <thead>
          <tr>
            <th>Agent</th>
            <th>Dịch vụ</th>
            <th>Hành động</th>
            <th>Tài nguyên</th>
            <th>Trạng thái</th>
            <th>Thời gian</th>
            <th />
          </tr>
        </thead>

        <tbody>
          {requests.map((item) => (
            <tr key={item.id}>
              <td>
                {item.agent?.name ?? "—"}
              </td>
              <td>{item.service}</td>
              <td>{item.action}</td>
                           <td>{item.resourceId ?? "—"}</td>
              <td>
                <StatusBadge
                  status={item.status}
                />
              </td>
              <td>
                {new Date(
                  item.createdAt
                ).toLocaleString("vi-VN")}
              </td>
              <td>
                {item.status === "EXECUTED" && (
                  <button
                    className="text-button"
                    onClick={() =>
                      void onVerify(
                        item.requestId
                      )
                    }
                  >
                    Xác minh
                  </button>
                )}
              </td>
            </tr>
          ))}

          {requests.length === 0 && (
            <tr>
              <td
                colSpan={7}
                className="empty-table"
              >
                Chưa có dữ liệu.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default App;