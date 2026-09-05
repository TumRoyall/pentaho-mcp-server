# MergeRows — Step so sánh hai stream và đánh dấu khác biệt

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>MergeRows</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <keys>
      <key>{{KEY_FIELD}}</key>
    </keys>
    <values>
      <value>{{COMPARE_FIELD}}</value>
    </values>
    <flag_field>{{FLAG_FIELD}}</flag_field>
    <reference>{{REFERENCE_STEP}}</reference>
    <compare>{{COMPARE_STEP}}</compare>
    <compare>
    </compare>
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
| `<keys>/<key>` | Y | Mỗi field khóa là node `<key>FIELD</key>` (text). |
| `<values>/<value>` | Y | Mỗi field cần so sánh là node `<value>FIELD</value>` (text). |
| `<flag_field>` | Y | Field kết quả nhận trạng thái: `identical`/`changed`/`new`/`deleted`. |
| `<reference>` | Y | Tên step stream tham chiếu (dữ liệu gốc). |
| `<compare>` | Y | Tên step stream cần so sánh; Spoon ghi kèm một node `<compare>` rỗng — giữ nguyên. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: MERGE_ROWS` | `<type>` | `MergeRows`. |
| `configuration.keys[]` | `<keys>/<key>` | Mỗi phần tử → một `<key>`. |
| `configuration.compare_fields[]` | `<values>/<value>` | Mỗi phần tử → một `<value>`. |
| `configuration.flag_field` | `<flag_field>` |  |
| `configuration.reference_step` | `<reference>` | Tham chiếu step. |
| `configuration.compare_step` | `<compare>` | Tham chiếu step. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`engine/src/main/java/org/pentaho/di/trans/steps/mergerows/MergeRowsMeta.java :: getXML()`.

`getXML()` ghi khối `<keys>` (mỗi key là `<key>FIELD</key>` text),
khối `<values>` (mỗi field là `<value>FIELD</value>` text),
`<flag_field>`, `<reference>` + `<compare>` (tên 2 info hop), rồi một
node `<compare>` rỗng. `setDefault()` đặt `flagField="flagfield"`.

Ví dụ production: `all_steps_configured.ktr` (Spoon PDI 9.4 verified), step "Merge rows (diff)".

## 5. Lưu ý / bẫy

- Hai input phải được **sort theo cùng khóa** trước khi vào Merge rows.
- `<keys>`/`<values>` là danh sách node text đơn giản (`<key>ID</key>`), không phải block con.
- Spoon ghi kèm một node `<compare>` rỗng ngay sau `<compare>` chứa tên step — giữ nguyên khi generate.
- Tham chiếu `<reference>`/`<compare>` do generator nối bằng `set_field`/`edit_hops`; không hardcode giá trị thật trong template.

## Production Example

Trích từ Spoon PDI 9.4 (verified): `all_steps_configured.ktr`

```xml
<step>
    <name>Merge rows (diff)</name>
    <type>MergeRows</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <keys>
      <key>ID</key>
    </keys>
    <values>
      <value>ID</value>
    </values>
    <flag_field>flagfield</flag_field>
    <reference>GEN ID</reference>
    <compare>GEN NAME</compare>
    <compare>
    </compare>
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
      <yloc>96</yloc>
      <draw>Y</draw>
    </GUI>
  </step>
```

