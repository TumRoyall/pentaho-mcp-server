# Unique — Loại dòng trùng liên tiếp

## 1. XML Template

```xml
<step>
  <name>{{STEP_NAME}}</name>
  <type>Unique</type>
  <description/>
  <distribute>Y</distribute>
  <custom_distribution/>
  <copies>1</copies>
  <partitioning><method>none</method><schema_name/></partitioning>
  <count_rows>N</count_rows>
  <count_field/>
  <reject_duplicate_row>N</reject_duplicate_row>
  <error_description/>
  <fields><field><name>{{COMPARE_FIELD}}</name><case_insensitive>Y</case_insensitive></field></fields>
  <attributes/>
  <cluster_schema/>
  <remotesteps><input/><output/></remotesteps>
  <GUI><xloc>368</xloc><yloc>304</yloc><draw>Y</draw></GUI>
</step>
```

## 2. Config Fields

| Field XML | Bắt buộc | Ý nghĩa / cách điền |
|---|---|---|
| `<count_rows>` | N | `Y` thêm count field; mặc định `N`. |
| `<count_field>` | N | Tên field count; mặc định rỗng. |
| `<reject_duplicate_row>` | N | `Y` gửi duplicate sang error hop. |
| `<error_description>` | N | Mô tả error; mặc định rỗng. |
| `<fields>/<field>` | Y | Mỗi item có `name` và `case_insensitive`; default item là `Y`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: UNIQUE_ROWS` | `<type>` | Ghi `Unique`. |
| `configuration.count_rows` | `<count_rows>` | Y/N. |
| `configuration.count_field` | `<count_field>` | Chỉ có ý nghĩa khi đếm. |
| `configuration.reject_duplicates` | `<reject_duplicate_row>` | Y/N. |
| `configuration.error_description` | `<error_description>` |  |
| `configuration.fields[].name` | `<fields>/<field>/<name>` |  |
| `configuration.fields[].case_insensitive` | `<fields>/<field>/<case_insensitive>` | Y/N. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `engine/src/main/java/org/pentaho/di/trans/steps/uniquerows/UniqueRowsMeta.java` :: `getXML()`.

Source ghi `count_rows`, `count_field`, `reject_duplicate_row`, `error_description`, rồi `<fields>`. Ví dụ Spoon đã quan sát field `ID` với `case_insensitive=N`; đó là cấu hình production hợp lệ, dù default khởi tạo item là `Y`.

## 5. Lưu ý / bẫy

- Unique Rows yêu cầu input đã sort theo cùng compare fields; thường đặt SortRows ngay trước nó.
- Dùng `set_fields` với `listTag=fields`, `itemTag=field`.
- `reject_duplicate_row=Y` cần error hop phù hợp; hop nằm ngoài body XML của step.
