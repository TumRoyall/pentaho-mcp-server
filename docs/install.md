# Cài đặt kettle-mcp-dte (kể cả mạng nội bộ hạn chế)

Server tự chứa (self-contained): knowledge base nằm trong `src/knowledge/pentaho`,
đóng gói theo repo. Cài xong là chạy được, không cần kéo thêm folder knowledge.

## Yêu cầu

- Node.js >= 20 (dùng `node:test` và ESM sẵn có, không cần build).
- Chỉ 2 runtime dependency: `@modelcontextprotocol/sdk`, `fast-xml-parser`.

## Cách 1 — có internet tới npm registry

```sh
cd kettle-mcp-dte
npm install
```

## Cách 2 — mạng nội bộ, không ra được npm

Vì chỉ có 2 dependency, có 3 lựa chọn:

1. **Đưa cả repo kèm `node_modules`.** Cài `npm install` một lần ở máy có mạng,
   rồi copy nguyên thư mục `kettle-mcp-dte` (gồm `node_modules`) vào máy đích.
   ESM chạy trực tiếp, không cần build lại.
2. **Trỏ registry nội bộ** (nếu công ty có Nexus/Artifactory):
   `npm config set registry <internal-registry-url>` rồi `npm install`.
3. **Dùng chung `node_modules` của server cũ** nếu cùng version deps:
   đặt `NODE_PATH` trỏ tới `node_modules` đã có, hoặc symlink.

## Đăng ký vào Kiro

`~/.kiro/settings/mcp.json`:

```json
{
  "mcpServers": {
    "kettle-dte": {
      "command": "node",
      "args": ["<abs path>/kettle-mcp-dte/src/index.js"],
      "env": {
        "KETTLE_ROOT": "<abs path>/dte-etl-pentaho"
      }
    }
  }
}
```

Sau khi lưu, reconnect MCP server trong Kiro (MCP Server view) — không cần khởi
động lại Kiro.

## Kiểm tra nhanh

- `node --test` phải xanh (toàn bộ suite pass, chỉ 1 skip do platform không tạo
  được symlink).
- Gọi tool `kettle_knowledge_list` phải trả danh sách type + đường dẫn knowledge
  nằm trong `src/knowledge/pentaho` (xác nhận knowledge đi kèm package).
- Gọi `kettle_validate` trên một `.ktr` thật phải trả `{errors, warnings, info}`.

## Cách 3 — bản đóng gói `.exe` tự chứa (khuyến nghị cho người dùng cuối)

Không cần Node trên máy đích, không cần `npm install`; knowledge base và hướng
dẫn lifecycle nằm luôn trong `.exe`.

### Tạo bản phát hành (người bảo trì)

```sh
npm install
npm run verify:profile                     # đảm bảo không lộ learning/promotion
npm run build:release -- --version 1.0.0
```

Kết quả trong `dist/`:

- `dte-pentaho-mcp-<version>-win-x64.zip` — đúng 7 mục: `dte-pentaho-mcp.exe`,
  `install.ps1`, `uninstall.ps1`, `doctor.ps1`, `config.example.yaml`,
  `README.md`, `VERSION`.
- `checksums.sha256` — mã băm SHA-256 của ZIP.

### Cài trên máy đích (offline)

1. Copy ZIP sang máy đích, giải nén ra thư mục bất kỳ.
2. Trong thư mục vừa giải nén:

   ```powershell
   .\install.ps1 -WorkspaceRoot C:\duong-dan\workspace
   ```

   Lệnh này ghi một server `dte-pentaho` vào
   `%USERPROFILE%\.kiro\settings\mcp.json` (sao lưu file cũ, giữ nguyên các
   server khác, không bật auto-approve toàn bộ tool).
3. Reconnect MCP server trong Kiro.

Kiểm tra cài đặt: `.\doctor.ps1 -WorkspaceRoot C:\duong-dan\workspace` (bắt tay
MCP, kiểm tra tool/prompt/resource, validate `.pentaho-mcp.yaml`, dò PDI tùy
chọn — thiếu PDI không làm hỏng kiểm tra).

Gỡ bỏ: `.\uninstall.ps1` (chỉ xóa entry `dte-pentaho`).

### Cấu hình project

Mỗi workspace commit một `.pentaho-mcp.yaml` ở gốc (xem `config.example.yaml`).
Tên thư mục project đọc từ file này, không hard-code; mọi đường dẫn là tương đối
theo workspace và bị từ chối nếu tuyệt đối/thoát ra ngoài hoặc ghi vào `input/`.

### An toàn thực thi và không tự commit Git

- Kitchen/Pan chỉ tự chạy ở `DEV`/`TEST`; môi trường khác (kể cả `UNKNOWN`) cần
  xác nhận rõ ràng.
- Server không bao giờ thay đổi Git (không commit/push/amend); chỉ đọc trạng
  thái Git khi inspect.

## Đóng gói dạng npm (tùy chọn)

`package.json` đã khai báo `files: [src, docs, README.md]`, nên `npm pack` gói
đúng `src` (gồm knowledge) + docs. Không phát hành `node_modules`; máy đích tự
`npm install` hoặc nhận theo Cách 2.
