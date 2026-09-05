# EVAL_FILES_METRICS — Job entry đánh giá số liệu file

Đánh giá số lượng hoặc tổng kích thước file theo điều kiện để rẽ nhánh success/failure.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>EVAL_FILES_METRICS</type>
      <attributes/>
      <result_filenames_wildcard>{{RESULT_FILENAMES_WILDCARD}}</result_filenames_wildcard>
      <Result_field_file>{{RESULT_FILE_FIELD}}</Result_field_file>
      <Result_field_wildcard>{{RESULT_WILDCARD_FIELD}}</Result_field_wildcard>
      <Result_field_includesubfolders>{{RESULT_INCLUDE_SUBFOLDERS_FIELD}}</Result_field_includesubfolders>
      <fields>
        <field>
          <source_filefolder>{{SOURCE_FILE_OR_DIRECTORY}}</source_filefolder>
          <wildcard>{{FILE_WILDCARD}}</wildcard>
          <include_subFolders>N</include_subFolders>
        </field>
      </fields>
      <comparevalue>{{COMPARE_VALUE}}</comparevalue>
      <minvalue/>
      <maxvalue/>
      <successnumbercondition>greater</successnumbercondition>
      <source_files>files</source_files>
      <evaluation_type>size</evaluation_type>
      <scale>bytes</scale>
      <parallel>N</parallel>
      <draw>Y</draw>
      <nr>0</nr>
      <xloc>{{X}}</xloc>
      <yloc>{{Y}}</yloc>
      <attributes_kjc/>
    </entry>
```

## 2. Config Fields

| Field XML | Bắt buộc | Ý nghĩa / cách điền |
|---|---|---|
| `<result_filenames_wildcard>` | Khi `source_files=filenamesresult` | Regex lọc result filenames. |
| `<Result_field_file>`, `<Result_field_wildcard>`, `<Result_field_includesubfolders>` | Khi `source_files=previousresult` | Tên field trong result rows cung cấp file, wildcard và cờ duyệt thư mục con. |
| `<fields>/<field>/<source_filefolder>` | Khi `source_files=files` | File hoặc thư mục cần đánh giá. |
| `<fields>/<field>/<wildcard>` | N | Regex lọc file dưới nguồn. |
| `<fields>/<field>/<include_subFolders>` | N | `Y` để duyệt folder con; `N` mặc định. |
| `<comparevalue>`, `<minvalue>`, `<maxvalue>` | Y theo điều kiện | Ngưỡng một giá trị, hoặc min/max cho `between`. |
| `<successnumbercondition>` | Y | `equal`, `different`, `smaller`, `smallequal`, `greater`, `greaterequal`, `between`, `inlist`, `notinlist`. |
| `<source_files>` | Y | `files`, `filenamesresult` hoặc `previousresult`. |
| `<evaluation_type>` | Y | `size` hoặc `count`; constructor mặc định `size`. |
| `<scale>` | Khi `evaluation_type=size` | `bytes`, `kbytes`, `mbytes`, `gbytes`; mặc định `bytes`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: EVAL_FILES_METRICS` | `<type>` | Luôn là `EVAL_FILES_METRICS`. |
| `configuration.source` | `<source_files>` | `files`/`filenamesresult`/`previousresult`. |
| `configuration.files[].path` | `<fields>/<field>/<source_filefolder>` | Dùng khi source là `files`. |
| `configuration.files[].wildcard` | `<fields>/<field>/<wildcard>` | |
| `configuration.files[].include_subfolders` | `<fields>/<field>/<include_subFolders>` | Y/N. |
| `configuration.result_filenames_wildcard` | `<result_filenames_wildcard>` | Dùng khi source là `filenamesresult`. |
| `configuration.previous_result.file_field` | `<Result_field_file>` | Dùng khi source là `previousresult`. |
| `configuration.evaluation_type` | `<evaluation_type>` | `size`/`count`. |
| `configuration.scale` | `<scale>` | Đơn vị size. |
| `configuration.condition` | `<successnumbercondition>` | Mã điều kiện. |
| `configuration.compare_value` | `<comparevalue>` | Không dùng khi condition là `between`. |
| `configuration.min_value`, `configuration.max_value` | `<minvalue>`, `<maxvalue>` | Dùng khi condition là `between`. |

Fill `<fields>` bằng `set_fields` (listTag=`fields`, itemTag=`field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `engine/src/main/java/org/pentaho/di/job/entries/evalfilesmetrics/JobEntryEvalFilesMetrics.java :: getXML()`.

- `getXML()` ghi `result_filenames_wildcard`, `Result_field_file`, `Result_field_wildcard`, `Result_field_includesubfolders`; sau đó mở `<fields>` và ghi mỗi `<field>` theo thứ tự `source_filefolder`, `wildcard`, `include_subFolders`; cuối cùng ghi `comparevalue`, `minvalue`, `maxvalue`, `successnumbercondition`, `source_files`, `evaluation_type`, `scale`.
- Constructor mặc định `source_files=files`, `evaluation_type=size`, `scale=bytes`, `successnumbercondition=greater`. Ví dụ observed trước đây cho pattern kiểm tra có file là `evaluation_type=count`, `successnumbercondition=greater`, `comparevalue=0`.

## 5. Lưu ý / bẫy

- Ba tag `Result_field_*` có chữ `R` hoa vì `getXML()` của PDI 9.4 ghi đúng như vậy. `loadXML()` lại đọc `result_field_*` viết thường; đây là bất nhất trong source, nhưng template canonical phải khớp serializer.
- Với `source_files=files`, dùng list `<fields>`; với `filenamesresult`, danh sách đến từ result filenames; với `previousresult`, `<Result_field_file>` phải trỏ đến field file trong result row.
- `between` yêu cầu `minvalue` và `maxvalue`; các điều kiện khác dùng `comparevalue`. Khi đánh giá `size`, giá trị được quy đổi theo `<scale>` trước khi so sánh.
