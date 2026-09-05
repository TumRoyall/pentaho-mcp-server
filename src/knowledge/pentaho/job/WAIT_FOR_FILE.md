# WAIT_FOR_FILE — Job entry chờ file xuất hiện

Chặn job cho tới khi file xuất hiện (hoặc hết timeout), tuỳ chọn kiểm tra kích thước ổn định.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>WAIT_FOR_FILE</type>
      <attributes/>
      <filename>{{FILENAME}}</filename>
      <maximum_timeout>0</maximum_timeout>
      <check_cycle_time>0</check_cycle_time>
      <success_on_timeout>N</success_on_timeout>
      <file_size_check>N</file_size_check>
      <add_filename_result>N</add_filename_result>
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
| `<filename>` | Y | Đường dẫn file chờ; hỗ trợ biến. |
| `<maximum_timeout>` | N | Thời gian chờ tối đa (giây); `0`=chờ vô hạn. |
| `<check_cycle_time>` | N | Chu kỳ kiểm tra lại (giây). |
| `<success_on_timeout>` | N | `Y`=coi là success khi hết timeout dù file chưa có. |
| `<file_size_check>` | N | `Y`=chờ kích thước file ổn định (file ghi xong). |
| `<add_filename_result>` | N | `Y`=thêm file vào result filenames. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: WAIT_FOR_FILE` | `<type>` | `WAIT_FOR_FILE`. |
| `configuration.filename` | `<filename>` | |
| `configuration.maximum_timeout` | `<maximum_timeout>` | Giây; `0`=vô hạn. |
| `configuration.check_cycle_time` | `<check_cycle_time>` | |
| `configuration.success_on_timeout` | `<success_on_timeout>` | Y/N. |
| `configuration.file_size_check` | `<file_size_check>` | Y/N. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `engine/src/main/java/org/pentaho/di/job/entries/waitforfile/JobEntryWaitForFile.java :: getXML()`.

- `getXML()` gọi `super.getXML()` rồi ghi: `filename`, `maximum_timeout`, `check_cycle_time`, `success_on_timeout`, `file_size_check`, `add_filename_result`.

## 5. Lưu ý / bẫy

- `maximum_timeout=0` = chờ VÔ HẠN; đặt giá trị dương để tránh treo job.
- `success_on_timeout=N` + timeout → entry FAIL; `=Y` → tiếp tục dù chưa có file.
- `file_size_check=Y` giúp tránh đọc file khi tiến trình khác đang ghi dở.
