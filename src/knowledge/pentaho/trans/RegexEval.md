# RegexEval — Step đánh giá biểu thức chính quy

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>RegexEval</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <script>{{REGEX}}</script>
    <matcher>{{SOURCE_FIELD}}</matcher>
    <resultfieldname>{{RESULT_FIELD}}</resultfieldname>
    <usevar>N</usevar>
    <allowcapturegroups>N</allowcapturegroups>
    <replacefields>Y</replacefields>
    <canoneq>N</canoneq>
    <caseinsensitive>N</caseinsensitive>
    <comment>N</comment>
    <dotall>N</dotall>
    <multiline>N</multiline>
    <unicode>N</unicode>
    <unix>N</unix>
    <fields>
      <field>
        <name>{{CAPTURE_FIELD_NAME}}</name>
        <type>String</type>
        <format/>
        <group/>
        <decimal/>
        <length>-1</length>
        <precision>-1</precision>
        <nullif/>
        <ifnull/>
        <trimtype>none</trimtype>
        <currency/>
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
| `<script>` | Y | Biểu thức chính quy. |
| `<matcher>` | Y | Field nguồn cần kiểm tra. |
| `<resultfieldname>` | Y | Field boolean kết quả. |
| `<usevar>` | N | Cho phép dùng biến trong regex. |
| `<allowcapturegroups>` | N | Xuất capture group. |
| `<replacefields>` | N | Ghi đè field đã tồn tại. |
| `<canoneq>` | N | Canonical equivalence. |
| `<caseinsensitive>` | N | Không phân biệt hoa thường. |
| `<comment>` | N | Bật COMMENTS mode. |
| `<dotall>` | N | DOTALL mode. |
| `<multiline>` | N | MULTILINE mode. |
| `<unicode>` | N | Unicode case. |
| `<unix>` | N | UNIX_LINES mode. |
| `<fields>` | N | Danh sách capture group/field kết quả; mỗi `<field>`: `name`, `type` (chuỗi ValueMetaName), `format`, `group`, `decimal`, `length`, `precision`, `nullif`, `ifnull`, `trimtype` (**không gạch dưới**), `currency`. Bỏ cả khối item khi không dùng capture group. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: REGEX_EVAL` | `<type>` | `RegexEval`. |
| `configuration.regex` | `<script>` | XML escape ký tự đặc biệt. |
| `configuration.source_field` | `<matcher>` |  |
| `configuration.result_field` | `<resultfieldname>` |  |
| `configuration.allow_capture_groups` | `<allowcapturegroups>` | Y/N. |
| `configuration.capture_fields[].name` | `<fields>/<field>/<name>` | Kèm đủ 11 node con theo item mẫu (xóa item mẫu khi không dùng). |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`engine/src/main/java/org/pentaho/di/trans/steps/regexeval/RegexEvalMeta.java :: getXML()`.

`getXML()` ghi 13 node scalar đúng thứ tự (`script`, `matcher`,
`resultfieldname`, `usevar`, `allowcapturegroups`, `replacefields`,
`canoneq`, `caseinsensitive`, `comment`, `dotall`, `multiline`,
`unicode`, `unix`), rồi khối `<fields>` — mỗi `<field>` capture có 11
node con (`name`, `type` chuỗi ValueMetaName, `format`, `group`,
`decimal`, `length`, `precision`, `nullif`, `ifnull`, `trimtype`,
`currency`).

Ví dụ production: `all_steps_configured.ktr` (Spoon PDI 9.4 verified), step "Regex evaluation".

## 5. Lưu ý / bẫy

- `<fields>` rỗng là hợp lệ khi chỉ đánh giá match/không-match (`resultfieldname` boolean). Chỉ cần `<fields>` khi `allowcapturegroups=Y` để xuất từng nhóm bắt.
- Regex phải XML-escape các ký tự `&` và `<` trong template (vd `^(\d+)$` không cần escape, nhưng `a<b` phải là `a&lt;b`).
- Các cờ regex được ghi thành từng node Y/N; không gộp thành chuỗi flag.

## Production Example

Trích từ Spoon PDI 9.4 (verified): `all_steps_configured.ktr` (regex `^(\d+)$` trên field ID, không dùng capture group):

```xml
<step>
    <name>Regex evaluation</name>
    <type>RegexEval</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <script>^(\d+)$</script>
    <matcher>ID</matcher>
    <resultfieldname>result</resultfieldname>
    <usevar>N</usevar>
    <allowcapturegroups>N</allowcapturegroups>
    <replacefields>Y</replacefields>
    <canoneq>N</canoneq>
    <caseinsensitive>N</caseinsensitive>
    <comment>N</comment>
    <dotall>N</dotall>
    <multiline>N</multiline>
    <unicode>N</unicode>
    <unix>N</unix>
    <fields>
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
      <xloc>688</xloc>
      <yloc>352</yloc>
      <draw>Y</draw>
    </GUI>
  </step>
```

