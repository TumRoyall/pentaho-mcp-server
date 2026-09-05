# SwitchCase — Phân nhánh theo giá trị field

## 1. XML Template

```xml
<step>
  <name>{{STEP_NAME}}</name>
  <type>SwitchCase</type>
  <description/>
  <distribute>Y</distribute>
  <custom_distribution/>
  <copies>1</copies>
  <partitioning><method>none</method><schema_name/></partitioning>
  <fieldname>{{SWITCH_FIELD}}</fieldname>
  <use_contains>N</use_contains>
  <case_value_type>None</case_value_type>
  <case_value_format/>
  <case_value_decimal/>
  <case_value_group/>
  <default_target_step>{{DEFAULT_TARGET_STEP}}</default_target_step>
  <cases>
    <case><value>{{CASE_VALUE}}</value><target_step>{{CASE_TARGET_STEP}}</target_step></case>
  </cases>
  <attributes/>
  <cluster_schema/>
  <remotesteps><input/><output/></remotesteps>
  <GUI><xloc>448</xloc><yloc>512</yloc><draw>Y</draw></GUI>
</step>
```

## 2. Config Fields

| Field XML | Bắt buộc | Ý nghĩa / cách điền |
|---|---|---|
| `<fieldname>` | Y | Field dùng để phân nhánh. |
| `<use_contains>` | N | `Y` để so khớp contains, mặc định `N`. |
| `<case_value_type>` | Y | Tên type `ValueMetaBase`, ví dụ `None`, `String`, `Integer`, `Number`, `Date`. |
| `<case_value_format>`, `<case_value_decimal>`, `<case_value_group>` | N | Format/decimal/grouping cho giá trị case. |
| `<default_target_step>` | N | Tên step nhận giá trị không khớp. |
| `<cases>/<case>` | N | Một `<value>` và một `<target_step>` cho từng nhánh. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: SWITCH_CASE` | `<type>` | Ghi `SwitchCase`. |
| `configuration.field` | `<fieldname>` |  |
| `configuration.use_contains` | `<use_contains>` | Y/N. |
| `configuration.value_type` | `<case_value_type>` | Tên type Spoon ghi. |
| `configuration.value_format` | `<case_value_format>` |  |
| `configuration.value_decimal` | `<case_value_decimal>` |  |
| `configuration.value_group` | `<case_value_group>` |  |
| `configuration.default_target` | `<default_target_step>` | Tham chiếu step. |
| `configuration.cases[]` | `<cases>/<case>` | `value` và `target_step`. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `engine/src/main/java/org/pentaho/di/trans/steps/switchcase/SwitchCaseMeta.java` :: `getXML()`.

Source ghi lần lượt `fieldname`, `use_contains`, `case_value_type`, `case_value_format`, `case_value_decimal`, `case_value_group`, `default_target_step`, rồi `<cases>`. Ví dụ Spoon đã quan sát phân nhánh field `ID`, case `1` tới `Null if`, với fallback `CSV file input`.

## 5. Lưu ý / bẫy

- `<target_step>` của mỗi case và `<default_target_step>` phải trỏ tới step tồn tại; generator cần cập nhật hop tương ứng.
- Dùng `set_fields` cho danh sách (`listTag=cases`, `itemTag=case`); giữ nguyên wrapper `<cases>`.
- `case_value_type=None` là giá trị Spoon quan sát để so khớp chuỗi thô; không thay bằng số enum Java.
