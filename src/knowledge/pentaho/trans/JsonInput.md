# JsonInput — Step parse JSON thành fields

## 1. XML Template

```xml
<step>
  <name>PARSE_JSON</name>
  <type>JsonInput</type>
  <description/>
  <distribute>Y</distribute>
  <custom_distribution/>
  <copies>1</copies>
  <partitioning>
    <method>none</method>
    <schema_name/>
  </partitioning>
  <include/>
  <include_field/>
  <rownum/>
  <addresultfile>N</addresultfile>
  <readurl>N</readurl>
  <removeSourceField>N</removeSourceField>
  <IsIgnoreEmptyFile>N</IsIgnoreEmptyFile>
  <doNotFailIfNoFile>Y</doNotFailIfNoFile>
  <ignoreMissingPath>N</ignoreMissingPath>
  <defaultPathLeafToNull>Y</defaultPathLeafToNull>
  <includeNulls>N</includeNulls>
  <rownum_field/>
  <file>
    <name/>
    <filemask/>
    <exclude_filemask/>
    <file_required>N</file_required>
    <include_subfolders>N</include_subfolders>
  </file>
  <IsInFields>Y</IsInFields>
  <IsAFile>N</IsAFile>
  <valueField>response_body</valueField>
  <shortFileFieldName/>
  <pathFieldName/>
  <hiddenFieldName/>
  <lastModificationTimeFieldName/>
  <uriNameFieldName/>
  <rootUriNameFieldName/>
  <extensionFieldName/>
  <sizeFieldName/>
  <fields>
    <field>
      <name>parsed_value</name>
      <path>$.data.value</path>
      <type>String</type>
      <format/>
      <currency/>
      <decimal/>
      <group/>
      <length>-1</length>
      <precision>-1</precision>
      <trim_type>none</trim_type>
      <repeat>N</repeat>
    </field>
  </fields>
  <limit>0</limit>
  <attributes/>
  <cluster_schema/>
  <remotesteps>
    <input/>
    <output/>
  </remotesteps>
  <GUI>
    <xloc>400</xloc>
    <yloc>100</yloc>
    <draw>Y</draw>
  </GUI>
</step>
```

## 2. Config Fields

| Field XML | Bắt buộc | Giá trị / Cách điền |
|-----------|----------|---------------------|
| `<IsInFields>` | Y | `Y` = parse từ input field |
| `<valueField>` | Y (khi IsInFields=Y) | Tên field chứa JSON |
| `<fields>/<field>/<name>` | Y | Output field name |
| `<fields>/<field>/<path>` | Y | JSONPath (vd `$.access_token`) |
| `<fields>/<field>/<type>` | Y | PDI type |
| `<ignoreMissingPath>` | N | `N` = fail nếu path không tồn tại |
| `<includeNulls>` | N | `Y`/`N` — giữ field null trong output (node này template cũ thiếu) |

## 3. YAML → XML Mapping

| YAML | XML | Ghi chú |
|------|-----|---------|
| `type: JSON_INPUT` | `<type>JsonInput</type>` | |
| `config.source_field` | `<valueField>` | |
| `config.fields[].name` | `<name>` | |
| `config.fields[].json_path` | `<path>` | |
| `config.fields[].type` | `<type>` | |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`plugins/json/core/src/main/java/org/pentaho/di/trans/steps/jsoninput/JsonInputMeta.java :: getXML()`
+ `JsonInputField.java :: getXML()`.

`getXML()` ghi đúng thứ tự: `include`, `include_field`, `rownum`,
`addresultfile`, `readurl`, `removeSourceField`, `IsIgnoreEmptyFile`,
`doNotFailIfNoFile`, `ignoreMissingPath`, `defaultPathLeafToNull`,
`includeNulls`, `rownum_field`, khối `<file>`, khối `<fields>` (mỗi
`<field>` 11 node: `name`, `path`, `type`, `format`, `currency`,
`decimal`, `group`, `length`, `precision`, `trim_type`, `repeat`),
`limit`, `IsInFields`, `IsAFile`, `valueField`, rồi nhóm
`shortFileFieldName`…`sizeFieldName`.

Ví dụ production: `etl_tran_ftp_dieuchinh_get_auth_token.ktr`, step "Json Input".

## 5. Lưu ý / bẫy

- Parse trước khi check HTTP status → có thể crash trên error response.
- `ignoreMissingPath=N` mà path không tồn tại → transformation fails.

## Production Example

Trích từ file production: `etl_tran_ftp_dieuchinh_get_auth_token.ktr`

```xml
<step>
  <name>Json Input</name>
  <type>JsonInput</type>
  <description/>
  <distribute>N</distribute>
  <custom_distribution/>
  <copies>1</copies>
  <partitioning>
    <method>none</method>
    <schema_name/>
  </partitioning>
  <include>N</include>
  <include_field/>
  <rownum>N</rownum>
  <addresultfile>N</addresultfile>
  <readurl>N</readurl>
  <removeSourceField>N</removeSourceField>
  <IsIgnoreEmptyFile>N</IsIgnoreEmptyFile>
  <doNotFailIfNoFile>Y</doNotFailIfNoFile>
  <ignoreMissingPath>N</ignoreMissingPath>
  <defaultPathLeafToNull>N</defaultPathLeafToNull>
  <includeNulls>N</includeNulls>
  <rownum_field/>
  <file>
    <name/>
    <filemask/>
    <exclude_filemask/>
    <file_required>N</file_required>
    <include_subfolders>N</include_subfolders>
  </file>
  <fields>
    <field>
      <name>access_token</name>
      <path>$.access_token</path>
      <type>String</type>
      <format/>
      <currency/>
      <decimal/>
      <group/>
      <length>-1</length>
      <precision>-1</precision>
      <trim_type>none</trim_type>
      <repeat>N</repeat>
    </field>
    <field>
      <name>expires_in</name>
      <path>$.expires_in</path>
      <type>String</type>
      <format/>
      <currency/>
      <decimal/>
      <group/>
      <length>-1</length>
      <precision>-1</precision>
      <trim_type>none</trim_type>
      <repeat>N</repeat>
    </field>
    <field>
      <name>token_type</name>
      <path>$.token_type</path>
      <type>String</type>
      <format/>
      <currency/>
      <decimal/>
      <group/>
      <length>-1</length>
      <precision>-1</precision>
      <trim_type>none</trim_type>
      <repeat>N</repeat>
    </field>
  </fields>
  <limit>0</limit>
  <IsInFields>Y</IsInFields>
  <IsAFile>N</IsAFile>
  <valueField>result</valueField>
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
    <xloc>464</xloc>
    <yloc>176</yloc>
    <draw>Y</draw>
  </GUI>
</step>
```
