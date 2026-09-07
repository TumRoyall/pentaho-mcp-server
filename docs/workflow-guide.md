# Hướng dẫn workflow lifecycle

Playbook end-to-end cho operator và agent: khởi tạo, resume, hoàn tất và đối chiếu một requirement. Nguồn sự thật: `src/lifecycle/*`, `src/workflow/*`, `src/sync/*`, `test/lifecycle-*.test.js`.

Prompt `develop-pentaho-job` (`requirementFolder` bắt buộc) và 5 resource `dte-pentaho://skills/...` dẫn dắt agent; tool bậc cao `pentaho_*` thực thi từng chặng.

## 1. Prerequisite và bố cục workspace

- Workspace chứa `.pentaho-mcp.yaml` đã commit (xem `docs/configuration.md`).
- Mỗi BA request là một folder con trực tiếp: `REQ_<ID>_<UPPER_SNAKE>` (ví dụ `REQ_001_CUSTOMER_EXPORT`). Sai tên/vị trí → từ chối.
- Bố cục trong một request:

```text
REQ_001_CUSTOMER_EXPORT/
  input/               BA sở hữu, chỉ đọc, chỉ Markdown
  requirement.md       yêu cầu đã validate
  design/              design.md + manifest.yaml + YAML component
  <runtime project>/   KJB/KTR sinh ra (đường dẫn từ manifest pentaho.project_path)
  changelog.md         append-only CHG-NNN
  workflow-state.yaml  advisory, có thể stale
  .pentaho-workflow.lock  lock advisory
  runtime-logs/        log đã khử nhạy cảm
```

- `input/` chỉ đọc: ghi vào `input/` bị từ chối; file không phải Markdown bị liệt `unsupported` và chặn workflow (`BLOCKED/UNSUPPORTED_INPUT`).
- `KETTLE_ROOT` nên trỏ workspace; đường tương đối trong tool resolve tại đó.

## 2. Từng chặng và gate

| Chặng | Input | Artifact sinh ra | Validator | Điều kiện chặn | Next action |
|-------|-------|------------------|-----------|----------------|-------------|
| Requirement | Markdown trong `input/` | `requirement.md` (technical readiness, không approval con người) | `validateRequirement` | `INPUT_EMPTY`, `UNSUPPORTED_INPUT`, thiếu section/reference, còn blocking open question | `pentaho_requirement_write` rồi resume |
| Design | `requirement.md` | `design/design.md`, `manifest.yaml`, YAML component, diagram regen | `validateDesign` + `writeDesignDiagrams` | `DESIGN_MISSING`, ID/hop/reference/type/traceability/secret fail, diagram stale, catalog gap chưa quyết | `pentaho_design_write` |
| Generation | Design package hợp lệ | Toàn runtime project + `changelog.md` + marker `.pentaho-mcp-generated.json` | `validateGeneration` + `kettle_validate` | `RUNTIME_MISSING`, unknown type, observed thiếu known-gap decision, đích non-empty unmanaged | `pentaho_generate` |
| Modification/Sync | KJB/KTR sửa tay | Patch YAML/design/diagram + `CHG-NNN` | `diffRuntimeDesign` | Semantic conflict | `pentaho_sync_changes` |
| Validation | Toàn bytes hiện tại | Báo cáo tổng hợp (không gộp `NOT_RUN` thành pass) | `finalizeWorkflow` | Blocker bất kỳ | `pentaho_validate_project` |
| Finalization | Báo cáo pass | `COMPLETE` + state `COMPLETE` | `finalizeWorkflow` | Check bắt buộc fail | `pentaho_finalize` |

Workflow tự đánh giá readiness kỹ thuật; không thêm field human approval giữa các pha tài liệu. Agent tự quyết technical choice thông thường; chỉ hỏi user khi mơ hồ nghiệp vụ thật, evidence xung đột, hoặc quyết định thay thế không đảo ngược được.

Trạng thái phục hồi bằng `inspectWorkflow` + `decideNextStage`: `INPUT_CHANGED` → `REQUIREMENT`; thiếu requirement → `REQUIREMENT`; requirement đổi → `DESIGN`; thiếu design → `DESIGN`; design đổi → `GENERATION`; thiếu runtime → `GENERATION`; runtime đổi → `MODIFYING`; đủ artifact → `VALIDATING`; `COMPLETE` không đổi → `COMPLETE`.

## 3. Truy xuất và design contract

- ID append-only: `SRC-*` (nguồn), `R-*` (yêu cầu), `AC-*` (acceptance). Không tái dùng ID.
- `requirement.md` gồm front matter YAML (mapping duy nhất) + 10 section bắt buộc: objective and scope, source contract, target contract, mapping and transformation, load and operating, controls/error handling/security, acceptance criteria, decisions, open questions, evidence. `sourceArtifact` và reference bắt buộc; open question consistency: còn blocking question thì chưa `READY`.
- `manifest.yaml` khai báo component job/transformation với stable component ID, `artifact_name`, requirement reference, connection, entrypoint, `pentaho.project_path`; component YAML tham chiếu đúng ID.
- Mermaid diagram chỉ regen vùng generated đã đánh dấu; stale diagram chặn design.
- Catalog gap: type vắng → design ở `CATALOG_GAP` cho tới khi intake có tài liệu; observed chỉ sinh khi design có technical decision known-gap khớp, và output mang đúng một `MANUAL_REVIEW`. Secret/absolute path/placeholder bị chặn khi generate.

## 4. Resume, lock và compare-and-swap

- Tái dựng từ bytes hiện tại; saved state chỉ advisory. Hash invalid thì resume chặng stale cũ nhất. State invalid được báo, không tin mù quáng.
- Lock advisory theo requirement (`.pentaho-workflow.lock`, gồm PID/session/timestamp), refresh khi mutation, recover stale lock chỉ sau tái kiểm tra, luôn release trong `finally`.
- Mọi ghi lifecycle nhận `expectedHashes` từ lần inspect trước; re-read trước rename; bytes đổi đồng thời → `CONCURRENT_CHANGE`, không ghi. Trả per-file diff + hash mới.

Luồng resume chuẩn:

```json
{ "workspaceRoot": "C:/ws", "requirementFolder": "REQ_001_CUSTOMER_EXPORT" }
```

1. `pentaho_workflow_start` (hoặc `pentaho_project_inspect`) → `decision {stage, reason, blockers, staleArtifacts}` + `expectedHashes`.
2. Gọi tool của chặng đó với `expectedHashes` vừa nhận.
3. `pentaho_workflow_status` kiểm tra chặng tiếp theo.

## 5. Thay đổi KJB/KTR thủ công

- Visual-only drift (tọa độ, serialization nhiễu): `diffRuntimeDesign` bỏ qua, không rewrite design, trả `UNCHANGED`.
- Technical delta an toàn (SQL, field, connection, name, hop): patch đúng node YAML/Markdown/diagram, tăng design revision một lần, prepend một `CHG-NNN`.
- Business-semantic delta: trả `USER_DECISION_REQUIRED`; đồng bộ requirement chỉ khi caller cung cấp business change có evidence; nếu không, công việc quay về requirement hoặc design.
- Unknown XML tồn tại được giữ nguyên khi modify, nhưng không được thêm unknown type mới nếu chưa qua intake.

## 6. Ví dụ end-to-end

Folder trung tính `REQ_001_CUSTOMER_EXPORT`; path/ID hư cấu, không bịa payload Pentaho hay business rule.

1. BA thả Markdown vào `REQ_001_CUSTOMER_EXPORT/input/`.
2. `pentaho_workflow_start` → `REQUIREMENT/REQUIREMENT_MISSING`.
3. `pentaho_requirement_write` (kèm `expectedHashes`) → `DESIGN/DESIGN_MISSING`.
4. `pentaho_design_write` (`design.md`, `manifest.yaml`, component YAML) → `GENERATION/RUNTIME_MISSING`.
5. `pentaho_generate` → runtime project + `changelog.md` → `VALIDATING/ARTIFACTS_PRESENT`.
6. Ai đó sửa tay một SQL trong Spoon → `pentaho_workflow_status` → `MODIFYING/RUNTIME_CHANGED` → `pentaho_sync_changes` → design + `CHG-NNN` mới.
7. `pentaho_validate_project` kiểm tổng hợp; `pentaho_finalize` mark `COMPLETE` chỉ khi mọi check bắt buộc pass.

Mọi chuyển trạng thái kỳ vọng đều quan sát được qua `decision.stage`/`reason` mà không cần đoán.
