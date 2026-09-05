# ValueMapper — Step ánh xạ giá trị

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>ValueMapper</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <field_to_use>{{SOURCE_FIELD}}</field_to_use>
    <target_field>{{TARGET_FIELD}}</target_field>
    <non_match_default>{{DEFAULT_VALUE}}</non_match_default>
    <fields>
      <field>
        <source_value>{{SOURCE_VALUE}}</source_value>
        <target_value>{{TARGET_VALUE}}</target_value>
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
| `<field_to_use>` | Y | Field nguồn cần ánh xạ. |
| `<target_field>` | N | Field đích; để trống = ghi đè field nguồn. |
| `<non_match_default>` | N | Giá trị mặc định khi không khớp mapping nào. |
| `<fields>/<field>` | Y | Mỗi cặp ánh xạ: `source_value` → `target_value`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: VALUE_MAPPER` | `<type>` | `ValueMapper`. |
| `configuration.source_field` | `<field_to_use>` |  |
| `configuration.target_field` | `<target_field>` |  |
| `configuration.default_value` | `<non_match_default>` |  |
| `configuration.mappings[].source` | `<fields>/<field>/<source_value>` |  |
| `configuration.mappings[].target` | `<fields>/<field>/<target_value>` |  |

Fill danh sách bằng `set_fields` (listTag=`fields`, itemTag=`field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`engine/src/main/java/org/pentaho/di/trans/steps/valuemapper/ValueMapperMeta.java :: getXML()`.

`getXML()` ghi theo đúng thứ tự: `<field_to_use>`, `<target_field>`,
`<non_match_default>`, rồi khối `<fields>` bao ngoài danh sách
`<field>` (mỗi item: `source_value`, `target_value`). Đây là dạng list
**có tag bao** → generator fill bằng `set_fields` (`listTag=fields`,
`itemTag=field`).

Ví dụ production: `all_steps_configured.ktr` (Spoon PDI 9.4 verified), step "Value mapper".

## 5. Lưu ý / bẫy

- `<target_field>` trống → giá trị ánh xạ ghi đè lên chính `field_to_use`.
- `non_match_default` trống → giá trị không khớp giữ nguyên (không thành null).

## Production Example

Trích từ Spoon PDI 9.4 (verified): `all_steps_configured.ktr`

```xml
<step>
    <name>Value mapper</name>
    <type>ValueMapper</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <field_to_use>ID</field_to_use>
    <target_field/>
    <non_match_default/>
    <fields>
      <field>
        <source_value>A</source_value>
        <target_value>B</target_value>
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
      <xloc>544</xloc>
      <yloc>320</yloc>
      <draw>Y</draw>
    </GUI>
  </step>
```

