# GroupBy — Gom nhóm và tính aggregate

## 1. XML Template

```xml
<step>
  <name>{{STEP_NAME}}</name>
  <type>GroupBy</type>
  <description/>
  <distribute>Y</distribute>
  <custom_distribution/>
  <copies>1</copies>
  <partitioning><method>none</method><schema_name/></partitioning>
  <all_rows>N</all_rows>
  <ignore_aggregate>N</ignore_aggregate>
  <field_ignore/>
  <directory>%%java.io.tmpdir%%</directory>
  <prefix>grp</prefix>
  <add_linenr>N</add_linenr>
  <linenr_fieldname/>
  <give_back_row>N</give_back_row>
  <group><field><name>{{GROUP_FIELD}}</name></field></group>
  <fields>
    <field>
      <aggregate>{{OUTPUT_FIELD}}</aggregate>
      <subject>{{SUBJECT_FIELD}}</subject>
      <type>COUNT_ANY</type>
      <valuefield/>
    </field>
  </fields>
  <attributes/>
  <cluster_schema/>
  <remotesteps><input/><output/></remotesteps>
  <GUI><xloc>300</xloc><yloc>100</yloc><draw>Y</draw></GUI>
</step>
```

## 2. Config Fields

| Field XML | Bắt buộc | Ý nghĩa / cách điền |
|---|---|---|
| `<all_rows>` | N | `N` xuất một row mỗi group; `Y` xuất mọi input row trong group kèm kết quả aggregate của group. |
| `<ignore_aggregate>`, `<field_ignore>` | N | Cờ và tên boolean field dự kiến để bỏ qua một row khi aggregate; PDI 9.4 ghi/đọc XML nhưng `GroupByMeta` ghi rõ TODO và runtime/GUI hiện chưa dùng. |
| `<directory>`, `<prefix>` | N | File tạm; mặc định `%%java.io.tmpdir%%` và `grp`. |
| `<add_linenr>`, `<linenr_fieldname>` | N | Thêm số dòng trong group. |
| `<give_back_row>` | N | Trả lại một row; mặc định `N`. |
| `<group>/<field>/<name>` | N | Mỗi field group. |
| `<fields>/<field>` | N | Aggregate gồm `aggregate`, `subject`, `type`, `valuefield`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: GROUP_BY` | `<type>` | Ghi `GroupBy`. |
| `configuration.group_fields[]` | `<group>/<field>/<name>` | Danh sách group. |
| `configuration.aggregates[].output` | `<aggregate>` | Tên field output. |
| `configuration.aggregates[].subject` | `<subject>` | Input field; có thể rỗng cho `COUNT_ANY`. |
| `configuration.aggregates[].type` | `<type>` | Mã aggregate source. |
| `configuration.aggregates[].valuefield` | `<valuefield>` | Field/tham số bổ sung khi hàm dùng nó. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `engine/src/main/java/org/pentaho/di/trans/steps/groupby/GroupByMeta.java` :: `getXML()`.

Thứ tự phần thân là `all_rows`, `ignore_aggregate`, `field_ignore`, `directory`, `prefix`, `add_linenr`, `linenr_fieldname`, `give_back_row`, `<group>`, `<fields>`. Các mã type hợp lệ gồm `SUM`, `AVERAGE`, `MEDIAN`, `PERCENTILE`, `MIN`, `MAX`, `COUNT_ALL`, `CONCAT_COMMA`, `FIRST`, `LAST`, `FIRST_INCL_NULL`, `LAST_INCL_NULL`, `CUM_SUM`, `CUM_AVG`, `STD_DEV`, `CONCAT_STRING`, `COUNT_DISTINCT`, `COUNT_ANY`, `STD_DEV_SAMPLE`, `PERCENTILE_NEAREST_RANK`. Ví dụ production đã quan sát `CONCAT_STRING` với `<valuefield>&lt;br&gt;</valuefield>`.

## 5. Lưu ý / bẫy

- Input cần được sort theo group keys khi `all_rows=N`.
- `<field_ignore>` là node body thật; bản cũ thiếu node này nên phải giữ đúng vị trí nguồn.
- Không dựa vào `<ignore_aggregate>`/`<field_ignore>` để loại row: PDI 9.4 chưa triển khai hành vi này ở GUI hoặc worker.
- Dùng `set_fields` riêng cho `<group>/<field>` và `<fields>/<field>`; hai danh sách có cấu trúc khác nhau.
