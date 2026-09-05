# SHELL — Entry thực thi lệnh shell/script bên ngoài

## 1. XML Template

```xml
<entry>
  <name>Run backup script</name>
  <description/>
  <type>SHELL</type>
  <attributes/>
  <filename>${Internal.Entry.Current.Directory}/scripts/backup.sh</filename>
  <work_directory>${Internal.Entry.Current.Directory}</work_directory>
  <arg_from_previous>N</arg_from_previous>
  <exec_per_row>N</exec_per_row>
  <set_logfile>N</set_logfile>
  <logfile/>
  <set_append_logfile>N</set_append_logfile>
  <logext/>
  <add_date>N</add_date>
  <add_time>N</add_time>
  <insertScript>N</insertScript>
  <script/>
  <loglevel>Basic</loglevel>
  <parallel>N</parallel>
  <draw>Y</draw>
  <nr>0</nr>
  <xloc>300</xloc>
  <yloc>96</yloc>
  <attributes_kjc/>
</entry>
```

## 2. Config Fields

| Field XML | Bắt buộc | Ý nghĩa / cách điền |
|---|---|---|
| `filename` | Y* | Đường dẫn tới script file (.sh/.bat) — dùng `${VAR}`; bỏ trống nếu dùng inline script |
| `work_directory` | N | Thư mục làm việc khi chạy script. Hỗ trợ biến |
| `arg_from_previous` | Y | `Y`/`N` — nhận argument từ result rows của entry trước (default `N`) |
| `exec_per_row` | Y | `Y`/`N` — chạy script một lần cho mỗi row (default `N`) |
| `set_logfile` | Y | `Y`/`N` — redirect stdout/stderr vào log file (default `N`) |
| `logfile` | N | Đường dẫn log file (khi set_logfile=Y) — dùng `${VAR}` |
| `set_append_logfile` | Y | `Y`/`N` — append thay vì overwrite log file (default `N`) |
| `logext` | N | Extension cho log file (vd `txt`) |
| `add_date` | Y | `Y`/`N` — thêm ngày vào tên log file (default `N`) |
| `add_time` | Y | `Y`/`N` — thêm giờ vào tên log file (default `N`) |
| `insertScript` | Y | `Y`/`N` — dùng inline script thay vì file (default `N`; chú ý `S` hoa) |
| `script` | N* | Nội dung script inline (khi insertScript=Y). Cần XML-escape |
| `loglevel` | Y | `Nothing`, `Error`, `Minimal`, `Basic` (default), `Detailed`, `Debug`, `Rowlevel` — mã `LogLevel.getCode()` |
| `argumentN` | N | Argument thứ N (`argument0`, `argument1`, …) — CHỈ ghi khi có argument, không có tag bao ngoài (xem §5) |

*Một trong hai `filename` hoặc `script` (khi insertScript=Y) là bắt buộc.

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `script_file` | `filename` | Hỗ trợ biến `${VAR}` |
| `working_directory` | `work_directory` | Chú ý `work_directory`, không phải `working_directory` |
| `inline_script` | `script` | Phải XML-escape; kèm `insertScript=Y` |
| `use_inline` | `insertScript` | Y/N, `S` hoa |
| `args_from_previous` | `arg_from_previous` | Y/N |
| `exec_per_row` | `exec_per_row` | Y/N |
| `log_file` | `logfile` | Kèm `set_logfile=Y` |
| `append_log` | `set_append_logfile` | Y/N |
| `log_extension` | `logext` | |
| `log_level` | `loglevel` | Mã LogLevel, default `Basic` |
| `arguments[]` | `argument0`, `argument1`, … | Không tag bao, đánh số từ 0 |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`engine/src/main/java/org/pentaho/di/job/entries/shell/JobEntryShell.java :: getXML()`
+ mô tả thứ tự node.

`getXML()` = `super.getXML()` + đúng thứ tự 13 node cố định: `filename`,
`work_directory`, `arg_from_previous`, `exec_per_row`, `set_logfile`,
`logfile`, `set_append_logfile`, `logext`, `add_date`, `add_time`,
`insertScript` (`S` hoa), `script`, `loglevel` (mã `LogLevel.getCode()`,
`null` nếu chưa chọn) + các node `argumentN` (`argument0`, `argument1`, …
đánh số từ 0, KHÔNG có tag bao ngoài — source tự chú thích "VERY BAD WAY...
DON'T REUSE IT"). `loadXML()` đọc argument bằng vòng lặp
`getTagValue(entrynode, "argument" + argnr)` cho tới `null`. `clear()`
default mọi boolean `false` (= `N`).

Ví dụ inline script (kèm `argument` điều kiện):

```xml
<entry>
  <name>Shell</name>
  <description/>
  <type>SHELL</type>
  <attributes/>
  <filename/>
  <work_directory/>
  <arg_from_previous>N</arg_from_previous>
  <exec_per_row>N</exec_per_row>
  <set_logfile>Y</set_logfile>
  <logfile>${LOG_DIR}\log_shell_${PRD_ID}</logfile>
  <set_append_logfile>N</set_append_logfile>
  <logext>txt</logext>
  <add_date>Y</add_date>
  <add_time>Y</add_time>
  <insertScript>Y</insertScript>
  <script>${SQLLDR_BIN} /@${DB_TNS_ALIAS}, control=${BULK_DIR}\load_original.ctl</script>
  <loglevel>Basic</loglevel>
  <parallel>N</parallel>
  <draw>Y</draw>
  <nr>0</nr>
  <xloc>1074</xloc>
  <yloc>163</yloc>
  <attributes_kjc/>
</entry>
```

## 5. Lưu ý / bẫy

- **Exit code quyết định success/failure**: exit 0 = success, khác 0 = failure.
- **Inline script phải XML-escape**: `<` → `&lt;`, `>` → `&gt;`, `&` → `&amp;`.
- **Biến PDI được resolve**: `${PRD_ID}` trong filename và script đều được thay thế.
- **Platform-dependent**: Script .sh chỉ chạy trên Linux, .bat chỉ trên Windows. Thiết kế cần ghi rõ platform.
- **Không dùng cho logic nghiệp vụ**: Shell chỉ phù hợp cho tác vụ hệ thống (backup, file management, invoke external tool). Logic dữ liệu nên ở transformation.
- **Boolean dùng `Y`/`N`** (so `equalsIgnoreCase("Y")` trong `loadXML`), khác SQL entry dùng `T`/`F`.
- **`argumentN` không có tag bao**: generator KHÔNG dùng `set_fields` được —
  chèn thủ công từng `<argument0>`, `<argument1>`, … sau `<loglevel>`, đánh số liên tục từ 0.
- Khung entry (`parallel`, `draw`, `nr`, `xloc`, `yloc`, `attributes_kjc`) do
  `JobEntryCopy.getXML()` bao ngoài — giữ nguyên theo mẫu.
- Không absolute path máy cụ thể trong template — dùng `${VAR}` hoặc `${Internal.Entry.Current.Directory}`.

## Production Example

Trích từ file production: `job_ftp_job_int_rdf.kjb`

```xml
<entry>
  <name>Shell</name>
  <description/>
  <type>SHELL</type>
  <attributes/>
  <filename/>
  <work_directory/>
  <arg_from_previous>N</arg_from_previous>
  <exec_per_row>N</exec_per_row>
  <set_logfile>Y</set_logfile>
  <logfile>${LOG_DIR}\log_shell_${PRD_ID}</logfile>
  <set_append_logfile>N</set_append_logfile>
  <logext>txt</logext>
  <add_date>Y</add_date>
  <add_time>Y</add_time>
  <insertScript>Y</insertScript>
  <script>${SQLLDR_BIN} /@${DB_TNS_ALIAS}, control=${BULK_DIR}\load_original.ctl, log=${BULK_DIR}\load_${PRD_ID}.log, bad=${BULK_DIR}\load_${PRD_ID}.bad, DATA=${BULK_DATA_DIR}\load_data.dat, errors=50,direct=true,rows=100000, discard=${BULK_DIR}\load_${PRD_ID}.dis,discardmax=5</script>
  <loglevel>Basic</loglevel>
  <parallel>N</parallel>
  <draw>Y</draw>
  <nr>0</nr>
  <xloc>1074</xloc>
  <yloc>163</yloc>
  <attributes_kjc/>
</entry>
```
