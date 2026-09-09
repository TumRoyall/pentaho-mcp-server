# Cài đặt

Quy trình cài đặt tập trung. Biên workspace và cấu hình runtime tùy chọn xem `docs/configuration.md`; vận hành xem `docs/operations.md`.

## Cách 1 — bản `.exe` tự chứa (khuyến nghị cho end user)

Không cần Node trên máy đích, không cần `npm install`; knowledge base và companion skill nằm trong bản phát hành.

### Tạo bản phát hành (maintainer)

```powershell
npm install
node scripts/verify-production-profile.mjs
node scripts/build-release.mjs --version 1.0.0
```

Kết quả trong `dist/`:

- `dte-pentaho-mcp-<version>-win-x64.zip` — gồm các mục: `README.md`, `VERSION`, `doctor.ps1`, `dte-pentaho-mcp.exe`, `install.ps1`, `uninstall.ps1`, và companion skill `skills/developing-pentaho-jobs/SKILL.md` cùng hai mẫu `skills/developing-pentaho-jobs/references/pentaho-spec-template.md` và `skills/developing-pentaho-jobs/references/pentaho-plan-template.md`.
- `checksums.sha256` — SHA-256 của ZIP, nằm cạnh ZIP.

### Cài trên máy đích (offline)

1. Copy ZIP sang máy đích, giải nén ra thư mục bất kỳ.
2. Trong thư mục vừa giải nén:

```powershell
.\install.ps1 -WorkspaceRoot C:\path\to\your\workspace -PentahoHome C:\Pentaho\data-integration
```

Lệnh ghi server `dte-pentaho` vào `%USERPROFILE%\.kiro\settings\mcp.json` (backup file cũ, giữ server khác, không auto-approve toàn bộ tool).
3. Reconnect MCP server trong Kiro.

Kiểm tra: `.\doctor.ps1 -PentahoHome C:\Pentaho\data-integration` (handshake MCP bằng initialize + tools/list, assert 26 tool, từ chối `pentaho_*`).

Gỡ bỏ: `.\uninstall.ps1` (chỉ xóa entry `dte-pentaho`).

### Companion skill

Bản giải nén chứa `skills/developing-pentaho-jobs/`. **Skill không tự cài chỉ vì có trong ZIP** — bạn phải copy nó vào vị trí skills của client:

- **Kiro:** copy `skills/developing-pentaho-jobs/` vào `.kiro/skills/` (workspace) hoặc `~/.kiro/skills/` (user).
- **Codex / agent tương thích Superpowers:** đặt dưới thư mục skills runtime (ví dụ `~/.agents/skills/`) theo tài liệu client.

Đây là skill dẫn dắt workflow phát triển Pentaho năm pha (xem `docs/workflow-guide.md`).

## Cách 2 — source-mode (cho developer)

Yêu cầu: Node.js 20+. **Hai** runtime dependency: `@modelcontextprotocol/sdk`, `fast-xml-parser`.

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

Lưu rồi reconnect MCP trong Kiro; không cần restart Kiro. Ở source-mode, companion skill nằm ngay tại `skills/` trong repo; để client khám phá được, copy `skills/developing-pentaho-jobs/` vào `.kiro/skills/` (Kiro) hoặc thư mục skills của runtime (Codex, ví dụ `~/.agents/skills/`).

Kiểm tra nhanh:

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

## Đóng gói npm (tùy chọn)

`package.json` khai báo `files` gồm `src`, `docs`, `README.md` và `skills`, nên `npm pack` gói đúng `src` (gồm knowledge) + docs + companion skill. Không phát hành `node_modules`.
