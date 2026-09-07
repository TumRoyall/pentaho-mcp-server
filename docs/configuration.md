# Cấu hình

Tài liệu schema cho operator và maintainer. Nguồn sự thật: `src/project/config.js`, `src/project/paths.js`, `src/server.js`, `src/runtime/detect.js`, `src/runtime/policy.js`.

## Thứ tự ưu tiên cấu hình

1. Biến môi trường (`KETTLE_ROOT`, `KETTLE_KNOWLEDGE_DIR`).
2. `.pentaho-mcp.yaml` đã commit tại workspace root (đường dẫn project, environment, PDI home).
3. Giá trị mặc định trong code (`environment` → `UNKNOWN`, knowledge → `src/knowledge/pentaho` nhúng).

Đường dẫn tool tương đối resolve theo `KETTLE_ROOT` (xem `src/server.js:26-30`); đường dẫn project resolve theo `.pentaho-mcp.yaml`.

## Biến môi trường

| Biến | Ý nghĩa | Mặc định |
|------|---------|----------|
| `KETTLE_ROOT` | Scope mặc định cho list/search/validate và biên ghi cho edit tool. Đường tương đối resolve tại đây. Luôn nên đặt; khi unset, biên ghi tắt. | `process.cwd()` |
| `KETTLE_KNOWLEDGE_DIR` | Ghi đè knowledge base nhúng để nhiều checkout chia sẻ một cây canonical. | `src/knowledge/pentaho` đóng gói |

## Schema `.pentaho-mcp.yaml`

- File duy nhất: `<workspace>/.pentaho-mcp.yaml`. Thiếu file → `Missing .pentaho-mcp.yaml`.
- `schema_version` phải là `1` (số, không phải chuỗi).
- Top-level chỉ cho phép: `schema_version`, `project`, `paths`, `environment`, `pentaho`. Key lạ → `Unknown top-level key`.
- `project.code`: chuỗi không rỗng, bắt buộc.
- `paths.requirements`, `paths.pentaho`: bắt buộc, chuỗi tương đối; `paths.ai_context`: tùy chọn.
- `environment`: **mapping** với key tùy chọn `name` (không phải scalar). Vắng → `UNKNOWN`. Chuẩn hóa trim + uppercase.
- `pentaho.home`: tùy chọn; tuyệt đối giữ nguyên, tương đối resolve theo workspace root.

## Ví dụ đầy đủ có chú thích

```yaml
schema_version: 1

project:
  # Mã project ngắn, dùng trong tên artifact và báo cáo.
  code: EXAMPLE

paths:
  # Thư mục chứa các folder BA REQ_<ID>_<UPPER_SNAKE>.
  requirements: docs
  # Thư mục chứa Pentaho project sinh ra (.kjb/.ktr và file kèm).
  pentaho: etl-pentaho
  # Tùy chọn: folder AI-context/skills chung nếu workspace có.
  # ai_context: ai-context

# Môi trường triển khai. DEV và TEST cho Kitchen/Pan tự chạy;
# mọi giá trị khác (kể cả UNKNOWN) yêu cầu xác nhận rõ ràng.
environment:
  name: UNKNOWN

pentaho:
  # Tùy chọn: PDI cục bộ (Kitchen.bat/Pan.bat nằm dưới nó).
  # Bỏ trống khi không cài runtime — validation và generation vẫn chạy.
  # home: pentaho-ce/data-integration
```

Sao chép thành `<workspace>\.pentaho-mcp.yaml` rồi chỉnh `code`, `paths`, `environment.name`, `pentaho.home` cho project của bạn.

## Quy tắc resolve đường dẫn

- Mọi `paths.*` phải tương đối workspace. Tuyệt đối hoặc `..` thoát workspace → từ chối (`paths.* must be workspace-relative`, `resolves outside the workspace`).
- So sánh containment không phân biệt hoa/thường trên Windows; ancestor đã tồn tại được `realpathSync` trước khi so.
- `resolveProjectPath(config, key, ...segments)` chặn target thoát root (`Path resolves outside configured <key> root`).

## Biên đọc/ghi

- Root ghi hợp lệ: `paths.requirements` và `paths.pentaho`. Ngoài hai root → `Path is outside configured project roots`.
- Ghi dưới mọi subtree `<REQ>/input` → `BA input is read-only`. Chỉ Markdown (`.md`) dưới `input/` được coi là evidence; file khác bị liệt `unsupported` và chặn workflow (`UNSUPPORTED_INPUT`).
- Thư mục yêu cầu phải là con trực tiếp, tên `REQ_<ID>_<UPPER_SNAKE_CASE_SLUG>`; sai tên → từ chối.

## Chính sách thực thi theo environment

| `environment.name` | `kettle_runtime_execute` không `confirmed` | Với `confirmed: true` |
|--------------------|--------------------------------------------|------------------------|
| `DEV`, `TEST` | `ALLOW` (tự chạy) | `ALLOW` |
| Mọi giá trị khác, gồm `UNKNOWN`, `PROD` | `CONFIRM_REQUIRED` | `ALLOW` |

Nguồn: `src/runtime/policy.js`. `loadcheck`/`execute` luôn validation tĩnh trước; `STATIC_VALIDATION_FAILED` khi có structural error.

## Discovery PDI tùy chọn

- `pentaho.home` unset → `detectPdi` trả `{available: false, reason: pentaho.home is not configured}`.
- Home không tồn tại → throw `Configured PDI home not found`.
- Resolve `Kitchen.bat`/`Pan.bat` dưới home; ngoài home → throw; thiếu một trong hai → `available: false`.
- Không có PDI vẫn dùng được read/edit/validate/generation tri thức tĩnh; `runPdi` trả `UNAVAILABLE` thay vì fail toàn cục.

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

## Lỗi validation thường gặp

| Lỗi | Nguyên nhân | Sửa |
|-----|-------------|-----|
| `Missing .pentaho-mcp.yaml` | Thiếu file ở root | Copy từ `packaging/config.example.yaml` |
| `schema_version must be 1` | Sai version/kiểu | Đặt `schema_version: 1` |
| `Unknown top-level key` | Key lạ | Chỉ giữ 5 key cho phép |
| `environment must be a YAML mapping` | Ghi `environment: UNKNOWN` scalar | Đổi thành `environment:\n  name: UNKNOWN` |
| `paths.* must be workspace-relative` | Đường tuyệt đối | Đổi thành tương đối |
| `resolves outside the workspace` | `..` thoát root | Đưa vào trong workspace |
| `BA input is read-only` | Ghi vào `input/` | Ghi ra ngoài `input/` |
| `Requirement folder must be ...` | Sai tên/vị trí folder | Đặt `REQ_<ID>_<UPPER_SNAKE>` con trực tiếp |
