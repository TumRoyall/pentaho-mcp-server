# Tham chiếu tool MCP

Catalog đầy đủ 22 tool production. Nguồn sự thật: `src/tools/*.tools.js`, `src/tools/registry.js`, `src/server.js`, `test/`. Mọi kết quả là `text` chứa `{ "ok": true, "data": ... }` hoặc `{ "ok": false, "error": "..." }`.

MCP **không quảng bá prompt hay resource nào**; `initialize` chỉ khai báo `capabilities = { tools: {} }`. Superpowers (ngoài MCP) là workflow suy luận khuyến nghị, nhưng các tool dưới đây gọi trực tiếp được bởi client bất kỳ.

## Quy ước chung

- **Biên workspace**: mọi đường dẫn hoặc tương đối `KETTLE_ROOT`, hoặc tuyệt đối **nằm trong** `KETTLE_ROOT`. `KETTLE_ROOT` mặc định `process.cwd()` khi unset và luôn được enforce (`src/workspace/boundary.js`). Đường ngoài `KETTLE_ROOT` (absolute ngoài root, `..`, sibling-prefix, symlink/junction escape) → từ chối.
- **Transport**: stdio JSON-RPC. `tools/list` liệt kê `{name, description, inputSchema}`; `tools/call` trả envelope trên.
- **Edit tool** trả unified diff của đúng bytes đã đổi và validate trước khi commit nơi áp dụng được. `kettle_add_element` trả thêm `{diff, catalogStatus, manualReviewRequired}`.

## Nhóm read (4)

### `kettle_list`

- Mục đích: liệt kê job/transformation dưới một thư mục (mặc định `KETTLE_ROOT`).
- Tham số: `directory?` (string).
- Output: danh sách artifact. Không ghi. Lỗi: thư mục ngoài scope.
- Ví dụ: `{ "directory": "etl-pentaho" }`

### `kettle_summary`

- Mục đích: tóm tắt một file: element + type, hop graph, connection, param, SQL preview.
- Tham số: `path` (bắt buộc).
- Output: summary model. Chỉ đọc. Lỗi: file không tồn tại/XML hỏng.
- Ví dụ: `{ "path": "etl-pentaho/main.kjb" }`

### `kettle_get_element`

- Mục đích: cấu hình đầy đủ của một step/entry, gồm SQL đầy đủ; `raw: true` kèm XML thô.
- Tham số: `path`, `name` (bắt buộc); `raw?` (boolean, mặc định `false`).
- Output: element detail. Chỉ đọc. Lỗi: element không tồn tại.
- Ví dụ: `{ "path": "etl-pentaho/load.ktr", "name": "Table input", "raw": false }`

### `kettle_search`

- Mục đích: tìm kiếm toàn cây `.kjb`/`.ktr`.
- Tham số: `query` (bắt buộc); `kind?` enum `text|table|connection|variable|step_type|entry_type` (mặc định `text`); `directory?` (mặc định `KETTLE_ROOT`).
- Output: danh sách match. Chỉ đọc.
- Ví dụ: `{ "query": "customer", "kind": "table" }`

## Nhóm edit (9)

### `kettle_create_file`

- Mục đích: tạo file Kettle rỗng mới. `.ktr` → transformation rỗng (`<order>` rỗng); `.kjb` → job với đúng một START và `<hops>` rỗng. Tên internal mặc định basename. Từ chối ghi đè. Trả validation report.
- Tham số: `path` (bắt buộc, chưa tồn tại); `kind?` enum `job|trans` (phải khớp extension nếu đưa); `name?`.
- Tác dụng: tạo file. Lỗi: đã tồn tại, kind/extension lệch.
- Ví dụ: `{ "path": "etl-pentaho/new_job.kjb", "kind": "job" }`

### `kettle_add_element`

- Mục đích: thêm step/trans hoặc entry/job từ template XML trong knowledge base, đặt tên element.
- Tham số: `path`, `type`, `name` (bắt buộc); `x?`, `y?` (number); `allowObserved?` (boolean).
- Chính sách catalog: `canonical` chèn sạch; `observed` từ chối trừ khi `allowObserved: true` (khi cho phép, prefix đúng một `<!-- MANUAL_REVIEW: ... -->`); unknown luôn từ chối kể cả custom template.
- Output: `{diff, catalogStatus, manualReviewRequired}`. Ghi file.
- Ví dụ: `{ "path": "etl-pentaho/load.ktr", "type": "TableInput", "name": "Read customer" }`

### `kettle_set_field`

- Mục đích: đặt một child value trên step/entry; tạo child nếu vắng. SQL chỉ là một child field bình thường (`<sql>`), nên sửa SQL của TableInput/ExecSQL step hay SQL job entry bằng chính tool này với `field: "sql"`.
- Tham số: `path`, `name`, `field`, `value` (bắt buộc). Trả `{diff}`.
- Ví dụ: `{ "path": "etl-pentaho/load.ktr", "name": "Table input", "field": "limit", "value": "1000" }`
- Ví dụ sửa SQL: `{ "path": "etl-pentaho/load.ktr", "name": "Read customer", "field": "sql", "value": "SELECT * FROM CUSTOMER" }`

### `kettle_set_field_path`

- Mục đích: đặt giá trị lồng nhau theo slash path (ví dụ `file/sheetname`). Ancestor phải tồn tại; leaf tạo nếu vắng.
- Tham số: `path`, `name`, `fieldPath`, `value` (bắt buộc). Trả `{diff}`.
- Ví dụ: `{ "path": "etl-pentaho/load.ktr", "name": "Excel input", "fieldPath": "file/sheetname", "value": "Sheet1" }`

### `kettle_set_fields`

- Mục đích: điền repeatable list (ví dụ SelectValues `<field>`/`<meta>`, ExcelWriter `<fields>`). Học thứ tự child + default từ item đầu trong template, rebuild toàn run; vắng item mẫu thì suy thứ tự từ key input và chèn trước closing tag.
- Tham số: `path`, `name`, `listTag`, `itemTag`, `items` (array object string→string) (bắt buộc). Trả `{diff}`.
- Ví dụ: `{ "path": "etl-pentaho/map.ktr", "name": "Select values", "listTag": "fields", "itemTag": "field", "items": [{ "name": "id" }] }`

### `kettle_edit_hops`

- Mục đích: add/remove/enable/disable hop giữa hai element.
- Tham số: `path`, `action` enum `add|remove|enable|disable`, `from`, `to` (bắt buộc); `evaluation?` enum `Y|N`; `unconditional?` enum `Y|N`.
- Ngữ nghĩa job hop: success (`evaluation=Y`, mặc định), failure (`evaluation=N`, hop đỏ), unconditional (`unconditional=Y`); hop từ START mặc định `unconditional=Y` như Spoon. Transformation hop không có evaluation/unconditional; error hop transformation dùng `kettle_add_error_hop`.
- Trả `{diff}`.
- Ví dụ: `{ "path": "etl-pentaho/main.kjb", "action": "add", "from": "START", "to": "Load" }`

### `kettle_add_error_hop`

- Mục đích: error handling transformation: route error rows từ source step sang target step (hop đỏ trong Spoon). Ghi cả block `<error>` trong `<step_error_handling>` và hop thường source → target trong một edit atomic. Chỉ transformation. Từ chối nếu source đã có error hop.
- Tham số: `path`, `source`, `target` (bắt buộc); `enabled?` (mặc định `true`); `nrErrorsField?`, `errorDescField?`, `errorFieldsField?`, `errorCodesField?`, `maxErrors?`, `maxPctErrors?`, `minPctRows?`.
- Trả `{diff}`.
- Ví dụ: `{ "path": "etl-pentaho/load.ktr", "source": "Table input", "target": "Log errors" }`

### `kettle_rename_element`

- Mục đích: rename step/entry và cập nhật mọi hop tham chiếu.
- Tham số: `path`, `oldName`, `newName` (bắt buộc). Trả `{diff}`.
- Ví dụ: `{ "path": "etl-pentaho/load.ktr", "oldName": "Old", "newName": "New" }`

### `kettle_clone`

- Mục đích: copy `.kjb`/`.ktr` làm template: đặt internal name và find/replace literal.
- Tham số: `sourcePath`, `destPath` (chưa tồn tại), `name` (bắt buộc); `replacements?` array `{find, replace}`.
- Ví dụ: `{ "sourcePath": "etl-pentaho/a.ktr", "destPath": "etl-pentaho/b.ktr", "name": "b", "replacements": [] }`

## Nhóm validation (1)

### `kettle_validate`

- Mục đích: lint một file (hoặc toàn cây `KETTLE_ROOT` khi bỏ `path`). Structural + catalog coverage. Đây là ranh giới hoàn tất của workflow: zero structural error cho từng artifact và toàn cây.
- Tham số: `path?`; `checkCatalog?` (boolean, mặc định `true`).
- Structural (error): XML hỏng, tên trùng, hop thiếu đích, job thiếu đúng một start, file tham chiếu thiếu, connection chưa khai báo, stale step reference, unreachable, biến chưa khai báo.
- Catalog (mềm): unknown type → warning; documented-nhưng-không-canonical → info; không bao giờ error.
- Ví dụ: `{ "path": "etl-pentaho/load.ktr", "checkCatalog": true }`

## Nhóm knowledge (4)

### `kettle_knowledge_list`

- Mục đích: liệt kê type trong catalog nhúng, kèm status và eligibility.
- Tham số: `kind?` enum `job|trans` (vắng → cả hai).
- Output: `{knowledgeDir, job|trans: [{type, xml_type, status, generator_eligible, file}]}`. Chỉ đọc.
- Ví dụ: `{ "kind": "trans" }`

### `kettle_knowledge_get`

- Mục đích: reference đầy đủ của một type (template XML, bảng field, mapping YAML→XML, gotcha). Nhận `xml_type` hoặc alias (ví dụ `TableInput` hoặc `TABLE_INPUT`). **Gọi trước khi thêm/cấu hình mỗi type** (knowledge-first).
- Tham số: `kind`, `type` (bắt buộc).
- Output: `{kind, requested, entry, generator_eligible, file, content}`. Chỉ đọc. Lỗi: unknown type.
- Ví dụ: `{ "kind": "trans", "type": "TableInput" }`

### `kettle_knowledge_analyze_xml`

- Mục đích: phân tích XML do user đưa làm candidate catalog, chỉ đọc; không ghi/promote type.
- Tham số: `kind` (bắt buộc), `xml` (bắt buộc, `.kjb`/`.ktr` đầy đủ hoặc một block `<entry>`/`<step>`); `elementName?` (khi artifact nhiều candidate); `sourceArtifact?`, `pdiVersion?`, `plugin?`; `verification?` enum `unverified|spoon_loaded|runtime_passed` (mặc định `unverified`).
- Output: candidate (`xmlType`, `status: observed`, `generatorEligible: false`), XML byte-preserved, findings (`ABSOLUTE_PATH`, `POSSIBLE_SECRET`, …), `missingInformation`, `requiresElementName` khi mơ hồ.
- Ví dụ: `{ "kind": "trans", "xml": "<step><name>CSV source</name><type>CsvInput</type></step>", "verification": "spoon_loaded" }`

### `kettle_knowledge_coverage`

- Mục đích: báo cáo canonical/observed/missing usage dưới `KETTLE_ROOT`.
- Tham số: `directory?`; `includeExamples?` (mặc định `true`).
- Output: `{summary: {files, parsedFiles, scanIssues, typeUsages, distinctTypes, canonical, observed, missing}, types, issues}`. Chỉ đọc, resilient trước file hỏng.
- Ví dụ: `{ "directory": "etl-pentaho" }`

## Nhóm runtime (4, ngoài workflow / đã hoãn)

> Nhóm runtime tạm giữ lại nhưng **nằm ngoài workflow idea-to-static-job** và được **hoãn** cho một đợt refactor sau. Không dùng trong luồng knowledge-first.

### `kettle_runtime_detect`

- Mục đích: dò `Kitchen.bat`/`Pan.bat` tùy chọn dưới `pentaho.home`.
- Tham số: `workspaceRoot` (bắt buộc).
- Output: `{available, home, kitchen, pan, reason?}`. Không cần PDI để dùng tool khác.
- Ví dụ: `{ "workspaceRoot": "C:/ws" }`

### `kettle_runtime_loadcheck`

- Mục đích: validation tĩnh rồi nhờ Kitchen/Pan load artifact, không deploy.
- Tham số: `workspaceRoot`, `requirementFolder`, `artifact` (path tương đối Pentaho root) (bắt buộc); `parameters?`, `timeoutMs?`.
- Output: `UNAVAILABLE` (thiếu PDI), `STATIC_VALIDATION_FAILED`, `PASS`/`FAIL`/`TIMEOUT` kèm stdout/stderr đã khử + `logFile`.
- Ví dụ: `{ "workspaceRoot": "C:/ws", "requirementFolder": "REQ_001_CUSTOMER_EXPORT", "artifact": "jobs/main.kjb" }`

### `kettle_runtime_execute`

- Mục đích: execute bằng Kitchen/Pan; `DEV`/`TEST` tự cho phép, mọi môi trường khác cần `confirmed: true`. Giới hạn cwd, param, env, output 256KB, timeout (mặc định 120s). Log khử trong `runtime-logs/`.
- Tham số thêm: `confirmed?` (boolean).
- Ví dụ: `{ "workspaceRoot": "C:/ws", "requirementFolder": "REQ_001_CUSTOMER_EXPORT", "artifact": "jobs/main.kjb", "confirmed": true }`

### `kettle_runtime_logs`

- Mục đích: đọc log đã khử của một workflow.
- Tham số: `workspaceRoot`, `requirementFolder` (bắt buộc).
- Output: `{files: [{name, content}]}`.
- Ví dụ: `{ "workspaceRoot": "C:/ws", "requirementFolder": "REQ_001_CUSTOMER_EXPORT" }`

## Bảng chọn tool

| Việc cần làm | Dùng tool |
|--------------|-----------|
| Liệt kê file | `kettle_list` |
| Tóm tắt job/trans | `kettle_summary` |
| Xem một step/entry | `kettle_get_element` |
| Tìm text/bảng/connection/variable/type | `kettle_search` |
| Tạo file mới | `kettle_create_file` |
| Thêm step/entry từ catalog | `kettle_add_element` |
| Sửa SQL trong element có `<sql>` | `kettle_set_field` với `field: "sql"` |
| Sửa một field / nested path / list | `kettle_set_field`, `kettle_set_field_path`, `kettle_set_fields` |
| Sửa hop thường | `kettle_edit_hops` |
| Thêm error hop transformation | `kettle_add_error_hop` |
| Rename/clone | `kettle_rename_element`, `kettle_clone` |
| Lint file/cây (ranh giới hoàn tất) | `kettle_validate` |
| Hỏi catalog / lấy template / intake unknown / coverage | `kettle_knowledge_list`, `kettle_knowledge_get`, `kettle_knowledge_analyze_xml`, `kettle_knowledge_coverage` |
| Dò PDI / loadcheck / execute / đọc log (ngoài workflow, đã hoãn) | `kettle_runtime_detect`, `kettle_runtime_loadcheck`, `kettle_runtime_execute`, `kettle_runtime_logs` |

## Chỉ đọc vs ghi workspace vs chạy process

| Lớp | Tool |
|-----|------|
| Chỉ đọc (không ghi workspace, không chạy process) | `kettle_list`, `kettle_summary`, `kettle_get_element`, `kettle_search`, `kettle_validate`, `kettle_knowledge_list`, `kettle_knowledge_get`, `kettle_knowledge_analyze_xml`, `kettle_knowledge_coverage`, `kettle_runtime_detect`, `kettle_runtime_logs` |
| Ghi workspace (không chạy process) | 9 edit tool |
| Chạy process (Kitchen/Pan, sau validation tĩnh; ngoài workflow, đã hoãn) | `kettle_runtime_loadcheck`, `kettle_runtime_execute` |
