# XMLOutput — Step ghi dữ liệu ra file XML

Ghi stream ra file XML với phần tử gốc/lặp và danh sách field.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>XMLOutput</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <encoding>UTF-8</encoding>
    <name_space/>
    <xml_main_element>Rows</xml_main_element>
    <xml_repeat_element>Row</xml_repeat_element>
    <file>
      <name>{{FILE_PATH}}</name>
      <extention>xml</extention>
      <servlet_output>N</servlet_output>
      <do_not_open_newfile_init>N</do_not_open_newfile_init>
      <split>N</split>
      <add_date>N</add_date>
      <add_time>N</add_time>
      <SpecifyFormat>N</SpecifyFormat>
      <omit_null_values>N</omit_null_values>
      <date_time_format/>
      <add_to_result_filenames>N</add_to_result_filenames>
      <zipped>N</zipped>
      <splitevery>0</splitevery>
    </file>
    <fields>
      <field>
        <content_type>Element</content_type>
        <name>{{FIELD_NAME}}</name>
        <element>{{XML_ELEMENT_NAME}}</element>
        <type>String</type>
        <format/>
        <currency/>
        <decimal/>
        <group/>
        <nullif/>
        <length>-1</length>
        <precision>-1</precision>
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
| `<encoding>` | N | Bộ mã XML. `setDefault`=`Const.XML_ENCODING` (UTF-8). |
| `<name_space>` | N | Namespace XML. `setDefault`=rỗng. |
| `<xml_main_element>` | N | Phần tử gốc bao toàn bộ. `setDefault`=`Rows`. |
| `<xml_repeat_element>` | N | Phần tử lặp cho mỗi dòng. `setDefault`=`Row`. |
| `<file>/<name>` | Y | Đường dẫn file (không kèm đuôi). |
| `<file>/<extention>` | N | Đuôi file. `setDefault`=`xml`. LƯU Ý node sai chính tả `extention`. |
| `<file>/<split>` | N | Thêm số step vào tên file. |
| `<file>/<add_date>` `<add_time>` | N | Thêm ngày/giờ vào tên file. |
| `<file>/<omit_null_values>` | N | `Y`=bỏ node của field null. |
| `<file>/<zipped>` | N | `Y`=nén file kết quả. |
| `<file>/<splitevery>` | N | Tách file sau N dòng; `0`=không tách. |
| `<fields>/<field>` | N | Field xuất; node con bên dưới. |

### Node con của mỗi `<field>` (item = `XMLField`)
`content_type` (`Element` hoặc `Attribute`), `name` (field nguồn), `element` (tên node/attr XML), `type` (value-meta desc), `format`, `currency`, `decimal`, `group`, `nullif`, `length`, `precision`.

## 3. YAML→XML Mapping

| YAML | XML | Ghi chú |
|---|---|---|
| `type: XML_OUTPUT` | `<type>` | `XMLOutput`. |
| `configuration.file` | `<file>/<name>` | Không kèm đuôi. |
| `configuration.root_element` | `<xml_main_element>` | Mặc định `Rows`. |
| `configuration.row_element` | `<xml_repeat_element>` | Mặc định `Row`. |
| `configuration.encoding` | `<encoding>` | |
| `configuration.fields[].name` | `<fields>/<field>/<name>` | |
| `configuration.fields[].element` | `<fields>/<field>/<element>` | |
| `configuration.fields[].content_type` | `<fields>/<field>/<content_type>` | `Element`/`Attribute`. |

Fill `<fields>` bằng `set_fields` (listTag=`fields`, itemTag=`field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `plugins/xml/core/src/main/java/org/pentaho/di/trans/steps/xmloutput/XMLOutputMeta.java :: getXML()` (+ `XMLField` cho item `<field>`).

- Thân step: `encoding`, `name_space`, `xml_main_element`, `xml_repeat_element`.
- Block `<file>`: `name`, `extention`, `servlet_output`, `do_not_open_newfile_init`, `split`, `add_date`, `add_time`, `SpecifyFormat`, `omit_null_values`, `date_time_format`, `add_to_result_filenames`, `zipped`, `splitevery`.
- Block `<fields>`: mỗi `<field>` ghi `content_type` (= `getContentType().name()`), `name`, `element`, `type` (`getTypeDesc()`), `format`, `currency`, `decimal`, `group`, `nullif`, `length`, `precision`.
- `setDefault()`: `extension=xml`, `encoding=XML_ENCODING`, `xml_main_element=Rows`, `xml_repeat_element=Row`, cờ còn lại `false`, `splitEvery=0`.

## 5. Lưu ý / bẫy

- Node đuôi file ghi SAI CHÍNH TẢ `<extention>` (giống ExcelWriter). Dùng đúng.
- `content_type` chỉ nhận `Element` hoặc `Attribute` (viết hoa chữ đầu, theo enum name).
- `<file>/<name>` KHÔNG kèm đuôi; đuôi lấy từ `<extention>`.
- List `<field>` nằm trong tag bao `<fields>` → fill bằng `set_fields`.
