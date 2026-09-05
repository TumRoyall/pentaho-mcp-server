# SQL — Entry thực thi SQL

## 1. XML Template

```xml
<entry>
  <name>INSERT JOB RUNNING</name>
  <description/>
  <type>SQL</type>
  <attributes/>
  <sql>INSERT INTO ${SCHEMA_LOG}.ETL_JOB_RUNNING (...) VALUES (...); COMMIT;</sql>
  <useVariableSubstitution>T</useVariableSubstitution>
  <sqlfromfile>F</sqlfromfile>
  <sqlfilename/>
  <sendOneStatement>F</sendOneStatement>
  <connection>conn_oracle_test</connection>
  <parallel>N</parallel>
  <draw>Y</draw>
  <nr>0</nr>
  <xloc>400</xloc>
  <yloc>96</yloc>
  <attributes_kjc/>
</entry>
```

## 2. Config Fields

| Field XML | Bắt buộc | Giá trị / Cách điền |
|-----------|----------|---------------------|
| `<sql>` | Y | Nội dung SQL nguyên văn từ design; `COMMIT;` cuối nếu cần |
| `<connection>` | Y | Tên connection — phải trùng `shared.xml` |
| `<useVariableSubstitution>` | Y | **`T`** nếu SQL có `${VAR}` (hầu như luôn), `F` nếu không |
| `<sqlfromfile>` | N | **`F`** — SQL inline; `T` = đọc SQL từ file `<sqlfilename>` |
| `<sqlfilename>` | N | Path file `.sql` khi `sqlfromfile=T`, để trống khi inline |
| `<sendOneStatement>` | N | **`F`** — cho phép nhiều statement phân cách bằng `;`; `T` = gửi 1 statement duy nhất |

## 3. YAML → XML Mapping

| YAML | XML | Ghi chú |
|------|-----|---------|
| `type: SQL` (không có `result_handling`) | `<type>SQL</type>` | |
| `config.connection` | `<connection>` | |
| `config.use_variable_substitution: true` | `<useVariableSubstitution>T` | **true→T, false→F** |
| `config.sql` | `<sql>` | Giữ nguyên văn |
| `config.sql_from_file: true` + `config.sql_filename` | `<sqlfromfile>T` + `<sqlfilename>` | Mặc định inline (`F`) |
| `config.send_one_statement: true` | `<sendOneStatement>T` | Mặc định `F` |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`engine/src/main/java/org/pentaho/di/job/entries/sql/JobEntrySQL.java :: getXML()`
+ mô tả thứ tự node.

`getXML()` = `super.getXML()` (`name`, `description`, `type`, `attributes`) +
đúng thứ tự: `sql`, `useVariableSubstitution` (**T/F**), `sqlfromfile`
(**T/F**), `sqlfilename`, `sendOneStatement` (**T/F**), `connection`
(tên connection, `null` nếu chưa chọn).

Nguồn ví dụ: `knowledge/pentaho/templates/base-project/etl_job_template.kjb:451-485`.
Template có 5 entry SQL tracking (INSERT RUNNING, INSERT LOGS, UPDATE SUCCESS, UPDATE FAIL, DELETE RUNNING).

## 5. Lưu ý / bẫy — CRITICAL

- **Boolean dùng `T`/`F`** (KHÔNG phải `Y`/`N`) cho mọi field boolean của SQL entry
  (`useVariableSubstitution`, `sqlfromfile`, `sendOneStatement`) — đối chiếu
  `getXML()` dùng toán tử `? "T" : "F"`, `loadXML()` so `equalsIgnoreCase("T")`.
- SQL tracking dùng `${SCHEMA_LOG}` — không hardcode schema.
- Credential không bao giờ nằm trong `<sql>`.
- `sendOneStatement=F` cho phép nhiều statement phân cách bằng `;`.
- Khung entry (`parallel`, `draw`, `nr`, `xloc`, `yloc`, `attributes_kjc`) do
  `JobEntryCopy.getXML()` bao ngoài — giữ nguyên theo mẫu.

## Production Example

Trích từ file production: `etl_job_engine_tckt_ftp_tt2_daily.kjb`

```xml
<entry>
  <name>DELETE BANG TAM F2B TCKT</name>
  <description/>
  <type>SQL</type>
  <attributes/>
  <sql>DELETE FROM ETL.F2B_FO_ALM_1;
DELETE FROM ETL.F2B_MO_EXPORT;
COMMIT;</sql>
  <useVariableSubstitution>F</useVariableSubstitution>
  <sqlfromfile>F</sqlfromfile>
  <sqlfilename/>
  <sendOneStatement>F</sendOneStatement>
  <connection>tckt_dc</connection>
  <parallel>N</parallel>
  <draw>Y</draw>
  <nr>0</nr>
  <xloc>912</xloc>
  <yloc>160</yloc>
  <attributes_kjc/>
</entry>
```
