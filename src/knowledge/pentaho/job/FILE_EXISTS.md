# FILE_EXISTS — Job entry kiểm tra file tồn tại

Entry trả về success nếu file tồn tại (dùng để rẽ nhánh luồng job).

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>FILE_EXISTS</type>
      <attributes/>
      <filename>{{FILENAME}}</filename>
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
| `<filename>` | Y | Đường dẫn file cần kiểm tra; hỗ trợ biến `${...}`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: FILE_EXISTS` | `<type>` | `FILE_EXISTS`. |
| `configuration.filename` | `<filename>` | |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `engine/src/main/java/org/pentaho/di/job/entries/fileexists/JobEntryFileExists.java :: getXML()`.

- `getXML()` gọi `super.getXML()` (khung `<name>/<description>/<type>/<attributes/>`) rồi ghi duy nhất node `<filename>`.
- Các node `<parallel>`, `<draw>`, `<nr>`, `<xloc>`, `<yloc>`, `<attributes_kjc/>` do JobMeta bao ngoài khi serialize entry.

## 5. Lưu ý / bẫy

- Kết quả (found/not found) dùng để rẽ nhánh: nối hop success (`evaluation=Y`) và/hoặc failure (`evaluation=N`) tới entry kế tiếp.
- Chỉ kiểm tra 1 file; nhiều file dùng FILES_EXIST.
