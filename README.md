# AI Agent Trust and Audit Platform for Smart Campus

Nền tảng quản lý định danh, quyền hạn, phê duyệt và kiểm toán hành động của AI Agent trong môi trường Smart Campus.

## Chức năng chính

- Đăng ký định danh AI Agent.
- Xác thực Agent bằng Client ID và Client Secret.
- Quản lý quyền theo dịch vụ và hành động.
- Thiết lập mức rủi ro LOW, MEDIUM và HIGH.
- Giới hạn số hành động mỗi ngày.
- Phê duyệt thủ công theo cơ chế Human-in-the-loop.
- Thu hồi và kích hoạt lại Agent.
- Lưu yêu cầu, quyết định và kết quả trong PostgreSQL.
- Ghi hash kiểm toán lên blockchain.
- Đối chiếu dữ liệu PostgreSQL với blockchain.
- Dashboard quản trị bằng React.

## Kiến trúc

```mermaid
flowchart TD
    A["AI Agent"] --> B["Express API"]
    U["Quản trị viên"] --> F["React Dashboard"]
    F --> B
    B --> P["PostgreSQL"]
    B --> S["CampusAgentRegistry"]
    S --> H["Hardhat Blockchain"]
```

## Công nghệ

| Thành phần | Công nghệ |
|---|---|
| Smart contract | Solidity, Hardhat 3, OpenZeppelin |
| Blockchain local | Hardhat Network |
| Backend | Node.js, Express, TypeScript |
| ORM | Prisma ORM |
| Database | PostgreSQL 16 |
| Xác thực | JWT, bcrypt |
| Blockchain client | Ethers.js |
| Frontend | React, TypeScript, Vite |
| Hạ tầng local | Docker Compose |

## Cấu trúc dự án

```text
smart-campus-agent-trust
├── agents
├── backend
│   ├── prisma
│   └── src
│       ├── config
│       ├── lib
│       ├── middleware
│       ├── routes
│       └── scripts
├── contracts
│   ├── contracts
│   ├── ignition
│   └── test
├── docs
├── frontend
│   └── src
├── scripts
│   ├── health-check.ps1
│   └── start-dev.ps1
├── docker-compose.yml
└── README.md
```

## Mô hình kiểm soát rủi ro

| Mức | Cơ chế |
|---|---|
| LOW | Tự động phê duyệt nếu Agent có quyền |
| MEDIUM | Chờ quản trị viên phê duyệt |
| HIGH | Chờ quản trị viên phê duyệt và ghi bằng chứng quyết định |

## Luồng xử lý

1. Quản trị viên đăng ký Agent.
2. Backend tạo Client ID và Client Secret.
3. Định danh Agent được ghi lên blockchain.
4. Quản trị viên cấp quyền service/action.
5. Agent đăng nhập và nhận JWT.
6. Agent gửi yêu cầu hành động.
7. Backend kiểm tra database và blockchain.
8. Backend kiểm tra trạng thái và hạn mức.
9. Yêu cầu LOW được tự động duyệt.
10. Yêu cầu MEDIUM/HIGH chờ quản trị viên.
11. Hành động được thực thi.
12. Payload hash và result hash được ghi lên blockchain.
13. Dashboard đối chiếu bằng chứng kiểm toán.

## Cấu hình môi trường

Tạo `backend/.env`:

```env
DATABASE_URL="postgresql://campus:campus@localhost:5432/campus_audit"
PORT=3100
JWT_SECRET="replace-with-a-long-random-secret"
RPC_URL="http://127.0.0.1:8545"
CONTRACT_ADDRESS="0x..."
BACKEND_SIGNER_PRIVATE_KEY="0x..."
ADMIN_USERNAME="admin"
ADMIN_PASSWORD="replace-with-a-strong-password"
```

Tạo `frontend/.env`:

```env
VITE_API_URL=http://localhost:3100
```

Không commit các file `.env`.

## Cài đặt

### Contract

```powershell
cd contracts
npm install
npm run compile
npx hardhat test
```

### Backend

```powershell
cd backend
npm install
npx prisma generate
npx prisma migrate dev
npm run seed:admin
npm run build
```

### Frontend

```powershell
cd frontend
npm install
npm run build
```

## Khởi động nhanh

Mở Docker Desktop, sau đó:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\start-dev.ps1
```

Kiểm tra:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\health-check.ps1
```

## Địa chỉ local

| Dịch vụ | URL |
|---|---|
| Dashboard | http://127.0.0.1:5175 |
| Backend API | http://localhost:3100 |
| Database health | http://localhost:3100/health |
| Blockchain health | http://localhost:3100/health/blockchain |
| Hardhat RPC | http://127.0.0.1:8545 |

## API chính

| Method | Endpoint | Quyền |
|---|---|---|
| POST | `/api/auth/admin` | Công khai |
| POST | `/api/auth/agent` | Công khai |
| GET | `/api/auth/agent/me` | Agent |
| POST | `/api/auth/agent/rotate-secret` | Agent |
| GET | `/api/agents` | Admin |
| POST | `/api/agents` | Admin |
| POST | `/api/agents/:id/permissions` | Admin |
| PATCH | `/api/agents/:id/status` | Admin |
| POST | `/api/actions` | Agent |
| POST | `/api/actions/:requestId/execute` | Agent |
| GET | `/api/actions/my` | Agent |
| GET | `/api/actions/admin/all` | Admin |
| GET | `/api/actions/:requestId/audit` | Admin |
| GET | `/api/approvals/pending` | Admin |
| POST | `/api/approvals/:requestId` | Admin |

## Kiểm thử

```powershell
cd contracts
npx hardhat test

cd ..\backend
npm run build

cd ..\frontend
npm run build
```

Kết quả hiện tại:

- 4 smart contract tests passing.
- Backend TypeScript build thành công.
- Frontend production build thành công.

## Lưu ý bảo mật

- Private key Hardhat chỉ được dùng trong môi trường local.
- Không dùng tài khoản Hardhat trên mạng blockchain thật.
- Client Secret chỉ được hiển thị một lần.
- Password và Client Secret được băm bằng bcrypt.
- JWT có thời hạn một giờ.
- Agent bị thu hồi sẽ bị chặn dù token chưa hết hạn.
- Hành động được kiểm tra ở cả database và blockchain.
- Blockchain chỉ lưu hash, không lưu dữ liệu nhạy cảm.