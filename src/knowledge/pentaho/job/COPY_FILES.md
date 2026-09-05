# COPY_FILES — Job entry sao chép file hoặc thư mục

Sao chép một hay nhiều file/thư mục; đặt `remove_source_files=Y` khi cần xoá nguồn sau khi sao chép.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>COPY_FILES</type>
      <attributes/>
      <copy_empty_folders>Y</copy_empty_folders>
      <arg_from_previous>N</arg_from_previous>
      <overwrite_files>N</overwrite_files>
      <include_subfolders>N</include_subfolders>
      <remove_source_files>N</remove_source_files>
      <add_result_filesname>N</add_result_filesname>
      <destination_is_a_file>N</destination_is_a_file>
      <create_destination_folder>N</create_destination_folder>
      <fields>
        <field>
          <source_filefolder>${SOURCE_DIR}</source_filefolder>
          <source_configuration_name/>
          <destination_filefolder>${DESTINATION_DIR}</destination_filefolder>
          <destination_configuration_name/>
          <wildcard>.*\.csv$</wildcard>
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
| `<copy_empty_folders>` | N | `Y`/`N`; mặc định source là `Y`. |
| `<arg_from_previous>` | N | `Y` lấy file từ result của entry trước. |
| `<overwrite_files>` | N | `Y` ghi đè file đích. |
| `<include_subfolders>` | N | `Y` duyệt thư mục con. |
| `<remove_source_files>` | N | `Y` xoá nguồn sau khi copy. |
| `<add_result_filesname>` | N | `Y` thêm file đã copy vào result. |
| `<destination_is_a_file>` | N | `Y` khi đích là một file, không phải thư mục. |
| `<create_destination_folder>` | N | `Y` tạo thư mục đích nếu thiếu. |
| `<fields>/<field>/source_filefolder` | Y | File/thư mục nguồn. |
| `<source_configuration_name>` | N | Named-cluster/VFS configuration của nguồn. |
| `<destination_filefolder>` | Y | File/thư mục đích. |
| `<destination_configuration_name>` | N | Named-cluster/VFS configuration của đích. |
| `<wildcard>` | N | Regex chọn file. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `configuration.copy_empty_folders` | `<copy_empty_folders>` | Y/N. |
| `configuration.from_previous` | `<arg_from_previous>` | Y/N. |
| `configuration.files[].source` | `<fields>/<field>/source_filefolder` | Một item cho mỗi cặp nguồn/đích. |
| `configuration.files[].destination` | `<fields>/<field>/destination_filefolder` | |
| `configuration.files[].wildcard` | `<fields>/<field>/wildcard` | Regex, không phải glob. |
| `configuration.remove_source` | `<remove_source_files>` | `Y` biến thao tác thành copy rồi xoá nguồn. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `engine/src/main/java/org/pentaho/di/job/entries/copyfiles/JobEntryCopyFiles.java :: getXML()`.

- `getXML()` ghi theo thứ tự tám cờ `copy_empty_folders` đến `create_destination_folder`, rồi wrapper `<fields>`.
- Mỗi `<field>` ghi `source_filefolder`, `source_configuration_name`, `destination_filefolder`, `destination_configuration_name`, rồi `wildcard`; ví dụ observed đã được chuẩn hoá thành `${SOURCE_DIR}` và `${DESTINATION_DIR}`.

## 5. Lưu ý / bẫy

- Dùng `set_fields` với `listTag=fields`, `itemTag=field`; không bỏ hai node `*_configuration_name` ngay cả khi để rỗng.
- `wildcard` là regex; `.*\.csv$` khác glob `*.csv`.
- `remove_source_files=Y` có tính phá huỷ; chỉ bật sau khi xác nhận copy thành công.
