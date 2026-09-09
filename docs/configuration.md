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
| `PENTAHO_ENABLE_EXECUTE` | Cổng opt-in phía server cho thực thi. Chỉ giá trị đúng `1` mới bật; mọi giá trị khác (kể cả `true`, `0`, unset) đều tắt. | không đặt (tắt) |
| `KETTLE_KNOWLEDGE_DIR` | Ghi đè knowledge base nhúng để nhiều checkout chia sẻ một cây canonical. | `src/knowledge/pentaho` đóng gói |

Không còn file cấu hình YAML theo project, biến môi trường tên môi trường, hay biến ghi đè tên thư mục docs/jobs. Server không tự phát hiện, tạo hay đổi tên thư mục con của project.

## Runtime tùy chọn: một root, dùng chung biên

Bốn tool `kettle_runtime_*` dùng đúng biên `KETTLE_ROOT` như các tool tĩnh. Không có tham số chọn project riêng cho từng lời gọi (không còn tham số workspace-root hay requirement-folder theo lời gọi).

- `artifact` resolve theo `KETTLE_ROOT` (tương đối, hoặc tuyệt đối nằm trong root); chỉ nhận `.kjb`/`.ktr`.
- `PENTAHO_HOME` là thiết lập vị trí PDI duy nhất. Bỏ trống → runtime báo không khả dụng, tool tĩnh vẫn chạy.
- Log đã khử được ghi lười (lazy) dưới `<KETTLE_ROOT>/.pentaho-mcp/runtime-logs/`. Nên thêm `.pentaho-mcp/` vào `.gitignore` của project (MCP không tự sửa `.gitignore`).
- Sau mỗi lần chạy, thư mục log giữ **100 file `.log` mới nhất**; file cũ hơn bị xóa (retention theo số lượng).

## Chính sách thực thi: cần cả opt-in server và xác nhận từng lời gọi

Thực thi yêu cầu **hai lớp độc lập**: operator bật `PENTAHO_ENABLE_EXECUTE=1` ở môi trường server, và mỗi lời gọi phải khẳng định `confirmed: true`. `confirmed` chỉ là khẳng định của caller, không phải bằng chứng có người phê duyệt — vô nghĩa nếu thiếu opt-in phía server.

| Server (`PENTAHO_ENABLE_EXECUTE`) | Lời gọi | Kết quả |
|-----------------------------------|---------|---------|
| khác `1` (unset/`0`/`true`...) | bất kỳ | `EXECUTE_DISABLED` (không detect, không spawn) |
| `1` | không `confirmed` | `CONFIRM_REQUIRED` (không spawn) |
| `1` | `confirmed: true` | `ALLOW` |

`kettle_runtime_loadcheck` không cần opt-in/xác nhận thực thi nhưng vẫn validation tĩnh trước.

Nguồn: `src/runtime/policy.js` (`executionPolicy({confirmed, executeEnabled})`), cổng server ở `src/server.js` (`executeEnabled: process.env.PENTAHO_ENABLE_EXECUTE === '1'`). `loadcheck`/`execute` luôn validation tĩnh trước; `STATIC_VALIDATION_FAILED` khi có structural error.

## An toàn khi spawn và output bị chặn kích thước

- **Kiểm token Windows:** khi launcher là `.bat`/`.cmd`, mọi token (command, `/file:`, `/param:name=value`) bị từ chối nếu chứa CR, LF, NUL, `"`, `&`, `|`, `<`, `>`, `^`, `%`, hoặc `!` trước khi spawn. Khoảng trắng, dấu phẩy, dấu hai chấm ổ đĩa, dấu phân tách đường dẫn, `=`, dấu chấm, gạch nối, gạch dưới vẫn hợp lệ. Tên tham số phải khớp `^[A-Za-z_][A-Za-z0-9_.-]*$`. Nguồn: `src/runtime/windows-args.js`.
- **Output có chặn:** stdout/stderr dùng tail buffer cố định **256 KiB mỗi luồng** ngay khi dữ liệu đến (không bao giờ tích lũy chuỗi không giới hạn rồi mới cắt). Phần được giữ là phần **đuôi** (mới nhất). Nguồn: `src/runtime/tail-buffer.js`.
- **Timeout theo cây tiến trình:** khi hết `timeoutMs`, trên Windows chạy `taskkill.exe /PID <pid> /T /F` (`shell:false`) để hạ cả cây tiến trình JVM; trên nền tảng khác gửi `SIGTERM`, chờ ân hạn ngắn rồi `SIGKILL`. Kết quả trả `TIMEOUT`. Nguồn: `src/runtime/run.js`.
- **Đọc log có chặn:** `kettle_runtime_logs` nhận `name` (tùy chọn) và `limit` (1..100), trả **mới nhất trước**, tối đa **256 KiB mỗi file**, kiểm chứa canonical cho từng file (từ chối tên thoát khỏi thư mục log).

## Discovery PDI tùy chọn

- `PENTAHO_HOME` unset → `detectPdi` trả `{available: false, reason: PENTAHO_HOME is not configured}`.
- Home không tồn tại → throw `Configured PDI home not found`.
- Resolve `Kitchen.bat`/`Pan.bat` dưới home; ngoài home → throw; thiếu một trong hai → `available: false`. Sau kiểm tồn tại, launcher được canonical hóa bằng `realpathSync` và kiểm lại vẫn nằm trong home canonical (chống symlink/junction thoát ra ngoài).
- Không có PDI vẫn dùng được đầy đủ read/edit/validate/knowledge; `runPdi` trả `UNAVAILABLE` thay vì fail toàn cục.

## Mô hình đăng ký client dùng chung

Mọi client đều dùng chung mô hình command/args/env cho server `dte-pentaho`:

- `command` là đường dẫn tuyệt đối `dte-pentaho-mcp.exe` (bản packaged) hoặc `node` (source-mode).
- `args` rỗng cho bản packaged, hoặc một phần tử là đường dẫn tuyệt đối `src/index.js` cho source-mode.
- `env` luôn nên đặt `KETTLE_ROOT`; `PENTAHO_HOME` và `PENTAHO_ENABLE_EXECUTE` là tùy chọn.

Ví dụ chính xác cho từng client xem `docs/install.md`: Kiro (`.kiro/settings/mcp.json`), Claude Code (`.mcp.json` tại project root), Codex (`.codex/config.toml`).

`KETTLE_ROOT` là tùy chọn nhưng nên đặt khi không chắc thư mục làm việc của tiến trình MCP; nếu client khởi chạy server ngay trong project thì có thể chỉ cần `PENTAHO_HOME`. `PENTAHO_HOME` chỉ cần khi dùng nhóm runtime tùy chọn. `PENTAHO_ENABLE_EXECUTE` cũng tùy chọn: **chỉ đặt `"1"` khi muốn cho phép thực thi thật**; bỏ hẳn để chặn (`EXECUTE_DISABLED`).

## Lỗi biên thường gặp

| Lỗi | Nguyên nhân | Sửa |
|-----|-------------|-----|
| Đường ngoài `KETTLE_ROOT` bị từ chối | Absolute ngoài root, `..`, sibling-prefix, hoặc symlink/junction escape | Đưa target vào trong `KETTLE_ROOT` |
| Tuyệt đối bị từ chối | Đường tuyệt đối nhưng không nằm trong root | Dùng đường tương đối, hoặc tuyệt đối bên trong root |
| Runtime báo không khả dụng | `PENTAHO_HOME` chưa đặt hoặc trỏ sai | Đặt `PENTAHO_HOME` tới thư mục PDI chứa `Kitchen.bat`/`Pan.bat` |
