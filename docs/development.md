# Phát triển

Hướng dẫn maintainer. Nguồn sự thật: `package.json`, `scripts/*.mjs`, `packaging/*`, `test/*`, `src/knowledge/pentaho/README.md`.

## Prerequisite

- Node.js 20+ (ESM, `node:test`, SEA toolchain cho release Windows).
- Windows 10/11 để build `.exe` (dùng `tar.exe` hệ thống để đóng ZIP).
- Không cần PDI để phát triển tính năng lõi; chỉ cần PDI khi kiểm thủ công `kettle_runtime_*` (nhóm phase-gated: chỉ sau validation tĩnh).

## Setup repo

```powershell
npm install
node --test
node scripts/verify-production-profile.mjs
```

Chuẩn mực baseline: toàn suite pass, profile `production profile OK: 26 tools (exact set), no lifecycle prompt/resource surface, no learning/promotion surface`.

## npm script

| Script | Ý nghĩa |
|--------|---------|
| `npm test` (`node --test`) | Toàn suite `node:test` + fixture (gồm file 9.4 thật) |
| `npm run verify:profile` | Chặn learning/promotion surface, assert đúng tập 26 tool (so khớp tên chính xác) và không có bề mặt lifecycle prompt/resource |
| `npm run build:release -- --version <semver>` | Bundle + SEA + ZIP versioned + checksum (chỉ Windows), gồm companion skill |

## Bề mặt production

Registry (`src/tools/registry.js`) đăng ký đúng **7 factory**: read/edit/validate/knowledge/runtime/artifact/removal → tổng **26 tool**. Nhóm runtime thuộc workflow nhưng phase-gated (Pha 5, chỉ sau validation tĩnh).

Phần cài đặt lifecycle BA cũ đã **gỡ bỏ khỏi source** cùng toàn bộ test riêng của nó; không còn module nào như vậy trên đĩa. `test/legacy-removal.test.js` giữ vai trò guard, fail nếu bất kỳ đường dẫn legacy nào quay lại. MCP cũng không quảng bá prompt/resource nào; `initialize` chỉ khai báo `capabilities = { tools: {} }`.

## Tổ chức test

`test/` dùng `node:test` + `assert/strict`. Nhóm chính đăng ký: `add-element`, `create-file`, `edit*`, `set-fields`, `search`, `summarize`, `validate`, `knowledge*`, `runtime`, `smoke`, `packaging`, cùng test biên workspace và `legacy-removal`.

Lệnh focused:

```powershell
node --test test/smoke.test.js
node --test test/runtime.test.js
node --test test/knowledge.test.js test/knowledge-intake.test.js test/knowledge-coverage.test.js
```

`test/smoke.test.js` assert stdio initialize/tools (không prompt/resource); `test/packaging.test.js` build ZIP thật và smoke `.exe` nên chậm — chỉ chạy khi đụng release.

## Thêm tool factory mới

1. Tạo `src/tools/<name>.tools.js` export factory nhận biên workspace chung (`createWorkspaceBoundary`) và trả `[{name, description, inputSchema, handler}]`.
2. Thêm factory vào `FACTORIES` trong `src/tools/registry.js`.

`server.js` phát hiện mọi thứ qua `buildTools()`; không sửa file khác. Viết test contract (từ chối out-of-root qua biên workspace, validation fail) trước khi implement.

## Thêm/sửa knowledge type

Theo `src/knowledge/pentaho/README.md` (5 phần: template, config fields, YAML→XML mapping, ví dụ, gotcha):

1. Trích XML block từ `.kjb`/`.ktr` thật đã chạy hoặc block user cung cấp kèm PDI/plugin/verification. Chưa verify → ghi rõ, không đoán.
2. Chạy `kettle_knowledge_analyze_xml` (chỉ đọc) lấy candidate + findings; trình user và chờ xác nhận trước khi thêm catalog.
3. Tạo `src/knowledge/pentaho/trans/<TYPE>.md` hoặc `job/<TYPE>.md`; thay secret/endpoint/path máy bằng `${VAR_...}`/placeholder mô tả; ghi provenance.
4. Thêm một dòng vào `catalog.yaml` dưới `components.transformation`/`components.job`: `type`, `xml_type`, `file`, `status`, `generator_eligible`.

Trạng thái catalog:

- `canonical` + `generator_eligible: true`: scaffold sạch, không marker. Chỉ thăng sau khi verify trên PDI target.
- `observed` + `generator_eligible: false`: known gap; scaffold cần `allowObserved: true` + đúng một `MANUAL_REVIEW`.
- Unknown (vắng khỏi catalog): read/validate chạy, scaffold luôn từ chối.

## Giới hạn production-profile

`scripts/verify-production-profile.mjs` fail nếu tool chứa `learn|promot|intake|catalog_add/write/promote`, nếu có bất kỳ prompt/resource nào được quảng bá, hoặc tập tool khác tập 26 tên kỳ vọng (so khớp tập chính xác, không chỉ đếm). Không thêm bề mặt ghi/promote tri thức, không đưa bề mặt lifecycle BA trở lại, không quảng bá prompt/resource vào production.

## Continuous integration

`.github/workflows/ci.yml` chạy trên `windows-latest` (khớp môi trường build `.exe`):

- Job `test`: matrix Node `[20, 22]`, mỗi node chạy `npm ci` → `npm test` → `npm run verify:profile` → `git diff --check`.
- Job `package`: Node 20, chạy `npm run build:release -- --version 0.0.0-ci` rồi upload `dist/**` qua `actions/upload-artifact@v4` để kiểm nhanh artifact release.

## Bao bì npm

`package.json` `files` liệt kê tường minh `src`, `skills`, `README.md` và từng file `docs/*.md` hiện hành. Thư mục `docs/superpowers/` (plan/spec/handoff lịch sử của coordinator) **không** nằm trong danh sách nên không phát hành lên npm. Dev dependency dùng `esbuild` (bundle release) và `postject` (SEA inject); không còn phụ thuộc `yaml` (không có source nào import). Kiểm tra danh mục tarball bằng `npm pack --dry-run --json`.

## Release build internals

`scripts/build-release.mjs --version <semver>`:

1. esbuild bundle `src/index.js` thành một CJS, collapse `import.meta.url` về base ổn định.
2. Nhúng mọi text asset bất biến (`src/knowledge/pentaho/**`) vào module generated; fs shim serve read theo suffix, fallback fs thật.
3. `node --experimental-sea-config packaging/sea-config.json` tạo blob; copy Node exe và inject bằng postject.
4. Smoke `.exe` qua stdio (initialize/tools, assert 26 tool, không prompt/resource, không learning/promotion).
5. Stage ZIP versioned + `checksums.sha256` (cạnh ZIP), gồm companion skill dưới `skills/`. Thiếu esbuild/postject/SEA toolchain → fail to, không fallback cần system Node.

## Danh mục phát hành

ZIP gồm các entry: `README.md`, `VERSION`, `doctor.ps1`, `dte-pentaho-mcp.exe`, `install.ps1`, `uninstall.ps1`, `skills/`, `skills/developing-pentaho-jobs/`, `skills/developing-pentaho-jobs/references/`, `skills/developing-pentaho-jobs/SKILL.md`, `skills/developing-pentaho-jobs/references/pentaho-spec-template.md`. `checksums.sha256` nằm cạnh ZIP, không phải entry bên trong.

## Checklist đóng góp

- [ ] Test focused pass; `node --test` pass; `node scripts/verify-production-profile.mjs` OK (26 tool, no prompt/resource, no learning/promotion).
- [ ] Không hard-code `dte-*`; biên workspace (`createWorkspaceBoundary`) enforce mọi đường ghi/đọc.
- [ ] Knowledge mới có provenance, không secret/endpoint/path thật.
- [ ] Không commit/push trừ khi user cho phép riêng; mỗi task kết thúc bằng diff reviewable.
- [ ] `git diff --check` sạch.
