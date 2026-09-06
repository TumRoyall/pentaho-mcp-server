# Path-Driven Pentaho Lifecycle Design

## Mục tiêu

Thiết kế lại lifecycle MCP để phát triển Pentaho từ tài liệu yêu cầu trong một repository tài liệu và sinh KJB/KTR vào một repository ETL độc lập. MCP không phụ thuộc tên repository, tên thư mục yêu cầu, đường dẫn máy, hoặc file cấu hình đặt tại workspace root.

Người dùng điều khiển phạm vi bằng prompt. Agent chuyển ý định đó thành các đường dẫn rõ ràng khi gọi tool. MCP không tự đoán vị trí ghi dữ liệu.

## Bối cảnh triển khai

Môi trường thực tế có hai Git repository được clone cục bộ:

```text
<docs-repository>/
└── <request-name>/
    ├── input/
    ├── requirement.md
    └── design/

<etl-repository>/
└── <pentaho-project>/
    ├── *.kjb
    ├── *.ktr
    └── .kettle/
```

Tên hai repository và tên request không thuộc contract của MCP. `<request-name>` có thể là bất kỳ tên thư mục hợp lệ nào; không còn quy tắc `REQ_<ID>_<UPPER_SNAKE>`.

## Quyết định kiến trúc

### Phạm vi do đường dẫn điều khiển

Lifecycle nhận hai đường dẫn gốc:

- `requestPath`: đúng thư mục của một yêu cầu trong repository tài liệu.
- `etlRepositoryPath`: root của toàn bộ repository ETL Pentaho.

Ví dụ:

```json
{
  "requestPath": "D:/work/docs/load-customer",
  "etlRepositoryPath": "D:/work/etl-pentaho"
}
```

MCP không suy ra hai đường dẫn này từ tên repository, current working directory hoặc convention riêng của một công ty.

### Contract của thư mục yêu cầu

Bên trong `requestPath`, ba vị trí sau là contract ổn định:

- `input/`: context nguồn do người dùng sở hữu và chỉ đọc.
- `requirement.md`: requirement đã được agent chuẩn hóa.
- `design/`: design documentation và executable design YAML.

Đây là contract của artifact, không phải mapping project-specific. MCP không tạo một thư mục dùng chung như `docs/pentaho-mcp-server/` và không đặt runtime Pentaho vào repository tài liệu.

MCP phải hash và inventory tất cả file trong `input/`. Khả năng trích xuất nội dung được tổ chức theo adapter mở rộng; loại file chưa có adapter được báo rõ, không bị bỏ qua âm thầm và không làm thay đổi file nguồn.

### Liên kết sang repository ETL

`design/manifest.yaml` chứa đường dẫn project Pentaho tương đối với `etlRepositoryPath`:

```yaml
pentaho:
  project_path: xuat_user_active
  entrypoint_job: JOB-001
```

Manifest không lưu absolute path và không lặp lại tên repository. MCP resolve đích theo:

```text
resolve(etlRepositoryPath, manifest.pentaho.project_path)
```

Đường dẫn đã resolve phải nằm trong `etlRepositoryPath`; absolute path, `..` escape và symlink escape đều bị từ chối.

Nếu manifest chưa tồn tại hoặc chưa có `project_path`, MCP trả trạng thái `TARGET_PROJECT_UNRESOLVED`. Agent phải lấy project đích từ prompt hoặc hỏi người dùng. MCP không tự chọn folder, không tự sinh tên và không ghi trực tiếp vào root repository ETL.

### Vai trò của prompt và agent

Prompt là nơi người dùng chỉ định yêu cầu cần xử lý. Agent chịu trách nhiệm:

1. Lấy `requestPath` và `etlRepositoryPath` từ prompt hoặc hội thoại.
2. Gọi tool inspect trước khi ghi.
3. Đọc context nguồn và soạn requirement/design.
4. Hỏi người dùng khi project ETL đích chưa được xác định.
5. Truyền nội dung và đường dẫn rõ ràng cho tool ghi/generate.

MCP chịu trách nhiệm kiểm tra path, concurrency, schema executable, graph, Pentaho catalog, generation và synchronization. MCP không tự diễn giải một đường dẫn output còn thiếu thành default.

## Cấu hình MCP

`.pentaho-mcp.yaml` không còn bắt buộc và không tham gia xác định lifecycle scope.

Thiết lập cài đặt MCP chỉ giữ thông tin kỹ thuật theo máy, khi cần:

- `PENTAHO_HOME`: vị trí PDI/Kitchen/Pan.
- `PENTAHO_ENV`: chính sách DEV/TEST/PROD.
- Danh sách allowed roots tùy chọn để tăng cường sandbox ở cấp server.

Không lưu `requestPath`, `etlRepositoryPath`, project mapping hoặc output mặc định trong MCP settings. Những giá trị này thuộc từng yêu cầu và từng lần gọi tool.

## Requirement contract

`requirement.md` là tài liệu người đọc, không bị ép theo đúng mười heading tiếng Anh. YAML front matter là phần contract máy đọc được và được version hóa độc lập với cách trình bày Markdown. Metadata tối thiểu gồm:

```yaml
schema_version: 1
artifact_type: pentaho-requirement
revision: 1
status: DRAFT # hoặc READY_FOR_DESIGN
blocking_questions: []
evidence:
  - id: SRC-001
    source: input/phieu-yeu-cau.md
```

Metadata không chứa ID suy ra từ tên folder. Validator kiểm tra các thuộc tính ngữ nghĩa cần thiết thay vì tên và thứ tự heading:

- tài liệu tồn tại và không rỗng;
- không còn placeholder chưa giải quyết;
- evidence/reference được khai báo nhất quán với front matter khi được sử dụng;
- `blocking_questions` rỗng khi status là `READY_FOR_DESIGN`;
- không chứa secret literal.

Tên heading, ngôn ngữ và cách trình bày được tự do. Front matter không được dùng để ép tên folder hoặc project-specific ID.

## Design contract

Design YAML vẫn có schema chặt vì đây là input executable của generator. Các field như component ID, Pentaho type, hop, configuration và requirement traceability là domain contract hợp lệ, không phải project hard-code.

Ngược lại, những phần trình bày không cần cho generator không được khóa cứng:

- `design.md` không bắt buộc heading tiếng Anh;
- diagram có thể được render khi tài liệu khai báo vùng generated, nhưng thiếu marker không làm package vô hiệu nếu diagram không được yêu cầu;
- tên file component do manifest khai báo;
- manifest phải validate schema/version, artifact type, identity, extension và mọi path trước khi generation.

## Tool surface

Các lifecycle tool thay `workspaceRoot + requirementFolder` bằng `requestPath + etlRepositoryPath`:

```text
pentaho_project_inspect
pentaho_workflow_start
pentaho_workflow_status
pentaho_requirement_write
pentaho_design_write
pentaho_generate
pentaho_sync_changes
pentaho_validate_project
pentaho_finalize
```

Để giữ một mental model duy nhất, mọi high-level lifecycle tool nhận cả `requestPath` và `etlRepositoryPath`. Các primitive chỉ thao tác requirement có thể chỉ nhận `requestPath`; các low-level Kettle tool tiếp tục nhận trực tiếp file hoặc directory đích.

Mọi tool ghi phải dùng compare-and-swap hash và canonical path containment. Khi không cấu hình allowed roots ở MCP settings, chính `requestPath` và `etlRepositoryPath` của lần gọi là hai write boundary. Tool không commit, push hoặc deploy.

## Luồng xử lý

1. Inspect `requestPath/input`, `requirement.md`, `design/` và manifest.
2. Nếu requirement thiếu hoặc context thay đổi, trở về requirement analysis.
3. Nếu design thiếu hoặc requirement thay đổi, trở về design.
4. Resolve `manifest.pentaho.project_path` bên trong `etlRepositoryPath`.
5. Nếu target chưa xác định, dừng với `TARGET_PROJECT_UNRESOLVED`.
6. Validate design executable trước khi generation.
7. Generate hoặc patch KJB/KTR trong resolved project directory.
8. Validate runtime và đối chiếu runtime với design.
9. Resume dựa trên bytes hiện tại; saved state chỉ là advisory.

## Xử lý lỗi

- `REQUEST_PATH_INVALID`: request path không tồn tại hoặc không phải directory.
- `INPUT_MISSING`: thiếu `input/` hoặc không có context.
- `CONTEXT_UNREADABLE`: có file nguồn mà adapter hiện tại không đọc được.
- `TARGET_PROJECT_UNRESOLVED`: chưa có project ETL đích đã được xác nhận.
- `TARGET_PATH_ESCAPE`: project path thoát khỏi ETL repository root.
- `CONCURRENT_CHANGE`: file đã thay đổi sau lần inspect.
- `REQUIREMENT_INVALID`, `DESIGN_INVALID`, `GENERATION_INVALID`: validation theo stage thất bại.

Lỗi phải trả về dữ liệu có cấu trúc để agent biết khi nào cần tự sửa và khi nào cần hỏi người dùng.

## Tương thích và migration

- Request folder `REQ_*` hiện tại vẫn hoạt động vì tên đó là một tên folder hợp lệ, nhưng không còn bắt buộc.
- `input/`, `requirement.md` và `design/` hiện tại được giữ nguyên.
- Manifest cũ có `project_path: dte-etl-pentaho/xuat_user_active` cần migrate thành `project_path: xuat_user_active` khi `etlRepositoryPath` đã là root `dte-etl-pentaho`.
- `.pentaho-mcp.yaml` có thể được đọc tạm thời trong giai đoạn chuyển tiếp, nhưng đường dẫn truyền trực tiếp có độ ưu tiên cao hơn. Sau migration, lifecycle không phụ thuộc file này.

## Kiểm thử chấp nhận

- Chấp nhận request folder không theo mẫu `REQ_*`.
- Hai repository có tên bất kỳ vẫn hoạt động khi truyền đúng hai đường dẫn.
- Không có `.pentaho-mcp.yaml` vẫn inspect, write, generate và validate được.
- Project path tương đối resolve đúng bên trong ETL root.
- Absolute path, traversal và symlink escape bị từ chối.
- Thiếu target project không tạo output mặc định và trả `TARGET_PROJECT_UNRESOLVED`.
- Requirement tiếng Việt với heading tùy ý có thể pass khi đủ ngữ nghĩa.
- Design schema thiếu metadata bắt buộc hoặc có artifact path không an toàn bị từ chối.
- Context thay đổi làm workflow quay lại đúng stage.
- Runtime thay đổi thủ công được phát hiện và đồng bộ theo policy hiện có.
- Không tool nào ghi vào `input/`, commit, push hoặc deploy.

## Ngoài phạm vi

- Truy cập GitLab remote qua API.
- Clone repository hoặc quản lý credential GitLab.
- Tự động chọn project ETL dựa trên độ giống tên.
- Tự động commit, push, merge request hoặc deploy.
- Hỗ trợ ngay mọi định dạng binary; kiến trúc adapter chỉ chuẩn bị điểm mở rộng.
