# TextFileInput — Step đọc file văn bản

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>TextFileInput</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <accept_filenames>N</accept_filenames>
    <passing_through_fields>N</passing_through_fields>
    <accept_field>{{FILENAME_FIELD}}</accept_field>
    <accept_stepname>{{FILENAME_SOURCE_STEP}}</accept_stepname>
    <separator>{{SEPARATOR}}</separator>
    <enclosure>"</enclosure>
    <enclosure_breaks>N</enclosure_breaks>
    <escapechar/>
    <header>Y</header>
    <nr_headerlines>1</nr_headerlines>
    <footer>N</footer>
    <nr_footerlines>1</nr_footerlines>
    <line_wrapped>N</line_wrapped>
    <nr_wraps>1</nr_wraps>
    <layout_paged>N</layout_paged>
    <nr_lines_per_page>80</nr_lines_per_page>
    <nr_lines_doc_header>0</nr_lines_doc_header>
    <noempty>Y</noempty>
    <include>N</include>
    <include_field/>
    <rownum>N</rownum>
    <rownumByFile>N</rownumByFile>
    <rownum_field/>
    <format>DOS</format>
    <encoding>{{ENCODING}}</encoding>
    <length/>
    <add_to_result_filenames>Y</add_to_result_filenames>
    <file>
      <name>{{FILE_PATH}}</name>
      <filemask/>
      <exclude_filemask/>
      <file_required>N</file_required>
      <include_subfolders>N</include_subfolders>
      <type>CSV</type>
      <compression>None</compression>
    </file>
    <filters>
    </filters>
    <fields>
      <field>
        <name>{{FIELD_NAME}}</name>
        <type>{{TYPE}}</type>
        <format/>
        <currency/>
        <decimal/>
        <group/>
        <nullif/>
        <ifnull/>
        <position>-1</position>
        <length>-1</length>
        <precision>-1</precision>
        <trim_type>none</trim_type>
        <repeat>N</repeat>
      </field>
    </fields>
    <limit>0</limit>
    <error_ignored>N</error_ignored>
    <skip_bad_files>N</skip_bad_files>
    <file_error_field/>
    <file_error_message_field/>
    <error_line_skipped>N</error_line_skipped>
    <error_count_field/>
    <error_fields_field/>
    <error_text_field/>
    <bad_line_files_destination_directory/>
    <bad_line_files_extension>warning</bad_line_files_extension>
    <error_line_files_destination_directory/>
    <error_line_files_extension>error</error_line_files_extension>
    <line_number_files_destination_directory/>
    <line_number_files_extension>line</line_number_files_extension>
    <date_format_lenient>Y</date_format_lenient>
    <date_format_locale>en_US</date_format_locale>
    <shortFileFieldName/>
    <pathFieldName/>
    <hiddenFieldName/>
    <lastModificationTimeFieldName/>
    <uriNameFieldName/>
    <rootUriNameFieldName/>
    <extensionFieldName/>
    <sizeFieldName/>
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
| `<accept_filenames>` | N | Nhận filename từ step trước bằng `Y`. |
| `<accept_field>` | N | Field chứa filename khi nhận từ step trước. |
| `<accept_stepname>` | N | Tên step cung cấp filename. |
| `<separator>` | Y | Ký tự phân cách. |
| `<enclosure>` | N | Ký tự bao chuỗi. |
| `<escapechar>` | N | Ký tự escape. |
| `<header>` | N | File có header. |
| `<nr_headerlines>` | N | Số dòng header. |
| `<footer>` | N | File có footer. |
| `<nr_footerlines>` | N | Số dòng footer. |
| `<format>` | N | Kiểu line ending/format do Spoon ghi. |
| `<encoding>` | N | Encoding file. |
| `<file>/<name>` | Y | Đường dẫn file (hoặc thư mục + `filemask`). `<type>`=CSV/Fixed, `<compression>`=None/Zip/GZip. |
| `<filters>` | N | Danh sách filter dòng; có thể để rỗng. |
| `<fields>/<field>` | Y | Mỗi field đầu ra: `name`, `type`, `position` (-1 delimited / vị trí cho Fixed), `length`, `trim_type`. |
| `<limit>` | N | Giới hạn số dòng; `0` là không giới hạn. |
| `<error_ignored>` | N | Bỏ qua lỗi parse. |
| `<add_to_result_filenames>` | N | Thêm file đã đọc vào result. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: TEXT_FILE_INPUT` | `<type>` | `TextFileInput`. |
| `configuration.separator` | `<separator>` | XML escape nếu cần. |
| `configuration.enclosure` | `<enclosure>` |  |
| `configuration.encoding` | `<encoding>` |  |
| `configuration.header` | `<header>` | Y/N. |
| `configuration.files[].path` | `<file>/<name>` |  |
| `configuration.files[].mask` | `<file>/<filemask>` | Regex khi đọc nhiều file. |
| `configuration.fields[].name` | `<fields>/<field>/<name>` |  |
| `configuration.fields[].type` | `<fields>/<field>/<type>` |  |
| `configuration.fields[].position` | `<fields>/<field>/<position>` | Fixed-width dùng vị trí; delimited để `-1`. |
| `configuration.filename_source_step` | `<accept_stepname>` | Tham chiếu step. |

Fill danh sách field bằng `set_fields` (listTag=`fields`, itemTag=`field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`engine/src/main/java/org/pentaho/di/trans/steps/fileinput/text/TextFileInputMeta.java :: getXML()`
(bản legacy song sinh: `engine/.../textfileinput/TextFileInputMeta.java`
— cùng hình dạng nhưng KHÔNG có node `<length>`; Spoon ghi `<length/>`
nên template theo bản `fileinput/text`).

`getXML()` ghi đúng thứ tự: `accept_filenames`, `passing_through_fields`,
`accept_field`, `accept_stepname`, `separator`, `enclosure`,
`enclosure_breaks`, `escapechar`, `header`, `nr_headerlines`, `footer`,
`nr_footerlines`, `line_wrapped`, `nr_wraps`, `layout_paged`,
`nr_lines_per_page`, `nr_lines_doc_header`, `noempty`, `include`,
`include_field`, `rownum`, `rownumByFile`, `rownum_field`, `format`,
`encoding`, **`length`**, `add_to_result_filenames`, khối `<file>`
(`name`/`filemask`/`exclude_filemask`/`file_required`/
`include_subfolders` × N rồi `type`, `compression`), khối `<filters>`
(mỗi `<filter>`: `filter_string` base64, `filter_position`,
`filter_is_last_line`, `filter_is_positive`), khối `<fields>` (mỗi
`<field>` 13 node: `name`, `type`, `format`, `currency`, `decimal`,
`group`, `nullif`, `ifnull`, `position`, `length`, `precision`,
`trim_type`, `repeat`), rồi `limit` và nhóm error handling
(`error_ignored`…`sizeFieldName`).

Ví dụ production: `old_src/trans/trans_read_html_warning.ktr`, step "Text file input".

## 5. Lưu ý / bẫy

- Với file Fixed-width, `<file>/<type>` = `Fixed` và mỗi field cần `<position>`/`<length>` đúng; với delimited (CSV) thì `<position>=-1` và cần `<separator>`.
- Nếu `accept_filenames=Y`, `<accept_stepname>` là tham chiếu step và phải được nối bằng `set_field`/`set_field_path` cùng `edit_hops`; không hardcode.
- Separator, enclosure và nội dung text phải XML-escape khi có ký tự đặc biệt.

## Production Example

Trích từ file production: `old_src/trans/trans_read_html_warning.ktr` (đọc 1 file thành 1 cột `html`, Fixed, không header):

```xml
<step>
    <name>Text file input</name>
    <type>TextFileInput</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <accept_filenames>N</accept_filenames>
    <passing_through_fields>N</passing_through_fields>
    <accept_field/>
    <accept_stepname/>
    <separator/>
    <enclosure/>
    <enclosure_breaks>N</enclosure_breaks>
    <escapechar/>
    <header>N</header>
    <nr_headerlines>1</nr_headerlines>
    <footer>N</footer>
    <nr_footerlines>1</nr_footerlines>
    <line_wrapped>N</line_wrapped>
    <nr_wraps>1</nr_wraps>
    <layout_paged>N</layout_paged>
    <nr_lines_per_page>80</nr_lines_per_page>
    <nr_lines_doc_header>0</nr_lines_doc_header>
    <noempty>N</noempty>
    <include>N</include>
    <include_field/>
    <rownum>N</rownum>
    <rownumByFile>N</rownumByFile>
    <rownum_field/>
    <format>mixed</format>
    <encoding>UTF-8</encoding>
    <length/>
    <add_to_result_filenames>Y</add_to_result_filenames>
    <file>
      <name>${FOLDER_JOB}\file.html</name>
      <filemask/>
      <exclude_filemask/>
      <file_required>N</file_required>
      <include_subfolders>N</include_subfolders>
      <type>Fixed</type>
      <compression>None</compression>
    </file>
    <filters>
    </filters>
    <fields>
      <field>
        <name>html</name>
        <type>String</type>
        <format/>
        <currency/>
        <decimal/>
        <group/>
        <nullif/>
        <ifnull/>
        <position>0</position>
        <length>999999</length>
        <precision>-1</precision>
        <trim_type>none</trim_type>
        <repeat>N</repeat>
      </field>
    </fields>
    <limit>0</limit>
    <error_ignored>N</error_ignored>
    <skip_bad_files>N</skip_bad_files>
    <file_error_field/>
    <file_error_message_field/>
    <error_line_skipped>N</error_line_skipped>
    <error_count_field/>
    <error_fields_field/>
    <error_text_field/>
    <date_format_lenient>Y</date_format_lenient>
    <date_format_locale>en_US</date_format_locale>
    <attributes/>
    <cluster_schema/>
    <remotesteps>
      <input>
      </input>
      <output>
      </output>
    </remotesteps>
    <GUI>
      <xloc>443</xloc>
      <yloc>241</yloc>
      <draw>Y</draw>
    </GUI>
  </step>
```

