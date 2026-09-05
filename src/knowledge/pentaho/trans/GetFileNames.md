# GetFileNames — Step liệt kê tên file

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>GetFileNames</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <filter>
      <filterfiletype>all_files</filterfiletype>
    </filter>
    <doNotFailIfNoFile>N</doNotFailIfNoFile>
    <rownum>N</rownum>
    <isaddresult>Y</isaddresult>
    <filefield>N</filefield>
    <rownum_field>{{ROW_NUMBER_FIELD}}</rownum_field>
    <filename_Field>{{DYNAMIC_FILENAME_FIELD}}</filename_Field>
    <wildcard_Field>{{DYNAMIC_WILDCARD_FIELD}}</wildcard_Field>
    <exclude_wildcard_Field>{{DYNAMIC_EXCLUDE_FIELD}}</exclude_wildcard_Field>
    <dynamic_include_subfolders>N</dynamic_include_subfolders>
    <limit>0</limit>
    <file>
      <name>{{FOLDER_OR_FILE_PATH}}</name>
      <filemask>{{FILEMASK_REGEX}}</filemask>
      <exclude_filemask/>
      <file_required>N</file_required>
      <include_subfolders>N</include_subfolders>
    </file>
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
| `<filter/filterfiletype>` | N | Loại file cần lấy; nguồn dùng `all_files`. |
| `<doNotFailIfNoFile>` | N | Không fail khi không có file. |
| `<rownum>` | N | Thêm số thứ tự dòng. |
| `<rownum_field>` | N | Tên field số thứ tự. |
| `<isaddresult>` | N | Thêm filename vào result. |
| `<filefield>` | N | Nhận file/filter từ field động. |
| `<filename_Field>` | N | Field filename động. |
| `<wildcard_Field>` | N | Field wildcard động. |
| `<exclude_wildcard_Field>` | N | Field wildcard loại trừ. |
| `<dynamic_include_subfolders>` | N | Bao gồm thư mục con cho input động. |
| `<limit>` | N | Giới hạn số file; `0` là không giới hạn. |
| `<file>` | Y | Danh sách path, wildcard và recurse; nguồn rỗng. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: GET_FILE_NAMES` | `<type>` | `GetFileNames`. |
| `configuration.file_type` | `<filter/filterfiletype>` |  |
| `configuration.do_not_fail_if_empty` | `<doNotFailIfNoFile>` | Y/N. |
| `configuration.add_to_result` | `<isaddresult>` | Y/N. |
| `configuration.files[].path` | `<file>/<name>` | Đường dẫn thư mục hoặc file. |
| `configuration.files[].mask` | `<file>/<filemask>` | **Regex** (không phải glob), vd `(?i).*\.(kjb\|ktr)$`. |
| `configuration.files[].include_subfolders` | `<file>/<include_subfolders>` | Y/N. |
| `configuration.dynamic.filename_field` | `<filename_Field>` |  |

Fill danh sách bằng `set_fields` (listTag không tồn tại — dùng `set_field_path` cho từng `file/name`, `file/filemask`) hoặc lặp block `<file>`.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`engine/src/main/java/org/pentaho/di/trans/steps/getfilenames/GetFileNamesMeta.java :: getXML()`.

`getXML()` ghi đúng thứ tự: khối `<filter>` (`filterfiletype` —
enum `FileInputList.FileTypeFilter`), `doNotFailIfNoFile`, `rownum`,
`isaddresult`, `filefield`, `rownum_field`, `filename_Field`,
`wildcard_Field`, `exclude_wildcard_Field`,
`dynamic_include_subfolders`, `limit`, rồi khối `<file>` (mỗi entry 5
node: `name`, `filemask`, `exclude_filemask`, `file_required`,
`include_subfolders` — KHÔNG có tag bao con, lặp trực tiếp trong
`<file>`). `loadXML()`/`readData()` đọc lại khớp.

Ví dụ production: `old_src/trans/trans_export_repo_reformat.ktr`, step "Get File Names".

## 5. Lưu ý / bẫy

- `<filemask>` là **regex** của Java, không phải glob shell: `.*\.txt$` chứ không phải `*.txt`.
- Có thể lặp nhiều block `<file>` để quét nhiều thư mục.
- Khi dùng field động (`filefield=Y`), tên field phải tồn tại trong stream đầu vào và topology cần hop hợp lệ.

## Production Example

Trích từ file production: `old_src/trans/trans_export_repo_reformat.ktr`

```xml
<step>
    <name>Get File Names</name>
    <type>GetFileNames</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <filter>
      <filterfiletype>all_files</filterfiletype>
    </filter>
    <doNotFailIfNoFile>N</doNotFailIfNoFile>
    <rownum>N</rownum>
    <isaddresult>N</isaddresult>
    <filefield>N</filefield>
    <rownum_field/>
    <filename_Field/>
    <wildcard_Field/>
    <exclude_wildcard_Field/>
    <dynamic_include_subfolders>N</dynamic_include_subfolders>
    <limit>0</limit>
    <file>
      <name>${OUTPUT_PATH}</name>
      <filemask>(?i).*\.(kjb|ktr)$</filemask>
      <exclude_filemask/>
      <file_required>N</file_required>
      <include_subfolders>Y</include_subfolders>
    </file>
    <attributes/>
    <cluster_schema/>
    <remotesteps>
      <input>
      </input>
      <output>
      </output>
    </remotesteps>
    <GUI>
      <xloc>348</xloc>
      <yloc>139</yloc>
      <draw>Y</draw>
    </GUI>
  </step>
```

