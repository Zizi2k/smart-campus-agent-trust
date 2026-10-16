import {
  type FormEvent,
  Fragment,
  useEffect,
  useState,
} from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  Copy,
  Cpu,
  Database,
  Eye,
  EyeOff,
  FileCheck2,
  FileText,
  Key,
  Lock,
  LogOut,
  Monitor,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sun,
  User,
  Wallet,
  XCircle,
} from "lucide-react";

import { AgentForms } from "./AgentForms";
import { api, setAccessToken } from "./api";
import "./App.css";

type Tab =
  | "overview"
  | "agents"
  | "requests"
  | "approvals"
  | "audit";

type ThemeMode = "dark" | "light" | "system";

interface Agent {
  id: string;
  name: string;
  type: string;
  walletAddress: string;
  status: string;
  clientId: string;
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
  payload?: Record<string, unknown> | null;
  result?: Record<string, unknown> | null;
  payloadHash?: string;
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
  blockchain?: {
    execution?: {
      exists: boolean;
      payloadHash: string;
      resultHash: string;
      action: string;
      success: boolean;
      timestamp: string;
      recordedBy: string;
    };
    approval?: {
      exists: boolean;
      payloadHash: string;
      decisionHash: string;
      action: string;
      success: boolean;
      timestamp: string;
      recordedBy: string;
    };
  };
}

const CONTRACT_ADDR = "0x5FbDB2315678afecb367f032d93F642f64180aa3";

const REQUESTS_PER_PAGE = 5;
const AGENTS_PER_PAGE = 5;
const AUDIT_PER_PAGE = 6;

function TablePagination({
  currentPage,
  totalItems,
  pageSize,
  onPageChange,
}: {
  currentPage: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
}) {
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const startItem = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, totalItems);

  if (totalItems <= pageSize) {
    return (
      <div className="table-pagination-bar">
        <span className="pagination-info-text">
          Hiển thị tất cả <strong>{totalItems}</strong> mục
        </span>
      </div>
    );
  }

  return (
    <div className="table-pagination-bar">
      <span className="pagination-info-text">
        Hiển thị <strong>{startItem}–{endItem}</strong> trên <strong>{totalItems}</strong> mục
      </span>
      <div className="pagination-controls">
        <button
          type="button"
          className="pagination-btn"
          disabled={currentPage === 1}
          onClick={() => onPageChange(currentPage - 1)}
          title="Trang trước"
        >
          <ChevronLeft size={14} />
          <span>Trước</span>
        </button>
        <span className="pagination-page-indicator">
          Trang <strong>{currentPage}</strong> / {totalPages}
        </span>
        <button
          type="button"
          className="pagination-btn"
          disabled={currentPage === totalPages}
          onClick={() => onPageChange(currentPage + 1)}
          title="Trang sau"
        >
          <span>Sau</span>
          <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem("sc_token"));
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [authError, setAuthError] = useState("");
  const [authLoading, setAuthLoading] = useState(false);

  const [tab, setTab] = useState<Tab>("overview");
  const [agents, setAgents] = useState<Agent[]>([]);
  const [requests, setRequests] = useState<ActionRequest[]>([]);
  const [pending, setPending] = useState<ActionRequest[]>([]);
  const [auditResults, setAuditResults] = useState<AuditResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [resettingDb, setResettingDb] = useState(false);
  const [error, setError] = useState("");
  const [copiedText, setCopiedText] = useState<string | null>(null);

  // Search & Filter States
  const [agentSearch, setAgentSearch] = useState("");
  const [requestSearch, setRequestSearch] = useState("");
  const [requestFilter, setRequestFilter] = useState("ALL");
  const [expandedRequestId, setExpandedRequestId] = useState<string | null>(null);
  const [expandedAgentId, setExpandedAgentId] = useState<string | null>(null);

  // Pagination States
  const [requestPage, setRequestPage] = useState(1);
  const [agentPage, setAgentPage] = useState(1);
  const [auditPage, setAuditPage] = useState(1);

  // Sidebar Collapse / Expand State (with persistence)
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(() => {
    return localStorage.getItem("sc_sidebar_collapsed") === "true";
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem("sc_sidebar_collapsed", String(next));
      return next;
    });
  };

  // Theme Management (dark, light, system)
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    return (localStorage.getItem("sc_theme") as ThemeMode) || "dark";
  });

  useEffect(() => {
    const root = document.documentElement;
    localStorage.setItem("sc_theme", themeMode);

    if (themeMode === "system") {
      const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      root.setAttribute("data-theme", systemDark ? "dark" : "light");

      const listener = (e: MediaQueryListEvent) => {
        root.setAttribute("data-theme", e.matches ? "dark" : "light");
      };
      const media = window.matchMedia("(prefers-color-scheme: dark)");
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    } else {
      root.setAttribute("data-theme", themeMode);
    }
  }, [themeMode]);

  useEffect(() => {
    if (token) {
      setAccessToken(token);
      void loadDashboard();
    }
  }, [token]);

  function copyText(str: string) {
    void navigator.clipboard.writeText(str);
    setCopiedText(str);
    setTimeout(() => setCopiedText(null), 2000);
  }

  async function handleLogin(e: FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError("");
    try {
      const res = await api.post("/auth/admin", { username, password });
      const newToken = res.data.accessToken as string;
      localStorage.setItem("sc_token", newToken);
      setToken(newToken);
      setAccessToken(newToken);
    } catch (err: unknown) {
      const axiosErr = err as {
        response?: { data?: { message?: string } };
        code?: string;
        message?: string;
      };
      if (!axiosErr.response) {
        setAuthError(
          "Không thể kết nối đến máy chủ Backend (Port 3100). Vui lòng kiểm tra dịch vụ Backend đang chạy."
        );
      } else {
        setAuthError(
          axiosErr.response.data?.message ||
            "Tên đăng nhập hoặc mật khẩu quản trị không chính xác."
        );
      }
    } finally {
      setAuthLoading(false);
    }
  }

  function handleLogout() {
    localStorage.removeItem("sc_token");
    setToken(null);
    setAccessToken(null);
    setUsername("");
    setPassword("");
  }

  async function loadDashboard() {
    setLoading(true);
    setError("");
    try {
      const [agentsRes, requestsRes, pendingRes] = await Promise.all([
        api.get("/agents"),
        api.get("/actions/admin/all"),
        api.get("/approvals/pending"),
      ]);
      setAgents(agentsRes.data.agents ?? []);
      setRequests(requestsRes.data.requests ?? []);
      setPending(pendingRes.data.requests ?? []);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : "Không thể nạp dữ liệu từ máy chủ";
      setError(message || "Lỗi nạp dữ liệu hệ thống");
    } finally {
      setLoading(false);
    }
  }

  async function handleAuditReconciliation() {
    setLoading(true);
    setError("");
    try {
      if (requests.length === 0) {
        setAuditResults([]);
        return;
      }
      const auditPromises = requests.slice(0, 15).map(async (req) => {
        const res = await api.get(`/actions/${req.requestId}/audit`);
        return res.data as AuditResult;
      });
      const settled = await Promise.allSettled(auditPromises);
      const validResults = settled
        .filter((r): r is PromiseFulfilledResult<AuditResult> => r.status === "fulfilled")
        .map((r) => r.value);
      setAuditResults(validResults);
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : "Không thể đối soát dữ liệu trên Blockchain";
      setError(message || "Lỗi kiểm toán on-chain");
    } finally {
      setLoading(false);
    }
  }

  async function handleDecide(requestId: string, approved: boolean) {
    setDecidingId(requestId);
    try {
      await api.post(`/approvals/${requestId}`, {
        decision: approved ? "APPROVED" : "REJECTED",
        reason: approved
          ? "Quản trị viên đã ký duyệt phê duyệt tác vụ"
          : "Từ chối do vi phạm ngưỡng an toàn bảo mật",
      });
      await loadDashboard();
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : "Không thể gửi quyết định phê duyệt";
      setError(message || "Lỗi khi xử lý quyết định");
    } finally {
      setDecidingId(null);
    }
  }

  async function handleResetDatabase() {
    const confirmed = window.confirm(
      "Xác nhận làm sạch toàn bộ dữ liệu kiểm thử (Action Requests, HITL Queue, AI Agents)?\n\nTài khoản Quản trị viên (Admin) sẽ được bảo toàn nguyên vẹn để tiếp tục test."
    );
    if (!confirmed) return;

    setResettingDb(true);
    try {
      await api.post("/actions/admin/reset-database");
      await loadDashboard();
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { message?: string } } }).response?.data?.message
          : "Không thể reset database";
      setError(message || "Lỗi khi làm sạch dữ liệu");
    } finally {
      setResettingDb(false);
    }
  }

  async function handleToggleAgentStatus(agent: Agent) {
    const isCurrentlyActive = agent.status === "ACTIVE";
    const nextStatus = isCurrentlyActive ? "REVOKED" : "ACTIVE";
    try {
      await api.patch(`/agents/${agent.id}/status`, { status: nextStatus });
      await loadDashboard();
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "response" in err
          ? (err as { response?: { data?: { error?: string } } }).response?.data?.error
          : "Không thể cập nhật trạng thái Agent";
      setError(message || "Lỗi khi đổi trạng thái Agent");
    }
  }

  // Filtered lists
  const filteredAgents = agents.filter((ag) => {
    const query = agentSearch.toLowerCase();
    return (
      ag.name.toLowerCase().includes(query) ||
      ag.type.toLowerCase().includes(query) ||
      ag.walletAddress.toLowerCase().includes(query)
    );
  });

  const filteredRequests = requests.filter((req) => {
    const matchesFilter =
      requestFilter === "ALL" ||
      req.status === requestFilter ||
      (requestFilter === "PENDING_APPROVAL" && req.status === "PENDING");
    const query = requestSearch.toLowerCase();
    const matchesQuery =
      req.requestId.toLowerCase().includes(query) ||
      req.service.toLowerCase().includes(query) ||
      req.action.toLowerCase().includes(query) ||
      (req.agent?.name.toLowerCase().includes(query) ?? false);
    return matchesFilter && matchesQuery;
  });

  useEffect(() => {
    setRequestPage(1);
  }, [requestFilter, requestSearch]);

  useEffect(() => {
    setAgentPage(1);
  }, [agentSearch]);

  const paginatedAgents = filteredAgents.slice(
    (agentPage - 1) * AGENTS_PER_PAGE,
    agentPage * AGENTS_PER_PAGE
  );

  const paginatedRequests = filteredRequests.slice(
    (requestPage - 1) * REQUESTS_PER_PAGE,
    requestPage * REQUESTS_PER_PAGE
  );

  const paginatedAuditResults = auditResults.slice(
    (auditPage - 1) * AUDIT_PER_PAGE,
    auditPage * AUDIT_PER_PAGE
  );

  const activeAgentsCount = agents.filter((a) => a.status === "ACTIVE").length;
  const executedCount = requests.filter((r) => r.status === "APPROVED" || r.status === "AUTO_APPROVED").length;
  const countPending = requests.filter((r) => r.status === "PENDING" || r.status === "PENDING_APPROVAL").length;
  const countAuto = requests.filter((r) => r.status === "AUTO_APPROVED").length;
  const countApproved = requests.filter((r) => r.status === "APPROVED").length;
  const countRejected = requests.filter((r) => r.status === "REJECTED").length;

  // ============================================================================
  // RENDER: LOGIN VIEW
  // ============================================================================
  if (!token) {
    return (
      <div className="login-view-wrapper">
        {/* Theme Switcher on Login Screen */}
        <div style={{ position: "fixed", top: 20, right: 24, zIndex: 100 }}>
          <div className="theme-segmented-switch">
            <button
              type="button"
              className={`theme-opt-btn ${themeMode === "light" ? "active" : ""}`}
              onClick={() => setThemeMode("light")}
              title="Chế độ Sáng"
            >
              <Sun size={15} />
            </button>
            <button
              type="button"
              className={`theme-opt-btn ${themeMode === "dark" ? "active" : ""}`}
              onClick={() => setThemeMode("dark")}
              title="Chế độ Tối"
            >
              <Moon size={15} />
            </button>
            <button
              type="button"
              className={`theme-opt-btn ${themeMode === "system" ? "active" : ""}`}
              onClick={() => setThemeMode("system")}
              title="Theo Hệ Thống"
            >
              <Monitor size={15} />
            </button>
          </div>
        </div>

        <div className="login-panel">
          <div className="login-brand-header">
            <div className="login-icon-badge">
              <ShieldCheck size={28} />
            </div>
            <h1 className="login-panel-title">Smart Campus Trust</h1>
          </div>

          {authError && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "10px 14px",
              borderRadius: "var(--radius-md)",
              background: "var(--status-danger-bg)",
              border: "1px solid var(--status-danger-border)",
              color: "var(--status-danger-text)",
              fontSize: "0.82rem",
              fontWeight: 600,
              marginBottom: 18,
            }}>
              <AlertCircle size={16} />
              <span>{authError}</span>
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div className="form-field-block">
              <label className="field-label-text">
                <User size={14} />
                <span>Tài khoản</span>
              </label>
              <div className="input-icon-wrapper">
                <span className="input-prefix-icon"><User size={16} /></span>
                <input
                  type="text"
                  className="text-input input-with-icon"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="admin"
                  required
                />
              </div>
            </div>

            <div className="form-field-block">
              <label className="field-label-text">
                <Lock size={14} />
                <span>Mật khẩu</span>
              </label>
              <div className="input-icon-wrapper">
                <span className="input-prefix-icon"><Lock size={16} /></span>
                <input
                  type={showPassword ? "text" : "password"}
                  className="text-input input-with-icon"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  required
                />
                <button
                  type="button"
                  className="input-suffix-btn"
                  onClick={() => setShowPassword(!showPassword)}
                  title={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              className="btn-primary-action"
              style={{ marginTop: 12, fontWeight: 700, letterSpacing: "0.04em" }}
              disabled={authLoading}
            >
              {authLoading ? "Đang đăng nhập..." : "ĐĂNG NHẬP"}
            </button>
          </form>

          <div
            className="login-credentials-hint"
            style={{ cursor: "pointer", transition: "all var(--transition-fast)" }}
            onClick={() => {
              setUsername("admin");
              setPassword("campuspassword123");
            }}
            title="Nhấp để điền nhanh"
          >
            <Key size={15} color="var(--color-brand)" style={{ flexShrink: 0, marginTop: 2 }} />
            <div>
              <span>Mặc định: <code>admin</code> / <code>campuspassword123</code></span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // RENDER: MAIN APPLICATION WORKSPACE
  // ============================================================================
  return (
    <div className="app-layout">
      {/* 1. TOP NAVIGATION BAR */}
      <header className="top-nav-bar">
        <div className="nav-left-cluster">
          <div className="nav-brand-title">
            <div className="brand-logo-mark">
              <ShieldCheck size={20} />
            </div>
            <div className="brand-text-block">
              <h2>Smart Campus Trust</h2>
            </div>
          </div>

          <div className="network-status-beacon">
            <span className="status-pulse-dot" />
            <span>Hardhat</span>
            <span style={{ color: "var(--text-muted)" }}>•</span>
            <span className="font-mono" style={{ fontSize: "0.72rem" }}>Chain 31337</span>
          </div>
        </div>

        <div className="nav-right-cluster">
          <button
            type="button"
            className="btn-contract-address"
            onClick={() => copyText(CONTRACT_ADDR)}
            title="Nhấp để sao chép địa chỉ Smart Contract"
          >
            <Database size={13} color="var(--color-brand)" />
            <span>Contract: {CONTRACT_ADDR.slice(0, 6)}...{CONTRACT_ADDR.slice(-4)}</span>
            {copiedText === CONTRACT_ADDR ? (
              <Check size={13} color="#10b981" />
            ) : (
              <Copy size={13} />
            )}
          </button>

          {/* Theme Switcher Segmented */}
          <div className="theme-segmented-switch">
            <button
              type="button"
              className={`theme-opt-btn ${themeMode === "light" ? "active" : ""}`}
              onClick={() => setThemeMode("light")}
              title="Chế độ Sáng"
            >
              <Sun size={15} />
            </button>
            <button
              type="button"
              className={`theme-opt-btn ${themeMode === "dark" ? "active" : ""}`}
              onClick={() => setThemeMode("dark")}
              title="Chế độ Tối"
            >
              <Moon size={15} />
            </button>
            <button
              type="button"
              className={`theme-opt-btn ${themeMode === "system" ? "active" : ""}`}
              onClick={() => setThemeMode("system")}
              title="Theo Hệ Thống"
            >
              <Monitor size={15} />
            </button>
          </div>

          {/* User Profile */}
          <div className="user-profile-badge">
            <div className="user-avatar-circle">AD</div>
            <span>admin</span>
            <button
              type="button"
              className="btn-signout"
              onClick={handleLogout}
              title="Đăng xuất khỏi hệ thống"
            >
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </header>

      {/* 2. WORKSPACE CONTAINER */}
      <div className="workspace-container">
        {/* SIDEBAR NAVIGATION */}
        <aside className={`workspace-sidebar ${isSidebarCollapsed ? "is-collapsed" : ""}`}>
          <div className="sidebar-top-group">
            <div className="sidebar-section-header">
              <span className="sidebar-section-title">ĐIỀU HÀNH HỆ THỐNG</span>
            </div>

            <div className="sidebar-nav-list">
              {[
                { id: "overview", label: "Tổng quan", icon: Activity },
                { id: "agents", label: "AI Agents", icon: Bot },
                { id: "requests", label: "Action Logs", icon: FileText },
                { id: "approvals", label: "Phê duyệt HITL", icon: ShieldAlert, count: pending.length },
                { id: "audit", label: "Audit On-Chain", icon: Database },
              ].map((item) => {
                const IconComp = item.icon;
                const isActive = tab === item.id;
                return (
                  <button
                    key={item.id}
                    className={`sidebar-nav-btn ${isActive ? "active" : ""}`}
                    onClick={() => setTab(item.id as Tab)}
                    title={isSidebarCollapsed ? item.label : undefined}
                  >
                    <div className="sidebar-nav-btn-content">
                      <div className="sidebar-icon-wrap">
                        <IconComp size={17} />
                        {item.count !== undefined && item.count > 0 && isSidebarCollapsed && (
                          <span className="sidebar-mini-alert-dot" />
                        )}
                      </div>
                      <span className="sidebar-label-text">{item.label}</span>
                    </div>
                    {item.count !== undefined && item.count > 0 && (
                      <span className="sidebar-badge-count">{item.count}</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="sidebar-bottom-group">
            {/* System Node Micro Card */}
            <div className="sidebar-node-status-card" title="Mạng Hardhat cục bộ đang kết nối">
              <span className="status-pulse-dot" />
              <div className="sidebar-node-text-col">
                <span className="sidebar-node-title">Hardhat Node</span>
                <span className="sidebar-node-sub font-mono">Chain 31337</span>
              </div>
            </div>

            {/* Collapse / Expand Toggle Button */}
            <button
              type="button"
              className="sidebar-collapse-toggle-btn"
              onClick={toggleSidebar}
              title={isSidebarCollapsed ? "Mở rộng sidebar" : "Thu gọn sidebar (Click để khóa, hover để mở tạm)"}
            >
              <div className="sidebar-collapse-icon-wrap">
                {isSidebarCollapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
              </div>
              <span className="sidebar-label-text">
                {isSidebarCollapsed ? "Mở rộng" : "Thu gọn sidebar"}
              </span>
            </button>
          </div>
        </aside>

        {/* MAIN VIEWPORT */}
        <main className="workspace-main-panel">
          <div className="view-header-row">
            <div className="view-header-left">
              <h1 className="view-heading">
                {tab === "overview" && "Dashboard Tổng Quan"}
                {tab === "agents" && "Quản lý AI Agents"}
                {tab === "requests" && "Action Logs"}
                {tab === "approvals" && "Phê duyệt HITL"}
                {tab === "audit" && "Audit On-Chain"}
              </h1>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <button
                type="button"
                className="btn-reset-db"
                onClick={() => void handleResetDatabase()}
                disabled={loading || resettingDb}
                title="Làm sạch toàn bộ dữ liệu kiểm thử (Requests, Approvals, Agents), bảo toàn tài khoản Admin"
              >
                <RotateCcw size={13} className={resettingDb ? "animate-spin" : ""} />
                <span>{resettingDb ? "Đang reset..." : "Reset Dữ Liệu Test"}</span>
              </button>

              <button
                className="btn-secondary-action"
                onClick={() => void loadDashboard()}
                disabled={loading || resettingDb}
              >
                <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
                <span>{loading ? "Đang tải..." : "Làm mới"}</span>
              </button>
            </div>
          </div>

          {error && (
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              padding: "12px 18px",
              borderRadius: "var(--radius-md)",
              background: "var(--status-danger-bg)",
              border: "1px solid var(--status-danger-border)",
              color: "var(--status-danger-text)",
              marginBottom: 20,
              fontSize: "0.85rem",
              fontWeight: 600,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
              <button
                type="button"
                className="btn-row-action btn-row-danger"
                onClick={() => setError("")}
              >
                Đóng
              </button>
            </div>
          )}

          {/* ================================================================== */}
          {/* TAB 1: OVERVIEW */}
          {/* ================================================================== */}
          {tab === "overview" && (
            <>
              {/* Executive Metrics Quad Grid */}
              <div className="metrics-quad-grid">
                <div className="metric-tile-card metric-card-blue">
                  <div className="metric-card-header">
                    <div className="metric-icon-box" style={{ background: "var(--color-brand-bg)", color: "var(--color-brand)" }}>
                      <Bot size={20} />
                    </div>
                    <span className="metric-tag-indicator" style={{ background: "var(--color-brand-bg)", color: "var(--color-brand)" }}>
                      ON-CHAIN
                    </span>
                  </div>
                  <div>
                    <span className="metric-tile-title">Active Agents</span>
                    <div className="metric-tile-number">{activeAgentsCount}</div>
                    <div className="metric-tile-footer">Tổng số {agents.length} Agent đã đăng ký</div>
                  </div>
                </div>

                <div className="metric-tile-card metric-card-amber">
                  <div className="metric-card-header">
                    <div className="metric-icon-box" style={{ background: "var(--status-pending-bg)", color: "var(--status-pending-text)" }}>
                      <Clock size={20} />
                    </div>
                    <span className="metric-tag-indicator" style={{ background: "var(--status-pending-bg)", color: "var(--status-pending-text)" }}>
                      PENDING HITL
                    </span>
                  </div>
                  <div>
                    <span className="metric-tile-title">Chờ phê duyệt</span>
                    <div className="metric-tile-number" style={{ color: pending.length > 0 ? "var(--status-pending-text)" : undefined }}>
                      {pending.length}
                    </div>
                    <div className="metric-tile-footer">
                      {pending.length > 0 ? "Yêu cầu HITL cần review" : "Hàng đợi an toàn"}
                    </div>
                  </div>
                </div>

                <div className="metric-tile-card metric-card-green">
                  <div className="metric-card-header">
                    <div className="metric-icon-box" style={{ background: "var(--status-active-bg)", color: "var(--status-active-text)" }}>
                      <CheckCircle2 size={20} />
                    </div>
                    <span className="metric-tag-indicator" style={{ background: "var(--status-active-bg)", color: "var(--status-active-text)" }}>
                      EXECUTED
                    </span>
                  </div>
                  <div>
                    <span className="metric-tile-title">Đã thực thi</span>
                    <div className="metric-tile-number">{executedCount}</div>
                    <div className="metric-tile-footer">Tác vụ bảo đảm an toàn</div>
                  </div>
                </div>

                <div className="metric-tile-card metric-card-purple">
                  <div className="metric-card-header">
                    <div className="metric-icon-box" style={{ background: "var(--status-crypto-bg)", color: "var(--status-crypto-text)" }}>
                      <FileCheck2 size={20} />
                    </div>
                    <span className="metric-tag-indicator" style={{ background: "var(--status-crypto-bg)", color: "var(--status-crypto-text)" }}>
                      BLOCKCHAIN
                    </span>
                  </div>
                  <div>
                    <span className="metric-tile-title">Audit Logs On-Chain</span>
                    <div className="metric-tile-number">{requests.length}</div>
                    <div className="metric-tile-footer">Đã lưu trên Smart Contract</div>
                  </div>
                </div>
              </div>

              {/* 2-Column Overview Split Layout */}
              <div className="overview-layout-split">
                {/* Left Column: Recent Activity Feed */}
                <div className="content-box" style={{ marginBottom: 0 }}>
                  <div className="content-box-header">
                    <h3 className="content-box-title">
                      <Activity size={18} color="var(--color-brand)" />
                      <span>Action Logs gần đây</span>
                    </h3>
                    <button
                      type="button"
                      className="btn-secondary-action"
                      onClick={() => setTab("requests")}
                    >
                      <span>Xem tất cả ({requests.length})</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>

                  <div className="table-scroll-container">
                    <table className="enterprise-data-table">
                      <thead>
                        <tr>
                          <th>Request ID</th>
                          <th>AI Agent</th>
                          <th>Service & Action</th>
                          <th>Status</th>
                          <th>Timestamp</th>
                        </tr>
                      </thead>
                      <tbody>
                        {requests.slice(0, 6).map((req, idx) => (
                          <tr key={req.id} className={idx % 2 === 1 ? "row-tinted" : "row-plain"}>
                            <td className="font-mono" style={{ fontSize: "0.78rem", fontWeight: 600 }}>
                              {req.requestId.slice(0, 8)}...
                            </td>
                            <td style={{ fontWeight: 600 }}>
                              {req.agent?.name ?? "Agent Không Rõ"}
                            </td>
                            <td>
                              <span style={{ fontWeight: 600 }}>{req.service}</span>
                              <span style={{ color: "var(--text-muted)", margin: "0 6px" }}>/</span>
                              <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.76rem" }}>{req.action}</code>
                            </td>
                            <td>
                              <span className={`status-pill-badge ${
                                req.status === "APPROVED" || req.status === "AUTO_APPROVED"
                                  ? "pill-approved"
                                  : req.status === "PENDING" || req.status === "PENDING_APPROVAL"
                                  ? "pill-pending"
                                  : "pill-danger"
                              }`}>
                                {req.status === "AUTO_APPROVED" && <CheckCircle2 size={12} />}
                                {req.status === "APPROVED" && <Check size={12} />}
                                {(req.status === "PENDING" || req.status === "PENDING_APPROVAL") && <Clock size={12} />}
                                {req.status === "REJECTED" && <XCircle size={12} />}
                                <span>{req.status}</span>
                              </span>
                            </td>
                            <td style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
                              {new Date(req.createdAt).toLocaleTimeString("vi-VN", { hour: "2-digit", minute: "2-digit" })} • {new Date(req.createdAt).toLocaleDateString("vi-VN")}
                            </td>
                          </tr>
                        ))}
                        {requests.length === 0 && (
                          <tr>
                            <td colSpan={5}>
                              <div className="empty-state-card" style={{ padding: "40px 16px" }}>
                                <div className="empty-state-icon"><FileText size={22} /></div>
                                <div className="empty-state-title">Chưa có Action Logs nào</div>
                                <div className="empty-state-caption">
                                  Khi AI Agent gửi request truy cập tài nguyên trường học, logs và hash chứng thực sẽ hiển thị tại đây.
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="content-box-footer">
                    <span className="footer-meta-text">
                      {requests.length > 0
                        ? `Đang hiển thị ${Math.min(requests.length, 6)} trên tổng số ${requests.length} logs gần nhất`
                        : "Trạng thái: Chưa có transactions từ AI Agent"}
                    </span>
                    <span className="footer-crypto-badge">
                      <CheckCircle2 size={12} color="#10b981" />
                      <span>Verified On-Chain Hash</span>
                    </span>
                  </div>
                </div>

                {/* Right Column: Node Infrastructure & Quick Jump Links */}
                <div className="system-status-card">
                  <div className="system-status-header">
                    <Cpu size={16} color="var(--color-brand)" />
                    <span>Hạ tầng Blockchain & Node</span>
                    <span className="status-pulse-dot" style={{ marginLeft: "auto" }} title="Nút mạng hoạt động"></span>
                  </div>

                  <div className="system-stat-row">
                    <span className="system-stat-label">
                      <Database size={14} /> Blockchain Network
                    </span>
                    <span className="system-stat-value font-mono" style={{ fontSize: "0.78rem" }}>
                      Hardhat (Chain ID 31337)
                    </span>
                  </div>

                  <div className="system-stat-row">
                    <span className="system-stat-label">
                      <ShieldCheck size={14} /> Smart Contract
                    </span>
                    <button
                      type="button"
                      className="btn-contract-address"
                      onClick={() => copyText(CONTRACT_ADDR)}
                      title="Sao chép địa chỉ Smart Contract"
                    >
                      <span>{CONTRACT_ADDR.slice(0, 6)}...{CONTRACT_ADDR.slice(-4)}</span>
                      {copiedText === CONTRACT_ADDR ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                    </button>
                  </div>

                  <div className="system-stat-row">
                    <span className="system-stat-label">
                      <Bot size={14} /> Database Lưu Trữ
                    </span>
                    <span className="system-stat-value" style={{ color: "var(--status-active-text)" }}>
                      PostgreSQL (Ready)
                    </span>
                  </div>

                  <div className="system-stat-row">
                    <span className="system-stat-label">
                      <Lock size={14} /> Access Control
                    </span>
                    <span className="system-stat-value">
                      ABAC & Quota Limits
                    </span>
                  </div>

                  <div style={{ marginTop: 18, paddingTop: 14, borderTop: "1px solid var(--border-subtle)" }}>
                    <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 10 }}>
                      Lối tắt quản trị
                    </div>

                    <div className="quick-nav-list">
                      <div className="quick-nav-card" onClick={() => setTab("approvals")}>
                        <div className="quick-nav-card-left">
                          <ShieldAlert size={16} color={pending.length > 0 ? "var(--status-pending-text)" : "var(--color-brand)"} />
                          <span>Hàng đợi phê duyệt HITL</span>
                        </div>
                        <span className="sidebar-badge-count" style={{ background: pending.length > 0 ? "var(--status-pending-bg)" : undefined, color: pending.length > 0 ? "var(--status-pending-text)" : undefined }}>
                          {pending.length}
                        </span>
                      </div>

                      <div className="quick-nav-card" onClick={() => setTab("agents")}>
                        <div className="quick-nav-card-left">
                          <Bot size={16} color="var(--color-brand)" />
                          <span>Quản lý AI Agents</span>
                        </div>
                        <ChevronRight size={14} color="var(--text-muted)" />
                      </div>

                      <div className="quick-nav-card" onClick={() => setTab("audit")}>
                        <div className="quick-nav-card-left">
                          <Database size={16} color="var(--status-crypto-text)" />
                          <span>Audit On-Chain</span>
                        </div>
                        <ChevronRight size={14} color="var(--text-muted)" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}

          {/* ================================================================== */}
          {/* TAB 2: AGENTS DIRECTORY */}
          {/* ================================================================== */}
          {tab === "agents" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="content-box">
                <div className="content-box-header">
                  <h3 className="content-box-title">
                    <Bot size={18} color="var(--color-brand)" />
                    <span>Danh bạ AI Agent</span>
                    <span className="pill-count-subtle">{filteredAgents.length}</span>
                  </h3>

                  <div className="table-toolbar-cluster">
                    <div className="search-input-box">
                      <Search size={15} color="var(--text-muted)" />
                      <input
                        type="text"
                        placeholder="Tìm theo tên, loại, ví..."
                        value={agentSearch}
                        onChange={(e) => setAgentSearch(e.target.value)}
                      />
                    </div>
                  </div>
                </div>

                <div className="table-scroll-container">
                  <table className="enterprise-data-table">
                    <thead>
                      <tr>
                        <th style={{ width: 40 }}></th>
                        <th>AI Agent</th>
                        <th>Phân Loại</th>
                        <th>Ví EVM (On-Chain)</th>
                        <th>Chính Sách & Quota</th>
                        <th>Status</th>
                        <th style={{ textAlign: "right" }}>Thao Tác</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedAgents.map((ag, idx) => {
                        const isExpanded = expandedAgentId === ag.id;
                        return (
                          <Fragment key={ag.id}>
                            <tr
                              className={`data-row-clickable ${idx % 2 === 1 ? "row-tinted" : "row-plain"} ${isExpanded ? "row-expanded" : ""}`}
                              onClick={() => setExpandedAgentId(isExpanded ? null : ag.id)}
                            >
                              <td style={{ color: "var(--text-muted)", textAlign: "center" }}>
                                {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                              </td>
                              <td>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                  <div className="agent-initials-badge">
                                    {ag.name.slice(0, 2).toUpperCase()}
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{ag.name}</div>
                                    <span className="font-mono" style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                      ID: {ag.id.slice(0, 8)}...
                                    </span>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <span className="status-pill-badge pill-info">
                                  {ag.type}
                                </span>
                              </td>
                              <td>
                                {ag.walletAddress ? (
                                  <button
                                    type="button"
                                    className="btn-contract-address"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      copyText(ag.walletAddress);
                                    }}
                                    title="Sao chép địa chỉ ví EVM"
                                  >
                                    <Wallet size={12} color="var(--color-brand)" />
                                    <span>{ag.walletAddress.slice(0, 6)}...{ag.walletAddress.slice(-4)}</span>
                                    {copiedText === ag.walletAddress ? <Check size={12} color="#10b981" /> : <Copy size={12} />}
                                  </button>
                                ) : (
                                  <span style={{ color: "var(--text-muted)", fontSize: "0.76rem" }}>Chưa liên kết</span>
                                )}
                              </td>
                              <td>
                                <span style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 6,
                                  fontSize: "0.78rem",
                                  fontWeight: 600,
                                  color: "var(--color-brand)",
                                  background: "var(--color-brand-bg)",
                                  padding: "3px 8px",
                                  borderRadius: "var(--radius-xs)",
                                  border: "1px solid var(--color-brand-border)",
                                }}>
                                  <Sliders size={12} />
                                  <span>{ag.permissions?.length ?? 0} quyền</span>
                                  <span style={{ fontSize: "0.7rem", opacity: 0.8 }}>({isExpanded ? "Đóng" : "Chi tiết"})</span>
                                </span>
                              </td>
                              <td>
                                <span className={`status-pill-badge ${ag.status === "ACTIVE" ? "pill-active" : "pill-danger"}`}>
                                  {ag.status === "ACTIVE" ? <ShieldCheck size={12} /> : <Lock size={12} />}
                                  <span>{ag.status === "ACTIVE" ? "ACTIVE" : "REVOKED"}</span>
                                </span>
                              </td>
                              <td style={{ textAlign: "right" }}>
                                <button
                                  type="button"
                                  className={`btn-row-action ${ag.status === "ACTIVE" ? "btn-row-danger" : "btn-row-success"}`}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    void handleToggleAgentStatus(ag);
                                  }}
                                >
                                  {ag.status === "ACTIVE" ? (
                                    <>
                                      <Lock size={13} />
                                      <span>Vô hiệu hóa</span>
                                    </>
                                  ) : (
                                    <>
                                      <ShieldCheck size={13} />
                                      <span>Kích hoạt lại</span>
                                    </>
                                  )}
                                </button>
                              </td>
                            </tr>

                            {isExpanded && (
                              <tr key={`${ag.id}-permissions`} className="request-expanded-row">
                                <td colSpan={7}>
                                  <div style={{
                                    padding: "16px 20px",
                                    background: "var(--bg-surface-elevated)",
                                    borderTop: "1px solid var(--border-subtle)",
                                  }}>
                                    <div style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      marginBottom: 12,
                                    }}>
                                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: "0.82rem", fontWeight: 700 }}>
                                        <Sliders size={15} color="var(--color-brand)" />
                                        <span>Chính Sách & Hạn Mức Đã Gán (ABAC Policies on Blockchain & DB):</span>
                                      </div>
                                      <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                                        Agent: <strong>{ag.name}</strong> ({ag.permissions?.length ?? 0} chính sách)
                                      </span>
                                    </div>

                                    {(!ag.permissions || ag.permissions.length === 0) ? (
                                      <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontStyle: "italic", padding: "8px 0" }}>
                                        Agent này chưa được gán chính sách nào. Vui lòng dùng form "Thiết lập quyền" bên dưới để gán quyền.
                                      </div>
                                    ) : (
                                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
                                        {ag.permissions.map((p) => (
                                          <div key={p.id} style={{
                                            background: "var(--bg-surface)",
                                            border: "1px solid var(--border-subtle)",
                                            borderRadius: "var(--radius-md)",
                                            padding: "12px 14px",
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 8,
                                          }}>
                                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                              <span style={{ fontWeight: 700, fontSize: "0.84rem", color: "var(--color-brand)" }}>
                                                {p.service} / <code>{p.action}</code>
                                              </span>
                                              <span className={`status-pill-badge ${
                                                p.riskLevel === "HIGH" ? "pill-danger" : p.riskLevel === "MEDIUM" ? "pill-pending" : "pill-approved"
                                              }`}>
                                                {p.riskLevel}
                                              </span>
                                            </div>
                                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.76rem", color: "var(--text-secondary)" }}>
                                              <span>Hạn mức ngày (Quota):</span>
                                              <strong style={{ color: "var(--text-primary)" }}>{p.dailyLimit} lượt/ngày</strong>
                                            </div>
                                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.76rem", color: "var(--text-secondary)" }}>
                                              <span>Cơ chế phê duyệt:</span>
                                              <span>{p.riskLevel === "LOW" ? "Tự động duyệt (Auto)" : "Cần HITL ký duyệt"}</span>
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            )}
                          </Fragment>
                        );
                      })}
                      {filteredAgents.length === 0 && (
                        <tr>
                          <td colSpan={7}>
                            <div className="empty-state-card">
                              <div className="empty-state-icon"><Bot size={24} /></div>
                              <div className="empty-state-title">Không tìm thấy Agent nào</div>
                              <div className="empty-state-caption">Hãy đăng ký một AI Agent mới ở mẫu phía dưới.</div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <TablePagination
                  currentPage={agentPage}
                  totalItems={filteredAgents.length}
                  pageSize={AGENTS_PER_PAGE}
                  onPageChange={setAgentPage}
                />
              </div>

              {/* Sub-Forms for Agent Registration and Policies */}
              <AgentForms agents={agents} onChanged={loadDashboard} />
            </div>
          )}

          {/* ================================================================== */}
          {/* TAB 3: REQUESTS LEDGER */}
          {/* ================================================================== */}
          {tab === "requests" && (
            <div className="content-box">
              <div className="content-box-header">
                <h3 className="content-box-title">
                  <FileText size={18} color="var(--color-brand)" />
                  <span>Action Logs</span>
                </h3>

                <div className="table-toolbar-cluster">
                  <div className="search-input-box">
                    <Search size={15} color="var(--text-muted)" />
                    <input
                      type="text"
                      placeholder="Tìm ID, service, agent..."
                      value={requestSearch}
                      onChange={(e) => setRequestSearch(e.target.value)}
                    />
                  </div>

                  {/* Segmented Filter Pills */}
                  <div className="filter-pill-cluster">
                    <button
                      type="button"
                      className={`filter-pill-btn ${requestFilter === "ALL" ? "active" : ""}`}
                      onClick={() => setRequestFilter("ALL")}
                    >
                      Tất cả <span className="pill-count-subtle">{requests.length}</span>
                    </button>
                    <button
                      type="button"
                      className={`filter-pill-btn ${requestFilter === "PENDING_APPROVAL" ? "active" : ""}`}
                      onClick={() => setRequestFilter("PENDING_APPROVAL")}
                    >
                      Pending HITL <span className="pill-count-subtle">{countPending}</span>
                    </button>
                    <button
                      type="button"
                      className={`filter-pill-btn ${requestFilter === "AUTO_APPROVED" ? "active" : ""}`}
                      onClick={() => setRequestFilter("AUTO_APPROVED")}
                    >
                      Auto Approved <span className="pill-count-subtle">{countAuto}</span>
                    </button>
                    <button
                      type="button"
                      className={`filter-pill-btn ${requestFilter === "APPROVED" ? "active" : ""}`}
                      onClick={() => setRequestFilter("APPROVED")}
                    >
                      Approved <span className="pill-count-subtle">{countApproved}</span>
                    </button>
                    <button
                      type="button"
                      className={`filter-pill-btn ${requestFilter === "REJECTED" ? "active" : ""}`}
                      onClick={() => setRequestFilter("REJECTED")}
                    >
                      Rejected <span className="pill-count-subtle">{countRejected}</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="table-scroll-container">
                <table className="enterprise-data-table">
                  <thead>
                    <tr>
                      <th style={{ width: 40 }}></th>
                      <th>Request ID</th>
                      <th>AI Agent</th>
                      <th>Service & Action</th>
                      <th>Keccak-256 Hash</th>
                      <th>Status</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedRequests.map((req, idx) => {
                      const isExpanded = expandedRequestId === req.id;
                      return (
                        <Fragment key={req.id}>
                          <tr
                            className={`data-row-clickable ${idx % 2 === 1 ? "row-tinted" : "row-plain"} ${isExpanded ? "row-expanded" : ""}`}
                            onClick={() => setExpandedRequestId(isExpanded ? null : req.id)}
                          >
                            <td style={{ color: "var(--text-muted)", textAlign: "center" }}>
                              {isExpanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                            </td>
                            <td className="font-mono" style={{ fontSize: "0.78rem", fontWeight: 600 }}>
                              {req.requestId.slice(0, 10)}...
                            </td>
                            <td style={{ fontWeight: 600 }}>
                              {req.agent?.name ?? "Chưa rõ"}
                            </td>
                            <td>
                              <span style={{ fontWeight: 700 }}>{req.service}</span>
                              <span style={{ color: "var(--text-muted)", margin: "0 6px" }}>/</span>
                              <code style={{ fontFamily: "var(--font-mono)", fontSize: "0.76rem" }}>{req.action}</code>
                            </td>
                            <td className="font-mono" style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                              {req.payloadHash ? `${req.payloadHash.slice(0, 10)}...` : "—"}
                            </td>
                            <td>
                              <span className={`status-pill-badge ${
                                req.status === "APPROVED" || req.status === "AUTO_APPROVED"
                                  ? "pill-approved"
                                  : req.status === "PENDING" || req.status === "PENDING_APPROVAL"
                                  ? "pill-pending"
                                  : "pill-danger"
                              }`}>
                                {req.status === "AUTO_APPROVED" && <CheckCircle2 size={12} />}
                                {req.status === "APPROVED" && <Check size={12} />}
                                {(req.status === "PENDING" || req.status === "PENDING_APPROVAL") && <Clock size={12} />}
                                {req.status === "REJECTED" && <XCircle size={12} />}
                                <span>{req.status}</span>
                              </span>
                            </td>
                            <td style={{ color: "var(--text-muted)", fontSize: "0.78rem" }}>
                              {new Date(req.createdAt).toLocaleString("vi-VN")}
                            </td>
                          </tr>

                          {isExpanded && (
                            <tr key={`${req.id}-drawer`} className="request-expanded-row">
                              <td colSpan={7}>
                                <div className="request-expanded-drawer">
                                  <div className="drawer-grid">
                                    <div className="drawer-col">
                                      <div className="drawer-sublabel">Chi tiết Payload (JSON):</div>
                                      <pre className="drawer-payload-code">
                                        {req.payload ? JSON.stringify(req.payload, null, 2) : "// Không có tham số bổ sung"}
                                      </pre>
                                    </div>

                                    <div className="drawer-col">
                                      <div className="drawer-sublabel">Thông tin Hash & Blockchain:</div>
                                      <div className="drawer-meta-list">
                                        <div className="drawer-meta-item">
                                          <span className="drawer-meta-key">Hash Keccak-256 toàn vẹn:</span>
                                          <span className="drawer-meta-val font-mono" style={{ fontSize: "0.72rem" }}>
                                            {req.payloadHash || "Chưa tạo hash"}
                                            {req.payloadHash && (
                                              <button
                                                type="button"
                                                className="btn-mini-copy"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  if (req.payloadHash) copyText(req.payloadHash);
                                                }}
                                                title="Sao chép hash"
                                              >
                                                {copiedText === req.payloadHash ? <Check size={11} color="#10b981" /> : <Copy size={11} />}
                                              </button>
                                            )}
                                          </span>
                                        </div>

                                        <div className="drawer-meta-item">
                                          <span className="drawer-meta-key">Mã định danh tác vụ (Request ID):</span>
                                          <span className="drawer-meta-val font-mono" style={{ fontSize: "0.74rem" }}>
                                            {req.requestId}
                                          </span>
                                        </div>

                                        <div className="drawer-meta-item">
                                          <span className="drawer-meta-key">Thời gian tiếp nhận:</span>
                                          <span className="drawer-meta-val" style={{ fontSize: "0.76rem" }}>
                                            {new Date(req.createdAt).toLocaleString("vi-VN")}
                                          </span>
                                        </div>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      );
                    })}

                    {filteredRequests.length === 0 && (
                      <tr>
                        <td colSpan={7}>
                          <div className="empty-state-card">
                            <div className="empty-state-icon"><FileText size={24} /></div>
                            <div className="empty-state-title">Không tìm thấy Action Logs nào</div>
                            <div className="empty-state-caption">Thử thay đổi bộ lọc trạng thái hoặc từ khóa tìm kiếm.</div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <TablePagination
                currentPage={requestPage}
                totalItems={filteredRequests.length}
                pageSize={REQUESTS_PER_PAGE}
                onPageChange={setRequestPage}
              />
            </div>
          )}

          {/* ================================================================== */}
          {/* TAB 4: HITL APPROVALS QUEUE */}
          {/* ================================================================== */}
          {tab === "approvals" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              {pending.length === 0 ? (
                <div className="content-box">
                  <div className="empty-state-card" style={{ padding: "48px 24px" }}>
                    <div className="empty-state-icon" style={{ background: "var(--status-active-bg)", color: "var(--status-active-text)" }}>
                      <ShieldCheck size={28} />
                    </div>
                    <div className="empty-state-title" style={{ fontSize: "1.1rem" }}>
                      Hàng Đợi Phê Duyệt An Toàn
                    </div>
                    <div className="empty-state-caption" style={{ maxWidth: 420 }}>
                      Hiện tại không có action nào vượt quota hoặc policy rủi ro. Mọi request trước đó đã được xử lý thỏa đáng.
                    </div>
                  </div>
                </div>
              ) : (
                <div className="hitl-queue-grid">
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 16px",
                    background: "var(--status-pending-bg)",
                    border: "1px solid var(--status-pending-border)",
                    borderRadius: "var(--radius-md)",
                    color: "var(--status-pending-text)",
                    fontSize: "0.86rem",
                    fontWeight: 700,
                  }}>
                    <AlertTriangle size={17} />
                    <span>Có {pending.length} request cần xem xét và phê duyệt (HITL):</span>
                  </div>

                  {pending.map((req) => (
                    <div key={req.id} className="hitl-request-card">
                      <div className="hitl-card-top">
                        <div className="hitl-agent-info">
                          <div className="hitl-agent-avatar">
                            <Bot size={22} />
                          </div>
                          <div>
                            <div className="hitl-agent-name">{req.agent?.name ?? "AI Agent"}</div>
                            <div className="hitl-agent-meta">
                              Request ID: {req.requestId} • {new Date(req.createdAt).toLocaleString("vi-VN")}
                            </div>
                          </div>
                        </div>

                        <span className="status-pill-badge pill-pending">
                          <AlertTriangle size={12} />
                          HITL REVIEW (RỦI RO CAO)
                        </span>
                      </div>

                      <div style={{ marginBottom: 12, fontSize: "0.86rem" }}>
                        <span style={{ color: "var(--text-secondary)" }}>Action yêu cầu: </span>
                        <strong style={{ color: "var(--text-primary)" }}>{req.service} / {req.action}</strong>
                      </div>

                      {req.payload && (
                        <div>
                          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>
                            Chi tiết Tham Số (Payload):
                          </div>
                          <div className="hitl-payload-box">
                            <pre style={{ margin: 0 }}>{JSON.stringify(req.payload, null, 2)}</pre>
                          </div>
                        </div>
                      )}

                      <div className="hitl-actions-row">
                        <button
                          type="button"
                          className="btn-row-action btn-row-danger"
                          disabled={decidingId === req.requestId}
                          onClick={() => void handleDecide(req.requestId, false)}
                        >
                          <XCircle size={15} />
                          <span>Từ chối Action</span>
                        </button>

                        <button
                          type="button"
                          className={`btn-approve-hitl ${decidingId === req.requestId ? "is-loading" : ""}`}
                          disabled={decidingId === req.requestId}
                          onClick={() => void handleDecide(req.requestId, true)}
                        >
                          {decidingId === req.requestId ? (
                            <>
                              <RefreshCw size={15} className="animate-spin" />
                              <span>Đang ghi On-Chain...</span>
                            </>
                          ) : (
                            <>
                              <CheckCircle2 size={15} />
                              <span>Phê duyệt & Ghi On-Chain</span>
                            </>
                          )}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ================================================================== */}
          {/* TAB 5: ON-CHAIN AUDIT RECONCILIATION */}
          {/* ================================================================== */}
          {tab === "audit" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div className="audit-reconcile-banner">
                <div className="audit-seal-block">
                  <div className="audit-seal-icon">
                    <Database size={24} />
                  </div>
                  <div>
                    <div className="audit-seal-title">Audit Toàn Vẹn On-Chain (Cryptographic Audit)</div>
                    <div className="audit-seal-desc">
                      So khớp hash Keccak-256 lưu trong PostgreSQL Database với log bất biến trên Smart Contract.
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  className="btn-primary-action"
                  style={{ width: "auto", padding: "10px 20px" }}
                  onClick={() => void handleAuditReconciliation()}
                  disabled={loading}
                >
                  <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
                  <span>{loading ? "Đang chạy Audit..." : "Run On-Chain Audit"}</span>
                </button>
              </div>

              {auditResults.length > 0 && (
                <div className="audit-stats-grid">
                  <div className="audit-stat-card">
                    <span className="audit-stat-card-title">Tổng logs đối soát</span>
                    <span className="audit-stat-card-num">{auditResults.length}</span>
                  </div>
                  <div className="audit-stat-card">
                    <span className="audit-stat-card-title">Valid Match (Hợp lệ)</span>
                    <span className="audit-stat-card-num" style={{ color: "var(--status-active-text)" }}>
                      {auditResults.filter((a) => a.verification.payloadHashMatches).length}
                    </span>
                  </div>
                  <div className="audit-stat-card">
                    <span className="audit-stat-card-title">Mismatch (Bất thường)</span>
                    <span className="audit-stat-card-num" style={{ color: auditResults.some((a) => !a.verification.payloadHashMatches) ? "var(--status-danger-text)" : undefined }}>
                      {auditResults.filter((a) => !a.verification.payloadHashMatches).length}
                    </span>
                  </div>
                </div>
              )}

              <div className="content-box">
                <div className="content-box-header">
                  <h3 className="content-box-title">
                    <FileCheck2 size={18} color="var(--color-brand)" />
                    <span>Kết quả Audit On-Chain</span>
                  </h3>
                  <span className="font-mono" style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    Đã kiểm tra: {auditResults.length} records
                  </span>
                </div>

                <div className="table-scroll-container">
                  <table className="enterprise-data-table">
                    <thead>
                      <tr>
                        <th>Request ID</th>
                        <th>Database Hash (PostgreSQL)</th>
                        <th>On-Chain Hash (Smart Contract)</th>
                        <th>Action On-Chain</th>
                        <th>Audit Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedAuditResults.map((audit, idx) => {
                        const isMatch = audit.verification.payloadHashMatches === true;
                        return (
                          <tr key={audit.requestId} className={idx % 2 === 1 ? "row-tinted" : "row-plain"}>
                            <td className="font-mono" style={{ fontSize: "0.78rem", fontWeight: 700 }}>
                              {audit.requestId.slice(0, 10)}...
                            </td>
                            <td className="font-mono" style={{ fontSize: "0.74rem" }}>
                              {audit.database.payloadHash.slice(0, 14)}...
                            </td>
                            <td className="font-mono" style={{ fontSize: "0.74rem" }}>
                              {audit.blockchain?.execution?.payloadHash
                                ? `${audit.blockchain.execution.payloadHash.slice(0, 14)}...`
                                : audit.blockchain?.approval?.payloadHash
                                ? `${audit.blockchain.approval.payloadHash.slice(0, 14)}...`
                                : "Chưa ghi nhận On-Chain"}
                            </td>
                            <td>
                              <span style={{ fontSize: "0.78rem", color: "var(--text-secondary)" }}>
                                {audit.blockchain?.execution?.action ?? audit.blockchain?.approval?.action ?? "—"}
                              </span>
                            </td>
                            <td>
                              <span className={`status-pill-badge ${isMatch ? "pill-match" : "pill-mismatch"}`}>
                                {isMatch ? <ShieldCheck size={12} /> : <AlertCircle size={12} />}
                                <span>{isMatch ? "VALID MATCH" : "MISMATCH"}</span>
                              </span>
                            </td>
                          </tr>
                        );
                      })}

                      {auditResults.length === 0 && (
                        <tr>
                          <td colSpan={5}>
                            <div className="empty-state-card">
                              <div className="empty-state-icon"><Database size={24} /></div>
                              <div className="empty-state-title">Chưa chạy phiên Audit nào</div>
                              <div className="empty-state-caption">
                                Nhấn nút <strong>"Run On-Chain Audit"</strong> ở trên để truy xuất và verify hash từ Smart Contract.
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <TablePagination
                  currentPage={auditPage}
                  totalItems={auditResults.length}
                  pageSize={AUDIT_PER_PAGE}
                  onPageChange={setAuditPage}
                />
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}