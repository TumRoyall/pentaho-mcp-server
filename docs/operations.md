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
.\doctor.ps1 -WorkspaceRoot C:\path\to\your\workspace
node scripts/verify-production-profile.mjs
```

`doctor.ps1` bắt tay MCP bằng **initialize + tools/list** (không kiểm prompt/resource), assert đúng **22 tool** và từ chối mọi tool `pentaho_*` (lifecycle legacy không được đăng ký). Kỳ vọng profile: `production profile OK: 22 tools, no lifecycle prompt/resource surface, no learning/promotion surface`.

Kiểm tra handshake thủ công: `tools/list` phải có `kettle_add_error_hop` và 4 `kettle_runtime_*`, tổng 22 tool, và **không** có tool `pentaho_*` nào; MCP không quảng bá prompt/resource.

## Companion skill

Bản packaged kèm companion skill dưới `skills/developing-pentaho-jobs/` (gồm `SKILL.md` và `references/pentaho-spec-template.md`). Một agent tương thích Superpowers phát hiện skill bằng cách quét thư mục `skills/` trong bản giải nén. Ở source-mode, skill nằm ngay tại `skills/` trong repo.

## Nâng cấp/rollback

- Nâng cấp: giải nén ZIP mới ra folder mới, chạy `install.ps1` (chỉ ghi đè entry `dte-pentaho`), giữ folder cũ tới khi `doctor.ps1` OK trên bản mới.
- Rollback: chạy `install.ps1` từ folder cũ (trỏ lại `.exe` cũ), reconnect MCP.

## `doctor.ps1`

Thoát nonzero khi install/handshake invalid; báo PDI riêng (runtime đã hoãn, thiếu PDI không fail). Dùng sau mỗi cài đặt, nâng cấp, đổi `KETTLE_ROOT`.

## Log và khử nhạy cảm (runtime đã hoãn)

- Runtime log khử nhạy cảm nằm trong `runtime-logs/` (`<timestamp>-<kind>-<mode>.log`), gồm status/exitCode/signal + STDOUT/STDERR đã cắt 256KB và redact credential/tham số nhạy cảm. Đọc bằng `kettle_runtime_logs`.
- Server log stderr (`kettle-mcp-dte running on stdio ...`); tool failure là payload `{ok:false}` trong `text`, không phải protocol error.

## Timeout và xác nhận thực thi (runtime đã hoãn)

- `timeoutMs` mặc định 120s, tối thiểu 1ms; timeout → `TIMEOUT` + SIGTERM, log vẫn lưu.
- `DEV`/`TEST` tự chạy; mọi môi trường khác (kể cả `UNKNOWN`) cần `confirmed: true`, nếu không trả `CONFIRM_REQUIRED` mà không chạm PDI.
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
| Thiếu `.pentaho-mcp.yaml` khi gọi runtime | Chỉ cần cho nhóm runtime đã hoãn; tạo file runtime-only tối thiểu |

Chi tiết biên xem `docs/configuration.md`.

## Thiếu PDI (runtime đã hoãn)

`kettle_runtime_detect` trả `available: false` + reason. Tính năng lõi (read/edit/validate/knowledge) vẫn chạy; `loadcheck`/`execute` trả `UNAVAILABLE`. Cài PDI rồi đặt `pentaho.home` trỏ thư mục chứa `Kitchen.bat`/`Pan.bat`.

## Triage sự cố

1. `doctor.ps1` fail handshake → kiểm tra `.exe` bị chặn, `mcp.json` trỏ đúng path, reconnect MCP.
2. Tool trả `{ok:false}` → đọc `error`: đường ngoài `KETTLE_ROOT` / validation fail → sửa path hoặc artifact.
3. Runtime `FAIL`/`TIMEOUT` (đã hoãn) → `kettle_runtime_logs` xem log khử; kiểm tra `environment`/`confirmed`, `timeoutMs`, PDI home, structural validation.
4. Giữ `git status --short` sạch khỏi artifact tạm; server không bao giờ commit/push.
