# SFTPPUT — Job entry tải file lên SFTP

Tải các file local khớp wildcard lên thư mục SFTP đích.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>SFTPPUT</type>
      <attributes/>
      <servername>${SFTP_HOST}</servername>
      <serverport>22</serverport>
      <username>${SFTP_USERNAME}</username>
      <password>${SFTP_PASSWORD}</password>
      <sftpdirectory>{{REMOTE_DIRECTORY}}</sftpdirectory>
      <localdirectory>{{LOCAL_SOURCE_DIRECTORY}}</localdirectory>
      <wildcard>{{FILE_WILDCARD}}</wildcard>
      <copyprevious>N</copyprevious>
      <copypreviousfiles>N</copypreviousfiles>
      <addFilenameResut>N</addFilenameResut>
      <usekeyfilename>N</usekeyfilename>
      <keyfilename>{{PRIVATE_KEY_FILE}}</keyfilename>
      <keyfilepass>${SFTP_KEY_PASSPHRASE}</keyfilepass>
      <compression>none</compression>
      <proxyType>{{PROXY_TYPE}}</proxyType>
      <proxyHost>${SFTP_PROXY_HOST}</proxyHost>
      <proxyPort>{{SFTP_PROXY_PORT}}</proxyPort>
      <proxyUsername>${SFTP_PROXY_USERNAME}</proxyUsername>
      <proxyPassword>${SFTP_PROXY_PASSWORD}</proxyPassword>
      <createRemoteFolder>N</createRemoteFolder>
      <aftersftpput>nothing</aftersftpput>
      <destinationfolder>{{POST_UPLOAD_DIRECTORY}}</destinationfolder>
      <createdestinationfolder>N</createdestinationfolder>
      <successWhenNoFile>N</successWhenNoFile>
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
| `<servername>`, `<serverport>` | Y | SFTP host và cổng; mặc định `22`. |
| `<username>`, `<password>` | Y khi không dùng key | Tài khoản SFTP; password dùng `${VAR}`. |
| `<sftpdirectory>`, `<localdirectory>` | Y | Thư mục remote đích và thư mục local nguồn. |
| `<wildcard>` | N | Regex lọc file local cần upload. |
| `<copyprevious>`, `<copypreviousfiles>` | N | Dùng kết quả entry trước hoặc danh sách result filenames trước. |
| `<addFilenameResut>` | N | `Y` thêm tên file upload vào result; chính tả này là đúng theo serializer. |
| `<usekeyfilename>`, `<keyfilename>`, `<keyfilepass>` | N | Xác thực bằng private key; passphrase dùng `${VAR}`. |
| `<compression>` | N | Nén SFTP ∈ {`none`, `zlib`}; mặc định `none` (xem `SFTPClient.setCompression`). |
| `<proxyType>`, `<proxyHost>`, `<proxyPort>`, `<proxyUsername>`, `<proxyPassword>` | N | Proxy tùy chọn; `<proxyType>` ∈ {`HTTP`, `SOCKS5`} (xem `SFTPClient.PROXY_TYPE_*`); password dùng `${VAR}`. |
| `<createRemoteFolder>` | N | `Y` tạo thư mục SFTP đích nếu chưa tồn tại. |
| `<aftersftpput>` | N | Cách xử lý file local sau upload: `nothing`, `delete` hoặc `move`. |
| `<destinationfolder>`, `<createdestinationfolder>` | Khi `aftersftpput=move` | Thư mục local để chuyển file và cờ tạo thư mục. |
| `<successWhenNoFile>` | N | `Y` coi là thành công khi wildcard không tìm thấy file. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: SFTP_PUT` | `<type>` | Luôn là `SFTPPUT`. |
| `configuration.host` | `<servername>` | `${SFTP_HOST}`. |
| `configuration.port` | `<serverport>` | Mặc định `22`. |
| `configuration.username` | `<username>` | `${SFTP_USERNAME}`. |
| `configuration.password` | `<password>` | `${SFTP_PASSWORD}`. |
| `configuration.remote_directory` | `<sftpdirectory>` | Placeholder đường dẫn remote. |
| `configuration.local_directory` | `<localdirectory>` | Placeholder đường dẫn local. |
| `configuration.wildcard` | `<wildcard>` | Regex. |
| `configuration.after_upload` | `<aftersftpput>` | `nothing`/`delete`/`move`. |
| `configuration.post_upload_directory` | `<destinationfolder>` | Bắt buộc khi `after_upload=move`. |
| `configuration.success_when_no_file` | `<successWhenNoFile>` | Y/N. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `engine/src/main/java/org/pentaho/di/job/entries/sftpput/JobEntrySFTPPUT.java :: getXML()`.

- Sau `super.getXML()`, `getXML()` ghi theo thứ tự: `servername`, `serverport`, `username`, `password`, `sftpdirectory`, `localdirectory`, `wildcard`, `copyprevious`, `copypreviousfiles`, `addFilenameResut`, `usekeyfilename`, `keyfilename`, `keyfilepass`, `compression`, `proxyType`, `proxyHost`, `proxyPort`, `proxyUsername`, `proxyPassword`, `createRemoteFolder`, `aftersftpput`, `destinationfolder`, `createdestinationfolder`, `successWhenNoFile`.
- Constructor đặt `serverport=22`, `compression=none`, `aftersftpput=nothing`; các cờ boolean trong template mặc định `N`.

## 5. Lưu ý / bẫy

- Tag `<addFilenameResut>` thiếu chữ `l` là chính tả thật của PDI 9.4; không đổi thành `Result`.
- `password`, `keyfilepass` và `proxyPassword` được serializer mã hoá khi không phải variable. Dùng `${VAR}` và không chép secret vào XML hay ví dụ.
- `loadXML()` có nhánh tương thích cũ: `<remove>Y</remove>` chỉ được diễn giải là `aftersftpput=delete` nếu tag `<aftersftpput>` không chọn cách xử lý nào. Template mới phải ghi `aftersftpput` rõ ràng.
- SFTPPUT là upload; download dùng entry `SFTP`.
