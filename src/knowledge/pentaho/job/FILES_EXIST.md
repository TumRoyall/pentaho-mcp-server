# FILES_EXIST — Job entry kiểm tra nhiều file tồn tại

Kiểm tra các file trong danh sách; entry thành công khi tất cả file được kiểm tra đều tồn tại.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>FILES_EXIST</type>
      <attributes/>
      <filename/>
      <fields>
        <field>
          <name>${FILE_TO_CHECK}</name>
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
| `<filename>` | N | Trường legacy; source vẫn serialise trước danh sách và mặc định rỗng. |
| `<fields>/<field>/name` | Y | Mỗi file cần kiểm tra. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `configuration.filename` | `<filename>` | Chỉ dùng cho tương thích XML cũ. |
| `configuration.files[]` | `<fields>/<field>/name` | Một `<field>` cho mỗi file. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `engine/src/main/java/org/pentaho/di/job/entries/filesexist/JobEntryFilesExist.java :: getXML()`.

- `getXML()` ghi `filename`, rồi wrapper `<fields>` với item `<field><name>…</name></field>`.
- Ví dụ observed cũ đã được làm sạch thành `${FILE_TO_CHECK}`.

## 5. Lưu ý / bẫy

- Dùng `set_fields` với `listTag=fields`, `itemTag=field` và giữ `<filename/>` trước wrapper.
- `FILES_EXIST` khác `FILE_EXISTS`: entry số nhiều serialise danh sách, còn entry số ít chỉ có `<filename>`.
- Kết quả kiểm tra dùng hop success/failure để rẽ nhánh job.
