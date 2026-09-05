# Abort — Step dừng transformation

## 1. XML Template

```xml
<step>
  <name>{{STEP_NAME}}</name>
  <type>Abort</type>
  <description/>
  <distribute>Y</distribute>
  <custom_distribution/>
  <copies>1</copies>
  <partitioning><method>none</method><schema_name/></partitioning>
  <row_threshold>0</row_threshold>
  <message>{{MESSAGE}}</message>
  <always_log_rows>Y</always_log_rows>
  <abort_option>ABORT</abort_option>
  <attributes/>
  <cluster_schema/>
  <remotesteps><input/><output/></remotesteps>
  <GUI><xloc>200</xloc><yloc>300</yloc><draw>Y</draw></GUI>
</step>
```

## 2. Config Fields

| Field XML | Bắt buộc | Ý nghĩa / cách điền |
|---|---|---|
| `<row_threshold>` | N | Mặc định `0`; ngưỡng số row trước khi abort. |
| `<message>` | N | Thông điệp log; mặc định rỗng. |
| `<always_log_rows>` | N | Mặc định `Y`; log row khi dừng. |
| `<abort_option>` | N | `ABORT` (mặc định), `ABORT_WITH_ERROR`, hoặc `SAFE_STOP`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: ABORT` | `<type>` | Ghi `Abort`. |
| `configuration.row_threshold` | `<row_threshold>` | Chuỗi số. |
| `configuration.message` | `<message>` |  |
| `configuration.always_log_rows` | `<always_log_rows>` | Y/N. |
| `configuration.abort_option` | `<abort_option>` | Một trong ba enum nguồn. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/abort/AbortMeta.java` :: `getXML()`.

Thứ tự phần thân là `row_threshold`, `message`, `always_log_rows`, `abort_option`. Ví dụ production đã quan sát dùng `<message>Cannot get Token</message>`, `<always_log_rows>N</always_log_rows>` và `<abort_option>ABORT_WITH_ERROR</abort_option>`; không có secret hoặc đường dẫn máy.

## 5. Lưu ý / bẫy

- `loadXML()` còn đọc legacy `<abort_with_error>` khi `<abort_option>` vắng mặt; template mới phải dùng `<abort_option>`.
- Abort thường là đích của error hop hoặc nhánh false; cấu hình hop nằm ngoài XML body của step.
