# CHECK_FILES_LOCKED — Job entry kiểm tra file bị khoá

Kiểm tra một/nhiều file có đang bị khoá (đang được tiến trình khác ghi) hay không.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>CHECK_FILES_LOCKED</type>
      <attributes/>
      <arg_from_previous>N</arg_from_previous>
      <include_subfolders>N</include_subfolders>
      <fields>
        <field>
          <name>{{FILE_PATH}}</name>
          <filemask>{{FILE_MASK}}</filemask>
        </field>
      </fields>
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
| `<arg_from_previous>` | N | `Y`=lấy danh sách file từ kết quả entry trước (result rows). |
| `<include_subfolders>` | N | `Y`=duyệt thư mục con. |
| `<fields>/<field>/<name>` | Y | Đường dẫn file/thư mục cần kiểm tra. |
| `<fields>/<field>/<filemask>` | N | Regex lọc file khi `<name>` là thư mục. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: CHECK_FILES_LOCKED` | `<type>` | `CHECK_FILES_LOCKED`. |
| `configuration.arg_from_previous` | `<arg_from_previous>` | Y/N. |
| `configuration.include_subfolders` | `<include_subfolders>` | Y/N. |
| `configuration.files[].name` | `<fields>/<field>/<name>` | |
| `configuration.files[].filemask` | `<fields>/<field>/<filemask>` | |

Fill `<fields>` bằng `set_fields` (listTag=`fields`, itemTag=`field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `engine/src/main/java/org/pentaho/di/job/entries/checkfilelocked/JobEntryCheckFilesLocked.java :: getXML()`.

- `getXML()` gọi `super.getXML()` rồi ghi `arg_from_previous`, `include_subfolders`, sau đó mở `<fields>`, lặp mảng ghi từng `<field>` (`name`, `filemask`), đóng `</fields>`.
- Hằng: `ARG_FROM_PREVIOUS_ATTR="arg_from_previous"`, `INCLUDE_SUBFOLDERS_ATTR="include_subfolders"`, `NAME_ATTR="name"`, `FILE_MASK_ATTR="filemask"`.

## 5. Lưu ý / bẫy

- Kết quả (locked/not) dùng để rẽ nhánh success/failure.
- Khi `arg_from_previous=Y`, `<fields>` có thể để trống vì danh sách file đến từ entry trước.
- List `<field>` nằm trong tag bao `<fields>` → fill bằng `set_fields`.
