# ZIP_FILE — Job entry nén file ZIP

Nén file từ thư mục nguồn vào ZIP, có thể đổi tên theo thời gian hoặc di chuyển nguồn sau khi nén.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>ZIP_FILE</type>
      <attributes/>
      <zipfilename>${ZIP_FILE}</zipfilename>
      <compressionrate>1</compressionrate>
      <ifzipfileexists>2</ifzipfileexists>
      <wildcard>.*\.csv$</wildcard>
      <wildcardexclude/>
      <sourcedirectory>${SOURCE_DIR}</sourcedirectory>
      <movetodirectory/>
      <afterzip>0</afterzip>
      <addfiletoresult>N</addfiletoresult>
      <isfromprevious>N</isfromprevious>
      <createparentfolder>N</createparentfolder>
      <adddate>N</adddate>
      <addtime>N</addtime>
      <SpecifyFormat>N</SpecifyFormat>
      <date_time_format/>
      <createMoveToDirectory>N</createMoveToDirectory>
      <include_subfolders>Y</include_subfolders>
      <stored_source_path_depth>1</stored_source_path_depth>
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
| `<zipfilename>` | Y | File ZIP đầu ra. |
| `<compressionrate>` | N | Mặc định numeric `1`. |
| `<ifzipfileexists>` | N | Enum numeric, mặc định `2`. |
| `<wildcard>`, `<wildcardexclude>` | N | Regex include/exclude. |
| `<sourcedirectory>` | Y | File hoặc thư mục nguồn. |
| `<movetodirectory>`, `<afterzip>` | N | Đích và hành động sau nén; mặc định `afterzip=0`. |
| `<addfiletoresult>`, `<isfromprevious>`, `<createparentfolder>` | N | Các cờ Y/N. |
| `<adddate>`, `<addtime>`, `<SpecifyFormat>`, `<date_time_format>` | N | Đổi tên ZIP theo thời gian. |
| `<createMoveToDirectory>` | N | `Y` tạo move-to directory. |
| `<include_subfolders>` | N | Mặc định `Y`. |
| `<stored_source_path_depth>` | N | Mặc định chuỗi `1`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `configuration.output_file` | `<zipfilename>` | |
| `configuration.source_directory` | `<sourcedirectory>` | |
| `configuration.include_regex` | `<wildcard>` | Regex, không phải glob. |
| `configuration.exclude_regex` | `<wildcardexclude>` | |
| `configuration.include_subfolders` | `<include_subfolders>` | Y/N. |
| `configuration.after_zip` | `<afterzip>` | Enum numeric Spoon. |
| `configuration.add_to_result` | `<addfiletoresult>` | Y/N. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `engine/src/main/java/org/pentaho/di/job/entries/zipfile/JobEntryZipFile.java :: getXML()`.

- `getXML()` ghi tuần tự 18 node từ `zipfilename` đến `stored_source_path_depth`.
- Ví dụ observed dùng file và đường dẫn máy cục bộ; template giữ cấu trúc đó nhưng thay bằng `${ZIP_FILE}` và `${SOURCE_DIR}`.

## 5. Lưu ý / bẫy

- `compressionrate`, `ifzipfileexists`, `afterzip` là enum numeric; không tự thay bằng boolean hoặc mô tả dịch.
- Wildcard là regex: `.*\.csv$` khác glob `*.csv`.
- Nếu dùng `movetodirectory`, cân nhắc `createMoveToDirectory=Y` và kiểm tra nguy cơ ghi đè ở đích.
