# SetVariable — Step publish fields thành variables

## 1. XML Template

```xml
<step>
  <name>SET_CONTROL_VARIABLES</name>
  <type>SetVariable</type>
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
      <field_name>RUN_ID</field_name>
      <variable_name>RUN_ID</variable_name>
      <variable_type>ROOT_JOB</variable_type>
      <default_value/>
    </field>
  </fields>
  <use_formatting>Y</use_formatting>
  <attributes/>
  <cluster_schema/>
  <remotesteps>
    <input/>
    <output/>
  </remotesteps>
  <GUI>
    <xloc>300</xloc>
    <yloc>100</yloc>
    <draw>Y</draw>
  </GUI>
</step>
```

## 2. Config Fields

| Field XML | Bắt buộc | Giá trị / Cách điền |
|-----------|----------|---------------------|
| `<fields>/<field>` | Y | Mỗi mapping: `field_name`, `variable_name`, `variable_type` |
| `<variable_type>` | Y | `ROOT_JOB`, `PARENT_JOB`, `GP_JOB`, `JVM` (chuỗi code từ source — chú ý KHÔNG phải `GRAND_PARENT_JOB`) |
| `<use_formatting>` | N | `Y` (default `true` từ `setDefault()`) |
| `<default_value>` | N | Giá trị mặc định nếu field null |

### Scope Mapping

| YAML scope | XML variable_type |
|-----------|-------------------|
| `root-job` | `ROOT_JOB` |
| `parent-job` | `PARENT_JOB` |
| `grand-parent-job` | `GP_JOB` |
| `jvm` | `JVM` |

## 3. YAML → XML Mapping

| YAML | XML | Ghi chú |
|------|-----|---------|
| `type: SET_VARIABLE` | `<type>SetVariable</type>` | |
| `config.mappings[].field` | `<field_name>` | |
| `config.mappings[].variable` | `<variable_name>` | |
| `config.mappings[].scope` | `<variable_type>` | Dùng scope mapping table |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`engine/src/main/java/org/pentaho/di/trans/steps/setvariable/SetVariableMeta.java :: getXML()`.

`getXML()` ghi khối `<fields>` bao ngoài danh sách `<field>` (mỗi item:
`field_name`, `variable_name`, `variable_type`, `default_value`), rồi
`<use_formatting>`. `variable_type` ghi bằng code
`variableTypeCode = {"JVM", "PARENT_JOB", "GP_JOB", "ROOT_JOB"}`.
`setDefault()` đặt `usingFormatting = true`.

Ví dụ production: `etl_tran_ftp_dieuchinh_get_auth_token.ktr`, step "Set Variables".

## 5. Lưu ý / bẫy

- **Bẫy `variable_type` (đã đối chiếu source)**: scope grand-parent ghi là
  `GP_JOB`, KHÔNG phải `GRAND_PARENT_JOB`. Ghi sai → `getVariableType()`
  không khớp code nào và rơi về default `JVM`.
- Input stream phải produce đúng cardinality trước khi set scalar variable.
- JVM scope outlive transformation — cần review concurrency.

## Production Example

Trích từ file production: `etl_tran_ftp_dieuchinh_get_auth_token.ktr`

```xml
<step>
  <name>Set Variables</name>
  <type>SetVariable</type>
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
      <field_name>access_token</field_name>
      <variable_name>access_token</variable_name>
      <variable_type>PARENT_JOB</variable_type>
      <default_value/>
    </field>
  </fields>
  <use_formatting>Y</use_formatting>
  <attributes/>
  <cluster_schema/>
  <remotesteps>
    <input>
      </input>
    <output>
      </output>
  </remotesteps>
  <GUI>
    <xloc>848</xloc>
    <yloc>176</yloc>
    <draw>Y</draw>
  </GUI>
</step>
```
