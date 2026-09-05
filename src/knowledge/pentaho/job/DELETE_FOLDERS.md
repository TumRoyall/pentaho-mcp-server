# DELETE_FOLDERS — Job entry xoá nhiều thư mục

Xoá các thư mục được liệt kê và đánh giá success theo điều kiện/số lượng folder.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>DELETE_FOLDERS</type>
      <attributes/>
      <arg_from_previous>N</arg_from_previous>
      <success_condition>success_if_no_errors</success_condition>
      <limit_folders>10</limit_folders>
      <fields>
        <field>
          <name>${FOLDER_TO_DELETE}</name>
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
| `<arg_from_previous>` | N | `Y` lấy thư mục từ result trước. |
| `<success_condition>` | N | Mặc định `success_if_no_errors`; enum gồm `success_when_at_least`, `success_if_errors_less`, `success_if_no_errors`. |
| `<limit_folders>` | N | Ngưỡng số thư mục; mặc định `10`. |
| `<fields>/<field>/name` | Y | Thư mục cần xoá. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `configuration.from_previous` | `<arg_from_previous>` | Y/N. |
| `configuration.success_condition` | `<success_condition>` | Giữ enum Spoon. |
| `configuration.limit` | `<limit_folders>` | Chuỗi số. |
| `configuration.folders[].path` | `<fields>/<field>/name` | |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `engine/src/main/java/org/pentaho/di/job/entries/deletefolders/JobEntryDeleteFolders.java :: getXML()`.

- `getXML()` ghi `arg_from_previous`, `success_condition`, `limit_folders`, rồi wrapper `<fields>`.
- Mỗi `<field>` chỉ có node `<name>`; ví dụ observed giữ ý nghĩa đó nhưng dùng `${FOLDER_TO_DELETE}`.

## 5. Lưu ý / bẫy

- Dùng `set_fields` với `listTag=fields`, `itemTag=field`.
- Xoá folder là đệ quy và không hoàn tác; kiểm tra kỹ biến trước production.
- `success_if_no_errors` làm entry fail ngay khi có lỗi xoá folder.
