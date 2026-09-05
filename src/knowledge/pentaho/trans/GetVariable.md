# GetVariable — Step materialize variables thành fields

## 1. XML Template

```xml
<step>
  <name>GET_RUNTIME_VARS</name>
  <type>GetVariable</type>
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
      <name>prd_id_value</name>
      <variable>${PRD_ID}</variable>
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
    <input/>
    <output/>
  </remotesteps>
  <GUI>
    <xloc>100</xloc>
    <yloc>100</yloc>
    <draw>Y</draw>
  </GUI>
</step>
```

## 2. Config Fields

| Field XML | Bắt buộc | Giá trị / Cách điền |
|-----------|----------|---------------------|
| `<fields>/<field>` | Y | Mỗi field: `name`, `variable`, `type` |
| `<name>` (in field) | Y | Output stream field name |
| `<variable>` | Y | Variable expression `${...}` |
| `<type>` (in field) | Y | PDI type: `String`, `Integer`, `Number`, `Date`, `BigNumber`, `Boolean` |
| `<format>` | N | Format mask (date: `yyyyMMdd`) |
| `<length>/<precision>` | N | `-1` = auto |

## 3. YAML → XML Mapping

| YAML | XML | Ghi chú |
|------|-----|---------|
| `type: GET_VARIABLE` | `<type>GetVariable</type>` | |
| `config.fields[].output_name` | `<name>` | |
| `config.fields[].variable` | `<variable>` | Bao gồm `${...}` |
| `config.fields[].type` | `<type>` | |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`engine/src/main/java/org/pentaho/di/trans/steps/getvariable/GetVariableMeta.java :: getXML()`.

`getXML()` ghi khối `<fields>` bao ngoài danh sách `<field>` (mỗi item:
`name`, `variable`, `type` bằng chuỗi `ValueMetaFactory.getValueMetaName()`,
`format`, `currency`, `decimal`, `group`, `length`, `precision`,
`trim_type` bằng code). Item có `fieldName` rỗng bị bỏ qua.
`loadXML()` đọc lại khớp.

Ví dụ production: `etl_trans_f2b_get_token.ktr`, step "Get variables 2".

## 5. Lưu ý / bẫy

- Variable expressions phải là placeholders, không resolve secrets.
- Undefined variable → empty string — cần handle downstream.

## Production Example

Trích từ file production: `etl_trans_f2b_get_token.ktr`

```xml
<step>
  <name>Get variables 2</name>
  <type>GetVariable</type>
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
      <name>grant_type</name>
      <variable>${OAUTH_GRANT_TYPE}</variable>
      <type>String</type>
      <format/>
      <currency/>
      <decimal/>
      <group/>
      <length>-1</length>
      <precision>-1</precision>
      <trim_type>none</trim_type>
    </field>
    <field>
      <name>client_id</name>
      <variable>${OAUTH_CLIENT_ID}</variable>
      <type>String</type>
      <format/>
      <currency/>
      <decimal/>
      <group/>
      <length>-1</length>
      <precision>-1</precision>
      <trim_type>none</trim_type>
    </field>
    <field>
      <name>client_secret</name>
      <variable>${OAUTH_CLIENT_SECRET}</variable>
      <type>String</type>
      <format/>
      <currency/>
      <decimal/>
      <group/>
      <length>-1</length>
      <precision>-1</precision>
      <trim_type>none</trim_type>
    </field>
    <field>
      <name>URL_GET_TOKEN</name>
      <variable>${URL_GET_TOKEN}</variable>
      <type>String</type>
      <format/>
      <currency/>
      <decimal/>
      <group/>
      <length>-1</length>
      <precision>-1</precision>
      <trim_type>none</trim_type>
    </field>
    <field>
      <name>BEARER</name>
      <variable>Bearer</variable>
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
    <xloc>240</xloc>
    <yloc>224</yloc>
    <draw>Y</draw>
  </GUI>
</step>
```
