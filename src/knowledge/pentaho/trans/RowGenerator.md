# RowGenerator — Step sinh dòng control/test

## 1. XML Template

```xml
<step>
  <name>GENERATE_CONTROL_ROW</name>
  <type>RowGenerator</type>
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
      <name>dummy</name>
      <type>String</type>
      <format/>
      <currency/>
      <decimal/>
      <group/>
      <nullif/>
      <length>-1</length>
      <precision>-1</precision>
      <set_empty_string>N</set_empty_string>
    </field>
  </fields>
  <limit>1</limit>
  <never_ending>N</never_ending>
  <interval_in_ms>5000</interval_in_ms>
  <row_time_field>now</row_time_field>
  <last_time_field>FivesAgo</last_time_field>
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
| `<limit>` | Y | Số dòng (thường `1` cho control flows) |
| `<fields>/<field>` | Y | Output fields với constant values |
| `<never_ending>` | N | `N` |

## 3. YAML → XML Mapping

| YAML | XML | Ghi chú |
|------|-----|---------|
| `type: ROW_GENERATOR` | `<type>RowGenerator</type>` | |
| `config.row_count` | `<limit>` | |
| `config.fields[]` | `<fields>/<field>` | |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`engine/src/main/java/org/pentaho/di/trans/steps/rowgenerator/RowGeneratorMeta.java :: getXML()`.

`getXML()` ghi khối `<fields>` (mỗi `<field>` 10 node — cùng hình dạng
Constant: `name`, `type`, `format`, `currency`, `decimal`, `group`,
`nullif` (= giá trị hằng), `length`, `precision`, `set_empty_string`),
rồi `limit`, `never_ending`, `interval_in_ms`, `row_time_field`,
`last_time_field`.

Ví dụ production: `etl_tran_ftp_dieuchinh_get_auth_token.ktr`, step "Generate Rows".

## 5. Lưu ý / bẫy

- Thường dùng để sinh 1 dòng trigger cho GetVariable hoặc Rest call.
- **Bẫy `nullif`**: như Constant — giá trị hằng nằm ở node `<nullif>`.

## Production Example

Trích từ file production: `etl_tran_ftp_dieuchinh_get_auth_token.ktr`

```xml
<step>
  <name>Generate Rows</name>
  <type>RowGenerator</type>
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
      <name>Content-Type</name>
      <type>String</type>
      <format/>
      <currency/>
      <decimal/>
      <group/>
      <nullif>application/x-www-form-urlencoded</nullif>
      <length>-1</length>
      <precision>-1</precision>
      <set_empty_string>N</set_empty_string>
    </field>
    <field>
      <name>Authorization</name>
      <type>String</type>
      <format/>
      <currency/>
      <decimal/>
      <group/>
      <nullif>Basic bXN0MjRfdXNlcjE6bEg3WW1tUWR1NEtTZnBZTmh5bmJoak1HRFZSN0hzbEE=</nullif>
      <length>-1</length>
      <precision>-1</precision>
      <set_empty_string>N</set_empty_string>
    </field>
    <field>
      <name>authParams</name>
      <type>String</type>
      <format/>
      <currency/>
      <decimal/>
      <group/>
      <nullif>grant_type=client_credentials</nullif>
      <length>-1</length>
      <precision>-1</precision>
      <set_empty_string>N</set_empty_string>
    </field>
    <field>
      <name>grant_type</name>
      <type>String</type>
      <format/>
      <currency/>
      <decimal/>
      <group/>
      <nullif>client_credentials</nullif>
      <length>-1</length>
      <precision>-1</precision>
      <set_empty_string>N</set_empty_string>
    </field>
  </fields>
  <limit>1</limit>
  <never_ending>N</never_ending>
  <interval_in_ms>5000</interval_in_ms>
  <row_time_field>now</row_time_field>
  <last_time_field>FiveSecondsAgo</last_time_field>
  <attributes/>
  <cluster_schema/>
  <remotesteps>
    <input>
      </input>
    <output>
      </output>
  </remotesteps>
  <GUI>
    <xloc>96</xloc>
    <yloc>176</yloc>
    <draw>Y</draw>
  </GUI>
</step>
```
