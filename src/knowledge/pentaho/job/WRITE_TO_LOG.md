# WRITE_TO_LOG — Entry ghi log message

## 1. XML Template

```xml
<entry>
  <name>Write to parameter</name>
  <description/>
  <type>WRITE_TO_LOG</type>
  <attributes/>
  <logmessage>PARAMETER: ${PARAMETERS}</logmessage>
  <loglevel>Basic</loglevel>
  <logsubject/>
  <parallel>N</parallel>
  <draw>Y</draw>
  <nr>0</nr>
  <xloc>200</xloc>
  <yloc>200</yloc>
  <attributes_kjc/>
</entry>
```

## 2. Config Fields

| Field XML | Bắt buộc | Giá trị / Cách điền |
|-----------|----------|---------------------|
| `<logmessage>` | Y | Message — có thể chứa `${VAR}` |
| `<loglevel>` | Y | `Nothing`, `Error`, `Minimal`, `Basic`, `Detailed`, `Debug`, `Rowlevel` |
| `<logsubject>` | N | Subject line (để trống nếu không cần) |

## 3. YAML → XML Mapping

| YAML | XML | Ghi chú |
|------|-----|---------|
| `type: WRITE_TO_LOG` | `<type>WRITE_TO_LOG</type>` | |
| `config.message` | `<logmessage>` | |
| `config.level` | `<loglevel>` | |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`engine/src/main/java/org/pentaho/di/job/entries/writetolog/JobEntryWriteToLog.java :: getXML()`.

`getXML()` = `super.getXML()` + đúng thứ tự 3 node: `logmessage`,
`loglevel` (`LogLevel.getCode()`), `logsubject`.

Nguồn ví dụ: `knowledge/pentaho/templates/base-project/etl_job_template.kjb` (Write to parameter entry).

## 5. Lưu ý / bẫy

- Không log credential/secret qua variable expansion.
- Logging không thay thế error hop — vẫn cần terminal failure path.

## Production Example

Trích từ file production: `job_acg_line_txn_daily_backdate_loop.kjb`

```xml
<entry>
  <name>Write to log</name>
  <description/>
  <type>WRITE_TO_LOG</type>
  <attributes/>
  <logmessage>--- LOG IN JOB_ACG_LINE_TXN_DAILY_BACKDATE_LOOP ---
PRD_ID_BACKDATE: ${PRD_ID_BACKDATE}
MAX_CALENDAR_DATE: ${MAX_CALENDAR_DATE}</logmessage>
  <loglevel>Basic</loglevel>
  <logsubject/>
  <parallel>N</parallel>
  <draw>Y</draw>
  <nr>0</nr>
  <xloc>800</xloc>
  <yloc>240</yloc>
  <attributes_kjc/>
</entry>
```
