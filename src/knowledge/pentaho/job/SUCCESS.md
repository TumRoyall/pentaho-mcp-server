# SUCCESS — Entry kết thúc thành công

## 1. XML Template

```xml
<entry>
  <name>Success</name>
  <description/>
  <type>SUCCESS</type>
  <attributes/>
  <parallel>N</parallel>
  <draw>Y</draw>
  <nr>0</nr>
  <xloc>700</xloc>
  <yloc>96</yloc>
  <attributes_kjc/>
</entry>
```

## 2. Config Fields

| Field XML | Bắt buộc | Giá trị / Cách điền |
|-----------|----------|---------------------|
| `<type>` | Y | Cố định `SUCCESS` |
| `<name>` | Y | Tên hiển thị, mặc định `Success` |

## 3. YAML → XML Mapping

| YAML | XML | Ghi chú |
|------|-----|---------|
| `type: SUCCESS` | `<type>SUCCESS</type>` | |
| `name` / `display_name` | `<name>` | |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`engine/src/main/java/org/pentaho/di/job/entries/success/JobEntrySuccess.java :: getXML()`
— method chỉ gọi `super.getXML()`: entry KHÔNG có node cấu hình riêng
ngoài khung `JobEntryBase`.

Nguồn ví dụ: `knowledge/pentaho/templates/base-project/etl_job_template.kjb:316-327`.

## 5. Lưu ý / bẫy

- Không có config field nào khác — toàn bộ logic nằm ở hop tới entry này.

## Production Example

Trích từ file production: `etl_job_engine_tckt_ftp_tt2_daily.kjb`

```xml
<entry>
  <name>Success 2</name>
  <description/>
  <type>SUCCESS</type>
  <attributes/>
  <parallel>N</parallel>
  <draw>Y</draw>
  <nr>0</nr>
  <xloc>240</xloc>
  <yloc>640</yloc>
  <attributes_kjc/>
</entry>
```
