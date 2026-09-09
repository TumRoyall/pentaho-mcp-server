# Vận hành

Runbook cho operator. Nguồn sự thật: `packaging/doctor.ps1`, `scripts/*.mjs`, `src/runtime/*`, `src/workspace/boundary.js`.

## Mô hình triển khai

| Mô hình | Khi dùng | Runtime |
|---------|----------|---------|
| Windows `.exe` tự chứa | End user, máy offline | Không cần system Node; knowledge + companion skill kèm theo |
| Source-mode Node 20+ | Developer, CI | `npm install`; knowledge từ repo |

Cả hai đều tôn trọng `KETTLE_ROOT` (mặc định `process.cwd()`, luôn enforce); hành vi tool đồng nhất.

## Xác minh cài đặt

Bản packaged, chạy từ thư mục đã giải nén ZIP:

```powershell
.\doctor.ps1 -PentahoHome C:\Pentaho\data-integration
```

Source-mode, chạy từ repo root:

```powershell
node scripts/verify-production-profile.mjs
```

`doctor.ps1` bắt tay MCP bằng **initialize + tools/list** (không kiểm prompt/resource), assert đúng **26 tool** và từ chối mọi tool `pentaho_*` (lifecycle legacy không được đăng ký). Kỳ vọng profile: `production profile OK: 26 tools (exact set), no lifecycle prompt/resource surface, no learning/promotion surface`.

Kiểm tra handshake thủ công: `tools/list` phải có `kettle_add_error_hop`, 4 `kettle_runtime_*`, và 4 tool artifact/removal mới (`kettle_set_parameters`, `kettle_copy_connection`, `kettle_remove_element`, `kettle_edit_error_hop`), tổng 26 tool, và **không** có tool `pentaho_*` nào; MCP không quảng bá prompt/resource.

## Companion skill

Bản packaged kèm companion skill dưới `skills/developing-pentaho-jobs/` (gồm `SKILL.md` và hai mẫu `references/pentaho-spec-template.md`, `references/pentaho-plan-template.md`). **Việc phát hiện skill không tự động chỉ vì thư mục `skills/` có trong bản giải nén.**

| Client | Project scope | User scope |
|---|---|---|
| Kiro | `.kiro/skills/developing-pentaho-jobs/` | `%USERPROFILE%/.kiro/skills/developing-pentaho-jobs/` |
| Claude Code | `.claude/skills/developing-pentaho-jobs/` | `%USERPROFILE%/.claude/skills/developing-pentaho-jobs/` |
| Codex | `.agents/skills/developing-pentaho-jobs/` | `%USERPROFILE%/.agents/skills/developing-pentaho-jobs/` |

Ở source-mode, skill nằm ngay tại `skills/` trong repo; vẫn cần copy vào vị trí skills của client như trên để client khám phá được.

## Nâng cấp/rollback

- Nâng cấp: giải nén ZIP mới ra thư mục ổn định mới, sửa đường dẫn `command` của `dte-pentaho` trong cấu hình client đang dùng sang `.exe` mới, kiểm tra bằng `doctor.ps1`, sau đó giữ lại hoặc xóa thư mục cũ.
- Rollback: khôi phục đường dẫn executable cũ trong cùng cấu hình client.

## `doctor.ps1`

Thoát nonzero khi executable bị thiếu hoặc MCP handshake không hợp lệ; báo PDI riêng (runtime phase-gated, thiếu PDI không fail). Đây là kiểm tra độc lập executable và MCP handshake, không đọc cấu hình Kiro/Claude Code/Codex và không kiểm tra `KETTLE_ROOT`. Dùng sau khi build/giải nén hoặc trước khi đổi đường dẫn executable trong cấu hình client; kiểm tra kết nối của từng client theo `docs/install.md`.

## Log và khử nhạy cảm (runtime phase-gated)

- Runtime log khử nhạy cảm nằm trong `runtime-logs/` (`<timestamp>-<kind>-<mode>.log`), gồm status/exitCode/signal + STDOUT/STDERR (mỗi luồng bị chặn 256 KiB bằng tail buffer ngay khi streaming) và redact credential/tham số nhạy cảm. Đọc bằng `kettle_runtime_logs`.
- Thư mục log giữ **100 file mới nhất** sau mỗi lần chạy (retention theo số lượng); file cũ hơn bị xóa.
- `kettle_runtime_logs` nhận `name` (tùy chọn) và `limit` (1..100), trả **mới nhất trước**, tối đa **256 KiB mỗi file**, kiểm chứa canonical từng file (từ chối tên thoát khỏi thư mục log).
- Server log stderr (`kettle-mcp-dte running on stdio ...`); tool failure là payload `{ok:false}` trong `text`, không phải protocol error.
- Runtime log ghi dưới `<KETTLE_ROOT>/.pentaho-mcp/`; thư mục `.pentaho-mcp/` đã nằm trong `.gitignore` nên không lọt vào commit.

## CI và bao bì phát hành

- CI (`.github/workflows/ci.yml`) chạy trên `windows-latest`: job `test` với matrix Node `[20, 22]` (`npm ci` → `npm test` → `npm run verify:profile` → `git diff --check`), job `package` (Node 20) build release `0.0.0-ci` và upload `dist/**` làm artifact.
- Bản phát hành npm chỉ gồm `src`, `skills`, `README.md` và các file `docs/*.md` hiện hành; tài liệu lịch sử của coordinator dưới `docs/superpowers/` (plan/spec/handoff) **không** được đóng gói lên npm.

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

## Biên filesystem

- Ghi/đọc giới hạn trong `KETTLE_ROOT` (mặc định `process.cwd()`, luôn enforce) qua `src/workspace/boundary.js`; chặn absolute ngoài root, `..`, sibling-prefix, symlink/junction escape.

## Gỡ cài đặt

Xóa mục/bảng `dte-pentaho` khỏi cấu hình client đang dùng và tùy chọn xóa thư mục companion-skill đã copy; giữ các server khác và workspace.

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
