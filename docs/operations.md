# Vận hành

Runbook cho operator. Nguồn sự thật: `packaging/*.ps1`, `scripts/*.mjs`, `src/runtime/*`, `src/workspace/boundary.js`.

## Mô hình triển khai

| Mô hình | Khi dùng | Runtime |
|---------|----------|---------|
| Windows `.exe` tự chứa | End user, máy offline | Không cần system Node; knowledge + companion skill kèm theo |
| Source-mode Node 20+ | Developer, CI | `npm install`; knowledge từ repo |

Cả hai đều tôn trọng `KETTLE_ROOT` (mặc định `process.cwd()`, luôn enforce); hành vi tool đồng nhất.

## Xác minh cài đặt

```powershell
.\doctor.ps1 -PentahoHome C:\Pentaho\data-integration
node scripts/verify-production-profile.mjs
```

`doctor.ps1` bắt tay MCP bằng **initialize + tools/list** (không kiểm prompt/resource), assert đúng **22 tool** và từ chối mọi tool `pentaho_*` (lifecycle legacy không được đăng ký). Kỳ vọng profile: `production profile OK: 22 tools, no lifecycle prompt/resource surface, no learning/promotion surface`.

Kiểm tra handshake thủ công: `tools/list` phải có `kettle_add_error_hop` và 4 `kettle_runtime_*`, tổng 22 tool, và **không** có tool `pentaho_*` nào; MCP không quảng bá prompt/resource.

## Companion skill

Bản packaged kèm companion skill dưới `skills/developing-pentaho-jobs/` (gồm `SKILL.md` và hai mẫu `references/pentaho-spec-template.md`, `references/pentaho-plan-template.md`). **Việc phát hiện skill không tự động chỉ vì thư mục `skills/` có trong bản giải nén.** Cách nạp cho từng client:

- **Kiro:** copy `skills/developing-pentaho-jobs/` vào `.kiro/skills/` của workspace (hoặc `~/.kiro/skills/` cho phạm vi user).
- **Codex / agent tương thích Superpowers:** đặt skill dưới thư mục skills của runtime (ví dụ `~/.agents/skills/`) theo tài liệu client.

Ở source-mode, skill nằm ngay tại `skills/` trong repo; vẫn cần copy vào vị trí skills của client như trên để client khám phá được.

## Nâng cấp/rollback

- Nâng cấp: giải nén ZIP mới ra folder mới, chạy `install.ps1` (chỉ ghi đè entry `dte-pentaho`), giữ folder cũ tới khi `doctor.ps1` OK trên bản mới.
- Rollback: chạy `install.ps1` từ folder cũ (trỏ lại `.exe` cũ), reconnect MCP.

## `doctor.ps1`

Thoát nonzero khi install/handshake invalid; báo PDI riêng (runtime phase-gated, thiếu PDI không fail). Dùng sau mỗi cài đặt, nâng cấp, đổi `KETTLE_ROOT`.

## Log và khử nhạy cảm (runtime phase-gated)

- Runtime log khử nhạy cảm nằm trong `runtime-logs/` (`<timestamp>-<kind>-<mode>.log`), gồm status/exitCode/signal + STDOUT/STDERR (mỗi luồng bị chặn 256 KiB bằng tail buffer ngay khi streaming) và redact credential/tham số nhạy cảm. Đọc bằng `kettle_runtime_logs`.
- Thư mục log giữ **100 file mới nhất** sau mỗi lần chạy (retention theo số lượng); file cũ hơn bị xóa.
- `kettle_runtime_logs` nhận `name` (tùy chọn) và `limit` (1..100), trả **mới nhất trước**, tối đa **256 KiB mỗi file**, kiểm chứa canonical từng file (từ chối tên thoát khỏi thư mục log).
- Server log stderr (`kettle-mcp-dte running on stdio ...`); tool failure là payload `{ok:false}` trong `text`, không phải protocol error.

## Cổng thực thi, timeout và xác nhận (runtime phase-gated)

- Thực thi cần **cả hai**: `PENTAHO_ENABLE_EXECUTE=1` ở môi trường server **và** `confirmed: true` trên lời gọi.
  - Server không đặt `PENTAHO_ENABLE_EXECUTE=1` → `EXECUTE_DISABLED`, trả về **trước khi** detect/spawn (không chạm PDI).
  - Bật server nhưng thiếu `confirmed` → `CONFIRM_REQUIRED`, cũng không spawn.
  - `PENTAHO_ENABLE_EXECUTE=1` + `confirmed: true` → `ALLOW`.
  - Không có auto theo tên môi trường (không `DEV`/`TEST`/`UNKNOWN`).
- `timeoutMs` mặc định 120s, tối thiểu 1ms; timeout → `TIMEOUT` và hạ **cả cây tiến trình**: Windows chạy `taskkill.exe /PID <pid> /T /F` (`shell:false`); nền tảng khác `SIGTERM` rồi `SIGKILL` sau ân hạn. Log vẫn lưu.
- Trên Windows, launcher `.bat`/`.cmd` chạy qua shell; mọi token bị kiểm chống metacharacter (`" & | < > ^ % !`, CR/LF/NUL) và tên tham số phải là identifier trước khi spawn.
- Runtime là bước verification phase-gated: chỉ dùng sau validation tĩnh; `execute` còn cần user duyệt riêng cho lần chạy đó.
- `loadcheck`/`execute` luôn validation tĩnh trước; structural error → `STATIC_VALIDATION_FAILED`.

## Biên filesystem và backup

- Ghi/đọc giới hạn trong `KETTLE_ROOT` (mặc định `process.cwd()`, luôn enforce) qua `src/workspace/boundary.js`; chặn absolute ngoài root, `..`, sibling-prefix, symlink/junction escape.
- `install.ps1` backup `%USERPROFILE%\.kiro\settings\mcp.json` thành `mcp.json.bak-<timestamp>` trước khi ghi, giữ server khác.

## Gỡ cài đặt

`.\uninstall.ps1` chỉ xóa entry `dte-pentaho`; giữ các server khác và workspace.

## SmartScreen/AV

`.exe` mới có thể bị SmartScreen/AV chặn → handshake fail. Unblock file (Properties → Unblock), retry `doctor.ps1`. Không tắt AV toàn cục.

## Lỗi biên workspace

| Triệu chứng | Xử lý |
|-------------|-------|
| Đường ngoài `KETTLE_ROOT` bị từ chối | Đưa target vào trong root; tránh `..`, sibling-prefix, symlink/junction escape |
| Tuyệt đối bị từ chối | Dùng tương đối, hoặc tuyệt đối bên trong root |
| Runtime báo không khả dụng | Đặt `PENTAHO_HOME` trỏ thư mục PDI chứa `Kitchen.bat`/`Pan.bat` |

Chi tiết biên xem `docs/configuration.md`.

## Thiếu PDI (runtime tùy chọn)

`kettle_runtime_detect` trả `available: false` + reason. Tính năng lõi (read/edit/validate/knowledge) vẫn chạy; `loadcheck`/`execute` trả `UNAVAILABLE`. Cài PDI rồi đặt `PENTAHO_HOME` trỏ thư mục chứa `Kitchen.bat`/`Pan.bat`.

## Triage sự cố

1. `doctor.ps1` fail handshake → kiểm tra `.exe` bị chặn, `mcp.json` trỏ đúng path, reconnect MCP.
2. Tool trả `{ok:false}` → đọc `error`: đường ngoài `KETTLE_ROOT` / validation fail → sửa path hoặc artifact.
3. Runtime `FAIL`/`TIMEOUT` (tùy chọn) → `kettle_runtime_logs` xem log khử dưới `<KETTLE_ROOT>/.pentaho-mcp/runtime-logs/`; kiểm tra `PENTAHO_ENABLE_EXECUTE`, `confirmed`, `timeoutMs`, `PENTAHO_HOME`, structural validation. `EXECUTE_DISABLED` = server chưa opt-in; `CONFIRM_REQUIRED` = thiếu `confirmed`.
4. Giữ `git status --short` sạch khỏi artifact tạm; server không bao giờ commit/push.
