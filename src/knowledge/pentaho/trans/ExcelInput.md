# ExcelInput

Transformation step đọc file Excel (.xls, .xlsx) thành stream dòng.

## 1. XML Template

```xml
<step>
  <name>{{STEP_NAME}}</name>
  <type>ExcelInput</type>
  <description/>
  <distribute>Y</distribute>
  <custom_distribution/>
  <copies>1</copies>
  <partitioning>
    <method>none</method>
    <schema_name/>
  </partitioning>
  <header>{{HAS_HEADER}}</header>
  <noempty>{{SKIP_EMPTY_ROWS}}</noempty>
  <stoponempty>{{STOP_ON_EMPTY}}</stoponempty>
  <filefield/>
  <sheetfield/>
  <sheetrownumfield/>
  <rownumfield/>
  <sheetfield/>
  <filefield/>
  <limit>{{ROW_LIMIT}}</limit>
  <encoding>{{ENCODING}}</encoding>
  <add_to_result_filenames>{{ADD_TO_RESULT}}</add_to_result_filenames>
  <accept_filenames>{{ACCEPT_FILENAMES_FROM_STEP}}</accept_filenames>
  <accept_field/>
  <accept_stepname/>
  <file>
    <name>{{FILE_PATH}}</name>
    <filemask>{{FILE_MASK}}</filemask>
    <exclude_filemask/>
    <file_required>{{FILE_REQUIRED}}</file_required>
    <include_subfolders>{{INCLUDE_SUBFOLDERS}}</include_subfolders>
  </file>
  <fields>
    <field>
      <name>{{FIELD_NAME}}</name>
      <type>{{FIELD_TYPE}}</type>
      <length>{{LENGTH}}</length>
      <precision>{{PRECISION}}</precision>
      <trim_type>{{TRIM_TYPE}}</trim_type>
      <repeat>{{REPEAT}}</repeat>
      <format>{{FORMAT}}</format>
      <currency/>
      <decimal/>
      <group/>
    </field>
    <!-- repeat for each field -->
  </fields>
  <sheets>
    <sheet>
      <name>{{SHEET_NAME}}</name>
      <startrow>{{START_ROW}}</startrow>
      <startcol>{{START_COL}}</startcol>
    </sheet>
  </sheets>
  <strict_types>N</strict_types>
  <error_ignored>N</error_ignored>
  <error_line_skipped>N</error_line_skipped>
  <bad_line_files_destination_directory/>
  <bad_line_files_extension>warning</bad_line_files_extension>
  <error_line_files_destination_directory/>
  <error_line_files_extension>error</error_line_files_extension>
  <line_number_files_destination_directory/>
  <line_number_files_extension>line</line_number_files_extension>
  <shortFileFieldName/>
  <pathFieldName/>
  <hiddenFieldName/>
  <lastModificationTimeFieldName/>
  <uriNameFieldName/>
  <rootUriNameFieldName/>
  <extensionFieldName/>
  <sizeFieldName/>
  <spreadsheet_type>{{SPREADSHEET_TYPE}}</spreadsheet_type>
  <password>${EXCEL_PASSWORD}</password>
  <attributes/>
  <cluster_schema/>
  <remotesteps>
    <input/>
    <output/>
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
| `header` | Y | `Y`/`N` — dòng đầu là header |
| `noempty` | Y | `Y`/`N` — bỏ qua dòng rỗng |
| `stoponempty` | Y | `Y`/`N` — dừng đọc khi gặp dòng rỗng |
| `limit` | Y | Số dòng tối đa (0 = không giới hạn) |
| `encoding` | N | Encoding (trống = mặc định hệ thống) |
| `add_to_result_filenames` | Y | `Y`/`N` |
| `accept_filenames` | Y | `Y`/`N` — nhận danh sách file từ step khác |
| `file/name` | Y* | Đường dẫn file hoặc folder. Hỗ trợ biến |
| `file/filemask` | N | Regex lọc file trong folder |
| `file/file_required` | Y | `Y`/`N` |
| `file/include_subfolders` | Y | `Y`/`N` |
| `sheets/sheet/name` | Y | Tên sheet cần đọc |
| `sheets/sheet/startrow` | Y | Dòng bắt đầu (0-indexed) |
| `sheets/sheet/startcol` | Y | Cột bắt đầu (0-indexed) |
| `fields/field/name` | Y | Tên field output |
| `fields/field/type` | Y | `String`, `Number`, `Date`, `Boolean`, `Integer`, `BigNumber` |
| `fields/field/length` | N | Độ dài (-1 = mặc định) |
| `fields/field/precision` | N | Precision (-1 = mặc định) |
| `fields/field/trim_type` | N | `none`, `left`, `right`, `both` |
| `fields/field/repeat` | N | `Y`/`N` — lặp giá trị từ dòng trên nếu cell rỗng |
| `strict_types` | N | `N` mặc định; `Y` = ép kiểu nghiêm ngặt |
| `error_ignored` / `error_line_skipped` | N | Xử lý lỗi mức dòng |
| `spreadsheet_type` | Y | `POI` (xls+xlsx), `SAX_POI` (xlsx streaming), `ODS` |
| `password` | N | Mật khẩu file Excel — dùng `${VAR}`, không hardcode |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `file_path` | `file/name` | Hỗ trợ biến |
| `file_mask` | `file/filemask` | Regex |
| `sheet_name` | `sheets/sheet/name` | |
| `start_row` | `sheets/sheet/startrow` | 0-indexed |
| `start_col` | `sheets/sheet/startcol` | 0-indexed |
| `has_header` | `header` | Y/N |
| `skip_empty` | `noempty` | Y/N |
| `row_limit` | `limit` | 0 = unlimited |
| `field_mapping[].name` | `fields/field/name` | |
| `field_mapping[].type` | `fields/field/type` | |
| `spreadsheet_engine` | `spreadsheet_type` | POI/SAX_POI/ODS |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`plugins/excel/core/src/main/java/org/pentaho/di/trans/steps/excelinput/ExcelInputMeta.java :: getXML()`.

`getXML()` ghi đúng thứ tự: `header`, `noempty`, `stoponempty`,
`filefield`, `sheetfield`, `sheetrownumfield`, `rownumfield`,
`sheetfield`, `filefield` (trùng lặp đúng như source), `limit`,
`encoding`, `add_to_result_filenames`, `accept_filenames`,
`accept_field`, `accept_stepname`, khối `<file>`, khối `<fields>`
(mỗi `<field>` 10 node: `name`, `type`, `length`, `precision`,
`trim_type`, `repeat`, `format`, `currency`, `decimal`, `group`),
khối `<sheets>`, rồi nhóm error handling (`strict_types`…
`sizeFieldName`), `spreadsheet_type`, `password` (mã hoá qua
`Encr.encryptPasswordIfNotUsingVariables` — dùng `${VAR}`).

Ví dụ rút gọn (đủ các khối chính):

```xml
<!-- Provenance: old_src/trans/trans_file_toi_buttoan_loaitru_from_mpa.ktr, step "Microsoft Excel input" -->
<step>
  <name>Microsoft Excel input</name>
  <type>ExcelInput</type>
  <header>Y</header>
  <noempty>Y</noempty>
  <stoponempty>N</stoponempty>
  <limit>0</limit>
  <file>
    <name>${INPUT_FILE_DIR}</name>
    <filemask>.*\.xlsx$</filemask>
    <file_required>Y</file_required>
    <include_subfolders>N</include_subfolders>
  </file>
  <sheets>
    <sheet>
      <name>Sheet1</name>
      <startrow>0</startrow>
      <startcol>0</startcol>
    </sheet>
  </sheets>
  <fields>
    <field>
      <name>MA_CN</name>
      <type>String</type>
      <length>-1</length>
      <precision>-1</precision>
      <trim_type>none</trim_type>
      <repeat>N</repeat>
    </field>
    <field>
      <name>TIENNO</name>
      <type>Number</type>
      <length>-1</length>
      <precision>-1</precision>
      <trim_type>none</trim_type>
      <repeat>N</repeat>
    </field>
  </fields>
  <spreadsheet_type>POI</spreadsheet_type>
</step>
```

## 5. Lưu ý / bẫy

- **SAX_POI cho file lớn**: `POI` load toàn bộ file vào memory, `SAX_POI` streaming nhưng chỉ hỗ trợ .xlsx.
- **startrow 0-indexed**: Nếu header=Y thì dòng header là startrow, dữ liệu bắt đầu từ dòng kế tiếp.
- **Field type phải khớp với dữ liệu Excel**: Nếu khai báo Number mà cell chứa text → lỗi mức dòng.
- **filemask là regex**: Không phải glob. `*.xlsx` sai, cần `.*\.xlsx`.
- **Không dùng đường dẫn tuyệt đối trong design**: Dùng biến `${VAR}` cho đường dẫn file.

## Production Example

Trích từ file production: `etl_trans_import_namlc1.ktr`

```xml
<step>
  <name>Microsoft Excel input</name>
  <type>ExcelInput</type>
  <description/>
  <distribute>Y</distribute>
  <custom_distribution/>
  <copies>1</copies>
  <partitioning>
    <method>none</method>
    <schema_name/>
  </partitioning>
  <header>Y</header>
  <noempty>Y</noempty>
  <stoponempty>N</stoponempty>
  <filefield/>
  <sheetfield/>
  <sheetrownumfield/>
  <rownumfield/>
  <sheetfield/>
  <filefield/>
  <limit>0</limit>
  <encoding/>
  <add_to_result_filenames>Y</add_to_result_filenames>
  <accept_filenames>N</accept_filenames>
  <accept_field/>
  <accept_stepname/>
  <file>
    <name>${INPUT_FILE_DIR}/temp_list_ld.xlsx</name>
    <filemask/>
    <exclude_filemask/>
    <file_required>N</file_required>
    <include_subfolders>N</include_subfolders>
  </file>
  <fields>
    <field>
      <name>LD_ID</name>
      <type>String</type>
      <length>-1</length>
      <precision>-1</precision>
      <trim_type>none</trim_type>
      <repeat>N</repeat>
      <format/>
      <currency/>
      <decimal/>
      <group/>
    </field>
    <field>
      <name>KHOI</name>
      <type>String</type>
      <length>-1</length>
      <precision>-1</precision>
      <trim_type>none</trim_type>
      <repeat>N</repeat>
      <format/>
      <currency/>
      <decimal/>
      <group/>
    </field>
    <field>
      <name>DANHMUC</name>
      <type>String</type>
      <length>-1</length>
      <precision>-1</precision>
      <trim_type>none</trim_type>
      <repeat>N</repeat>
      <format/>
      <currency/>
      <decimal/>
      <group/>
    </field>
    <field>
      <name>THANG</name>
      <type>String</type>
      <length>-1</length>
      <precision>-1</precision>
      <trim_type>none</trim_type>
      <repeat>N</repeat>
      <format/>
      <currency/>
      <decimal/>
      <group/>
    </field>
  </fields>
  <sheets>
    <sheet>
      <name>Sheet1</name>
      <startrow>0</startrow>
      <startcol>0</startcol>
    </sheet>
  </sheets>
  <strict_types>N</strict_types>
  <error_ignored>N</error_ignored>
  <error_line_skipped>N</error_line_skipped>
  <bad_line_files_destination_directory/>
  <bad_line_files_extension>warning</bad_line_files_extension>
  <error_line_files_destination_directory/>
  <error_line_files_extension>error</error_line_files_extension>
  <line_number_files_destination_directory/>
  <line_number_files_extension>line</line_number_files_extension>
  <shortFileFieldName/>
  <pathFieldName/>
  <hiddenFieldName/>
  <lastModificationTimeFieldName/>
  <uriNameFieldName/>
  <rootUriNameFieldName/>
  <extensionFieldName/>
  <sizeFieldName/>
  <spreadsheet_type>SAX_POI</spreadsheet_type>
  <password>Encrypted </password>
  <attributes/>
  <cluster_schema/>
  <remotesteps>
    <input>
      </input>
    <output>
      </output>
  </remotesteps>
  <GUI>
    <xloc>368</xloc>
    <yloc>192</yloc>
    <draw>Y</draw>
  </GUI>
</step>
```
