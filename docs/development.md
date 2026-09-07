# Phát triển

Hướng dẫn maintainer. Nguồn sự thật: `package.json`, `scripts/*.mjs`, `packaging/*`, `test/*`, `src/knowledge/pentaho/README.md`.

## Prerequisite

- Node.js 20+ (ESM, `node:test`, SEA toolchain cho release Windows).
- Windows 10/11 để build `.exe` (dùng `tar.exe` hệ thống để đóng ZIP).
- Không cần PDI để phát triển tính năng lõi; chỉ cần PDI khi kiểm thủ công `kettle_runtime_*`.

## Setup repo

```powershell
npm install
node --test
node scripts/verify-production-profile.mjs
```

Chuẩn mực baseline: toàn suite pass, profile `31 tools, 5 resources, 1 prompt(s), no learning/promotion surface`.

## npm script

| Script | Ý nghĩa |
|--------|---------|
| `npm test` (`node --test`) | Toàn suite `node:test` + fixture (gồm file 9.4 thật) |
| `npm run verify:profile` | Chặn learning/promotion surface, assert 31 tool + prompt `develop-pentaho-job` |
| `npm run build:release -- --version <semver>` | Bundle + SEA + ZIP versioned + checksum (chỉ Windows) |

## Tổ chức test

`test/` dùng `node:test` + `assert/strict`. Nhóm chính: `add-element`, `create-file`, `edit*`, `set-fields`, `search`, `summarize`, `validate`, `knowledge*`, `lifecycle-*`, `workflow-*`, `generation`, `sync-changes`, `runtime`, `project-config`, `smoke`, `packaging`.

Lệnh focused:

```powershell
node --test test/smoke.test.js
node --test test/lifecycle-tools.test.js
node --test test/generation.test.js
node --test test/runtime.test.js
node --test test/knowledge.test.js test/knowledge-intake.test.js test/knowledge-coverage.test.js
```

`test/smoke.test.js` assert stdio initialize/tools/prompts/resources; `test/packaging.test.js` build ZIP thật và smoke `.exe` nên chậm — chỉ chạy khi đụng release.

## Thêm tool factory mới

1. Tạo `src/tools/<name>.tools.js` export factory `(ctx) => [{name, description, inputSchema, handler}]`, với `ctx` là `{root, resolve}`.
2. Thêm factory vào `FACTORIES` trong `src/tools/registry.js`.

`server.js` phát hiện mọi thứ qua `buildTools()`; không sửa file khác. Viết test contract (schema yêu cầu `workspaceRoot`/`requirementFolder` nếu lifecycle, từ chối out-of-root, hash stale, validation fail) trước khi implement.

## Thêm/sửa knowledge type

Theo `src/knowledge/pentaho/README.md` (5 phần: template, config fields, YAML→XML mapping, ví dụ, gotcha):

1. Trích XML block từ `.kjb`/`.ktr` thật đã chạy hoặc block user cung cấp kèm PDI/plugin/verification. Chưa verify → ghi rõ, không đoán.
2. Chạy `kettle_knowledge_analyze_xml` (chỉ đọc) lấy candidate + findings; trình user và chờ xác nhận trước khi thêm catalog.
3. Tạo `src/knowledge/pentaho/trans/<TYPE>.md` hoặc `job/<TYPE>.md`; thay secret/endpoint/path máy bằng `${VAR_...}`/placeholder mô tả; ghi provenance.
4. Thêm một dòng vào `catalog.yaml` dưới `components.transformation`/`components.job`: `type`, `xml_type`, `file`, `status`, `generator_eligible`.

Trạng thái catalog:

- `canonical` + `generator_eligible: true`: scaffold sạch, không marker. Chỉ thăng sau khi verify trên PDI target.
- `observed` + `generator_eligible: false`: known gap; scaffold cần `allowObserved: true` + đúng một `MANUAL_REVIEW`; generation cần known-gap decision khớp.
- Unknown (vắng khỏi catalog): read/validate chạy, scaffold luôn từ chối.

## Giới hạn production-profile

`scripts/verify-production-profile.mjs` fail nếu tool/resource/prompt chứa `learn|promot|intake|catalog_add/write/promote`, thiếu `develop-pentaho-job`, hoặc khác 31 tool. Không thêm bề mặt ghi/promote tri thức vào production.

## Release build internals

`scripts/build-release.mjs --version <semver>`:

1. esbuild bundle `src/index.js` thành một CJS, collapse `import.meta.url` về base ổn định.
2. Nhúng mọi text asset bất biến (`src/knowledge/pentaho/**`, `src/lifecycle/*.md`) vào module generated; fs shim serve read theo suffix, fallback fs thật. Source Task 1–9 không đổi.
3. `node --experimental-sea-config packaging/sea-config.json` tạo blob; copy Node exe và inject bằng postject.
4. Smoke `.exe` qua stdio (initialize/tools/prompts/resources, assert 31 tool, prompt, không learning/promotion).
5. Stage ZIP versioned + `checksums.sha256`. Thiếu esbuild/postject/SEA toolchain → fail to, không fallback cần system Node.

## Danh mục phát hành

ZIP đúng 7 entry: `dte-pentaho-mcp.exe`, `install.ps1`, `uninstall.ps1`, `doctor.ps1`, `config.example.yaml`, `README.md`, `VERSION`. `checksums.sha256` nằm cạnh ZIP, không phải entry thứ 8.

## Checklist đóng góp

- [ ] Test focused pass; `node --test` pass; `node scripts/verify-production-profile.mjs` OK.
- [ ] Không hard-code `dte-*`; path tương đối + biên `input/` giữ nguyên.
- [ ] Knowledge mới có provenance, không secret/endpoint/path thật.
- [ ] Không commit/push trừ khi user cho phép riêng; mỗi task kết thúc bằng diff reviewable.
- [ ] `git diff --check` sạch.
