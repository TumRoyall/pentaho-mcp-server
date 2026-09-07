# Cấu hình

Tài liệu schema cho operator và maintainer. Nguồn sự thật: `src/workspace/boundary.js`, `src/server.js`, `src/project/config.js` (chỉ còn liên quan runtime tùy chọn/hoãn), `src/runtime/detect.js`, `src/runtime/policy.js`.

## Biên workspace và fallback root

- `KETTLE_ROOT` là scope chia sẻ cho read/edit/validate/coverage. **Khi unset, mặc định là `process.cwd()`** và **luôn được enforce** — không có chế độ tắt biên.
- Chính sách chứa (canonical containment) do `src/workspace/boundary.js` (`createWorkspaceBoundary`) sở hữu và dùng chung cho mọi factory tool.
- Đường tương đối resolve theo root. Đường **tuyệt đối chỉ hợp lệ khi nằm trong root**.
- Từ chối mọi đường thoát root: `..`, sibling-prefix (ví dụ `C:\ws-other` khi root là `C:\ws`), và symlink/junction escape. So sánh containment không phân biệt hoa/thường trên Windows; ancestor đã tồn tại được canonical hóa trước khi so.

## Biến môi trường

| Biến | Ý nghĩa | Mặc định |
|------|---------|----------|
| `KETTLE_ROOT` | Scope + biên workspace cho read/edit/validate/coverage. Đường tương đối resolve tại đây; tuyệt đối chỉ hợp lệ khi trong root. Luôn được enforce. | `process.cwd()` |
| `KETTLE_KNOWLEDGE_DIR` | Ghi đè knowledge base nhúng để nhiều checkout chia sẻ một cây canonical. | `src/knowledge/pentaho` đóng gói |

## Runtime tùy chọn/đã hoãn: `.pentaho-mcp.yaml`

> **Cảnh báo:** Đợt refactor runtime **đã hoãn**. File `.pentaho-mcp.yaml` **chỉ còn ý nghĩa với các tool runtime tùy chọn/đã hoãn** (`kettle_runtime_*`). Nó không tham gia workflow idea-to-static-job và không ảnh hưởng read/edit/validate/knowledge.

Khi bạn thực sự dùng nhóm runtime đã hoãn, file cấu hình runtime-only tuân theo schema sau:

- File duy nhất: `<workspace>/.pentaho-mcp.yaml`. Thiếu file → `Missing .pentaho-mcp.yaml`.
- `schema_version` phải là `1` (số, không phải chuỗi).
- `environment`: **mapping** với key tùy chọn `name`. Vắng → `UNKNOWN`. Chuẩn hóa trim + uppercase. Điều khiển chính sách thực thi `DEV`/`TEST`.
- `pentaho.home`: tùy chọn; tuyệt đối giữ nguyên, tương đối resolve theo workspace root. Nơi chứa `Kitchen.bat`/`Pan.bat`.

```yaml
schema_version: 1
environment:
  # DEV và TEST cho Kitchen/Pan tự chạy; mọi giá trị khác (kể cả UNKNOWN) cần confirmed: true.
  name: UNKNOWN
pentaho:
  # Tùy chọn: PDI cục bộ (Kitchen.bat/Pan.bat nằm dưới nó). Bỏ trống khi không cài runtime.
  # home: pentaho-ce/data-integration
```

> Nội dung requirement-folder (`REQ_<ID>_<UPPER_SNAKE>`), biên ghi `input/`, `paths.requirements`/`paths.pentaho` thuộc về **bề mặt lifecycle legacy đã gỡ đăng ký** và **không** còn là chính sách production. Nếu gặp nó trong workspace cũ, coi là legacy runtime-only, không phải hành vi hiện tại của biên workspace chung.

## Chính sách thực thi theo environment (runtime đã hoãn)

| `environment.name` | `kettle_runtime_execute` không `confirmed` | Với `confirmed: true` |
|--------------------|--------------------------------------------|------------------------|
| `DEV`, `TEST` | `ALLOW` (tự chạy) | `ALLOW` |
| Mọi giá trị khác, gồm `UNKNOWN`, `PROD` | `CONFIRM_REQUIRED` | `ALLOW` |

Nguồn: `src/runtime/policy.js`. `loadcheck`/`execute` luôn validation tĩnh trước; `STATIC_VALIDATION_FAILED` khi có structural error.

## Discovery PDI tùy chọn (runtime đã hoãn)

- `pentaho.home` unset → `detectPdi` trả `{available: false, reason: pentaho.home is not configured}`.
- Home không tồn tại → throw `Configured PDI home not found`.
- Resolve `Kitchen.bat`/`Pan.bat` dưới home; ngoài home → throw; thiếu một trong hai → `available: false`.
- Không có PDI vẫn dùng được đầy đủ read/edit/validate/knowledge; `runPdi` trả `UNAVAILABLE` thay vì fail toàn cục.

## Đăng ký source-mode

`%USERPROFILE%\.kiro\settings\mcp.json`:

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

## Đăng ký packaged executable

Sau `npm run build:release -- --version <semver>`, giải nén ZIP và chạy trong folder giải nén:

```powershell
.\install.ps1 -WorkspaceRoot C:\path\to\your\workspace
```

Lệnh ghi entry `dte-pentaho` (`command` là `.exe`, `args` rỗng, `env.KETTLE_ROOT` là workspace) sau khi backup JSON, giữ server khác, không bật auto-approve toàn bộ. `uninstall.ps1` chỉ xóa entry này.

## Lỗi biên thường gặp

| Lỗi | Nguyên nhân | Sửa |
|-----|-------------|-----|
| Đường ngoài `KETTLE_ROOT` bị từ chối | Absolute ngoài root, `..`, sibling-prefix, hoặc symlink/junction escape | Đưa target vào trong `KETTLE_ROOT` |
| Tuyệt đối bị từ chối | Đường tuyệt đối nhưng không nằm trong root | Dùng đường tương đối, hoặc tuyệt đối bên trong root |
| `Missing .pentaho-mcp.yaml` (chỉ runtime đã hoãn) | Thiếu file khi gọi tool runtime | Chỉ cần khi dùng runtime; tạo file runtime-only tối thiểu |
