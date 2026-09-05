# SelectValues — Chọn, đổi tên, xóa và đổi metadata fields

## 1. XML Template

```xml
<step>
  <name>{{STEP_NAME}}</name>
  <type>SelectValues</type>
  <description/>
  <distribute>Y</distribute>
  <custom_distribution/>
  <copies>1</copies>
  <partitioning><method>none</method><schema_name/></partitioning>
  <fields>
    <field>
      <name>{{SOURCE_FIELD}}</name>
      <rename>{{TARGET_FIELD}}</rename>
    </field>
    <select_unspecified>N</select_unspecified>
    <remove><name>{{FIELD_TO_REMOVE}}</name></remove>
    <meta>
      <name>{{FIELD_TO_CHANGE}}</name>
      <rename/>
      <type>String</type>
      <length>-2</length>
      <precision>-2</precision>
      <conversion_mask/>
      <date_format_lenient>false</date_format_lenient>
      <date_format_locale/>
      <date_format_timezone/>
      <lenient_string_to_number>false</lenient_string_to_number>
      <encoding/>
      <decimal_symbol/>
      <grouping_symbol/>
      <currency_symbol/>
      <storage_type>normal</storage_type>
    </meta>
  </fields>
  <attributes/>
  <cluster_schema/>
  <remotesteps><input/><output/></remotesteps>
  <GUI><xloc>250</xloc><yloc>100</yloc><draw>Y</draw></GUI>
</step>
```

## 2. Config Fields

| Field XML | Bắt buộc | Ý nghĩa / cách điền |
|---|---|---|
| `<fields>/<field>` | N | Chọn field theo `<name>`; `<rename>` chỉ được serialize khi khác `null`. |
| `<select_unspecified>` | N | `Y` giữ các field chưa chọn (và sort chúng); `N` loại chúng. |
| `<fields>/<remove>/<name>` | N | Field cần xóa. |
| `<fields>/<meta>` | N | Đổi metadata; thứ tự node meta phải giữ như template. |
| `<meta>/<type>` | N | Tên type của `ValueMetaFactory`, ví dụ `String`, `Integer`, `Number`, `Date`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: SELECT_VALUES` | `<type>` | Ghi `SelectValues`. |
| `configuration.fields[].name` | `<fields>/<field>/<name>` | Danh sách chọn theo thứ tự output. |
| `configuration.fields[].rename` | `<fields>/<field>/<rename>` | Bỏ node nếu không đổi tên. |
| `configuration.select_unspecified` | `<fields>/<select_unspecified>` | Y/N. |
| `configuration.remove_fields[]` | `<fields>/<remove>/<name>` | Mỗi item là một `<remove>`. |
| `configuration.metadata[]` | `<fields>/<meta>` | Mỗi item là một `<meta>`. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `engine/src/main/java/org/pentaho/di/trans/steps/selectvalues/SelectValuesMeta.java` :: `getXML()`; item metadata: `SelectMetadataChange.java` :: `getXML()`.

`getXML()` ghi trong một `<fields>` duy nhất theo thứ tự: tất cả `<field>`, rồi `<select_unspecified>`, tất cả `<remove>`, rồi tất cả `<meta>`. Quan sát production trước đó có `<field><name>access_token</name></field>` và `select_unspecified=N`; tên token chỉ là tên field, không phải secret.

## 5. Lưu ý / bẫy

- Không đặt `<select_unspecified>` bên ngoài `<fields>` hoặc trước các `<field>`.
- Với `<field>`, source chỉ serialize `length` và `precision` khi `precision > 0` (cả hai điều kiện đều kiểm tra precision); không thêm các node đó vào item chọn mặc định.
- Đây là ba danh sách khác loại dưới cùng `<fields>`; generator không được dùng một `set_fields` duy nhất cho cả ba.
