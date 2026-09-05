# SET_VARIABLES — Entry gán biến tại job level

## 1. XML Template

```xml
<entry>
  <name>set Variables</name>
  <description/>
  <type>SET_VARIABLES</type>
  <attributes/>
  <replacevars>Y</replacevars>
  <filename/>
  <file_variable_type>JVM</file_variable_type>
  <fields>
    <field>
      <variable_name>JOB_NAME</variable_name>
      <variable_value>${Internal.Job.Name}</variable_value>
      <variable_type>JVM</variable_type>
    </field>
    <field>
      <variable_name>CHANNEL</variable_name>
      <variable_value>PENTAHO</variable_value>
      <variable_type>JVM</variable_type>
    </field>
    <field>
      <variable_name>UNIKEY_ID</variable_name>
      <variable_value>${CHANNEL}_${JOB_NAME}_${PARAMETERS}</variable_value>
      <variable_type>JVM</variable_type>
    </field>
  </fields>
  <parallel>N</parallel>
  <draw>Y</draw>
  <nr>0</nr>
  <xloc>200</xloc>
  <yloc>96</yloc>
  <attributes_kjc/>
</entry>
```

## 2. Config Fields

| Field XML | Bắt buộc | Giá trị / Cách điền |
|-----------|----------|---------------------|
| `<replacevars>` | Y | `Y` — resolve variables trong values |
| `<filename>` | N | Để trống (khai tường minh) hoặc path file properties |
| `<file_variable_type>` | N | `JVM` |
| `<fields>/<field>` | Y | Mỗi field: `variable_name`, `variable_value`, `variable_type` |
| `variable_type` | Y | `JVM`, `CURRENT_JOB`, `PARENT_JOB`, `ROOT_JOB` |

## 3. YAML → XML Mapping

| YAML | XML | Ghi chú |
|------|-----|---------|
| `type: SET_VARIABLES` | `<type>SET_VARIABLES</type>` | |
| `config.variables[].name` | `<variable_name>` | |
| `config.variables[].value` | `<variable_value>` | |
| `config.variables[].scope` | `<variable_type>` | |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`engine/src/main/java/org/pentaho/di/job/entries/setvariables/JobEntrySetVariables.java :: getXML()`
+ `variableTypeCode = { "JVM", "CURRENT_JOB", "PARENT_JOB", "ROOT_JOB" }`.

`getXML()` = `super.getXML()` + `replacevars`, `filename`,
`file_variable_type` (code scope), khối `<fields>` (mỗi `<field>` 3
node: `variable_name`, `variable_value`, `variable_type` = code scope).

Nguồn ví dụ: `knowledge/pentaho/templates/base-project/etl_job_template.kjb:380-414`.

## 5. Lưu ý / bẫy

- SET_VARIABLES phải chạy TRƯỚC mọi consumer entry.
- Credential/secret không nằm trong `<variable_value>`.
- JVM scope ảnh hưởng concurrent runs — chọn scope cẩn thận.

## Production Example

Trích từ file production: `etl_job_engine_tckt_ftp_tt2_daily.kjb`

```xml
<entry>
  <name>Gán lỗi 2</name>
  <description/>
  <type>SET_VARIABLES</type>
  <attributes/>
  <replacevars>Y</replacevars>
  <filename/>
  <file_variable_type>JVM</file_variable_type>
  <fields>
    <field>
      <variable_name>MSG_ERROR</variable_name>
      <variable_value>call API F2B về EngineTCKT lỗi</variable_value>
      <variable_type>JVM</variable_type>
    </field>
    <field>
      <variable_name>STEP_ERROR</variable_name>
      <variable_value>call api f2b ve tckt</variable_value>
      <variable_type>JVM</variable_type>
    </field>
  </fields>
  <parallel>N</parallel>
  <draw>Y</draw>
  <nr>0</nr>
  <xloc>1024</xloc>
  <yloc>272</yloc>
  <attributes_kjc/>
</entry>
```
