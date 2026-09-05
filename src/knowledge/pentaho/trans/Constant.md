# Constant — Step thêm các giá trị hằng

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>Constant</type>
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
        <name>{{FIELD_NAME}}</name>
        <type>{{TYPE}}</type>
        <format/>
        <currency/>
        <decimal/>
        <group/>
        <nullif>{{CONSTANT_VALUE}}</nullif>
        <length>-1</length>
        <precision>-1</precision>
        <set_empty_string>N</set_empty_string>
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
| `<field>/<name>` | Y | Tên field hằng mới thêm vào stream. |
| `<field>/<type>` | Y | Kiểu dữ liệu: `String`, `Integer`, `Number`, `Date`, `Boolean`... |
| `<field>/<nullif>` | Y | **Giá trị hằng** — Spoon lưu giá trị constant trong node `<nullif>` (không phải "null if"). |
| `<field>/<format>` | N | Format cho Date/Number. |
| `<field>/<length>`, `<precision>` | N | `-1` = mặc định. |
| `<field>/<set_empty_string>` | N | `Y` để set chuỗi rỗng thay vì null. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: ADD_CONSTANTS` | `<type>` | `Constant`. |
| `configuration.fields[].name` | `<field>/<name>` |  |
| `configuration.fields[].type` | `<field>/<type>` |  |
| `configuration.fields[].value` | `<field>/<nullif>` | **Giá trị hằng nằm ở node `nullif`**. |
| `configuration.fields[].format` | `<field>/<format>` |  |

Fill danh sách bằng `set_fields` (listTag=`fields`, itemTag=`field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`engine/src/main/java/org/pentaho/di/trans/steps/constant/ConstantMeta.java :: getXML()`.

`getXML()` ghi khối `<fields>` bao ngoài danh sách `<field>` (mỗi item:
`name`, `type` (ghi thẳng chuỗi), `format`, `currency`, `decimal`,
`group`, `nullif` (= giá trị hằng `value[i]`), `length`, `precision`,
`set_empty_string`). Item có `fieldName` rỗng bị bỏ qua.

Ví dụ production: `old_src/trans/trans_etl_ftp_tran_import_dieuchinh_bo.ktr`, step "Add constants".

## 5. Lưu ý / bẫy

- **Bẫy chính**: giá trị hằng được lưu trong node `<nullif>`, KHÔNG phải trong node tên `value`. Điền nhầm chỗ → field ra null.
- Giá trị hằng phải tương thích type/format đã khai báo; Date cần `format` khớp.

## Production Example

Trích từ file production: `old_src/trans/trans_etl_ftp_tran_import_dieuchinh_bo.ktr`

```xml
<step>
    <name>Add constants</name>
    <type>Constant</type>
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
        <name>FILE_ID</name>
        <type>String</type>
        <format/>
        <currency/>
        <decimal/>
        <group/>
        <nullif>TONG_HOP_DIEUCHINH_BO</nullif>
        <length>-1</length>
        <precision>-1</precision>
        <set_empty_string>N</set_empty_string>
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
      <xloc>224</xloc>
      <yloc>288</yloc>
      <draw>Y</draw>
    </GUI>
  </step>
```
