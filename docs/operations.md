# Vận hành

Runbook cho operator. Nguồn sự thật: `packaging/*.ps1`, `scripts/*.mjs`, `src/runtime/*`, `src/project/*`.

## Mô hình triển khai

| Mô hình | Khi dùng | Runtime |
|---------|----------|---------|
| Windows `.exe` tự chứa | End user, máy offline | Không cần system Node; knowledge/lifecycle nhúng |
| Source-mode Node 20+ | Developer, CI | `npm install`; knowledge từ repo |

Cả hai đều đọc `.pentaho-mcp.yaml` và `KETTLE_ROOT`; hành vi tool đồng nhất.

## Xác minh cài đặt

```powershell
.\doctor.ps1 -WorkspaceRoot C:\path\to\your\workspace
node scripts/verify-production-profile.mjs
```

`doctor.ps1` bắt tay MCP (initialize/tools/prompts/resources), validate `.pentaho-mcp.yaml`, dò PDI tùy chọn. Thiếu PDI chỉ báo riêng, không fail. Kỳ vọng: 32 tool, 5 resource, 1 prompt, không learning/promotion.

Kiểm tra handshake thủ công: `tools/list` phải có `kettle_add_error_hop` và 4 `kettle_runtime_*`; `prompts/list` có `develop-pentaho-job`.

## Nâng cấp/rollback

- Nâng cấp: giải nén ZIP mới ra folder mới, chạy `install.ps1` (chỉ ghi đè entry `dte-pentaho`), giữ folder cũ tới khi `doctor.ps1` OK trên bản mới.
- Rollback: chạy `install.ps1` từ folder cũ (trỏ lại `.exe` cũ), reconnect MCP.

## `doctor.ps1`

Thoát nonzero khi install/config/handshake invalid; báo PDI riêng. Dùng sau mỗi cài đặt, nâng cấp, đổi config, đổi `KETTLE_ROOT`.

## Log và khử nhạy cảm

- Runtime log khử nhạy cảm nằm trong `<REQ>/runtime-logs/` (`<timestamp>-<kind>-<mode>.log`), gồm status/exitCode/signal + STDOUT/STDERR đã cắt 256KB và redact credential/tham số nhạy cảm. Đọc bằng `kettle_runtime_logs`.
- Server log stderr (`kettle-mcp-dte running on stdio ...`); tool failure là payload `{ok:false}` trong `text`, không phải protocol error.

## Timeout và xác nhận thực thi

- `timeoutMs` mặc định 120s, tối thiểu 1ms; timeout → `TIMEOUT` + SIGTERM, log vẫn lưu.
- `DEV`/`TEST` tự chạy; mọi môi trường khác (kể cả `UNKNOWN`) cần `confirmed: true`, nếu không trả `CONFIRM_REQUIRED` mà không chạm PDI.
- `loadcheck`/`execute` luôn validation tĩnh trước; structural error → `STATIC_VALIDATION_FAILED`.

## Biên filesystem và backup

- Ghi giới hạn trong `paths.requirements`/`paths.pentaho`; chặn absolute/escape và ghi `input/`.
- `install.ps1` backup `%USERPROFILE%\.kiro\settings\mcp.json` thành `mcp.json.bak-<timestamp>` trước khi ghi, giữ server khác.
- Ghi lifecycle compare-and-swap: hash stale → `CONCURRENT_CHANGE`, không mất dữ liệu.

## Gỡ cài đặt

`.\uninstall.ps1` chỉ xóa entry `dte-pentaho`; giữ các server khác và workspace.

## SmartScreen/AV

`.exe` mới có thể bị SmartScreen/AV chặn → handshake fail. Unblock file (Properties → Unblock), retry `doctor.ps1`. Không tắt AV toàn cục.

## Lỗi config

| Triệu chứng | Xử lý |
|-------------|-------|
| `Missing .pentaho-mcp.yaml` | Copy `config.example.yaml` thành `.pentaho-mcp.yaml` ở root |
| `schema_version must be 1` | Đặt `schema_version: 1` |
| `environment must be a YAML mapping` | Dùng `environment:\n  name: UNKNOWN`, không scalar |
| Path absolute/escape | Đổi thành tương đối trong workspace |
| `BA input is read-only` | Không ghi vào `input/` |
| Sai tên folder requirement | Đặt `REQ_<ID>_<UPPER_SNAKE>` con trực tiếp |

Chi tiết schema xem `docs/configuration.md`.

## Thiếu PDI

`kettle_runtime_detect` trả `available: false` + reason. Tính năng lõi vẫn chạy; `loadcheck`/`execute` trả `UNAVAILABLE`. Cài PDI rồi đặt `pentaho.home` trỏ thư mục chứa `Kitchen.bat`/`Pan.bat`.

## Triage sự cố

1. `doctor.ps1` fail handshake → kiểm tra `.exe` bị chặn, `mcp.json` trỏ đúng path, reconnect MCP.
2. Tool trả `{ok:false}` → đọc `error`: out-of-root/input read-only/hash stale/validation fail → inspect lại, lấy `expectedHashes` mới, sửa artifact.
3. Runtime `FAIL`/`TIMEOUT` → `kettle_runtime_logs` xem log khử; kiểm tra `environment`/`confirmed`, `timeoutMs`, PDI home, structural validation.
4. Nghi config → validate `.pentaho-mcp.yaml` theo `docs/configuration.md`; chạy `pentaho_project_inspect`.
5. Giữ `git status --short` sạch khỏi artifact tạm; server không bao giờ commit/push.
