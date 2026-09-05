# CsvInput — Step đọc file CSV/delimited

Đọc file CSV/delimited với buffer + lazy conversion, khai báo layout field cố định.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>CsvInput</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <filename>{{FILE_PATH}}</filename>
    <filename_field/>
    <rownum_field/>
    <include_filename>N</include_filename>
    <separator>,</separator>
    <enclosure>"</enclosure>
    <header>Y</header>
    <buffer_size>50000</buffer_size>
    <lazy_conversion>Y</lazy_conversion>
    <add_filename_result>N</add_filename_result>
    <parallel>N</parallel>
    <newline_possible>N</newline_possible>
    <format>mixed</format>
    <encoding>UTF-8</encoding>
    <fields>
      <field>
        <name>{{FIELD_NAME}}</name>
        <type>String</type>
        <format/>
        <currency/>
        <decimal/>
        <group/>
        <length>-1</length>
        <precision>-1</precision>
        <trim_type>none</trim_type>
      </field>
    </fields>
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
| `<filename>` | Y | Đường dẫn file, nên dùng biến `${...}`. Bỏ trống nếu dùng `<filename_field>`. |
| `<filename_field>` | N | Tên field chứa đường dẫn file (đọc file theo dòng input). |
| `<rownum_field>` | N | Tên field output chứa số dòng. |
| `<include_filename>` | N | `Y`=thêm field tên file. `getXML` từ `includingFilename`. |
| `<separator>` | Y | Ký tự phân tách cột. `setDefault`=`,`. (KEY nội bộ: DELIMITER). |
| `<enclosure>` | N | Ký tự bao chuỗi. `setDefault`=`"`. |
| `<header>` | Y | `Y`=file có dòng header. (KEY: HEADER_PRESENT). |
| `<buffer_size>` | N | Kích thước buffer đọc. `setDefault`=`50000`. |
| `<lazy_conversion>` | N | `Y`=hoãn parse để tăng tốc. |
| `<add_filename_result>` | N | `Y`=thêm file vào result filenames. |
| `<parallel>` | N | `Y`=đọc song song nhiều copy. |
| `<newline_possible>` | N | Cho phép newline trong field (bao bởi enclosure). Mặc định `N` khi parallel, `Y` khi không — ở đây để `N`. |
| `<format>` | N | Kiểu xuống dòng: `mixed`/`DOS`/`Unix`. `setDefault`=`mixed`. |
| `<encoding>` | N | Bộ mã (`UTF-8`). |
| `<fields>/<field>` | Y | Khai báo từng cột (xem node con bên dưới). |

### Node con của mỗi `<field>` (item = `TextFileInputField`)
`name`, `type` (value-meta desc: `String`/`Integer`/`Number`/`Date`...), `format` (mask), `currency`, `decimal`, `group`, `length` (mặc định `-1`), `precision` (mặc định `-1`), `trim_type` (`none`/`left`/`right`/`both`).

## 3. YAML→XML Mapping

| YAML | XML | Ghi chú |
|---|---|---|
| `type: CSV_INPUT` | `<type>` | `CsvInput`. |
| `configuration.filename` | `<filename>` | Dùng biến path. |
| `configuration.separator` | `<separator>` | Mặc định `,`. |
| `configuration.enclosure` | `<enclosure>` | |
| `configuration.header` | `<header>` | true→Y. |
| `configuration.lazy_conversion` | `<lazy_conversion>` | Y/N. |
| `configuration.encoding` | `<encoding>` | |
| `configuration.fields[].name` | `<fields>/<field>/<name>` | |
| `configuration.fields[].type` | `<fields>/<field>/<type>` | |
| `configuration.fields[].length` | `<fields>/<field>/<length>` | |
| `configuration.fields[].trim_type` | `<fields>/<field>/<trim_type>` | |

Fill `<fields>` bằng `set_fields` (listTag=`fields`, itemTag=`field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `engine/src/main/java/org/pentaho/di/trans/steps/csvinput/CsvInputMeta.java :: getXML()`; tên node thật đối chiếu với file Spoon 9.4 verified `all_steps_configured.ktr` (step "CSV file input").

- `getXML()` dùng `getXmlCode("KEY")` để lấy tên node; ánh xạ KEY → tên node thật (xác nhận từ `.ktr`):
  FILENAME→`filename`, FILENAME_FIELD→`filename_field`, ROW_NUM_FIELD→`rownum_field`, INCLUDE_FILENAME→`include_filename`, DELIMITER→`separator`, ENCLOSURE→`enclosure`, HEADER_PRESENT→`header`, BUFFERSIZE→`buffer_size`, LAZY_CONVERSION→`lazy_conversion`, ADD_FILENAME_RESULT→`add_filename_result`, PARALLEL→`parallel`, NEWLINE_POSSIBLE→`newline_possible`, FORMAT→`format`, ENCODING→`encoding`, FIELDS→`fields`, FIELD→`field`.
- Item `<field>` con: FIELD_NAME→`name`, FIELD_TYPE→`type`, FIELD_FORMAT→`format`, FIELD_CURRENCY→`currency`, FIELD_DECIMAL→`decimal`, FIELD_GROUP→`group`, FIELD_LENGTH→`length`, FIELD_PRECISION→`precision`, FIELD_TRIM_TYPE→`trim_type`.
- `setDefault()`: `separator=,`, `enclosure="`, `buffer_size=50000`, `header=Y`, `lazy_conversion=Y`, `format=mixed`.

## 5. Lưu ý / bẫy

- Tên node dùng KEY nội bộ (`getXmlCode`), KHÔNG trùng tên logic: DELIMITER ghi ra `<separator>`, HEADER_PRESENT ghi ra `<header>`. Dùng đúng tên node ở template.
- `lazy_conversion=Y` nhanh hơn nhưng lỗi định dạng chỉ lộ ở step downstream.
- Luôn xác nhận `separator` thật của file (có thể là `#`, tab...), không mặc định là `,`.
- `<type>` field dùng tên value-meta (chuỗi), `length`/`precision` mặc định `-1`.
- List `<field>` nằm trong tag bao `<fields>` → fill bằng `set_fields`.
