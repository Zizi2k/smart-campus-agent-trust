import {
  type FormEvent,
  useState,
} from "react";

import { api } from "./api";

interface AgentOption {
  id: string;
  name: string;
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
  const [type, setType] =
    useState("LIBRARY_AGENT");
  const [description, setDescription] =
    useState("");
  const [walletAddress, setWalletAddress] =
    useState("");

  const [selectedAgent, setSelectedAgent] =
    useState("");
  const [service, setService] =
    useState("LIBRARY");
  const [action, setAction] =
    useState("READ_BOOK");
  const [dailyLimit, setDailyLimit] =
    useState(100);
  const [riskLevel, setRiskLevel] =
    useState("LOW");

  const [credentials, setCredentials] =
    useState<Credentials | null>(null);

  const [message, setMessage] =
    useState("");
  const [error, setError] =
    useState("");
  const [saving, setSaving] =
    useState(false);

  async function createAgent(
    event: FormEvent
  ) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    try {
      const response = await api.post(
        "/api/agents",
        {
          name: name.trim(),
          type: type.trim(),
          description:
            description.trim() || undefined,
          walletAddress:
            walletAddress.trim(),
        }
      );

      setCredentials(
        response.data.credentials
      );

      setMessage(
        "Đã tạo AI Agent thành công."
      );

      setName("");
      setDescription("");
      setWalletAddress("");

      await onChanged();
    } catch {
      setError(
        "Không thể tạo Agent. Hãy kiểm tra địa chỉ ví chưa được sử dụng."
      );
    } finally {
      setSaving(false);
    }
  }

  async function grantPermission(
    event: FormEvent
  ) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setError("");

    if (!selectedAgent) {
      setError("Hãy chọn AI Agent.");
      setSaving(false);
      return;
    }

    try {
      await api.post(
        `/api/agents/${selectedAgent}/permissions`,
        {
          service: service.trim(),
          action: action.trim(),
          allowed: true,
          dailyLimit,
          riskLevel,
        }
      );

      setMessage(
        "Đã cập nhật quyền trên database và blockchain."
      );

      await onChanged();
    } catch {
      setError(
        "Không thể cấp quyền cho Agent."
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="management-grid">
        <form
          className="management-form"
          onSubmit={createAgent}
        >
          <div className="form-heading">
            <div>
              <p className="eyebrow">
                ĐỊNH DANH MỚI
              </p>
              <h3>Tạo AI Agent</h3>
            </div>
          </div>

          <label>
            Tên Agent
            <input
              value={name}
              onChange={(event) =>
                setName(event.target.value)
              }
              placeholder="Student Assistant"
              required
            />
          </label>

          <label>
            Loại Agent
            <input
              value={type}
              onChange={(event) =>
                setType(event.target.value)
              }
              placeholder="STUDENT_AGENT"
              required
            />
          </label>

          <label>
            Địa chỉ ví
            <input
              value={walletAddress}
              onChange={(event) =>
                setWalletAddress(
                  event.target.value
                )
              }
              placeholder="0x..."
              required
            />
          </label>

          <label>
            Mô tả
            <textarea
              value={description}
              onChange={(event) =>
                setDescription(
                  event.target.value
                )
              }
              placeholder="Nhiệm vụ của Agent"
            />
          </label>

          <button
            className="primary-button"
            disabled={saving}
          >
            Tạo Agent
          </button>
        </form>

        <form
          className="management-form"
          onSubmit={grantPermission}
        >
          <div className="form-heading">
            <div>
              <p className="eyebrow">
                CHÍNH SÁCH TRUY CẬP
              </p>
              <h3>Cấp quyền Agent</h3>
            </div>
          </div>

          <label>
            AI Agent
            <select
              value={selectedAgent}
              onChange={(event) =>
                setSelectedAgent(
                  event.target.value
                )
              }
              required
            >
              <option value="">
                Chọn Agent
              </option>

              {agents.map((agent) => (
                <option
                  key={agent.id}
                  value={agent.id}
                >
                  {agent.name}
                </option>
              ))}
            </select>
          </label>

          <div className="form-row">
            <label>
              Dịch vụ
              <input
                value={service}
                onChange={(event) =>
                  setService(
                    event.target.value
                  )
                }
                required
              />
            </label>

            <label>
              Hành động
              <input
                value={action}
                onChange={(event) =>
                  setAction(
                    event.target.value
                  )
                }
                required
              />
            </label>
          </div>

          <div className="form-row">
            <label>
              Hạn mức/ngày
              <input
                type="number"
                min="0"
                value={dailyLimit}
                onChange={(event) =>
                  setDailyLimit(
                    Number(
                      event.target.value
                    )
                  )
                }
                required
              />
            </label>

            <label>
              Mức rủi ro
              <select
                value={riskLevel}
                onChange={(event) =>
                  setRiskLevel(
                    event.target.value
                  )
                }
              >
                <option value="LOW">
                  LOW – tự động duyệt
                </option>
                <option value="MEDIUM">
                  MEDIUM – cần duyệt
                </option>
                <option value="HIGH">
                  HIGH – cần duyệt
                </option>
              </select>
            </label>
          </div>

          <button
            className="primary-button"
            disabled={saving}
          >
            Cấp hoặc cập nhật quyền
          </button>
        </form>
      </div>

      {message && (
        <p className="success-banner">
          {message}
        </p>
      )}

      {error && (
        <p className="error-banner">
          {error}
        </p>
      )}

      {credentials && (
        <section className="credential-box">
          <div>
            <p className="eyebrow">
              THÔNG TIN XÁC THỰC
            </p>
            <h3>Lưu thông tin ngay</h3>
            <p>
              Client secret sẽ không được
              hiển thị lại.
            </p>
          </div>

          <label>
            Client ID
            <code>
              {credentials.clientId}
            </code>
          </label>

          <label>
            Client secret
            <code>
              {credentials.clientSecret}
            </code>
          </label>

          <button
            className="secondary-button"
            onClick={() =>
              setCredentials(null)
            }
          >
            Tôi đã lưu thông tin
          </button>
        </section>
      )}
    </>
  );
}