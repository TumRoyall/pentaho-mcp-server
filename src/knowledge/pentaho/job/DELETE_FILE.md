# DELETE_FILE — Job entry xoá một file

Xoá một file (thường là trigger hoặc file tạm) và có thể fail nếu file không tồn tại.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>DELETE_FILE</type>
      <attributes/>
      <filename>${FILE_TO_DELETE}</filename>
      <fail_if_file_not_exists>N</fail_if_file_not_exists>
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
| `<filename>` | Y | Đường dẫn file; hỗ trợ biến `${...}`. |
| `<fail_if_file_not_exists>` | N | `Y` để fail khi file không tồn tại; mặc định source là `N`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `configuration.filename` | `<filename>` | |
| `configuration.fail_if_missing` | `<fail_if_file_not_exists>` | Y/N. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `engine/src/main/java/org/pentaho/di/job/entries/deletefile/JobEntryDeleteFile.java :: getXML()`.

- `getXML()` gọi `super.getXML()` rồi ghi theo thứ tự `filename`, `fail_if_file_not_exists`.
- Ví dụ observed cũ dùng đường dẫn máy cụ thể; template thay bằng `${FILE_TO_DELETE}`.

## 5. Lưu ý / bẫy

- Đây là thao tác phá huỷ; kiểm tra giá trị biến và quyền trước khi chạy.
- `fail_if_file_not_exists=N` làm thao tác idempotent; đặt `Y` khi file bắt buộc phải có.
