# PropertyInput — Step đọc file .properties / .ini

Đọc cặp key=value từ file properties hoặc INI, xuất ra field.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>PropertyInput</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <file_type>property</file_type>
    <encoding>UTF-8</encoding>
    <include>N</include>
    <include_field/>
    <filename_Field/>
    <rownum>N</rownum>
    <isaddresult>Y</isaddresult>
    <filefield>N</filefield>
    <rownum_field/>
    <resetrownumber>N</resetrownumber>
    <resolvevaluevariable>N</resolvevaluevariable>
    <ini_section>N</ini_section>
    <ini_section_field/>
    <section/>
    <file>
      <name>{{FILE_PATH}}</name>
      <exclude_filemask/>
      <filemask/>
      <file_required>N</file_required>
      <include_subfolders>N</include_subfolders>
    </file>
    <fields>
      <field>
        <name>{{FIELD_NAME}}</name>
        <column>KEY</column>
        <type>String</type>
        <format/>
        <length>-1</length>
        <precision>-1</precision>
        <currency/>
        <decimal/>
        <group/>
        <trim_type>none</trim_type>
        <repeat>N</repeat>
      </field>
    </fields>
    <limit>0</limit>
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
| `<file_type>` | Y | `property` hoặc `ini`. `setDefault`=`property`. |
| `<encoding>` | N | Bộ mã. `setDefault`=`UTF-8`. |
| `<include>` | N | `Y`=thêm field tên file. |
| `<include_field>` | N | Tên field chứa tên file (khi `include=Y`). |
| `<filename_Field>` | N | Field chứa đường dẫn động (LƯU Ý viết hoa `F`). |
| `<rownum>` | N | `Y`=thêm field số dòng. |
| `<isaddresult>` | N | `setDefault`=Y. Thêm file vào result filenames. |
| `<filefield>` | N | `Y`=lấy tên file từ field input thay vì `<file>`. |
| `<resetrownumber>` | N | Reset số dòng mỗi file. |
| `<resolvevaluevariable>` | N | `Y`=resolve `${var}` trong giá trị. |
| `<ini_section>` / `<ini_section_field>` / `<section>` | N | Dùng cho file INI (chọn section). |
| `<file>/<name>` | Y | Đường dẫn file/thư mục (nhiều `<name>` = nhiều file). |
| `<file>/<filemask>` | N | Regex lọc file khi `<name>` là thư mục. |
| `<file>/<exclude_filemask>` | N | Regex loại trừ. |
| `<file>/<file_required>` | N | `Y`/`N`; file bắt buộc tồn tại. |
| `<file>/<include_subfolders>` | N | `Y`/`N`; duyệt thư mục con. |
| `<fields>/<field>` | Y | Field output (node con bên dưới). |
| `<limit>` | N | Giới hạn số dòng; `0`=không giới hạn. |

### Node con của mỗi `<field>` (item = `PropertyInputField`)
`name`, `column` (`KEY` hoặc `VALUE`), `type` (value-meta desc), `format`, `length`, `precision`, `currency`, `decimal`, `group`, `trim_type` (`none`/`left`/`right`/`both`), `repeat` (Y/N).

## 3. YAML→XML Mapping

| YAML | XML | Ghi chú |
|---|---|---|
| `type: PROPERTY_INPUT` | `<type>` | `PropertyInput`. |
| `configuration.file_type` | `<file_type>` | `property`/`ini`. |
| `configuration.encoding` | `<encoding>` | |
| `configuration.files[].name` | `<file>/<name>` | |
| `configuration.files[].filemask` | `<file>/<filemask>` | |
| `configuration.fields[].name` | `<fields>/<field>/<name>` | |
| `configuration.fields[].column` | `<fields>/<field>/<column>` | `KEY`/`VALUE`. |
| `configuration.fields[].type` | `<fields>/<field>/<type>` | |
| `configuration.limit` | `<limit>` | |

`<fields>` fill bằng `set_fields` (listTag=`fields`, itemTag=`field`). Khối `<file>`
chứa các mảng SONG SONG (`name`/`filemask`/`exclude_filemask`/`file_required`/`include_subfolders`)
lặp theo số file — nếu nhiều file, chèn thủ công đủ 5 node cho MỖI file, đúng thứ tự.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `engine/src/main/java/org/pentaho/di/trans/steps/propertyinput/PropertyInputMeta.java :: getXML()` (+ `PropertyInputField` cho item `<field>`).

- Thân step (flat): `file_type`, `encoding`, `include`, `include_field`, `filename_Field`, `rownum`, `isaddresult`, `filefield`, `rownum_field`, `resetrownumber`, `resolvevaluevariable`, `ini_section`, `ini_section_field`, `section`.
- Khối `<file>`: lặp mảng file, mỗi file ghi `name`, `exclude_filemask`, `filemask`, `file_required`, `include_subfolders` (các node NẰM CHUNG trong `<file>`, không bọc item riêng).
- Khối `<fields>`: mỗi `<field>` ghi `name`, `column` (`getColumnCode()`), `type` (`getTypeDesc()`), `format`, `length`, `precision`, `currency`, `decimal`, `group`, `trim_type` (`getTrimTypeCode()`), `repeat`.
- Sau `</fields>` ghi tiếp: `limit`, `shortFileFieldName`, `pathFieldName`, `hiddenFieldName`, `lastModificationTimeFieldName`, `uriNameFieldName`, `rootUriNameFieldName`, `extensionFieldName`, `sizeFieldName`.
- `setDefault()`: `file_type=property`, `encoding=UTF-8`, `isaddresult=true`, `section=""`, phần lớn cờ `false`, `limit=0`.

## 5. Lưu ý / bẫy

- Node đường dẫn động ghi HOA chữ F: `<filename_Field>` (không phải `filename_field`). Dùng đúng.
- Khối `<file>` KHÔNG bọc từng file trong tag riêng — 5 node lặp trực tiếp trong `<file>`. Nhiều file = nhiều bộ 5 node, giữ đúng thứ tự tương ứng.
- `column` chỉ nhận `KEY` hoặc `VALUE` (đọc key hay value của property).
- Với file INI cần đặt `file_type=ini` và `section`.
- `<type>` field dùng tên value-meta (chuỗi); `length`/`precision` mặc định `-1`.
