# StringOperations — Step thực hiện thao tác chuỗi

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>StringOperations</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <fields>
      <field>
        <in_stream_name>{{IN_FIELD}}</in_stream_name>
        <out_stream_name>{{OUT_FIELD}}</out_stream_name>
        <trim_type>both</trim_type>
        <lower_upper>lower</lower_upper>
        <padding_type/>
        <pad_char/>
        <pad_len/>
        <init_cap/>
        <mask_xml/>
        <digits/>
        <remove_special_characters/>
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
| `<field>/<in_stream_name>` | Y | Field nguồn cần xử lý. |
| `<field>/<out_stream_name>` | N | Field kết quả; để trống = ghi đè field nguồn. |
| `<field>/<trim_type>` | N | `none`, `left`, `right`, `both`. |
| `<field>/<lower_upper>` | N | `none`, `lower`, `upper`. |
| `<field>/<padding_type>`, `<pad_char>`, `<pad_len>` | N | Padding. |
| `<field>/<init_cap>` | N | Viết hoa chữ cái đầu. |
| `<field>/<remove_special_characters>` | N | Loại ký tự đặc biệt. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: STRING_OPERATIONS` | `<type>` | `StringOperations`. |
| `configuration.fields[].in_field` | `<field>/<in_stream_name>` |  |
| `configuration.fields[].out_field` | `<field>/<out_stream_name>` |  |
| `configuration.fields[].trim` | `<field>/<trim_type>` | none/left/right/both. |
| `configuration.fields[].case` | `<field>/<lower_upper>` | none/lower/upper. |

Fill danh sách bằng `set_fields` (listTag=`fields`, itemTag=`field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`engine/src/main/java/org/pentaho/di/trans/steps/stringoperations/StringOperationsMeta.java :: getXML()`.

`getXML()` ghi khối `<fields>` bao ngoài danh sách `<field>` (mỗi item
đúng thứ tự: `in_stream_name`, `out_stream_name`, `trim_type`,
`lower_upper`, `padding_type`, `pad_char`, `pad_len`, `init_cap`,
`mask_xml`, `digits`, `remove_special_characters`).

Ví dụ production: `all_steps_configured.ktr` (Spoon PDI 9.4 verified), step "String operations".

## 5. Lưu ý / bẫy

- `out_stream_name` trống thì field nguồn bị ghi đè kết quả.
- Các node enum (`trim_type`, `lower_upper`, `padding_type`) giữ đúng chuỗi Spoon; các node còn lại để trống nếu không dùng.

## Production Example

Trích từ Spoon PDI 9.4 (verified): `all_steps_configured.ktr`

```xml
<step>
    <name>String operations</name>
    <type>StringOperations</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <fields>
      <field>
        <in_stream_name>ID</in_stream_name>
        <out_stream_name>output</out_stream_name>
        <trim_type>both</trim_type>
        <lower_upper>lower</lower_upper>
        <padding_type/>
        <pad_char/>
        <pad_len/>
        <init_cap/>
        <mask_xml/>
        <digits/>
        <remove_special_characters/>
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
      <xloc>800</xloc>
      <yloc>176</yloc>
      <draw>Y</draw>
    </GUI>
  </step>
```

