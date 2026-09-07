# Cấu hình

Tài liệu schema cho operator và maintainer. Nguồn sự thật: `src/workspace/boundary.js`, `src/server.js`, `src/runtime/detect.js`, `src/runtime/policy.js`, `src/tools/runtime.tools.js`.

## Biên workspace và fallback root

- `KETTLE_ROOT` là scope chia sẻ cho read/edit/validate/coverage. **Khi unset, mặc định là `process.cwd()`** và **luôn được enforce** — không có chế độ tắt biên.
- Chính sách chứa (canonical containment) do `src/workspace/boundary.js` (`createWorkspaceBoundary`) sở hữu và dùng chung cho mọi factory tool.
- Đường tương đối resolve theo root. Đường **tuyệt đối chỉ hợp lệ khi nằm trong root**.
- Từ chối mọi đường thoát root: `..`, sibling-prefix (ví dụ `C:\ws-other` khi root là `C:\ws`), và symlink/junction escape. So sánh containment không phân biệt hoa/thường trên Windows; ancestor đã tồn tại được canonical hóa trước khi so.

## Biến môi trường

| Biến | Ý nghĩa | Mặc định |
|------|---------|----------|
| `KETTLE_ROOT` | Scope + biên workspace cho read/edit/validate/coverage/runtime. Đường tương đối resolve tại đây; tuyệt đối chỉ hợp lệ khi trong root. Luôn được enforce. | `process.cwd()` |
| `PENTAHO_HOME` | Vị trí PDI cục bộ (chứa `Kitchen.bat`/`Pan.bat`) cho nhóm runtime tùy chọn. Tùy chọn cho tool tĩnh. | không đặt |
| `KETTLE_KNOWLEDGE_DIR` | Ghi đè knowledge base nhúng để nhiều checkout chia sẻ một cây canonical. | `src/knowledge/pentaho` đóng gói |

Không còn file cấu hình YAML theo project, biến môi trường tên môi trường, hay biến ghi đè tên thư mục docs/jobs. Server không tự phát hiện, tạo hay đổi tên thư mục con của project.

## Runtime tùy chọn: một root, dùng chung biên

Bốn tool `kettle_runtime_*` dùng đúng biên `KETTLE_ROOT` như các tool tĩnh. Không có tham số chọn project riêng cho từng lời gọi (không còn tham số workspace-root hay requirement-folder theo lời gọi).

- `artifact` resolve theo `KETTLE_ROOT` (tương đối, hoặc tuyệt đối nằm trong root); chỉ nhận `.kjb`/`.ktr`.
- `PENTAHO_HOME` là thiết lập vị trí PDI duy nhất. Bỏ trống → runtime báo không khả dụng, tool tĩnh vẫn chạy.
- Log đã khử được ghi lười (lazy) dưới `<KETTLE_ROOT>/.pentaho-mcp/runtime-logs/`. Nên thêm `.pentaho-mcp/` vào `.gitignore` của project (MCP không tự sửa `.gitignore`).

## Chính sách thực thi: luôn cần xác nhận

| Lời gọi | Kết quả |
|---------|---------|
| `kettle_runtime_execute` không `confirmed` | `CONFIRM_REQUIRED` (không spawn) |
| `kettle_runtime_execute` với `confirmed: true` | `ALLOW` |
| `kettle_runtime_loadcheck` | Không cần xác nhận thực thi; vẫn validation tĩnh trước |

Nguồn: `src/runtime/policy.js`. Không có tên môi trường nào bỏ qua bước xác nhận. `loadcheck`/`execute` luôn validation tĩnh trước; `STATIC_VALIDATION_FAILED` khi có structural error.

## Discovery PDI tùy chọn

- `PENTAHO_HOME` unset → `detectPdi` trả `{available: false, reason: PENTAHO_HOME is not configured}`.
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
      "env": {
        "KETTLE_ROOT": "C:/path/to/your/workspace",
        "PENTAHO_HOME": "C:/Pentaho/data-integration"
      }
    }
  }
}
```

`KETTLE_ROOT` là tùy chọn nhưng nên đặt khi không chắc thư mục làm việc của tiến trình MCP; nếu client khởi chạy server ngay trong project thì có thể chỉ cần `PENTAHO_HOME`. `PENTAHO_HOME` chỉ cần khi dùng nhóm runtime tùy chọn. Lưu rồi reconnect MCP trong Kiro; không cần restart Kiro.

## Đăng ký packaged executable

Sau `npm run build:release -- --version <semver>`, giải nén ZIP và chạy trong folder giải nén:

```powershell
.\install.ps1 -WorkspaceRoot C:\path\to\your\workspace -PentahoHome C:\Pentaho\data-integration
```

Lệnh ghi entry `dte-pentaho` (`command` là `.exe`, `args` rỗng, `env.KETTLE_ROOT` là workspace) sau khi backup JSON, giữ server khác, không bật auto-approve toàn bộ. `uninstall.ps1` chỉ xóa entry này.

## Lỗi biên thường gặp

| Lỗi | Nguyên nhân | Sửa |
|-----|-------------|-----|
| Đường ngoài `KETTLE_ROOT` bị từ chối | Absolute ngoài root, `..`, sibling-prefix, hoặc symlink/junction escape | Đưa target vào trong `KETTLE_ROOT` |
| Tuyệt đối bị từ chối | Đường tuyệt đối nhưng không nằm trong root | Dùng đường tương đối, hoặc tuyệt đối bên trong root |
| Runtime báo không khả dụng | `PENTAHO_HOME` chưa đặt hoặc trỏ sai | Đặt `PENTAHO_HOME` tới thư mục PDI chứa `Kitchen.bat`/`Pan.bat` |
