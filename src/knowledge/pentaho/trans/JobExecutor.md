# JobExecutor — Step gọi một job con cho mỗi nhóm dòng

Thực thi một .kjb con, truyền tham số/biến, thu kết quả về stream.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>JobExecutor</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <specification_method>filename</specification_method>
    <job_object_id/>
    <job_name/>
    <filename>{{SUB_JOB_PATH}}</filename>
    <directory_path/>
    <group_size>-1</group_size>
    <group_field/>
    <group_time/>
    <parameters>
      <variablemapping>
        <variable>{{PARAM_NAME}}</variable>
        <field>{{SOURCE_FIELD}}</field>
        <input/>
      </variablemapping>
      <inherit_all_vars>Y</inherit_all_vars>
    </parameters>
    <execution_result_target_step/>
    <execution_time_field>{{EXEC_TIME_FIELD}}</execution_time_field>
    <execution_result_field>{{EXEC_RESULT_FIELD}}</execution_result_field>
    <execution_errors_field>{{EXEC_ERRORS_FIELD}}</execution_errors_field>
    <execution_lines_read_field/>
    <execution_lines_written_field/>
    <execution_lines_input_field/>
    <execution_lines_output_field/>
    <execution_lines_rejected_field/>
    <execution_lines_updated_field/>
    <execution_lines_deleted_field/>
    <execution_files_retrieved_field/>
    <execution_exit_status_field/>
    <execution_log_text_field/>
    <execution_log_channelid_field/>
    <result_rows_target_step/>
    <result_files_target_step/>
    <result_files_file_name_field/>
    <attributes/>
    <cluster_schema/>
    <remotesteps>
      <input>
      </input>
      <output>
      </output>
    </remotesteps>
    <GUI>
      <xloc>{{X}}</xloc>
      <yloc>{{Y}}</yloc>
      <draw>Y</draw>
    </GUI>
  </step>
```

## 2. Config Fields

| Field XML | Bắt buộc | Ý nghĩa / cách điền |
|---|---|---|
| `<specification_method>` | Y | Cách trỏ job con: `filename` (theo file) hoặc `rep_name`/`rep_ref`. `setDefault`=`filename`. |
| `<job_object_id>` | N | ID job trong repository (khi dùng repo). |
| `<job_name>` | N | Tên job trong repository. |
| `<filename>` | Tùy | Đường dẫn .kjb con (khi `specification_method=filename`). THAM CHIẾU FILE. |
| `<directory_path>` | N | Thư mục repo chứa job. |
| `<group_size>` | N | Số dòng gom mỗi lần gọi job con; `-1`=tất cả một lần. |
| `<group_field>` | N | Gom nhóm theo field (thay vì group_size). |
| `<parameters>` | N | Ánh xạ tham số/biến truyền vào job con. |
| `<parameters>/<variablemapping>/<variable>` | N | Tên tham số/biến của job con. |
| `<parameters>/<variablemapping>/<field>` | N | Field nguồn cấp giá trị. |
| `<parameters>/<variablemapping>/<input>` | N | Giá trị tĩnh (nếu không lấy từ field). |
| `<parameters>/<inherit_all_vars>` | N | `Y`=job con kế thừa mọi biến của trans cha. |
| `<execution_*_field>` | N | Field output nhận thông tin thực thi (thời gian, số dòng, lỗi...). |
| `<result_rows_target_step>` | N | Step nhận result rows từ job con. THAM CHIẾU STEP. |

## 3. YAML→XML Mapping

| YAML | XML | Ghi chú |
|---|---|---|
| `type: JOB_EXECUTOR` | `<type>` | `JobExecutor`. |
| `configuration.sub_job_path` | `<filename>` | Tham chiếu .kjb con. |
| `configuration.group_size` | `<group_size>` | |
| `configuration.parameters[].variable` | `<parameters>/<variablemapping>/<variable>` | |
| `configuration.parameters[].field` | `<parameters>/<variablemapping>/<field>` | |
| `configuration.inherit_all_vars` | `<parameters>/<inherit_all_vars>` | Y/N. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `engine/src/main/java/org/pentaho/di/trans/steps/jobexecutor/JobExecutorMeta.java :: getXML()` (+ `JobExecutorParameters.java :: getXML()`).

- Thân step ghi: `specification_method` (= `ObjectLocationSpecificationMethod.getCode()`, mặc định `filename`), `job_object_id`, `job_name`, `filename`, `directory_path`, `group_size`, `group_field`, `group_time`.
- Chèn `parameters.getXML()`: tag hằng `XML_TAG="parameters"`, lặp `variablemapping` (`variable`, `field`, `input`), rồi `inherit_all_vars`.
- Tiếp: nhiều `execution_*` field (target step + các field output), rồi `result_rows_target_step` với các item lặp `<result_rows_field>` (`name`, `type`, `length`, `precision`), `result_files_target_step`, `result_files_file_name_field`.
- `setDefault()`: `specificationMethod=FILENAME`, `parameters=new JobExecutorParameters()`.

## 5. Lưu ý / bẫy

- `<filename>` (job con) và `<result_rows_target_step>`/`<execution_result_target_step>` là THAM CHIẾU: generator set qua `set_field`/`set_field_path` và nối step đích bằng `edit_hops`. KHÔNG hardcode.
- `specification_method` quyết định dùng `<filename>` hay `<job_name>`+`<directory_path>` (repository).
- `<parameters>` là sub-block cố định (tag `parameters`); item `variablemapping` fill được nhưng nằm cùng cấp với `inherit_all_vars` — chèn cẩn thận theo thứ tự.
- `<result_rows_field>` là các node ANH EM (không có tag list bao) dưới `<step>`, sau `result_rows_target_step` — giống pattern Calculator.
- `group_size=-1` = gộp toàn bộ dòng gọi job con một lần.
