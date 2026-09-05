# EXPORT_REPOSITORY — Job entry export repository ra file XML

Xuất toàn bộ/một phần repository Pentaho ra file XML (backup).

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>EXPORT_REPOSITORY</type>
      <attributes/>
      <repositoryname>{{REPO_NAME}}</repositoryname>
      <username>${REPO_USER}</username>
      <password>${REPO_PASSWORD}</password>
      <targetfilename>{{TARGET_FILE}}</targetfilename>
      <iffileexists>0</iffileexists>
      <export_type>all</export_type>
      <directoryPath>/</directoryPath>
      <add_date>N</add_date>
      <add_time>N</add_time>
      <SpecifyFormat>N</SpecifyFormat>
      <date_time_format/>
      <createfolder>N</createfolder>
      <newfolder>N</newfolder>
      <add_result_filesname>N</add_result_filesname>
      <nr_errors_less_than>10</nr_errors_less_than>
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
| `<repositoryname>` | Y | Tên repository cần export. |
| `<username>` `<password>` | N | Thông tin đăng nhập repo; dùng `${VAR}`. |
| `<targetfilename>` | Y | File XML đích. |
| `<iffileexists>` | N | Ứng xử khi file tồn tại (SỐ: `0`=create unique, `1`=overwrite, `2`=fail — verify theo UI). |
| `<export_type>` | N | Phạm vi export: `all` / `trans` / `jobs` / ... |
| `<directoryPath>` | N | Thư mục repo export (khi export một phần). |
| `<nr_errors_less_than>` | N | Ngưỡng lỗi cho điều kiện success. |
| `<success_condition>` | N | `success_if_no_errors` / `success_if_errors_less` / ... |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: EXPORT_REPOSITORY` | `<type>` | `EXPORT_REPOSITORY`. |
| `configuration.repository` | `<repositoryname>` | |
| `configuration.target_file` | `<targetfilename>` | |
| `configuration.export_type` | `<export_type>` | |
| `configuration.username` | `<username>` | `${VAR}`. |
| `configuration.password` | `<password>` | `${VAR}`. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `engine/src/main/java/org/pentaho/di/job/entries/exportrepository/JobEntryExportRepository.java :: getXML()`.

- `getXML()` gọi `super.getXML()` rồi ghi: `repositoryname`, `username`, `password` (= `Encr.encryptPasswordIfNotUsingVariables`), `targetfilename`, `iffileexists`, `export_type`, `directoryPath`, `add_date`, `add_time`, `SpecifyFormat`, `date_time_format`, `createfolder`, `newfolder`, `add_result_filesname`, `nr_errors_less_than`, `success_condition`.

## 5. Lưu ý / bẫy

- `<password>`: source mã hoá bằng `Encr.encryptPasswordIfNotUsingVariables`. Dùng `${VAR}` để không mã hoá và không lộ secret. KHÔNG nhét mật khẩu thật.
- `iffileexists` là SỐ.
- Chỉ dùng khi có repository (không áp dụng cho file-based project). Tính năng backup/recovery.
