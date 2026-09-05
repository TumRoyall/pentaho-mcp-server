# TRANS — Entry gọi Transformation

## 1. XML Template

```xml
<entry>
  <name>etl_trans_example</name>
  <description/>
  <type>TRANS</type>
  <attributes/>
  <specification_method>filename</specification_method>
  <trans_object_id/>
  <filename>${Internal.Entry.Current.Directory}/etl_trans_example.ktr</filename>
  <transname/>
  <arg_from_previous>N</arg_from_previous>
  <params_from_previous>N</params_from_previous>
  <exec_per_row>N</exec_per_row>
  <clear_rows>N</clear_rows>
  <clear_files>N</clear_files>
  <set_logfile>N</set_logfile>
  <logfile/>
  <logext/>
  <add_date>N</add_date>
  <add_time>N</add_time>
  <loglevel>Basic</loglevel>
  <cluster>N</cluster>
  <slave_server_name/>
  <set_append_logfile>N</set_append_logfile>
  <wait_until_finished>Y</wait_until_finished>
  <follow_abort_remote>N</follow_abort_remote>
  <create_parent_folder>N</create_parent_folder>
  <logging_remote_work>N</logging_remote_work>
  <run_configuration>Pentaho local</run_configuration>
  <suppress_result_data>N</suppress_result_data>
  <parameters>
    <pass_all_parameters>Y</pass_all_parameters>
  </parameters>
  <parallel>N</parallel>
  <draw>Y</draw>
  <nr>0</nr>
  <xloc>300</xloc>
  <yloc>96</yloc>
  <attributes_kjc/>
</entry>
```

## 2. Config Fields

| Field XML | Bắt buộc | Giá trị / Cách điền |
|-----------|----------|---------------------|
| `<name>` | Y | **Phải trùng filename stem** của `.ktr` được gọi |
| `<type>` | Y | Cố định `TRANS` |
| `<specification_method>` | Y | `filename` |
| `<filename>` | Y | `${Internal.Entry.Current.Directory}/<stem>.ktr` |
| `<wait_until_finished>` | Y | `Y` |
| `<run_configuration>` | Y | `Pentaho local` |
| `<pass_all_parameters>` | Y | `Y` (truyền toàn bộ param từ job xuống trans) |
| `<trans_object_id>` | N | Bỏ trống (không dùng repository) |
| `<loglevel>` | N | `Basic` |

## 3. YAML → XML Mapping

| YAML | XML | Ghi chú |
|------|-----|---------|
| `type: TRANSFORMATION` | `<type>TRANS</type>` | YAML dùng `TRANSFORMATION`, XML dùng `TRANS` |
| `name` / `artifact_name` | `<name>` | Phải = filename stem |
| `config.filename` | `<filename>` | Prefix `${Internal.Entry.Current.Directory}/` |
| `config.wait_until_finished: true` | `<wait_until_finished>Y` | |
| `config.pass_parameters: true` | `<pass_all_parameters>Y` | |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`engine/src/main/java/org/pentaho/di/job/entries/trans/JobEntryTrans.java :: getXML()`.

`getXML()` = `super.getXML()` + đúng thứ tự: `specification_method`
(enum code), `trans_object_id`, `filename`, `transname`, `directory`
(chỉ ghi khi dùng repository — `filename` method thì bỏ),
`arg_from_previous`, `params_from_previous`, `exec_per_row`,
`clear_rows`, `clear_files`, `set_logfile`, `logfile`, `logext`,
`add_date`, `add_time`, `loglevel` (code), `cluster`,
`slave_server_name`, `set_append_logfile`, `wait_until_finished`,
`follow_abort_remote`, `create_parent_folder`, `logging_remote_work`,
`run_configuration`, `suppress_result_data`, rồi `argument0…`
(nếu có), khối `<parameters>` (`pass_all_parameters` + item
`<parameter>`: `name`, `stream_name`, `value`).

Nguồn ví dụ: `etl_pentaho/tckt/etl-casa-sync-test/etl_job_ods_tckt_casa_bal_daily_logic.kjb:323-361`.

## 5. Lưu ý / bẫy

- **Entry name PHẢI = filename stem** — sai → hop reference lệch, Spoon hiển thị sai.
- Quên `pass_all_parameters=Y` → trans không nhận `${INPUT_DATE}` → SQL chạy sai.
- `wait_until_finished=N` → job không đợi, downstream có thể chạy trước khi trans xong.
- Khi `pass_all_parameters = N`, liệt kê từng param:

```xml
<parameters>
  <pass_all_parameters>N</pass_all_parameters>
  <parameter>
    <name>PRD_ID</name>
    <stream_name/>
    <value>${PRD_ID}</value>
  </parameter>
</parameters>
```

## Production Example

Trích từ file production: `etl_job_engine_tckt_ftp_tt2_daily.kjb`

```xml
<entry>
  <name>Lấy dữ liệu cho bảng APPS.REF_FTP_OMO_RATE</name>
  <description/>
  <type>TRANS</type>
  <attributes/>
  <specification_method>rep_name</specification_method>
  <trans_object_id/>
  <filename/>
  <transname>etl_trans_tkct_REF_FTP_OMO_RATE</transname>
  <directory>/engine_tckt/batch/trans</directory>
  <arg_from_previous>N</arg_from_previous>
  <params_from_previous>N</params_from_previous>
  <exec_per_row>N</exec_per_row>
  <clear_rows>N</clear_rows>
  <clear_files>N</clear_files>
  <set_logfile>N</set_logfile>
  <logfile/>
  <logext/>
  <add_date>N</add_date>
  <add_time>N</add_time>
  <loglevel>Basic</loglevel>
  <cluster>N</cluster>
  <slave_server_name/>
  <set_append_logfile>N</set_append_logfile>
  <wait_until_finished>Y</wait_until_finished>
  <follow_abort_remote>N</follow_abort_remote>
  <create_parent_folder>N</create_parent_folder>
  <logging_remote_work>N</logging_remote_work>
  <run_configuration>Pentaho local</run_configuration>
  <suppress_result_data>N</suppress_result_data>
  <parameters>
    <pass_all_parameters>Y</pass_all_parameters>
  </parameters>
  <parallel>N</parallel>
  <draw>Y</draw>
  <nr>0</nr>
  <xloc>1328</xloc>
  <yloc>160</yloc>
  <attributes_kjc/>
</entry>
```
