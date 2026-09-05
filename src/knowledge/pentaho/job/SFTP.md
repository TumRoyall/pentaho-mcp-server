# SFTP — Job entry tải file từ SFTP

Tải các file khớp wildcard từ SFTP về thư mục local.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>SFTP</type>
      <attributes/>
      <servername>${SFTP_HOST}</servername>
      <serverport>22</serverport>
      <username>${SFTP_USERNAME}</username>
      <password>${SFTP_PASSWORD}</password>
      <sftpdirectory>{{REMOTE_DIRECTORY}}</sftpdirectory>
      <targetdirectory>{{LOCAL_TARGET_DIRECTORY}}</targetdirectory>
      <wildcard>{{FILE_WILDCARD}}</wildcard>
      <remove>N</remove>
      <isaddresult>Y</isaddresult>
      <createtargetfolder>N</createtargetfolder>
      <copyprevious>N</copyprevious>
      <usekeyfilename>N</usekeyfilename>
      <keyfilename>{{PRIVATE_KEY_FILE}}</keyfilename>
      <keyfilepass>${SFTP_KEY_PASSPHRASE}</keyfilepass>
      <compression>none</compression>
      <proxyType>{{PROXY_TYPE}}</proxyType>
      <proxyHost>${SFTP_PROXY_HOST}</proxyHost>
      <proxyPort>{{SFTP_PROXY_PORT}}</proxyPort>
      <proxyUsername>${SFTP_PROXY_USERNAME}</proxyUsername>
      <proxyPassword>${SFTP_PROXY_PASSWORD}</proxyPassword>
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
| `<servername>`, `<serverport>` | Y | SFTP host và cổng; constructor mặc định cổng `22`. |
| `<username>`, `<password>` | Y khi không dùng key | Tài khoản SFTP; password dùng `${VAR}`, không ghi plaintext. |
| `<sftpdirectory>`, `<targetdirectory>` | Y | Thư mục nguồn remote và thư mục đích local. |
| `<wildcard>` | N | Regex chọn file cần tải; rỗng là không lọc. |
| `<remove>` | N | `Y` xoá file remote sau khi tải; mặc định `N`. |
| `<isaddresult>` | N | `Y` thêm file đã tải vào result filenames; mặc định `Y`. |
| `<createtargetfolder>` | N | `Y` tạo thư mục local nếu chưa có. |
| `<copyprevious>` | N | `Y` dùng danh sách file từ result của entry trước. |
| `<usekeyfilename>`, `<keyfilename>`, `<keyfilepass>` | N | Xác thực bằng private key; passphrase dùng `${VAR}`. |
| `<compression>` | N | Nén SFTP ∈ {`none`, `zlib`}; constructor mặc định `none` (xem `SFTPClient.setCompression`). |
| `<proxyType>`, `<proxyHost>`, `<proxyPort>`, `<proxyUsername>`, `<proxyPassword>` | N | Proxy tùy chọn; `<proxyType>` ∈ {`HTTP`, `SOCKS5`} (xem `SFTPClient.PROXY_TYPE_*`); proxy password dùng `${VAR}`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: SFTP_GET` | `<type>` | Luôn là `SFTP`. |
| `configuration.host` | `<servername>` | `${SFTP_HOST}`. |
| `configuration.port` | `<serverport>` | Mặc định `22`. |
| `configuration.username` | `<username>` | `${SFTP_USERNAME}`. |
| `configuration.password` | `<password>` | `${SFTP_PASSWORD}`. |
| `configuration.remote_directory` | `<sftpdirectory>` | Placeholder đường dẫn remote. |
| `configuration.local_directory` | `<targetdirectory>` | Placeholder đường dẫn local. |
| `configuration.wildcard` | `<wildcard>` | Regex. |
| `configuration.remove_after_download` | `<remove>` | Y/N. |
| `configuration.add_to_result` | `<isaddresult>` | Y/N. |
| `configuration.private_key_file` | `<keyfilename>` | Bật `<usekeyfilename>Y</usekeyfilename>` khi dùng. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `engine/src/main/java/org/pentaho/di/job/entries/sftp/JobEntrySFTP.java :: getXML()`.

- Sau `super.getXML()`, `getXML()` ghi lần lượt: `servername`, `serverport`, `username`, `password`, `sftpdirectory`, `targetdirectory`, `wildcard`, `remove`, `isaddresult`, `createtargetfolder`, `copyprevious`, `usekeyfilename`, `keyfilename`, `keyfilepass`, `compression`, `proxyType`, `proxyHost`, `proxyPort`, `proxyUsername`, `proxyPassword`.
- Constructor đặt `serverport=22`, `isaddresult=true`, `compression=none`; các cờ còn lại trong template là `N`.

## 5. Lưu ý / bẫy

- `password`, `keyfilepass` và `proxyPassword` được `getXML()` truyền qua `Encr.encryptPasswordIfNotUsingVariables`; dùng `${VAR}` để Spoon giữ biến thay vì ghi secret.
- `remove=Y` là thao tác phá huỷ trên remote. Chỉ bật sau khi đã xác nhận tải thành công.
- SFTP là download; upload dùng entry `SFTPPUT`.
