# Bảng sự thật tài liệu (Documentation Facts)

> Tài liệu nội bộ cho người rà soát. Nguồn sự thật là mã nguồn và test trong `src/`, `test/`, `scripts/`, `packaging/`, `package.json`. Không dùng `README.md` hay `docs/install.md` hiện tại làm căn cứ khi có xung đột.

Ngày lập: 2026-09-06. Hồ sơ production đã kiểm chứng: `production profile OK: 31 tools, 5 resources, 1 prompt(s), no learning/promotion surface` (`node scripts/verify-production-profile.mjs`).

Bề mặt công cộng đã thu thập bằng lệnh (Task 1 Step 1):

```powershell
node --input-type=module -e "import { buildTools } from './src/tools/registry.js'; const tools=buildTools({root:process.cwd(),resolve:p=>p}); console.log(JSON.stringify(tools.map(({name,description,inputSchema})=>({name,description,inputSchema})),null,2));"
```

Kết quả: mảng JSON gồm 31 tool, bao gồm `kettle_add_error_hop`. Danh sách đầy đủ xem `docs/tools-reference.md`.

## 1. Nhận dạng sản phẩm

| Fact | Nguồn authoritative | Đích tài liệu |
|------|---------------------|----------------|
| Tên package `pentaho-mcp-server`, version `0.1.0`, `type: module`, entry `src/index.js`, binary `pentaho-mcp-server` | `package.json:1-7`, `src/index.js`, `src/server.js:43` | `README.md`, `docs/architecture.md`, `docs/development.md` |
| MCP stdio server cho file `.kjb` / `.ktr`; kiểm tra/chỉnh sửa XML ít mất mát, tri thức Pentaho nhúng, sinh mã theo lifecycle, validation tĩnh, thực thi PDI cục bộ có kiểm soát và tùy chọn | `src/server.js`, `src/tools/registry.js`, `src/core/*.js`, `src/generation/*.js`, `src/runtime/*.js` | `README.md`, `docs/architecture.md`, `docs/workflow-guide.md` |
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
| Tính năng lõi (read/edit/validate/generation tri thức tĩnh) không cần PDI; chỉ `kettle_runtime_loadcheck` và `kettle_runtime_execute` cần PDI cục bộ tùy chọn (`Kitchen.bat`/`Pan.bat` dưới `pentaho.home`) | `src/runtime/detect.js`, `src/runtime/run.js`, `src/tools/runtime.tools.js` | `README.md`, `docs/tools-reference.md`, `docs/operations.md`, `docs/configuration.md` |

## 4. Bề mặt MCP

| Fact | Nguồn authoritative | Đích tài liệu |
|------|---------------------|----------------|
| Tổng cộng đúng 31 tool: read 4, edit 9, validate 1, knowledge 4, lifecycle 9, runtime 4 | `src/tools/registry.js`, `src/tools/*.tools.js`, `scripts/verify-production-profile.mjs:20` | `README.md`, `docs/tools-reference.md` |
| Nhóm read (4): `kettle_list`, `kettle_summary`, `kettle_get_element`, `kettle_search` | `src/tools/read.tools.js` | `docs/tools-reference.md` |
| Nhóm edit (9): `kettle_create_file`, `kettle_add_element`, `kettle_set_field`, `kettle_set_field_path`, `kettle_set_fields`, `kettle_edit_hops`, `kettle_add_error_hop`, `kettle_rename_element`, `kettle_clone` (SQL sửa qua `kettle_set_field` với `field: "sql"`) | `src/tools/edit.tools.js` | `docs/tools-reference.md` |
| Nhóm validate (1): `kettle_validate` | `src/tools/validate.tools.js` | `docs/tools-reference.md` |
| Nhóm knowledge (4): `kettle_knowledge_list`, `kettle_knowledge_get`, `kettle_knowledge_analyze_xml`, `kettle_knowledge_coverage` | `src/tools/knowledge.tools.js` | `docs/tools-reference.md` |
| Nhóm lifecycle (9): `pentaho_project_inspect`, `pentaho_workflow_start`, `pentaho_workflow_status`, `pentaho_requirement_write`, `pentaho_design_write`, `pentaho_generate`, `pentaho_sync_changes`, `pentaho_validate_project`, `pentaho_finalize` | `src/tools/lifecycle.tools.js` | `docs/tools-reference.md`, `docs/workflow-guide.md` |
| Nhóm runtime (4): `kettle_runtime_detect`, `kettle_runtime_loadcheck`, `kettle_runtime_execute`, `kettle_runtime_logs` | `src/tools/runtime.tools.js` | `docs/tools-reference.md` |
| Một prompt: `develop-pentaho-job` (tham số bắt buộc `requirementFolder`) | `src/lifecycle/prompts.js`, `scripts/verify-production-profile.mjs:39` | `README.md`, `docs/workflow-guide.md`, `docs/tools-reference.md` |
| Năm resource lifecycle chỉ đọc (`dte-pentaho://skills/...`): `developing-pentaho-jobs`, `writing-etl-requirements`, `designing-pentaho-solutions`, `generating-pentaho-from-design`, `modifying-pentaho-jobs` | `src/lifecycle/catalog.js`, `src/lifecycle/resources.js` | `README.md`, `docs/workflow-guide.md` |
| Không có bề mặt learning/promotion tri thức (production knowledge bất biến, chỉ đọc) | `scripts/verify-production-profile.mjs:19`, `src/tools/registry.js` | `README.md`, `docs/architecture.md`, `docs/development.md` |
| Envelope trả về: `text` chứa `{ "ok": true, "data": ... }` hoặc `{ "ok": false, "error": "..." }`; edit tool trả unified diff | `src/server.js:32-66`, `src/tools/edit.tools.js` | `docs/tools-reference.md`, `docs/architecture.md` |

## 5. Schema cấu hình

| Fact | Nguồn authoritative | Đích tài liệu |
|------|---------------------|----------------|
| File `.pentaho-mcp.yaml` tại workspace root; `schema_version` phải là `1` | `src/project/config.js:46-57` | `docs/configuration.md`, `docs/workflow-guide.md` |
| Top-level cho phép: `schema_version`, `project`, `paths`, `environment`, `pentaho` | `src/project/config.js:6` | `docs/configuration.md` |
| `project.code`: chuỗi không rỗng, bắt buộc | `src/project/config.js:59-60,86` | `docs/configuration.md` |
| `paths.requirements`, `paths.pentaho` bắt buộc và tương đối; `paths.ai_context` tùy chọn | `src/project/config.js:8,68-74` | `docs/configuration.md` |
| `environment` là mapping với key tùy chọn `name` (không phải scalar); mặc định `UNKNOWN`, chuẩn hóa uppercase | `src/project/config.js:9,61,88` | `docs/configuration.md` |
| `pentaho.home` tùy chọn; có thể tuyệt đối hoặc tương đối workspace | `src/project/config.js:10,76-80` | `docs/configuration.md` |
| Biến môi trường: `KETTLE_ROOT` (scope mặc định + biên ghi), `KETTLE_KNOWLEDGE_DIR` (ghi đè knowledge nhúng) | `src/server.js:26-30`, `src/knowledge/loader.js` | `docs/configuration.md`, `docs/tools-reference.md` |

## 6. Đường dẫn và biên ghi

| Fact | Nguồn authoritative | Đích tài liệu |
|------|---------------------|----------------|
| Mọi `paths.*` phải tương đối workspace; từ chối absolute và `..` thoát workspace | `src/project/config.js:35-44` | `docs/configuration.md`, `docs/architecture.md` |
| So sánh containment không phân biệt hoa/thường trên Windows; dùng `realpathSync` cho ancestor đã tồn tại | `src/project/paths.js:4-26` | `docs/configuration.md` |
| Ghi bị từ chối dưới mọi subtree `<REQ>/input` (BA input chỉ đọc) | `src/project/paths.js:39-43` | `docs/configuration.md`, `docs/workflow-guide.md` |
| Chỉ chấp nhận Markdown dưới `input/`; file khác bị đánh dấu `unsupported` và chặn workflow | `src/workflow/inspect.js:43-47,96-98` | `docs/workflow-guide.md` |
| Ghi lifecycle dùng compare-and-swap `expectedHashes`; bytes đổi đồng thời trả `CONCURRENT_CHANGE` và không ghi | `src/lifecycle/artifact-write.js`, `src/tools/lifecycle.tools.js` | `docs/workflow-guide.md`, `docs/tools-reference.md` |

## 7. Vòng đời (lifecycle) và phục hồi trạng thái

| Fact | Nguồn authoritative | Đích tài liệu |
|------|---------------------|----------------|
| Thư mục yêu cầu phải là con trực tiếp, tên `REQ_<ID>_<UPPER_SNAKE>` (ví dụ `REQ_001_CUSTOMER_EXPORT`) | `src/workflow/inspect.js:8,38-40` | `docs/workflow-guide.md`, `docs/configuration.md` |
| Bố cục: `input/` (BA, chỉ đọc), `requirement.md`, `design/` (`design.md` + `manifest.yaml` + YAML component), thư mục runtime sinh ra, `changelog.md`, artifact state/lock, `runtime-logs/` đã khử nhạy cảm | `src/workflow/inspect.js:43-56`, `src/lifecycle/*.js`, `src/tools/runtime.tools.js:49` | `docs/workflow-guide.md` |
| Các chặng: requirement → design → generation → modifying/sync → validating → finalize/complete; tự đánh giá readiness kỹ thuật, không thêm approval con người giữa các pha tài liệu | `src/workflow/inspect.js:95-122`, `src/lifecycle/requirement-validator.js`, `src/lifecycle/design-validator.js`, `src/lifecycle/finalize.js` | `docs/workflow-guide.md` |
| State file là gợi ý; phục hồi từ bytes hiện tại, hash vô hiệu chặng cũ nhất, lock advisory theo requirement, stale-lock phục hồi sau tái kiểm tra | `src/workflow/state.js`, `src/workflow/lock.js`, `src/workflow/inspect.js` | `docs/workflow-guide.md`, `docs/architecture.md` |

## 8. Phạm vi validation

| Fact | Nguồn authoritative | Đích tài liệu |
|------|---------------------|----------------|
| Lớp structural (lỗi): XML hỏng, tên trùng, hop thiếu đích, job thiếu đúng một start, file tham chiếu thiếu, connection chưa khai báo, stale step reference, unreachable, biến chưa khai báo | `src/core/validate.js`, `src/tools/validate.tools.js` | `docs/tools-reference.md`, `README.md` |
| Lớp catalog (mềm): unknown type là warning, documented-nhưng-không-canonical là info; không bao giờ thành error; `checkCatalog: false` bỏ qua | `src/knowledge/catalog-check.js`, `src/tools/validate.tools.js:29-40` | `docs/tools-reference.md` |
| Phân biệt validation tĩnh/cấu trúc với đúng đắn nghiệp vụ/dữ liệu (ngoài phạm vi) | `src/core/validate.js`, `src/lifecycle/*-validator.js` | `README.md`, `docs/workflow-guide.md` |

## 9. Chính sách an toàn runtime

| Fact | Nguồn authoritative | Đích tài liệu |
|------|---------------------|----------------|
| Tự động cho phép chỉ ở `DEV` và `TEST`; mọi giá trị khác gồm `UNKNOWN` yêu cầu `confirmed: true` | `src/runtime/policy.js:1-4` | `README.md`, `docs/tools-reference.md`, `docs/operations.md`, `docs/configuration.md` |
| `loadcheck` luôn validation tĩnh trước; `execute` bị giới hạn cwd, tham số, env, kích thước output, timeout; log khử nhạy cảm lưu trong workflow | `src/runtime/run.js`, `src/runtime/redact.js`, `src/tools/runtime.tools.js` | `docs/tools-reference.md`, `docs/operations.md` |
| `detectPdi` phân biệt unavailable vs failed; executable phải nằm dưới PDI home; gọi bằng argument array, `shell: false` | `src/runtime/detect.js` | `docs/tools-reference.md` |
| Server không deploy; không commit/push/amend Git (chỉ đọc `git status --porcelain` khi inspect) | `src/workflow/inspect.js`, `src/tools/lifecycle.tools.js`, `scripts/build-release.mjs` | `README.md`, `docs/operations.md` |

## 10. Danh mục phát hành

| Fact | Nguồn authoritative | Đích tài liệu |
|------|---------------------|----------------|
| Lệnh: `npm run build:release -- --version <semver>`; bundle esbuild + SEA blob + postject inject; thất bại to nếu thiếu toolchain, không fallback cần system Node | `scripts/build-release.mjs`, `packaging/sea-config.json`, `package.json:11` | `docs/development.md`, `docs/operations.md` |
| ZIP đúng 7 entry: `dte-pentaho-mcp.exe`, `install.ps1`, `uninstall.ps1`, `doctor.ps1`, `config.example.yaml`, `README.md`, `VERSION`; `checksums.sha256` nằm cạnh, không phải entry thứ 8 | `scripts/build-release.mjs:220-245`, `test/packaging.test.js` | `docs/development.md`, `docs/operations.md` |
| `install.ps1` ghi entry Kiro user-level, backup JSON, giữ server khác, không `autoApprove: ["*"]`; `uninstall.ps1` chỉ xóa entry này; `doctor.ps1` handshake + validate config + dò PDI (thiếu PDI không fail) | `packaging/install.ps1`, `packaging/uninstall.ps1`, `packaging/doctor.ps1` | `docs/operations.md`, `docs/install.md` |

## 11. Chính sách catalog tri thức

| Fact | Nguồn authoritative | Đích tài liệu |
|------|---------------------|----------------|
| `catalog.yaml` là inventory duy nhất; `canonical` chèn sạch, `observed` cần `allowObserved: true` + đúng một marker `MANUAL_REVIEW`, unknown luôn bị scaffolding từ chối | `src/knowledge/loader.js`, `src/core/edit.js`, `src/tools/edit.tools.js:36-47` | `docs/tools-reference.md`, `docs/development.md` |
| `kettle_knowledge_analyze_xml` chỉ đọc, không ghi/promote; trả candidate + findings (`ABSOLUTE_PATH`, `POSSIBLE_SECRET`, …) | `src/core/knowledge-intake.js`, `src/tools/knowledge.tools.js:62-79` | `docs/tools-reference.md` |
| `kettle_knowledge_coverage` tổng hợp canonical/observed/missing, resilient trước file hỏng | `src/core/knowledge-coverage.js` | `docs/tools-reference.md` |

## 12. Non-goals (không làm)

| Fact | Nguồn authoritative | Đích tài liệu |
|------|---------------------|----------------|
| Không deploy, không Carte REST, không per-type schema registry, không kiểm chứng đúng đắn dữ liệu/nghiệp vụ | `src/server.js`, `src/core/*.js`, `scripts/verify-production-profile.mjs` | `README.md`, `docs/architecture.md` |
| Không tự tiến hành Git mutation; không human-approval gate cho requirement/design readiness | `src/lifecycle/prompts.js:32`, `src/lifecycle/*-validator.js` | `README.md`, `docs/workflow-guide.md` |

## Conflicts to resolve (6 khác biệt đã biết)

| # | Mô tả xung đột | Nguồn đúng | Đích sửa | Trạng thái |
|---|----------------|------------|----------|------------|
| 1 | Số tool: sau khi gỡ `kettle_set_sql` dư thừa, bề mặt là đúng 31 tool; `README.md` và `docs/tools-reference.md` đã đồng bộ | `src/tools/registry.js`, `scripts/verify-production-profile.mjs` | `README.md`, `docs/tools-reference.md` | Đã sửa |
| 2 | Nhóm edit có 9 tool (`kettle_add_error_hop` thuộc bề mặt công cộng; `kettle_set_sql` đã gỡ, SQL sửa qua `kettle_set_field`) | `src/tools/edit.tools.js` | `README.md`, `docs/tools-reference.md` | Đã sửa |
| 3 | Ngôn ngữ package/README nói “no execution”, nhưng đã có load-check/execution PDI tùy chọn có kiểm soát | `src/tools/runtime.tools.js`, `src/runtime/*.js` | `README.md`, `docs/operations.md` | Chưa sửa |
| 4 | `docs/install.md` nói 2 runtime dependency, thực tế 3 (`@modelcontextprotocol/sdk`, `fast-xml-parser`, `yaml`) | `package.json:22-26` | `docs/install.md` | Chưa sửa |
| 5 | `packaging/config.example.yaml` biểu diễn `environment` dạng scalar, trong khi `src/project/config.js` chờ `environment.name` | `src/project/config.js:61-65,88` | `packaging/config.example.yaml`, `docs/configuration.md` | Chưa sửa |
| 6 | Thực thi runtime tự cho phép chỉ `DEV` và `TEST`; mọi giá trị khác gồm `UNKNOWN` yêu cầu `confirmed: true` | `src/runtime/policy.js` | `README.md`, `docs/tools-reference.md`, `docs/operations.md` | Chưa sửa |

> Đánh dấu một xung đột là đã giải quyết chỉ sau khi tài liệu đích đã được cập nhật ở task sau.
