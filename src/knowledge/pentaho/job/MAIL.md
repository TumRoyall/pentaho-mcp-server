# MAIL — Entry gửi mail thông báo

## 1. XML Template

```xml
<entry>
  <name>Mail error</name>
  <description/>
  <type>MAIL</type>
  <attributes/>
  <server>${MAIL_SMTP_HOST}</server>
  <port>${MAIL_SMTP_PORT}</port>
  <destination>${MAIL_ALERT_RECIPIENTS}</destination>
  <destinationCc/>
  <destinationBCc/>
  <replyto>${MAIL_ALERT_SENDER}</replyto>
  <replytoname/>
  <subject>[ETL][FAILED] ${JOB_NAME} PRD_ID=${PRD_ID}</subject>
  <include_date>N</include_date>
  <contact_person/>
  <contact_phone/>
  <comment>Run thất bại. RUN_ID=${RUN_ID}, PRD_ID=${PRD_ID}.</comment>
  <include_files>N</include_files>
  <zip_files>N</zip_files>
  <zip_name/>
  <use_auth>N</use_auth>
  <use_secure_auth>N</use_secure_auth>
  <auth_user/>
  <auth_password/>
  <only_comment>N</only_comment>
  <use_HTML>N</use_HTML>
  <use_Priority>N</use_Priority>
  <encoding>UTF-8</encoding>
  <priority>normal</priority>
  <importance>normal</importance>
  <sensitivity>normal</sensitivity>
  <secureconnectiontype>SSL</secureconnectiontype>
  <replyToAddresses/>
  <filetypes>      </filetypes>
  <embeddedimages>
  </embeddedimages>
  <parallel>N</parallel>
  <draw>Y</draw>
  <nr>0</nr>
  <xloc>600</xloc>
  <yloc>250</yloc>
  <attributes_kjc/>
</entry>
```

## 2. Config Fields

| Field XML | Bắt buộc | Giá trị / Cách điền |
|-----------|----------|---------------------|
| `<server>` | Y | SMTP server — dùng `${MAIL_SMTP_HOST}` |
| `<port>` | Y | SMTP port — dùng `${MAIL_SMTP_PORT}` |
| `<destination>` | Y | Người nhận — dùng `${MAIL_ALERT_RECIPIENTS}` |
| `<destinationCc>` / `<destinationBCc>` | N | Cc / BCc, để trống nếu không dùng |
| `<replyto>` / `<replytoname>` | N | Địa chỉ + tên người gửi — dùng `${VAR}` |
| `<subject>` | Y | Tiêu đề — có thể dùng `${VAR}` |
| `<comment>` | N | Nội dung body |
| `<include_date>` | N | `Y`/`N` — chèn ngày vào subject |
| `<contact_person>` / `<contact_phone>` | N | Thông tin liên hệ trong footer |
| `<include_files>` | N | `Y` = đính kèm file kết quả; default `N` |
| `<zip_files>` / `<zip_name>` | N | `Y` + tên zip khi nén file đính kèm |
| `<use_auth>` / `<use_secure_auth>` | N | `N` mặc định; `Y` nếu SMTP cần xác thực |
| `<auth_user>` | N* | User SMTP — dùng `${VAR}` khi `use_auth=Y` |
| `<auth_password>` | N* | Password SMTP — LUÔN `${VAR}`, không plaintext (source mã hoá qua `Encr.encryptPasswordIfNotUsingVariables`) |
| `<only_comment>` | N | `Y` = chỉ gửi comment, không đính kèm file kết quả |
| `<use_HTML>` | N | `Y` = body dạng HTML |
| `<use_Priority>` | N | `Y` = dùng mức `<priority>` (low/normal/high) |
| `<encoding>` | N | `UTF-8` |
| `<priority>` / `<importance>` / `<sensitivity>` | N | `normal` mặc định |
| `<secureconnectiontype>` | N | `SSL` (hoặc `TLS`) |
| `<replyToAddresses>` | N | Danh sách reply-to bổ sung, để trống nếu không dùng |
| `<filetypes>` | N | Rỗng mặc định; mỗi file đính kèm = 1 `<filetype>` (mã `ResultFile.getTypeCode`: `GENERAL`, `LOG`, `ERRORLINE`, `ERROR`, `WARNING`) |
| `<embeddedimages>` | N | Rỗng mặc định; mỗi ảnh nhúng = 1 `<embeddedimage>` (`image_name`, `content_id`) |

## 3. YAML → XML Mapping

| YAML | XML | Ghi chú |
|------|-----|---------|
| `type: MAIL` | `<type>MAIL</type>` | |
| `config.server` | `<server>` | Luôn dùng variable |
| `config.port` | `<port>` | Luôn dùng variable |
| `config.recipients` | `<destination>` | |
| `config.cc` / `config.bcc` | `<destinationCc>` / `<destinationBCc>` | |
| `config.reply_to` | `<replyto>` | |
| `config.subject` | `<subject>` | |
| `config.body` | `<comment>` | |
| `config.auth_user` / `config.auth_password_var` | `<auth_user>` / `<auth_password>` | Password = `${VAR}` |
| `config.attach_files: true` | `<include_files>Y` (+ `<only_comment>N`) | |
| `config.use_html: true` | `<use_HTML>Y` | Chú ý HTML hoa |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`engine/src/main/java/org/pentaho/di/job/entries/mail/JobEntryMail.java :: getXML()`
+ mô tả thứ tự node.

`getXML()` = `super.getXML()` + đúng thứ tự 30 node: `server`, `port`,
`destination`, `destinationCc`, `destinationBCc`, `replyto`, `replytoname`,
`subject`, `include_date`, `contact_person`, `contact_phone`, `comment`,
`include_files`, `zip_files`, `zip_name`, `use_auth`, `use_secure_auth`,
`auth_user`, `auth_password` (mã hoá, giữ `${VAR}`), `only_comment`,
`use_HTML` (HTML hoa), `use_Priority` (P hoa), `encoding`, `priority`,
`importance`, `sensitivity`, `secureconnectiontype`, `replyToAddresses`,
khối `<filetypes>` (mỗi item 1 node `<filetype>` mã type), khối
`<embeddedimages>` (mỗi `<embeddedimage>` 2 node `image_name`,
`content_id`). Boolean dùng **Y/N**; `loadXML()` đọc lại toàn bộ các
node này (`"Y".equalsIgnoreCase(...)` cho boolean).

Nguồn ví dụ: `knowledge/pentaho/templates/base-project/etl_job_template.kjb:328-378`.

## 5. Lưu ý / bẫy

- KHÔNG bao giờ điền giá trị thật cho server/port/destination/auth —
  chỉ dùng `${VAR}`. Password plaintext bị source mã hoá khi lưu, template giữ `${VAR}`.
- Chú ý chính tả node: `use_HTML` (HTML hoa), `use_Priority` (P hoa),
  `destinationBCc` (BCc), `replyToAddresses` (To hoa) — sai 1 ký tự là Spoon không đọc.
- Source 9.4 KHÔNG có các node OAuth (`use_grantType`, `auth_clientId`,
  `auth_secretKey`, `auth_scope`, `auth_tokenUrl`, `auth_authorizationCode`,
  `redirectURI`, `refreshToken`) — KHÔNG chèn các node này.
- `<filetypes>` rỗng ghi trên 1 dòng (`<filetypes>      </filetypes>`),
  `<embeddedimages>` rỗng có xuống dòng — giữ đúng whitespace này.
- Khung entry (`parallel`, `draw`, `nr`, `xloc`, `yloc`, `attributes_kjc`) do
  `JobEntryCopy.getXML()` bao ngoài — giữ nguyên theo mẫu.

## Production Example

Trích từ file production: `etl_job_engine_tckt_ftp_tt2_daily.kjb`
(password đã thay bằng `${VAR}`).

```xml
<entry>
  <name>Mail</name>
  <description/>
  <type>MAIL</type>
  <attributes/>
  <server>${SMTP_HOST}</server>
  <port>25</port>
  <destination>${MAIL_TO}</destination>
  <destinationCc/>
  <destinationBCc/>
  <replyto>${MAIL_REPLYTO}</replyto>
  <replytoname>${MAIL_REPLYTO_NAME}</replytoname>
  <subject>[ETL PENTAHO] ${JOB_NAME} ABORT. LH: ${SUPPORT_CONTACT}</subject>
  <include_date>N</include_date>
  <contact_person/>
  <contact_phone/>
  <comment>Job ${Internal.Job.Name} bị lỗi tại step: ${STEP_ERROR}
Message error: ${MSG_ERROR}
Liên hệ: ${SUPPORT_CONTACT}
</comment>
  <include_files>Y</include_files>
  <zip_files>N</zip_files>
  <zip_name/>
  <use_auth>Y</use_auth>
  <use_secure_auth>N</use_secure_auth>
  <auth_user>${SMTP_AUTH_USER}</auth_user>
  <auth_password>${SMTP_AUTH_PASSWORD}</auth_password>
  <only_comment>Y</only_comment>
  <use_HTML>N</use_HTML>
  <use_Priority>N</use_Priority>
  <encoding>UTF-8</encoding>
  <priority>normal</priority>
  <importance>normal</importance>
  <sensitivity>normal</sensitivity>
  <secureconnectiontype>SSL</secureconnectiontype>
  <replyToAddresses/>
  <filetypes>
    <filetype>LOG</filetype>
  </filetypes>
  <embeddedimages>
      </embeddedimages>
  <parallel>N</parallel>
  <draw>Y</draw>
  <nr>0</nr>
  <xloc>544</xloc>
  <yloc>544</yloc>
  <attributes_kjc/>
</entry>
```
