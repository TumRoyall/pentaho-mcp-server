# EVAL_TABLE_CONTENT — Entry đánh giá nội dung bảng

## 1. XML Template

```xml
<entry>
  <name>CHECK JOB RUNNING</name>
  <description/>
  <type>EVAL_TABLE_CONTENT</type>
  <attributes/>
  <connection>conn_oracle_test</connection>
  <schemaname/>
  <tablename>ETL_JOB_RUNNING</tablename>
  <success_condition>rows_count_equal</success_condition>
  <limit>0</limit>
  <is_custom_sql>Y</is_custom_sql>
  <is_usevars>Y</is_usevars>
  <custom_sql>SELECT * FROM ${SCHEMA_LOG}.ETL_JOB_RUNNING WHERE UNIKEY_ID = '${UNIKEY_ID}'</custom_sql>
  <add_rows_result>N</add_rows_result>
  <clear_result_rows>Y</clear_result_rows>
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
| `<connection>` | Y | Tên connection |
| `<success_condition>` | Y | Mã điều kiện thành công — xem bảng mã dưới |
| `<limit>` | Y | Giá trị so sánh (vd: `0` = không có dòng nào); default `"0"` |
| `<is_custom_sql>` | Y | `Y` — đánh giá theo SQL tùy biến; `N` = đếm dòng theo `<schemaname>.<tablename>` |
| `<is_usevars>` | Y | `Y` — cho phép `${VAR}` trong SQL |
| `<custom_sql>` | Y* | Câu SELECT khi `is_custom_sql=Y`; dùng `${SCHEMA_LOG}` |
| `<schemaname>` | N | Chỉ dùng khi `is_custom_sql=N` |
| `<tablename>` | N | Chỉ dùng khi `is_custom_sql=N` |
| `<add_rows_result>` | N | `Y` = đưa dòng đọc được vào result rows; default `N` |
| `<clear_result_rows>` | N | `Y` = xoá result rows trước khi chạy; default `Y` |

Mã `success_condition` (`successConditionsCode` trong source, ghi nguyên chuỗi):

| Giá trị | Ý nghĩa |
|---------|---------|
| `rows_count_equal` | Số dòng = limit |
| `rows_count_different` | Số dòng ≠ limit |
| `rows_count_smaller` | Số dòng < limit |
| `rows_count_smaller_equal` | Số dòng ≤ limit |
| `rows_count_greater` | Số dòng > limit |
| `rows_count_greater_equal` | Số dòng ≥ limit |

## 3. YAML → XML Mapping

| YAML | XML | Ghi chú |
|------|-----|---------|
| `type: SQL` + có `result_handling` | `<type>EVAL_TABLE_CONTENT</type>` | Có `result_handling` → EVAL |
| `config.sql` | `<custom_sql>` | Kèm `is_custom_sql=Y`, `is_usevars=Y` |
| `config.connection` | `<connection>` | |
| `result_handling.condition: "zero_rows"` | `rows_count_equal` + `<limit>0</limit>` | |
| `result_handling.condition: "rows_found"` | `rows_count_greater` + `<limit>0</limit>` | |
| `result_handling.add_rows: true` | `<add_rows_result>Y` | Mặc định `N` |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`engine/src/main/java/org/pentaho/di/job/entries/evaluatetablecontent/JobEntryEvalTableContent.java :: getXML()`
+ mô tả thứ tự node.

`getXML()` = `super.getXML()` + đúng thứ tự: `connection`, `schemaname`,
`tablename`, `success_condition` (mã chuỗi từ `getSuccessConditionCode()`),
`limit`, `is_custom_sql` (**Y/N**), `is_usevars` (**Y/N**), `custom_sql`,
`add_rows_result` (**Y/N**), `clear_result_rows` (**Y/N**). `loadXML()` đọc
lại đúng 10 node này (`"Y".equalsIgnoreCase(...)` cho 4 boolean). Default
constructor: `limit="0"`, condition = `ROWS_COUNT_GREATER`,
`clearResultList=true`.

Nguồn ví dụ: `knowledge/pentaho/templates/base-project/etl_job_template.kjb:426-450` (CHECK JOB RUNNING)
và `:658` (check run — retry guard).

## 5. Lưu ý / bẫy

- Không nhầm với `SQL` entry — EVAL đánh giá kết quả, SQL thực thi không trả về.
- Boolean entry này dùng **`Y`/`N`** (overload `addTagValue(String, boolean)`),
  khác SQL entry dùng `T`/`F` — không lẫn lộn.
- Template chỉ xác minh `rows_count_equal`; condition khác `(cần verify)` khi dùng lần đầu.
- Khung entry (`parallel`, `draw`, `nr`, `xloc`, `yloc`, `attributes_kjc`) do
  `JobEntryCopy.getXML()` bao ngoài — giữ nguyên theo mẫu.

## Production Example

Trích từ file production: `etl_job_engine_tckt_ftp_tt2_daily.kjb`

```xml
<entry>
  <name>CHECK JOB RUNNING</name>
  <description/>
  <type>EVAL_TABLE_CONTENT</type>
  <attributes/>
  <connection>tckt_dc</connection>
  <schemaname/>
  <tablename>ETL_JOB_RUNNING</tablename>
  <success_condition>rows_count_equal</success_condition>
  <limit>0</limit>
  <is_custom_sql>Y</is_custom_sql>
  <is_usevars>Y</is_usevars>
  <custom_sql>SELECT *
FROM ETL.ETL_JOB_RUNNING
WHERE UNIKEY_ID = '${UNIKEY_ID}'
</custom_sql>
  <add_rows_result>N</add_rows_result>
  <clear_result_rows>Y</clear_result_rows>
  <parallel>N</parallel>
  <draw>Y</draw>
  <nr>0</nr>
  <xloc>240</xloc>
  <yloc>160</yloc>
  <attributes_kjc/>
</entry>
```
