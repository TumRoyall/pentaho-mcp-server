# TRUNCATE_TABLES — Entry truncate bảng

## 1. XML Template

```xml
<entry>
  <name>Truncate staging</name>
  <description/>
  <type>TRUNCATE_TABLES</type>
  <attributes/>
  <connection>conn_target</connection>
  <arg_from_previous>N</arg_from_previous>
  <fields>
    <field>
      <name>TABLE_NAME</name>
      <schemaname>SCHEMA_NAME</schemaname>
    </field>
  </fields>
  <parallel>N</parallel>
  <draw>Y</draw>
  <nr>0</nr>
  <xloc>300</xloc>
  <yloc>96</yloc>
  <attributes_kjc/>
</entry>
```

## 2. Config Fields

| Field XML | Bắt buộc | Giá trị / Cách điền |
|-----------|----------|---------------------|
| `<connection>` | Y | Target connection |
| `<arg_from_previous>` | N | `N` mặc định; `Y` = lấy danh sách bảng từ result rows entry trước |
| `<fields>/<field>` | Y | Mỗi bảng: `<name>` (table) + `<schemaname>` (schema) — đúng thứ tự `name` trước, `schemaname` sau |

## 3. YAML → XML Mapping

| YAML | XML | Ghi chú |
|------|-----|---------|
| `type: TRUNCATE_TABLES` | `<type>TRUNCATE_TABLES</type>` | |
| `config.connection` | `<connection>` | |
| `config.tables[].name` | `<fields>/<field>/<name>` | 1 item mẫu, thêm bảng = chèn thêm `<field>` |
| `config.tables[].schema` | `<fields>/<field>/<schemaname>` | |
| `config.arg_from_previous: true` | `<arg_from_previous>Y` | Mặc định `N` |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`engine/src/main/java/org/pentaho/di/job/entries/truncatetables/JobEntryTruncateTables.java :: getXML()`
+ mô tả thứ tự node.

`getXML()` = `super.getXML()` + đúng thứ tự: `connection`,
`arg_from_previous` (**Y/N**), khối `<fields>` bao ngoài chứa mỗi
`<field>` 2 node (`name`, `schemaname`). `loadXML()` đọc lại qua
`getSubNode(entrynode, "fields")` + đếm `field` — khối `<fields>` là
BẮT BUỘC (kể cả rỗng), generator fill bằng `set_fields`
(`listTag=fields`, `itemTag=field`).

Nguồn ví dụ: `job_tonghop_fin/job_agg_apps_fin_pnl_kenhso_monthly.kjb:1620-1650` (legacy).

## 5. Lưu ý / bẫy

- Chỉ dùng cho bảng staging được phê duyệt full refresh.
- Truncate + load KHÔNG chạy parallel.
- Không truncate persistent history hoặc production targets.
- `<arg_from_previous>` dùng `Y`/`N` (không phải `T`/`F`).
- Khung entry (`parallel`, `draw`, `nr`, `xloc`, `yloc`, `attributes_kjc`) do
  `JobEntryCopy.getXML()` bao ngoài — giữ nguyên theo mẫu.

## Production Example

Trích từ file production: `job_agg_apps_fin_pnl_kenhso_monthly.kjb`

```xml
<entry>
  <name>Truncate tables</name>
  <description/>
  <type>TRUNCATE_TABLES</type>
  <attributes/>
  <connection>tckt_dc</connection>
  <arg_from_previous>N</arg_from_previous>
  <fields>
    <field>
      <name>TMP_TONGHOP_PNL_KENHSO</name>
      <schemaname>ETL</schemaname>
    </field>
  </fields>
  <parallel>N</parallel>
  <draw>Y</draw>
  <nr>0</nr>
  <xloc>1120</xloc>
  <yloc>32</yloc>
  <attributes_kjc/>
</entry>
```
