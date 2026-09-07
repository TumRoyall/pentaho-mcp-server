# Bảng sự thật tài liệu (Documentation Facts)

> Tài liệu nội bộ cho người rà soát. Nguồn sự thật là mã nguồn và test trong `src/`, `test/`, `scripts/`, `packaging/`, `package.json`. Không dùng `README.md` hay `docs/install.md` hiện tại làm căn cứ khi có xung đột.

Hồ sơ production đã kiểm chứng: `production profile OK: 22 tools, no lifecycle prompt/resource surface, no learning/promotion surface` (`node scripts/verify-production-profile.mjs`).

Bề mặt công cộng đã thu thập bằng lệnh:

```powershell
node --input-type=module -e "import { buildTools } from './src/tools/registry.js'; import { createWorkspaceBoundary } from './src/workspace/boundary.js'; const tools=buildTools(createWorkspaceBoundary(process.cwd())); console.log(JSON.stringify(tools.map(({name,description,inputSchema})=>({name,description,inputSchema})),null,2));"
```

Kết quả: mảng JSON gồm 22 tool, bao gồm `kettle_add_error_hop`. Danh sách đầy đủ xem `docs/tools-reference.md`.

## 1. Nhận dạng sản phẩm

| Fact | Nguồn authoritative | Đích tài liệu |
|------|---------------------|----------------|
| Tên package `pentaho-mcp-server`, version `0.1.0`, `type: module`, entry `src/index.js`, binary `pentaho-mcp-server` | `package.json:1-7`, `src/index.js`, `src/server.js:43` | `README.md`, `docs/architecture.md`, `docs/development.md` |
| MCP stdio server cho file `.kjb` / `.ktr`; kiểm tra/chỉnh sửa XML ít mất mát, tri thức Pentaho nhúng, validation tĩnh; runtime PDI cục bộ tùy chọn thuộc workflow nhưng phase-gated (chỉ sau validation tĩnh) | `src/server.js`, `src/tools/registry.js`, `src/core/*.js`, `src/runtime/*.js` | `README.md`, `docs/architecture.md`, `docs/workflow-guide.md` |
| Tên server MCP quảng bá: `kettle-mcp-dte`, version `0.1.0` | `src/server.js:43` | `README.md`, `docs/operations.md` |

## 2. Loại artifact được hỗ trợ

| Fact | Nguồn authoritative | Đích tài liệu |
|------|---------------------|----------------|
| Hỗ trợ Pentaho Kettle job (`.kjb`, `<job>`) và transformation (`.ktr`, `<transformation>`) | `src/core/model.js`, `src/core/validate.js`, `test/fixtures` | `README.md`, `docs/architecture.md`, `docs/tools-reference.md` |
| Mô hình XML span-based, giữ nguyên CRLF và thứ tự field | `src/core/span.js`, `src/core/edit.js`, `test/edit-crlf.test.js` | `docs/architecture.md`, `docs/tools-reference.md` |

## 3. Yêu cầu runtime

| Fact | Nguồn authoritative | Đích tài liệu |
|------|---------------------|----------------|
| Node.js >= 20 (ESM, `node:test`) | `package.json:14-16` | `README.md`, `docs/development.md`, `docs/install.md` |
| Ba runtime dependency: `@modelcontextprotocol/sdk`, `fast-xml-parser`, `yaml` | `package.json:22-26` | `docs/install.md`, `docs/development.md`, `README.md` |
| Hai devDependency phục vụ release: `esbuild`, `postject` | `package.json:27-30` | `docs/development.md`, `docs/operations.md` |
| Tính năng lõi (read/edit/validate/knowledge) không cần PDI; chỉ `kettle_runtime_loadcheck` và `kettle_runtime_execute` cần PDI cục bộ tùy chọn (nhóm runtime thuộc workflow nhưng phase-gated: chỉ sau validation tĩnh) | `src/runtime/detect.js`, `src/runtime/run.js`, `src/tools/runtime.tools.js` | `README.md`, `docs/tools-reference.md`, `docs/operations.md`, `docs/configuration.md` |

## 4. Bề mặt MCP

| Fact | Nguồn authoritative | Đích tài liệu |
|------|---------------------|----------------|
| Tổng cộng đúng 22 tool: read 4, edit 9, validate 1, knowledge 4, runtime 4 | `src/tools/registry.js`, `src/tools/*.tools.js`, `scripts/verify-production-profile.mjs` | `README.md`, `docs/tools-reference.md` |
| Nhóm read (4): `kettle_list`, `kettle_summary`, `kettle_get_element`, `kettle_search` | `src/tools/read.tools.js` | `docs/tools-reference.md` |
| Nhóm edit (9): `kettle_create_file`, `kettle_add_element`, `kettle_set_field`, `kettle_set_field_path`, `kettle_set_fields`, `kettle_edit_hops`, `kettle_add_error_hop`, `kettle_rename_element`, `kettle_clone` (SQL sửa qua `kettle_set_field` với `field: "sql"`) | `src/tools/edit.tools.js` | `docs/tools-reference.md` |
| Nhóm validate (1): `kettle_validate` | `src/tools/validate.tools.js` | `docs/tools-reference.md` |
| Nhóm knowledge (4): `kettle_knowledge_list`, `kettle_knowledge_get`, `kettle_knowledge_analyze_xml`, `kettle_knowledge_coverage` | `src/tools/knowledge.tools.js` | `docs/tools-reference.md` |
| Nhóm runtime (4): `kettle_runtime_detect`, `kettle_runtime_loadcheck`, `kettle_runtime_execute`, `kettle_runtime_logs` — thuộc workflow, phase-gated (Pha 5, sau validation tĩnh; execute cần user duyệt) | `src/tools/runtime.tools.js` | `docs/tools-reference.md` |
| **Không** quảng bá prompt nào; `initialize` khai báo `capabilities = { tools: {} }` | `src/server.js`, `scripts/verify-production-profile.mjs` | `README.md`, `docs/tools-reference.md`, `docs/operations.md` |
| **Không** quảng bá resource nào (không còn `dte-pentaho://skills/...`) | `src/server.js`, `scripts/verify-production-profile.mjs` | `README.md`, `docs/tools-reference.md`, `docs/operations.md` |
| Source production hiện tại **không còn** phần cài đặt lifecycle BA (không module, không tool factory tương ứng); guard absence assert điều này, còn `registry.js` chỉ đăng ký 5 factory production | `test/legacy-removal.test.js`, `src/tools/registry.js` | `docs/architecture.md`, `docs/development.md` |
| Không có bề mặt learning/promotion tri thức (production knowledge bất biến, chỉ đọc) | `scripts/verify-production-profile.mjs`, `src/tools/registry.js` | `README.md`, `docs/architecture.md`, `docs/development.md` |
| Envelope trả về: `text` chứa `{ "ok": true, "data": ... }` hoặc `{ "ok": false, "error": "..." }`; edit tool trả unified diff | `src/server.js:32-66`, `src/tools/edit.tools.js` | `docs/tools-reference.md`, `docs/architecture.md` |

## 5. Biên workspace và cấu hình

| Fact | Nguồn authoritative | Đích tài liệu |
|------|---------------------|----------------|
| `KETTLE_ROOT` mặc định `process.cwd()` khi unset và luôn được enforce; canonical containment do `src/workspace/boundary.js` (`createWorkspaceBoundary`) sở hữu, dùng chung cho read/edit/validate/coverage | `src/workspace/boundary.js`, `src/tools/registry.js` | `README.md`, `docs/configuration.md`, `docs/architecture.md`, `docs/tools-reference.md` |
| Đường tuyệt đối chỉ hợp lệ khi trong root; `..`, sibling-prefix, symlink/junction escape đều bị từ chối; so containment không phân biệt hoa/thường trên Windows | `src/workspace/boundary.js` | `docs/configuration.md` |
| `assertWritable` cũ (env-based) trong `src/core/edit.js` đã gỡ; hàm XML lõi là filesystem op thuần túy, lớp tool adapter sở hữu biên | `src/core/edit.js`, `src/workspace/boundary.js` | `docs/architecture.md` |
| `KETTLE_KNOWLEDGE_DIR` ghi đè knowledge nhúng | `src/knowledge/loader.js` | `docs/configuration.md`, `docs/tools-reference.md` |
| `PENTAHO_HOME` là thiết lập vị trí PDI duy nhất cho nhóm runtime tùy chọn; runtime dùng chung biên `KETTLE_ROOT`, log dưới `<KETTLE_ROOT>/.pentaho-mcp/runtime-logs`; execute luôn cần `confirmed: true` | `src/server.js`, `src/runtime/*`, `src/tools/runtime.tools.js` | `docs/configuration.md` |

## 6. Workflow phát triển Pentaho (năm pha)

| Fact | Nguồn authoritative | Đích tài liệu |
|------|---------------------|----------------|
| Superpowers (ngoài MCP) sở hữu brainstorming/duyệt/đặc tả/lập kế hoạch/thực thi kế hoạch (`superpowers:brainstorming`, `superpowers:writing-plans`, `superpowers:executing-plans`); tool MCP nguyên thủy làm domain deterministic và vẫn gọi trực tiếp được | `skills/developing-pentaho-jobs/SKILL.md` | `README.md`, `docs/workflow-guide.md`, `docs/architecture.md` |
| Companion skill `skills/developing-pentaho-jobs/SKILL.md` + hai mẫu `references/pentaho-spec-template.md` và `references/pentaho-plan-template.md`; đặc tả có bảy section (objective/boundaries; artifact inventory; variables/parameters/connections; job definitions; transformation definitions; static acceptance criteria; runtime acceptance criteria) | `skills/developing-pentaho-jobs/SKILL.md`, `skills/developing-pentaho-jobs/references/*.md` | `docs/workflow-guide.md` |
| Cổng mutation kép: không tool edit MCP nào chạy cho tới khi **cả** đặc tả **và** kế hoạch được duyệt (duyệt thiết kế đơn thuần chưa đủ) | `skills/developing-pentaho-jobs/SKILL.md` | `README.md`, `docs/workflow-guide.md` |
| Knowledge-first: gọi `kettle_knowledge_get(kind, type)` trước khi thêm/cấu hình mỗi type; ranh giới hoàn tất phần build là `kettle_validate` zero structural error cho từng artifact và toàn cây | `skills/developing-pentaho-jobs/SKILL.md`, `src/tools/validate.tools.js` | `docs/workflow-guide.md` |
| Runtime phase-gated (Pha 5): `loadcheck` chỉ sau validation tĩnh; `execute` cần thêm user duyệt + `PENTAHO_HOME` dò thấy + `confirmed: true`; thất bại runtime không báo là thành công. Sinh testcase tự động và truy cập database nằm ngoài workflow | `skills/developing-pentaho-jobs/SKILL.md`, `src/runtime/policy.js`, `src/runtime/run.js` | `README.md`, `docs/workflow-guide.md` |

## 7. Phạm vi validation

| Fact | Nguồn authoritative | Đích tài liệu |
|------|---------------------|----------------|
| Lớp structural (lỗi): XML hỏng, tên trùng, hop thiếu đích, job thiếu đúng một start, file tham chiếu thiếu, connection chưa khai báo, stale step reference, unreachable, biến chưa khai báo | `src/core/validate.js`, `src/tools/validate.tools.js` | `docs/tools-reference.md`, `README.md` |
| Lớp catalog (mềm): unknown type là warning, documented-nhưng-không-canonical là info; không bao giờ thành error; `checkCatalog: false` bỏ qua | `src/knowledge/catalog-check.js`, `src/tools/validate.tools.js` | `docs/tools-reference.md` |
| Phân biệt validation tĩnh/cấu trúc với đúng đắn nghiệp vụ/dữ liệu (ngoài phạm vi) | `src/core/validate.js` | `README.md`, `docs/workflow-guide.md` |

## 8. Chính sách an toàn runtime (phase-gated)

| Fact | Nguồn authoritative | Đích tài liệu |
|------|---------------------|----------------|
| `kettle_runtime_execute` **luôn** cần `confirmed: true` mới `ALLOW`; thiếu → `CONFIRM_REQUIRED`. **Không** có auto theo tên môi trường (`DEV`/`TEST`/`UNKNOWN`) — chính sách chỉ dựa trên `confirmed` | `src/runtime/policy.js` | `docs/tools-reference.md`, `docs/operations.md`, `docs/configuration.md` |
| `loadcheck` luôn validation tĩnh trước; `execute` bị giới hạn cwd, tham số, env, cắt output 256KB, timeout mặc định 120s; log khử nhạy cảm | `src/runtime/run.js`, `src/runtime/redact.js`, `src/tools/runtime.tools.js` | `docs/tools-reference.md`, `docs/operations.md` |
| `detectPdi` phân biệt unavailable vs failed; executable phải nằm dưới PDI home (`realpathSync` canonical); trên Windows `.bat` chạy qua shell có quote (Node ≥18 từ chối spawn `.bat`/`.cmd` trực tiếp, CVE-2024-27980) | `src/runtime/detect.js`, `src/runtime/run.js` | `docs/tools-reference.md` |
| Server không deploy; không commit/push/amend Git | `scripts/build-release.mjs` | `README.md`, `docs/operations.md` |

## 9. Chính sách catalog tri thức

| Fact | Nguồn authoritative | Đích tài liệu |
|------|---------------------|----------------|
| `catalog.yaml` là inventory duy nhất; `canonical` chèn sạch, `observed` cần `allowObserved: true` + đúng một marker `MANUAL_REVIEW`, unknown luôn bị scaffolding từ chối | `src/knowledge/loader.js`, `src/core/edit.js`, `src/tools/edit.tools.js` | `docs/tools-reference.md`, `docs/development.md` |
| `kettle_knowledge_analyze_xml` chỉ đọc, không ghi/promote; trả candidate + findings (`ABSOLUTE_PATH`, `POSSIBLE_SECRET`, …) | `src/core/knowledge-intake.js`, `src/tools/knowledge.tools.js` | `docs/tools-reference.md` |
| `kettle_knowledge_coverage` tổng hợp canonical/observed/missing, resilient trước file hỏng | `src/core/knowledge-coverage.js` | `docs/tools-reference.md` |

## 10. Danh mục phát hành

| Fact | Nguồn authoritative | Đích tài liệu |
|------|---------------------|----------------|
| Lệnh: `npm run build:release -- --version <semver>`; bundle esbuild + SEA blob + postject inject; thất bại to nếu thiếu toolchain, không fallback cần system Node | `scripts/build-release.mjs`, `packaging/sea-config.json`, `package.json:11` | `docs/development.md`, `docs/operations.md` |
| ZIP gồm các entry: `README.md`, `VERSION`, `doctor.ps1`, `dte-pentaho-mcp.exe`, `install.ps1`, `uninstall.ps1`, `skills/`, `skills/developing-pentaho-jobs/`, `skills/developing-pentaho-jobs/references/`, `skills/developing-pentaho-jobs/SKILL.md`, `skills/developing-pentaho-jobs/references/pentaho-spec-template.md`, `skills/developing-pentaho-jobs/references/pentaho-plan-template.md`; `checksums.sha256` nằm cạnh ZIP, không phải entry bên trong | `scripts/build-release.mjs`, `test/packaging.test.js` | `docs/development.md`, `docs/operations.md`, `docs/install.md` |
| `install.ps1` ghi entry Kiro user-level, backup JSON, giữ server khác, không `autoApprove: ["*"]`; `uninstall.ps1` chỉ xóa entry này; `doctor.ps1` handshake initialize + tools/list (22 tool, từ chối `pentaho_*`, không kiểm prompt/resource) + dò PDI (thiếu PDI không fail) | `packaging/install.ps1`, `packaging/uninstall.ps1`, `packaging/doctor.ps1` | `docs/operations.md`, `docs/install.md` |
| Companion skill được đưa vào `files` của npm (mục `"skills"`) và copy vào ZIP release (`cpSync` đệ quy). **Discovery không tự động chỉ vì `skills/` trong ZIP**: Kiro cần copy `skills/developing-pentaho-jobs/` vào `.kiro/skills/` (workspace) hoặc `~/.kiro/skills/` (user); Codex/agent tương thích Superpowers đặt dưới thư mục skills runtime (ví dụ `~/.agents/skills/`) | `package.json`, `scripts/build-release.mjs`, `skills/developing-pentaho-jobs/SKILL.md` | `docs/install.md`, `docs/operations.md`, `README.md` |

## 11. Non-goals (không làm)

| Fact | Nguồn authoritative | Đích tài liệu |
|------|---------------------|----------------|
| Không deploy, không Carte REST, không per-type schema registry, không kiểm chứng đúng đắn dữ liệu/nghiệp vụ, không quảng bá prompt/resource | `src/server.js`, `src/core/*.js`, `scripts/verify-production-profile.mjs` | `README.md`, `docs/architecture.md` |
| Không tự tiến hành Git mutation | `scripts/build-release.mjs` | `README.md`, `docs/operations.md` |
