# RowsToResult

Transformation step đẩy toàn bộ dòng stream vào result rows của transformation, để job cha có thể đọc qua "Copy rows to result" / "exec_per_row".

## 1. XML Template

```xml
<step>
  <name>{{STEP_NAME}}</name>
  <type>RowsToResult</type>
  <description/>
  <distribute>Y</distribute>
  <custom_distribution/>
  <copies>1</copies>
  <partitioning>
    <method>none</method>
    <schema_name/>
  </partitioning>
  <attributes/>
  <cluster_schema/>
  <remotesteps>
    <input/>
    <output/>
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
| (không có config riêng) | — | Step không có field cấu hình. Nó đơn giản nhận mọi dòng vào và đặt vào result set |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| (không ánh xạ) | — | Chỉ cần khai báo step, không có config |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`engine/src/main/java/org/pentaho/di/trans/steps/rowstoresult/RowsToResultMeta.java`
— class KHÔNG override `getXML()` (chỉ có `loadXML` → `readData` rỗng,
`setDefault` rỗng): phần thân step là RỖNG, không có node cấu hình nào.

```xml
<!-- Provenance: thân rỗng theo source + pattern phổ biến trong old_src/trans khi trans cần trả dòng cho job cha -->
<step>
  <name>Copy rows to result</name>
  <type>RowsToResult</type>
  <distribute>Y</distribute>
  <copies>1</copies>
  <partitioning>
    <method>none</method>
    <schema_name/>
  </partitioning>
</step>
```

## 5. Lưu ý / bẫy

- **Kết hợp với job loop**: Thường dùng khi trans tạo danh sách (ví dụ list file, list date), đẩy vào result, rồi job entry kế tiếp đặt `exec_per_row=Y` để lặp qua.
- **Memory**: Tất cả dòng được giữ trong memory cho đến khi job đọc. Không dùng cho dataset lớn.
- **Không thay thế TableOutput**: RowsToResult không ghi vào DB, nó chỉ truyền dòng sang tầng job.
- **Một chiều**: Dòng chỉ đi từ trans → job result. Job không push dòng ngược lại bằng step này.

## Production Example

Trích từ file production: `etl_trans_loop_date_ods_cal_hhmg_fx.ktr`

```xml
<step>
  <name>Copy rows to result</name>
  <type>RowsToResult</type>
  <description/>
  <distribute>Y</distribute>
  <custom_distribution/>
  <copies>1</copies>
  <partitioning>
    <method>none</method>
    <schema_name/>
  </partitioning>
  <attributes/>
  <cluster_schema/>
  <remotesteps>
    <input>
      </input>
    <output>
      </output>
  </remotesteps>
  <GUI>
    <xloc>544</xloc>
    <yloc>304</yloc>
    <draw>Y</draw>
  </GUI>
</step>
```
