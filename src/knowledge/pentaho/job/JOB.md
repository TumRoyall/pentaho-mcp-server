# JOB — Entry gọi Sub-Job

## 1. XML Template

```xml
<entry>
  <name>etl_job_logic</name>
  <description/>
  <type>JOB</type>
  <attributes/>
  <specification_method>filename</specification_method>
  <job_object_id/>
  <filename>${Internal.Entry.Current.Directory}/etl_job_logic.kjb</filename>
  <jobname/>
  <directory/>
  <arg_from_previous>N</arg_from_previous>
  <params_from_previous>N</params_from_previous>
  <exec_per_row>N</exec_per_row>
  <set_logfile>N</set_logfile>
  <logfile/>
  <logext/>
  <add_date>N</add_date>
  <add_time>N</add_time>
  <loglevel>Nothing</loglevel>
  <slave_server_name/>
  <wait_until_finished>Y</wait_until_finished>
  <follow_abort_remote>N</follow_abort_remote>
  <expand_remote_job>N</expand_remote_job>
  <create_parent_folder>N</create_parent_folder>
  <pass_export>N</pass_export>
  <run_configuration>Pentaho local</run_configuration>
  <parameters>
    <pass_all_parameters>Y</pass_all_parameters>
  </parameters>
  <set_append_logfile>N</set_append_logfile>
  <parallel>N</parallel>
  <draw>Y</draw>
  <nr>0</nr>
  <xloc>500</xloc>
  <yloc>96</yloc>
  <attributes_kjc/>
</entry>
```

## 2. Config Fields

| Field XML | Bắt buộc | Giá trị / Cách điền |
|-----------|----------|---------------------|
| `<name>` | Y | **Phải trùng filename stem** của `.kjb` con |
| `<type>` | Y | `JOB` |
| `<specification_method>` | Y | `filename` |
| `<filename>` | Y | `${Internal.Entry.Current.Directory}/<stem>.kjb` |
| `<wait_until_finished>` | Y | `Y` |
| `<run_configuration>` | Y | `Pentaho local` |
| `<pass_all_parameters>` | Y | `Y` |
| `<loglevel>` | N | `Nothing` |

## 3. YAML → XML Mapping

| YAML | XML | Ghi chú |
|------|-----|---------|
| `type: JOB` | `<type>JOB</type>` | |
| `name` / `artifact_name` | `<name>` | = filename stem |
| `config.filename` | `<filename>` | |
| `config.pass_parameters: true` | `<pass_all_parameters>Y` | |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`engine/src/main/java/org/pentaho/di/job/entries/job/JobEntryJob.java :: getXML()`.

`getXML()` = `super.getXML()` + đúng thứ tự: `specification_method`,
`job_object_id`, `filename`, `jobname`, `directory`,
`arg_from_previous`, `params_from_previous`, `exec_per_row`,
`set_logfile`, `logfile`, `logext`, `add_date`, `add_time`, `loglevel`
(code), `slave_server_name`, `wait_until_finished`,
`follow_abort_remote`, `expand_remote_job`, `create_parent_folder`,
`pass_export`, `run_configuration`, rồi `argument0…` (nếu có), khối
`<parameters>` (`pass_all_parameters` + item `<parameter>`), rồi
`set_append_logfile` CUỐI (khác TRANS — TRANS không có node này).

Nguồn ví dụ: `knowledge/pentaho/templates/base-project/etl_job_template.kjb:600-641`.

## 5. Lưu ý / bẫy

- Entry name = filename stem — tuyệt đối không dùng alias.
- File `.kjb` con phải tồn tại trong project output.
- `parallel=Y` là quyết định scheduling — không tự suy từ tên entry.

## Production Example

Trích từ file production: `etl_job_hachtoan_ftp_dieuchinh_all.kjb`

```xml
<entry>
  <name>job_ftp_hachtoan_dieuchinh_loop</name>
  <description/>
  <type>JOB</type>
  <attributes/>
  <specification_method>rep_name</specification_method>
  <job_object_id/>
  <filename/>
  <jobname>job_ftp_hachtoan_dieuchinh_loop</jobname>
  <directory>/engine_tckt/batch/job</directory>
  <arg_from_previous>N</arg_from_previous>
  <params_from_previous>N</params_from_previous>
  <exec_per_row>N</exec_per_row>
  <set_logfile>N</set_logfile>
  <logfile/>
  <logext/>
  <add_date>N</add_date>
  <add_time>N</add_time>
  <loglevel>Nothing</loglevel>
  <slave_server_name/>
  <wait_until_finished>Y</wait_until_finished>
  <follow_abort_remote>N</follow_abort_remote>
  <expand_remote_job>N</expand_remote_job>
  <create_parent_folder>N</create_parent_folder>
  <pass_export>N</pass_export>
  <run_configuration>Pentaho local</run_configuration>
  <parameters>
    <pass_all_parameters>Y</pass_all_parameters>
    <parameter>
      <name>API_SERVER</name>
      <stream_name/>
      <value>${API_SERVER}</value>
    </parameter>
    <parameter>
      <name>SERVICE_ID</name>
      <stream_name/>
      <value>${SERVICE_ID}</value>
    </parameter>
    <parameter>
      <name>CONTENT</name>
      <stream_name/>
      <value>${CONTENT}</value>
    </parameter>
    <parameter>
      <name>PRD_ID</name>
      <stream_name/>
      <value>${PRD_ID}</value>
    </parameter>
  </parameters>
  <set_append_logfile>N</set_append_logfile>
  <parallel>N</parallel>
  <draw>Y</draw>
  <nr>0</nr>
  <xloc>752</xloc>
  <yloc>240</yloc>
  <attributes_kjc/>
</entry>
```
