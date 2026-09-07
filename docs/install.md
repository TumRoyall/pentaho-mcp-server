# Cài đặt

Quy trình cài đặt tập trung. Schema cấu hình xem `docs/configuration.md`; vận hành xem `docs/operations.md`.

## Cách 1 — bản `.exe` tự chứa (khuyến nghị cho end user)

Không cần Node trên máy đích, không cần `npm install`; knowledge base và lifecycle guidance nằm trong `.exe`.

### Tạo bản phát hành (maintainer)

```powershell
npm install
node scripts/verify-production-profile.mjs
node scripts/build-release.mjs --version 1.0.0
```

Kết quả trong `dist/`:

- `dte-pentaho-mcp-<version>-win-x64.zip` — đúng 7 mục: `dte-pentaho-mcp.exe`, `install.ps1`, `uninstall.ps1`, `doctor.ps1`, `config.example.yaml`, `README.md`, `VERSION`.
- `checksums.sha256` — SHA-256 của ZIP, nằm cạnh ZIP.

### Cài trên máy đích (offline)

1. Copy ZIP sang máy đích, giải nén ra thư mục bất kỳ.
2. Trong thư mục vừa giải nén:

```powershell
.\install.ps1 -WorkspaceRoot C:\path\to\your\workspace
```

Lệnh ghi server `dte-pentaho` vào `%USERPROFILE%\.kiro\settings\mcp.json` (backup file cũ, giữ server khác, không auto-approve toàn bộ tool).
3. Reconnect MCP server trong Kiro.

Kiểm tra: `.\doctor.ps1 -WorkspaceRoot C:\path\to\your\workspace` (handshake MCP, tool/prompt/resource, validate `.pentaho-mcp.yaml`, dò PDI tùy chọn — thiếu PDI không fail).

Gỡ bỏ: `.\uninstall.ps1` (chỉ xóa entry `dte-pentaho`).

## Cách 2 — source-mode (cho developer)

Yêu cầu: Node.js 20+. Ba runtime dependency: `@modelcontextprotocol/sdk`, `fast-xml-parser`, `yaml`.

```powershell
npm install
$env:KETTLE_ROOT = "C:\path\to\your\workspace"
node src/index.js
```

Đăng ký vào Kiro (`%USERPROFILE%\.kiro\settings\mcp.json`):

```json
{
  "mcpServers": {
    "dte-pentaho": {
      "command": "node",
      "args": ["C:/path/to/pentaho-mcp-server/src/index.js"],
      "env": { "KETTLE_ROOT": "C:/path/to/your/workspace" }
    }
  }
}
```

Lưu rồi reconnect MCP trong Kiro; không cần restart Kiro.

Kiểm tra nhanh:

```powershell
node --test
node scripts/verify-production-profile.mjs
```

Kỳ vọng: toàn suite pass và `production profile OK: 31 tools, 5 resources, 1 prompt(s), no learning/promotion surface`.

## Mạng nội bộ hạn chế (không ra npm)

Vì chỉ có 3 dependency, có 2 lựa chọn đã kiểm chứng:

1. **Đưa cả repo kèm `node_modules`.** Cài `npm install` một lần ở máy có mạng, rồi copy nguyên thư mục (gồm `node_modules`) vào máy đích. ESM chạy trực tiếp, không cần build lại.
2. **Trỏ registry nội bộ** (Nexus/Artifactory): `npm config set registry <internal-registry-url>` rồi `npm install`.

## Cấu hình project

Mỗi workspace commit một `.pentaho-mcp.yaml` ở gốc (copy từ `packaging/config.example.yaml`). Tên thư mục đọc từ file này, không hard-code; mọi đường dẫn tương đối workspace và bị từ chối nếu tuyệt đối/thoát ngoài hoặc ghi vào `input/`.

```yaml
schema_version: 1
project:
  code: EXAMPLE
paths:
  requirements: docs
  pentaho: etl-pentaho
environment:
  name: UNKNOWN
```

## An toàn thực thi và không tự commit Git

- Kitchen/Pan chỉ tự chạy ở `DEV`/`TEST`; môi trường khác (kể cả `UNKNOWN`) cần `confirmed: true`.
- Server không bao giờ thay đổi Git (không commit/push/amend); chỉ đọc trạng thái khi inspect.

## Đóng gói npm (tùy chọn)

`package.json` khai báo `files: [src, docs, README.md]`, nên `npm pack` gói đúng `src` (gồm knowledge) + docs. Không phát hành `node_modules`.
