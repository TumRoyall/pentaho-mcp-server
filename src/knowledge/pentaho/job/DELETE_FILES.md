# DELETE_FILES — Job entry xoá nhiều file

Xoá một danh sách file hoặc file trong thư mục theo regex, có thể nhận danh sách từ result trước.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>DELETE_FILES</type>
      <attributes/>
      <arg_from_previous>N</arg_from_previous>
      <include_subfolders>N</include_subfolders>
      <fields>
        <field>
          <name>${SOURCE_DIR}</name>
          <filemask>.*\.tmp$</filemask>
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
| `<arg_from_previous>` | N | `Y` đọc danh sách file từ result trước; mặc định `N`. |
| `<include_subfolders>` | N | `Y` quét thư mục con; mặc định `N`. |
| `<fields>/<field>/name` | Y | File hoặc thư mục nguồn. |
| `<fields>/<field>/filemask` | N | Regex lọc file; để rỗng khi nêu chính xác một file. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `configuration.from_previous` | `<arg_from_previous>` | Y/N. |
| `configuration.include_subfolders` | `<include_subfolders>` | Y/N. |
| `configuration.files[].path` | `<fields>/<field>/name` | |
| `configuration.files[].filemask` | `<fields>/<field>/filemask` | Regex, không phải glob. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `engine/src/main/java/org/pentaho/di/job/entries/deletefiles/JobEntryDeleteFiles.java :: getXML()`.

- `getXML()` ghi `arg_from_previous`, `include_subfolders`, rồi wrapper `<fields>`.
- Mỗi item ghi chính xác `name` rồi `filemask`; ví dụ observed nhiều item được thu gọn thành một item đã tham số hoá.

## 5. Lưu ý / bẫy

- Dùng `set_fields` với `listTag=fields`, `itemTag=field`.
- Xoá không hoàn tác; xác nhận `${SOURCE_DIR}` và regex trước production.
- `DELETE_FILES` khác `DELETE_FILE`: entry này luôn serialise wrapper `<fields>`.
