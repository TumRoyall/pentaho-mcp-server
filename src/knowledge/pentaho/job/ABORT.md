# ABORT — Job entry dừng job với lỗi

Dừng toàn bộ job và trả về trạng thái failure, có thể ghi thông điệp lỗi.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>ABORT</type>
      <attributes/>
      <message>{{ABORT_MESSAGE}}</message>
      <parallel>N</parallel>
      <draw>Y</draw>
      <nr>0</nr>
      <xloc>{{X}}</xloc>
      <yloc>{{Y}}</yloc>
      <attributes_kjc/>
    </entry>
```

## 2. Config Fields

| Field XML | Bắt buộc | Ý nghĩa / cách điền |
|---|---|---|
| `<message>` | N | Thông điệp lỗi; hỗ trợ biến Pentaho. Rỗng thì PDI dùng thông điệp mặc định. |
| `<parallel>` | N | Cờ chạy song song của khung job entry. Thường để `N` cho nhánh dừng job. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: ABORT` | `<type>` | Luôn là `ABORT`. |
| `configuration.message` | `<message>` | Tùy chọn; có thể là `${VAR}`. |
| `configuration.parallel` | `<parallel>` | Y/N. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `plugins/core/impl/src/main/java/org/pentaho/di/job/entries/abort/JobEntryAbort.java :: getXML()`.

- `getXML()` gọi `super.getXML()` và chỉ ghi thêm `<message>`.
- Constructor đặt `messageAbort=null`. Khi chạy, `evaluate()` thay biến trong message, ghi lỗi, tăng error count; `execute()` gọi `parentJob.stopAll()`.

## 5. Lưu ý / bẫy

- ABORT luôn làm entry failure và dừng toàn bộ job, không chỉ nhánh hiện tại.
- Đặt ABORT ở failure branch; message nên đủ ngữ cảnh để chẩn đoán nhưng không chứa credential, host hay đường dẫn nhạy cảm.
