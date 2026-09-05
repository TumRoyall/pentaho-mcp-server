# ConcatFields

Transformation step nối nhiều field thành một field text duy nhất (tương tự TextFileOutput nhưng ghi vào field thay vì file).

## 1. XML Template

```xml
<step>
  <name>{{STEP_NAME}}</name>
  <type>ConcatFields</type>
  <description/>
  <distribute>Y</distribute>
  <custom_distribution/>
  <copies>1</copies>
  <partitioning>
    <method>none</method>
    <schema_name/>
  </partitioning>
  <separator>{{SEPARATOR}}</separator>
  <enclosure>{{ENCLOSURE}}</enclosure>
  <enclosure_forced>{{ENCLOSURE_FORCED}}</enclosure_forced>
  <enclosure_fix_disabled>{{ENCLOSURE_FIX_DISABLED}}</enclosure_fix_disabled>
  <header>{{INCLUDE_HEADER}}</header>
  <footer>N</footer>
  <format>{{FORMAT}}</format>
  <compression>None</compression>
  <encoding>{{ENCODING}}</encoding>
  <endedLine/>
  <fileNameInField>N</fileNameInField>
  <fileNameField/>
  <create_parent_folder>Y</create_parent_folder>
  <file>
    <name/>
    <servlet_output>N</servlet_output>
    <do_not_open_new_file_init>Y</do_not_open_new_file_init>
    <extention>txt</extention>
    <append>N</append>
    <split>N</split>
    <haspartno>N</haspartno>
    <add_date>N</add_date>
    <add_time>N</add_time>
    <SpecifyFormat>N</SpecifyFormat>
    <date_time_format/>
    <add_to_result_filenames>Y</add_to_result_filenames>
    <pad>N</pad>
    <fast_dump>N</fast_dump>
    <splitevery>0</splitevery>
  </file>
  <fields>
    <field>
      <name>{{FIELD_NAME}}</name>
      <type>{{FIELD_TYPE}}</type>
      <format>{{FIELD_FORMAT}}</format>
      <currency/>
      <decimal/>
      <group/>
      <nullif/>
      <trim_type>none</trim_type>
      <length>{{LENGTH}}</length>
      <precision>{{PRECISION}}</precision>
    </field>
    <!-- repeat for each field to concatenate -->
  </fields>
  <ConcatFields>
    <targetFieldName>{{TARGET_FIELD_NAME}}</targetFieldName>
    <targetFieldLength>{{TARGET_FIELD_LENGTH}}</targetFieldLength>
    <removeSelectedFields>N</removeSelectedFields>
  </ConcatFields>
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
| `separator` | Y | Ký tự phân cách giữa các field (`;`, `,`, `\t`, etc.) |
| `enclosure` | N | Ký tự bao quanh giá trị (thường `"`) |
| `enclosure_forced` | Y | `Y`/`N` — luôn bao enclosure dù không cần |
| `enclosure_fix_disabled` | Y | `Y`/`N` |
| `header` | Y | `Y`/`N` — thêm header row (tên field) vào đầu |
| `format` | Y | `DOS`, `UNIX`, `NONE` |
| `encoding` | N | Encoding (trống = mặc định) |
| `ConcatFields/targetFieldName` | Y | Tên field output chứa kết quả nối |
| `ConcatFields/targetFieldLength` | Y | Độ dài tối đa (0 = không giới hạn) |
| `ConcatFields/removeSelectedFields` | N | `Y` = xóa các field nguồn sau khi nối |
| `fields/field/name` | Y | Tên field nguồn cần nối |
| `fields/field/type` | Y | Kiểu dữ liệu khi format ra text |
| `fields/field/format` | N | Date/number format pattern |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `separator` | `separator` | |
| `enclosure` | `enclosure` | |
| `target_field` | `ConcatFields/targetFieldName` | |
| `target_length` | `ConcatFields/targetFieldLength` | 0 = unlimited |
| `remove_selected_fields` | `ConcatFields/removeSelectedFields` | Y/N |
| `include_header` | `header` | Y/N |
| `output_format` | `format` | DOS/UNIX/NONE |
| `source_fields[]` | `fields/field` | |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/concatfields/ConcatFieldsMeta.java :: getXML()`
(kế thừa `engine/.../textfileoutput/TextFileOutputMeta.java`).

`ConcatFieldsMeta.getXML()` = `super.getXML()` (toàn bộ thân TextFileOutput:
`separator`…`file`…`fields`, với `fileName` ép rỗng và `fileNameInField`
ép `false` theo PDI-18028) + khối `<ConcatFields>` chứa
`targetFieldName`, `targetFieldLength`, `removeSelectedFields`.
Mỗi `<field>` trong `<fields>` đủ 10 node (`name`, `type`, `format`,
`currency`, `decimal`, `group`, `nullif`, `trim_type`, `length`,
`precision`).

```xml
<!-- Provenance: pattern quan sát trong old_src/trans (thân TextFileOutput + khối ConcatFields) -->
<step>
  <name>Build CSV line</name>
  <type>ConcatFields</type>
  <separator>,</separator>
  <enclosure>"</enclosure>
  <enclosure_forced>N</enclosure_forced>
  <enclosure_fix_disabled>N</enclosure_fix_disabled>
  <header>N</header>
  <footer>N</footer>
  <format>NONE</format>
  <encoding>UTF-8</encoding>
  <targetFieldName>csv_line</targetFieldName>
  <targetFieldLength>0</targetFieldLength>
  <fields>
    <field>
      <name>ACCOUNT_NO</name>
      <type>String</type>
      <format/>
      <length>-1</length>
      <precision>-1</precision>
    </field>
    <field>
      <name>AMOUNT</name>
      <type>Number</type>
      <format>#.##</format>
      <length>-1</length>
      <precision>2</precision>
    </field>
  </fields>
</step>
```

## 5. Lưu ý / bẫy

- **Bẫy vị trí `targetFieldName` (đã đối chiếu source)**:
  `targetFieldName`/`targetFieldLength`/`removeSelectedFields` nằm trong
  khối `<ConcatFields>`, KHÔNG phải node cấp-step. Đặt sai chỗ → Spoon bỏ qua.
- **Khác TextFileOutput**: ConcatFields tạo field mới trong stream, TextFileOutput ghi ra file. Dùng ConcatFields khi muốn build string rồi truyền tiếp.
- **Separator XML-escape**: Nếu separator là `<` hay `&` thì phải escape.
- **header=Y chỉ có ý nghĩa ở dòng đầu tiên**: Nếu nối nhiều dòng, header chỉ xuất hiện 1 lần ở dòng 1.
- **Field order**: Thứ tự field trong XML quyết định thứ tự nối.

## Production Example

Trích từ file production: `etl_trans_f2b_get_token.ktr`

```xml
<step>
  <name>Bearer_token</name>
  <type>ConcatFields</type>
  <description/>
  <distribute>Y</distribute>
  <custom_distribution/>
  <copies>1</copies>
  <partitioning>
    <method>none</method>
    <schema_name/>
  </partitioning>
  <separator> </separator>
  <enclosure>"</enclosure>
  <enclosure_forced>N</enclosure_forced>
  <enclosure_fix_disabled>N</enclosure_fix_disabled>
  <header>N</header>
  <footer>N</footer>
  <format>DOS</format>
  <compression>None</compression>
  <encoding/>
  <endedLine/>
  <fileNameInField>N</fileNameInField>
  <fileNameField/>
  <create_parent_folder>Y</create_parent_folder>
  <file>
    <name/>
    <servlet_output>N</servlet_output>
    <do_not_open_new_file_init>Y</do_not_open_new_file_init>
    <extention>txt</extention>
    <append>N</append>
    <split>N</split>
    <haspartno>N</haspartno>
    <add_date>N</add_date>
    <add_time>N</add_time>
    <SpecifyFormat>N</SpecifyFormat>
    <date_time_format/>
    <add_to_result_filenames>Y</add_to_result_filenames>
    <pad>N</pad>
    <fast_dump>N</fast_dump>
    <splitevery>0</splitevery>
  </file>
  <fields>
    <field>
      <name>BEARER</name>
      <type>String</type>
      <format/>
      <currency/>
      <decimal/>
      <group/>
      <nullif/>
      <trim_type>none</trim_type>
      <length>-1</length>
      <precision>-1</precision>
    </field>
    <field>
      <name>access_token</name>
      <type>String</type>
      <format/>
      <currency/>
      <decimal/>
      <group/>
      <nullif/>
      <trim_type>none</trim_type>
      <length>-1</length>
      <precision>-1</precision>
    </field>
  </fields>
  <ConcatFields>
    <targetFieldName>Token</targetFieldName>
    <targetFieldLength>0</targetFieldLength>
    <removeSelectedFields>N</removeSelectedFields>
  </ConcatFields>
  <attributes/>
  <cluster_schema/>
  <remotesteps>
    <input>
      </input>
    <output>
      </output>
  </remotesteps>
  <GUI>
    <xloc>1040</xloc>
    <yloc>224</yloc>
    <draw>Y</draw>
  </GUI>
</step>
```
