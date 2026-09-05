# FTP — Job entry tải file từ FTP server (Get files)

Kết nối FTP server, tải file khớp wildcard về thư mục đích.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>FTP</type>
      <attributes/>
      <port>21</port>
      <servername>${FTP_HOST}</servername>
      <username>${FTP_USER}</username>
      <password>${FTP_PASSWORD}</password>
      <ftpdirectory>{{REMOTE_DIR}}</ftpdirectory>
      <targetdirectory>{{LOCAL_DIR}}</targetdirectory>
      <wildcard>{{FILE_WILDCARD}}</wildcard>
      <binary>Y</binary>
      <timeout>10000</timeout>
      <remove>N</remove>
      <only_new>N</only_new>
      <active>N</active>
      <control_encoding>UTF-8</control_encoding>
      <movefiles>N</movefiles>
      <movetodirectory/>
      <adddate>N</adddate>
      <addtime>N</addtime>
      <SpecifyFormat>N</SpecifyFormat>
      <date_time_format/>
      <AddDateBeforeExtension>N</AddDateBeforeExtension>
      <isaddresult>Y</isaddresult>
      <createmovefolder>N</createmovefolder>
      <proxy_host/>
      <proxy_port/>
      <proxy_username/>
      <proxy_password/>
      <socksproxy_host/>
      <socksproxy_port/>
      <socksproxy_username/>
      <socksproxy_password/>
      <ifFileExists>skip</ifFileExists>
      <nr_limit>10</nr_limit>
      <success_condition>success_if_no_errors</success_condition>
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
| `<port>` | N | Cổng FTP; mặc định `21`. |
| `<servername>` | Y | Host FTP; dùng `${VAR}`. |
| `<username>` `<password>` | Y | Đăng nhập FTP; dùng `${VAR}`. |
| `<ftpdirectory>` | Y | Thư mục trên FTP server. |
| `<targetdirectory>` | Y | Thư mục lưu file tải về (local). |
| `<wildcard>` | N | Regex chọn file cần tải. |
| `<binary>` | N | `Y`=chế độ nhị phân (khuyến nghị cho file không phải text). |
| `<timeout>` | N | Timeout kết nối (ms). |
| `<remove>` | N | `Y`=xoá file trên server sau khi tải. |
| `<only_new>` | N | `Y`=chỉ tải file mới (chưa có ở local). |
| `<active>` | N | `Y`=active mode, `N`=passive mode. |
| `<control_encoding>` | N | Encoding kênh điều khiển FTP. |
| `<movefiles>` `<movetodirectory>` | N | Chuyển file local sau khi tải. |
| `<isaddresult>` | N | Thêm file vào result filenames. |
| `<ifFileExists>` | N | Ứng xử khi file local tồn tại (mã chuỗi, vd `skip`/`overwrite`/`uniquename`). |
| `<nr_limit>` | N | Giới hạn số file cho điều kiện success. |
| `<success_condition>` | N | `success_if_no_errors` / `success_if_errors_less` / ... |
| `<proxy_*>` / `<socksproxy_*>` | N | Cấu hình proxy; password dùng `${VAR}`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: FTP_GET` | `<type>` | `FTP`. |
| `configuration.server` | `<servername>` | `${VAR}`. |
| `configuration.port` | `<port>` | |
| `configuration.username` | `<username>` | `${VAR}`. |
| `configuration.password` | `<password>` | `${VAR}`. |
| `configuration.remote_dir` | `<ftpdirectory>` | |
| `configuration.local_dir` | `<targetdirectory>` | |
| `configuration.wildcard` | `<wildcard>` | |
| `configuration.binary` | `<binary>` | Y/N. |
| `configuration.only_new` | `<only_new>` | Y/N. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `engine/src/main/java/org/pentaho/di/job/entries/ftp/JobEntryFTP.java :: getXML()`.

- `getXML()` gọi `super.getXML()` rồi ghi lần lượt: `port`, `servername`, `username`, `password` (= `Encr.encryptPasswordIfNotUsingVariables`), `ftpdirectory`, `targetdirectory`, `wildcard`, `binary`, `timeout`, `remove`, `only_new`, `active`, `control_encoding`, `movefiles`, `movetodirectory`, `adddate`, `addtime`, `SpecifyFormat`, `date_time_format`, `AddDateBeforeExtension`, `isaddresult`, `createmovefolder`, `proxy_host`, `proxy_port`, `proxy_username`, `proxy_password`, `socksproxy_host`, `socksproxy_port`, `socksproxy_username`, `socksproxy_password`, `ifFileExists` (= biến `SifFileExists`), `nr_limit`, `success_condition`.

## 5. Lưu ý / bẫy

- TẤT CẢ password (`password`, `proxy_password`, `socksproxy_password`) mã hoá bằng `Encr.encryptPasswordIfNotUsingVariables`. Dùng `${VAR}` để không mã hoá và KHÔNG lộ secret. TUYỆT ĐỐI không nhét host/user/password thật.
- `<active>N</active>` = passive mode (thường cần cho firewall/NAT).
- `<binary>Y</binary>` cho file nhị phân (zip, excel...) để tránh hỏng dữ liệu.
- Node bảo file tồn tại là `<ifFileExists>` (ghi HOA chữ giữa) — dùng đúng.
- `<remove>Y</remove>` xoá file trên server — thao tác phá huỷ, cân nhắc kỹ.
