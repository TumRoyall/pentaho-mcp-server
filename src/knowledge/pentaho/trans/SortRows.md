# SortRows — Sắp xếp dòng

## 1. XML Template

```xml
<step>
  <name>{{STEP_NAME}}</name>
  <type>SortRows</type>
  <description/>
  <distribute>Y</distribute>
  <custom_distribution/>
  <copies>1</copies>
  <partitioning><method>none</method><schema_name/></partitioning>
  <directory>%%java.io.tmpdir%%</directory>
  <prefix>out</prefix>
  <sort_size>1000000</sort_size>
  <free_memory/>
  <compress>N</compress>
  <compress_variable/>
  <unique_rows>N</unique_rows>
  <fields>
    <field>
      <name>{{SORT_FIELD}}</name><ascending>Y</ascending><case_sensitive>Y</case_sensitive>
      <collator_enabled>N</collator_enabled><collator_strength>0</collator_strength><presorted>N</presorted>
    </field>
  </fields>
  <attributes/>
  <cluster_schema/>
  <remotesteps><input/><output/></remotesteps>
  <GUI><xloc>720</xloc><yloc>272</yloc><draw>Y</draw></GUI>
</step>
```

## 2. Config Fields

| Field XML | Bắt buộc | Ý nghĩa / cách điền |
|---|---|---|
| `<directory>`, `<prefix>` | N | File tạm; defaults `%%java.io.tmpdir%%`, `out`. |
| `<sort_size>`, `<free_memory>` | N | Buffer sort và ngưỡng RAM trống. |
| `<compress>`, `<compress_variable>` | N | Nén file tạm hoặc biến điều khiển. |
| `<unique_rows>` | N | Chỉ chuyển các row unique sau sort. |
| `<fields>/<field>` | Y | `name`, `ascending`, `case_sensitive`, `collator_enabled`, `collator_strength`, `presorted`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: SORT_ROWS` | `<type>` | Ghi `SortRows`. |
| `configuration.temp_directory` | `<directory>` |  |
| `configuration.temp_prefix` | `<prefix>` |  |
| `configuration.sort_size` | `<sort_size>` |  |
| `configuration.free_memory` | `<free_memory>` |  |
| `configuration.compress` | `<compress>` | Y/N. |
| `configuration.compress_variable` | `<compress_variable>` |  |
| `configuration.unique_rows` | `<unique_rows>` | Y/N. |
| `configuration.fields[].name` | `<fields>/<field>/<name>` | Danh sách theo thứ tự khóa sort. |
| `configuration.fields[].ascending` | `<fields>/<field>/<ascending>` | Y/N. |
| `configuration.fields[].case_sensitive` | `<fields>/<field>/<case_sensitive>` | Y/N. |
| `configuration.fields[].collator_enabled` | `<fields>/<field>/<collator_enabled>` | Y/N. |
| `configuration.fields[].collator_strength` | `<fields>/<field>/<collator_strength>` | Số nguyên. |
| `configuration.fields[].presorted` | `<fields>/<field>/<presorted>` | Y/N. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `engine/src/main/java/org/pentaho/di/trans/steps/sort/SortRowsMeta.java` :: `getXML()`.

Source ghi `directory`, `prefix`, `sort_size`, `free_memory`, `compress`, `compress_variable`, `unique_rows`, rồi `<fields>`. Ví dụ Spoon đã quan sát sort field `ID` tăng dần, không case-sensitive, `collator_strength=0`; các giá trị này có thể khác default tạo mới (`case_sensitive=Y`).

## 5. Lưu ý / bẫy

- Dùng `set_fields` với `listTag=fields`, `itemTag=field`; thứ tự item là độ ưu tiên sort.
- Sort lớn có thể ghi đĩa; đảm bảo thư mục tạm có đủ dung lượng.
- `collator_strength` là số, còn `ascending`, `case_sensitive`, `collator_enabled`, `presorted` là Y/N.
