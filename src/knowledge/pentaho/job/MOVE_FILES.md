# MOVE_FILES — Job entry di chuyển file hoặc thư mục

Di chuyển các cặp nguồn/đích và hỗ trợ đổi tên theo ngày giờ, xử lý file trùng, hoặc chạy mô phỏng.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>MOVE_FILES</type>
      <attributes/>
      <move_empty_folders>Y</move_empty_folders>
      <arg_from_previous>N</arg_from_previous>
      <include_subfolders>N</include_subfolders>
      <add_result_filesname>N</add_result_filesname>
      <destination_is_a_file>N</destination_is_a_file>
      <create_destination_folder>N</create_destination_folder>
      <add_date>N</add_date>
      <add_time>N</add_time>
      <SpecifyFormat>N</SpecifyFormat>
      <date_time_format/>
      <nr_errors_less_than>10</nr_errors_less_than>
      <success_condition>success_if_no_errors</success_condition>
      <AddDateBeforeExtension>N</AddDateBeforeExtension>
      <DoNotKeepFolderStructure>N</DoNotKeepFolderStructure>
      <iffileexists>do_nothing</iffileexists>
      <destinationFolder>${MOVE_TO_DIR}</destinationFolder>
      <ifmovedfileexists>do_nothing</ifmovedfileexists>
      <moved_date_time_format/>
      <create_move_to_folder>N</create_move_to_folder>
      <add_moved_date>N</add_moved_date>
      <add_moved_time>N</add_moved_time>
      <SpecifyMoveFormat>N</SpecifyMoveFormat>
      <AddMovedDateBeforeExtension>N</AddMovedDateBeforeExtension>
      <simulate>N</simulate>
      <fields>
        <field>
          <source_filefolder>${SOURCE_FILE}</source_filefolder>
          <destination_filefolder>${DESTINATION_DIR}</destination_filefolder>
          <wildcard/>
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
| `<move_empty_folders>` | N | `Y`/`N`; mặc định source là `Y`. |
| `<arg_from_previous>`, `<include_subfolders>`, `<add_result_filesname>` | N | Các cờ Y/N lấy result, quét thư mục con, thêm result. |
| `<destination_is_a_file>`, `<create_destination_folder>` | N | Cách diễn giải/tạo đích. |
| `<add_date>`, `<add_time>`, `<SpecifyFormat>`, `<date_time_format>` | N | Đổi tên đích theo thời gian. |
| `<nr_errors_less_than>`, `<success_condition>` | N | Mặc định `10`, `success_if_no_errors`. |
| `<iffileexists>`, `<ifmovedfileexists>` | N | Mặc định `do_nothing`; giữ đúng enum Spoon. |
| `<destinationFolder>` | N | Thư mục move-to chung. |
| `<simulate>` | N | `Y` chỉ mô phỏng; mặc định `N`. |
| `<fields>/<field>/source_filefolder` | Y | File/thư mục nguồn. |
| `<destination_filefolder>` | Y | File/thư mục đích cho item. |
| `<wildcard>` | N | Regex; để trống khi nguồn là file cụ thể. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `configuration.from_previous` | `<arg_from_previous>` | Y/N. |
| `configuration.destination_folder` | `<destinationFolder>` | Đích move-to chung, nếu dùng. |
| `configuration.if_exists` | `<iffileexists>` | Enum Spoon. |
| `configuration.simulate` | `<simulate>` | Y/N. |
| `configuration.files[].source` | `<fields>/<field>/source_filefolder` | |
| `configuration.files[].destination` | `<fields>/<field>/destination_filefolder` | |
| `configuration.files[].wildcard` | `<fields>/<field>/wildcard` | Regex. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `engine/src/main/java/org/pentaho/di/job/entries/movefiles/JobEntryMoveFiles.java :: getXML()`.

- `getXML()` ghi tuần tự 24 node từ `move_empty_folders` đến `simulate`, rồi `<fields>`.
- Mỗi item quan sát được gồm `source_filefolder`, `destination_filefolder`, `wildcard`; ví dụ cũ đã được làm sạch thành `${SOURCE_FILE}` và `${DESTINATION_DIR}`.

## 5. Lưu ý / bẫy

- Dùng `set_fields` với `listTag=fields`, `itemTag=field`.
- `iffileexists`, `ifmovedfileexists`, `success_condition` là enum chuỗi, không phải boolean.
- Move thay đổi vị trí dữ liệu; thử với `simulate=Y` trước khi chạy production.
