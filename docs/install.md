# Cài đặt

Tài liệu chuẩn cài đặt thủ công cho cả ba client: `Kiro`, `Claude Code` và `Codex`. Biên workspace và cấu hình runtime tùy chọn xem `docs/configuration.md`; vận hành xem `docs/operations.md`.

Máy chủ MCP chỉ có một artifact stdio duy nhất và một bộ biến môi trường runtime dùng chung. Việc cài đặt và gỡ bỏ là thao tác cấu hình client thủ công, không có script cài đặt.

## Chọn cách chạy server (độc lập client)

### Cách A — bản `.exe` tự chứa cho end user

Không cần Node trên máy đích, không cần `npm install`; knowledge base và companion skill nằm trong bản phát hành.

1. Tải/copy file ZIP phát hành sang máy đích.
2. Kiểm tra toàn vẹn:
```powershell
certutil -hashfile dte-pentaho-mcp-1.0.0-win-x64.zip SHA256
type checksums.sha256
```
Đối chiếu SHA-256 hiển thị với nội dung `checksums.sha256` đi kèm ZIP.
3. Giải nén ZIP ra một thư mục tuyệt đối ổn định, ví dụ `C:/Tools/dte-pentaho-mcp/`.
4. Dùng đường dẫn `dte-pentaho-mcp.exe` vừa giải nén trong cấu hình client ở các mục bên dưới.

Giữ nguyên thư mục giải nén vì cấu hình client trỏ trực tiếp tới executable. Di chuyển hoặc xóa thư mục chứa `.exe` sẽ làm hỏng các cấu hình còn trỏ tới nó.

### Cách B — source-mode cho developer

Yêu cầu: Node.js 20+.

```powershell
npm install
node src/index.js
```

Dùng `node` cộng đường dẫn tuyệt đối `src/index.js` (ví dụ `C:/src/pentaho-mcp-server/src/index.js`) trong cấu hình client ở các mục bên dưới. **Hai** runtime dependency: `@modelcontextprotocol/sdk`, `fast-xml-parser`.

### Lệnh build của maintainer

```powershell
npm install
npm run verify:profile
npm run build:release -- --version 1.0.0
```

Kết quả trong `dist/`:

- `dte-pentaho-mcp-<version>-win-x64.zip` — gồm đúng các mục: `README.md`, `VERSION`, `doctor.ps1`, `dte-pentaho-mcp.exe`, và companion skill `skills/developing-pentaho-jobs/SKILL.md` cùng hai mẫu `skills/developing-pentaho-jobs/references/pentaho-spec-template.md` và `skills/developing-pentaho-jobs/references/pentaho-plan-template.md`.
- `checksums.sha256` — SHA-256 của ZIP, nằm cạnh ZIP.

## Kiro

Cấu hình MCP của Kiro nằm tại `.kiro/settings/mcp.json` cho workspace hoặc `%USERPROFILE%/.kiro/settings/mcp.json` cho user.

### Kiro với bản `.exe`

```json
{
  "mcpServers": {
    "dte-pentaho": {
      "command": "C:/Tools/dte-pentaho-mcp/dte-pentaho-mcp.exe",
      "args": [],
      "env": {
        "KETTLE_ROOT": "C:/work/my-pentaho-project",
        "PENTAHO_HOME": "C:/Pentaho/data-integration"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

### Kiro với source-mode

```json
{
  "mcpServers": {
    "dte-pentaho": {
      "command": "node",
      "args": ["C:/src/pentaho-mcp-server/src/index.js"],
      "env": {
        "KETTLE_ROOT": "C:/work/my-pentaho-project",
        "PENTAHO_HOME": "C:/Pentaho/data-integration"
      },
      "disabled": false,
      "autoApprove": []
    }
  }
}
```

Lưu file rồi reconnect/kiểm tra `dte-pentaho` trong MCP panel của Kiro.

## Claude Code

Cấu hình MCP project của Claude Code là `.mcp.json` tại project root; thư mục `.claude/` dùng cho companion skill, không dùng cho mục MCP server.

### Claude Code với bản `.exe`

File `.mcp.json` tại project root:

```json
{
  "mcpServers": {
    "dte-pentaho": {
      "type": "stdio",
      "command": "C:/Tools/dte-pentaho-mcp/dte-pentaho-mcp.exe",
      "args": [],
      "env": {
        "KETTLE_ROOT": "C:/work/my-pentaho-project",
        "PENTAHO_HOME": "C:/Pentaho/data-integration"
      }
    }
  }
}
```

### Claude Code với source-mode

File `.mcp.json` tại project root:

```json
{
  "mcpServers": {
    "dte-pentaho": {
      "type": "stdio",
      "command": "node",
      "args": ["C:/src/pentaho-mcp-server/src/index.js"],
      "env": {
        "KETTLE_ROOT": "C:/work/my-pentaho-project",
        "PENTAHO_HOME": "C:/Pentaho/data-integration"
      }
    }
  }
}
```

`.mcp.json` ở phạm vi project có thể yêu cầu workspace trust/approval khi mở project.

Kiểm tra:

```powershell
claude mcp list
claude mcp get dte-pentaho
```

Hoặc dùng `/mcp` trong phiên Claude Code tương tác.

## Codex

Cấu hình MCP của Codex nằm tại project `.codex/config.toml` hoặc user `%USERPROFILE%/.codex/config.toml`.

### Codex với bản `.exe`

```toml
[mcp_servers.dte-pentaho]
command = "C:/Tools/dte-pentaho-mcp/dte-pentaho-mcp.exe"
args = []

[mcp_servers.dte-pentaho.env]
KETTLE_ROOT = "C:/work/my-pentaho-project"
PENTAHO_HOME = "C:/Pentaho/data-integration"
```

### Codex với source-mode

```toml
[mcp_servers.dte-pentaho]
command = "node"
args = ["C:/src/pentaho-mcp-server/src/index.js"]

[mcp_servers.dte-pentaho.env]
KETTLE_ROOT = "C:/work/my-pentaho-project"
PENTAHO_HOME = "C:/Pentaho/data-integration"
```

Kiểm tra:

```powershell
codex mcp list
```

Hoặc dùng `/mcp` trong Codex TUI. Sau khi thêm server qua MCP settings UI của IDE extension, cần restart extension.

## Companion skill

Cây nguồn và ZIP đều chứa `skills/developing-pentaho-jobs/`, nhưng để client khám phá được, phải copy toàn bộ thư mục đó tới một trong các đích sau:

| Client | Project scope | User scope |
|---|---|---|
| Kiro | `.kiro/skills/developing-pentaho-jobs/` | `%USERPROFILE%/.kiro/skills/developing-pentaho-jobs/` |
| Claude Code | `.claude/skills/developing-pentaho-jobs/` | `%USERPROFILE%/.claude/skills/developing-pentaho-jobs/` |
| Codex | `.agents/skills/developing-pentaho-jobs/` | `%USERPROFILE%/.agents/skills/developing-pentaho-jobs/` |

Đây là skill dẫn dắt workflow phát triển Pentaho năm pha (xem `docs/workflow-guide.md`).

## Runtime dùng chung

- `KETTLE_ROOT` nên đặt cho mọi cách cài đặt; khi unset, mặc định là `process.cwd()` và luôn được enforce. Xem `docs/configuration.md`.
- `PENTAHO_HOME` là tùy chọn và chỉ bật nhóm tool runtime PDI cục bộ.
- `PENTAHO_ENABLE_EXECUTE="1"` là tùy chọn và phải thêm trực tiếp vào khối `env` của client đang dùng mới cho phép thực thi thật; bỏ hẳn để chặn.

## Kiểm tra server độc lập client

`doctor.ps1` kiểm tra trực tiếp server đã đóng gói và không đăng ký server vào bất kỳ client nào:

```powershell
.\doctor.ps1 -PentahoHome C:\Pentaho\data-integration
```

Lệnh thực hiện handshake MCP bằng initialize + tools/list, assert 26 tool, từ chối `pentaho_*`.

Kiểm tra nhanh source-mode:

```powershell
node --test
node scripts/verify-production-profile.mjs
```

Kỳ vọng: toàn suite pass và `production profile OK: 26 tools (exact set), no lifecycle prompt/resource surface, no learning/promotion surface`.

## Mạng nội bộ hạn chế (không ra npm)

Vì chỉ có 3 dependency, có 2 lựa chọn đã kiểm chứng:

1. **Đưa cả repo kèm `node_modules`.** Cài `npm install` một lần ở máy có mạng, rồi copy nguyên thư mục (gồm `node_modules`) vào máy đích. ESM chạy trực tiếp, không cần build lại.
2. **Trỏ registry nội bộ** (Nexus/Artifactory): `npm config set registry <internal-registry-url>` rồi `npm install`.

## Biên workspace

- `KETTLE_ROOT` mặc định `process.cwd()` khi unset và luôn được enforce; đường tuyệt đối chỉ hợp lệ khi nằm trong root, `..`/sibling-prefix/symlink escape bị từ chối. Chi tiết xem `docs/configuration.md`.
- `PENTAHO_HOME` chỉ cần cho các tool runtime tùy chọn; không còn file cấu hình YAML theo project.

## An toàn thực thi và không tự commit Git

- Kitchen/Pan (runtime tùy chọn) luôn cần `confirmed: true` để execute; không tên môi trường nào bỏ qua bước xác nhận.
- Server không bao giờ thay đổi Git (không commit/push/amend).

## Gỡ bỏ

Việc gỡ bỏ là xóa mục/bảng `dte-pentaho` khỏi cấu hình client đang dùng và tùy chọn xóa thư mục companion-skill đã copy. Không cần script gỡ riêng.

## Đóng gói npm (tùy chọn)

`package.json` khai báo `files` gồm `src`, `docs`, `README.md` và `skills`, nên `npm pack` gói đúng `src` (gồm knowledge) + docs + companion skill. Không phát hành `node_modules`.
