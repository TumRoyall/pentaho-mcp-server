# CREATE_FOLDER — Job entry tạo thư mục

Tạo một thư mục, với lựa chọn fail nếu thư mục đã tồn tại.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>CREATE_FOLDER</type>
      <attributes/>
      <foldername>${FOLDER_TO_CREATE}</foldername>
      <fail_of_folder_exists>Y</fail_of_folder_exists>
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
| `<foldername>` | Y | Đường dẫn thư mục; hỗ trợ biến `${...}`. |
| `<fail_of_folder_exists>` | N | `Y` fail khi thư mục đã có; mặc định source là `Y`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `configuration.foldername` | `<foldername>` | |
| `configuration.fail_if_exists` | `<fail_of_folder_exists>` | Giữ chính tả `of` của Spoon. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `engine/src/main/java/org/pentaho/di/job/entries/createfolder/JobEntryCreateFolder.java :: getXML()`.

- `getXML()` gọi `super.getXML()` rồi ghi `foldername`, `fail_of_folder_exists`.
- Production example observed từng đặt `fail_of_folder_exists=N` để chạy lại idempotent; template giữ default constructor là `Y`.

## 5. Lưu ý / bẫy

- Không sửa node thành `fail_if_folder_exists`: `loadXML()` cũng đọc đúng tên `fail_of_folder_exists`.
- Đặt `N` nếu việc chạy lại khi thư mục đã có phải thành công.
