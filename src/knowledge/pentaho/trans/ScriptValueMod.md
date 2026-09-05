# ScriptValueMod — Step JavaScript transform

## 1. XML Template

```xml
<step>
  <name>DERIVE_FIELDS</name>
  <type>ScriptValueMod</type>
  <description/>
  <distribute>Y</distribute>
  <custom_distribution/>
  <copies>1</copies>
  <partitioning>
    <method>none</method>
    <schema_name/>
  </partitioning>
  <compatible>N</compatible>
  <optimizationLevel>9</optimizationLevel>
  <jsScripts>
    <jsScript>
      <jsScript_type>0</jsScript_type>
      <jsScript_name>Script 1</jsScript_name>
      <jsScript_script>
var derived = input_field.toUpperCase();
      </jsScript_script>
    </jsScript>
  </jsScripts>
  <fields>
    <field>
      <name>derived</name>
      <rename>derived</rename>
      <type>String</type>
      <length>-1</length>
      <precision>-1</precision>
      <replace>N</replace>
    </field>
  </fields>
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
| `<compatible>` | Y | `N` (JavaScript mới) |
| `<optimizationLevel>` | N | `9` |
| `<jsScripts>/<jsScript>` | Y | Script body |
| `<jsScript_type>` | Y | `0` = main, `1` = start, `2` = end |
| `<fields>/<field>` | Y | Output fields: name, type, length, precision |

## 3. YAML → XML Mapping

| YAML | XML | Ghi chú |
|------|-----|---------|
| `type: SCRIPT` | `<type>ScriptValueMod</type>` | |
| `config.script` | `<jsScript_script>` | XML-escape content |
| `config.output_fields[]` | `<fields>/<field>` | |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`engine/src/main/java/org/pentaho/di/trans/steps/scriptvalues_mod/ScriptValuesMetaMod.java :: getXML()`.

`getXML()` ghi đúng thứ tự: `compatible`, `optimizationLevel`, khối
`<jsScripts>` (mỗi `<jsScript>` 3 node: hằng `JSSCRIPT_TAG_TYPE` =
`jsScript_type`, `JSSCRIPT_TAG_NAME` = `jsScript_name`,
`JSSCRIPT_TAG_SCRIPT` = `jsScript_script`), khối `<fields>` (mỗi
`<field>` 6 node: `name`, `rename`, `type`, `length`, `precision`,
`replace`). `setDefault()`: `compatible=false` (ghi `N`),
1 script mẫu, 0 field.

## 5. Lưu ý / bẫy

- Ưu tiên native steps cho logic đơn giản.
- Script body phải XML-escape nếu chứa `<`, `>`, `&`.
- Output fields không declare → invisible downstream.
- Không embed credential trong script.

## Production Example

Trích từ file production: `etl_tran_ftp_dieuchinh_get_auth_token.ktr`

```xml
<step>
  <name>Modified Java Script Value</name>
  <type>ScriptValueMod</type>
  <description/>
  <distribute>Y</distribute>
  <custom_distribution/>
  <copies>1</copies>
  <partitioning>
    <method>none</method>
    <schema_name/>
  </partitioning>
  <compatible>N</compatible>
  <optimizationLevel>9</optimizationLevel>
  <jsScripts>
    <jsScript>
      <jsScript_type>0</jsScript_type>
      <jsScript_name>Script 1</jsScript_name>
      <jsScript_script>//Script here
var grant_type = "client_credentials";</jsScript_script>
    </jsScript>
  </jsScripts>
  <fields>
    <field>
      <name>grant_type</name>
      <rename>grant_type</rename>
      <type>String</type>
      <length>-1</length>
      <precision>-1</precision>
      <replace>N</replace>
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
    <xloc>96</xloc>
    <yloc>352</yloc>
    <draw>Y</draw>
  </GUI>
</step>
```
