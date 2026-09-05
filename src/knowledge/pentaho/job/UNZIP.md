# UNZIP — Job entry giải nén file zip

Giải nén file .zip vào thư mục đích, tuỳ chọn lọc, xử lý sau giải nén, và điều kiện success.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>UNZIP</type>
      <attributes/>
      <zipfilename>{{ZIP_FILE}}</zipfilename>
      <wildcard/>
      <wildcardexclude/>
      <targetdirectory>{{TARGET_DIR}}</targetdirectory>
      <movetodirectory/>
      <afterunzip>0</afterunzip>
      <addfiletoresult>N</addfiletoresult>
      <isfromprevious>N</isfromprevious>
      <adddate>N</adddate>
      <addtime>N</addtime>
      <addOriginalTimestamp>N</addOriginalTimestamp>
      <SpecifyFormat>N</SpecifyFormat>
      <date_time_format/>
      <rootzip>N</rootzip>
      <createfolder>N</createfolder>
      <nr_limit>10</nr_limit>
      <wildcardSource/>
      <success_condition>success_if_no_errors</success_condition>
      <iffileexists>SKIP</iffileexists>
      <create_move_to_directory>N</create_move_to_directory>
      <setOriginalModificationDate>N</setOriginalModificationDate>
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
| `<zipfilename>` | Y | Đường dẫn file zip nguồn (khi `isfromprevious=N`). |
| `<wildcard>` | N | Regex CHỌN entry trong zip cần giải nén. |
| `<wildcardexclude>` | N | Regex LOẠI TRỪ entry. |
| `<targetdirectory>` | Y | Thư mục đích (LƯU Ý: node là `targetdirectory` nhưng map từ biến `sourcedirectory`). |
| `<movetodirectory>` | N | Thư mục chuyển file zip sau khi giải nén (khi `afterunzip=2`). |
| `<afterunzip>` | N | Xử lý sau: `0`=không làm gì, `1`=xoá zip, `2`=move zip. |
| `<addfiletoresult>` | N | Thêm file giải nén vào result filenames. |
| `<isfromprevious>` | N | `Y`=lấy danh sách zip từ result entry trước. |
| `<rootzip>` | N | Giữ cấu trúc thư mục gốc trong zip. |
| `<createfolder>` | N | Tạo thư mục đích nếu chưa có. |
| `<nr_limit>` | N | Giới hạn số file cho điều kiện success. `setDefault`=`10`. |
| `<success_condition>` | N | `success_if_no_errors` / `success_if_errors_less` / `success_when_at_least`. `setDefault`=`success_if_no_errors`. |
| `<iffileexists>` | N | Ứng xử khi file đích tồn tại (mã HOA, xem bên dưới). `setDefault`=`SKIP`. |

### Giá trị `<iffileexists>` hợp lệ (từ `typeIfFileExistsCode`)
`SKIP`, `OVERWRITE`, `UNIQ`, `FAIL`, `OVERWRITE_DIFF_SIZE`, `OVERWRITE_EQUAL_SIZE`, `OVERWRITE_ZIP_BIG`, `OVERWRITE_ZIP_BIG_EQUAL`, `OVERWRITE_ZIP_SMALL`, `OVERWRITE_ZIP_SMALL_EQUAL`.

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: UNZIP` | `<type>` | `UNZIP`. |
| `configuration.zip_file` | `<zipfilename>` | |
| `configuration.target_dir` | `<targetdirectory>` | |
| `configuration.wildcard` | `<wildcard>` | |
| `configuration.after_unzip` | `<afterunzip>` | `0`/`1`/`2`. |
| `configuration.if_file_exists` | `<iffileexists>` | Mã HOA ở trên. |
| `configuration.success_condition` | `<success_condition>` | |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `engine/src/main/java/org/pentaho/di/job/entries/unzip/JobEntryUnZip.java :: getXML()`.

- `getXML()` gọi `super.getXML()` rồi ghi lần lượt: `zipfilename`, `wildcard`, `wildcardexclude`, `targetdirectory` (= biến `sourcedirectory`), `movetodirectory`, `afterunzip`, `addfiletoresult`, `isfromprevious`, `adddate`, `addtime`, `addOriginalTimestamp`, `SpecifyFormat`, `date_time_format`, `rootzip`, `createfolder`, `nr_limit`, `wildcardSource`, `success_condition`, `iffileexists` (= `getIfFileExistsCode()`), `create_move_to_directory`, `setOriginalModificationDate`.
- `setDefault()`: `iffileexist=SKIP`, `success_condition=success_if_no_errors`, `nr_limit=10`.

## 5. Lưu ý / bẫy

- Node `<targetdirectory>` được ghi TỪ biến nội bộ `sourcedirectory` (đặt tên ngược trong source) — dùng đúng tên node `targetdirectory`.
- `<iffileexists>` dùng mã HOA cố định (không dịch); sai mã → parse về giá trị mặc định.
- `<afterunzip>` là SỐ nguyên (`0/1/2`), không phải chuỗi.
- `isfromprevious=Y` thì `zipfilename` có thể bỏ trống (lấy từ entry trước).
