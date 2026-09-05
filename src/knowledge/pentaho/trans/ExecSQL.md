# ExecSQL

Transformation step thực thi câu SQL (DDL, DML hoặc procedure) trên một database connection, tùy chọn một lần hoặc mỗi dòng input.

> Khác với job entry SQL: step ExecSQL nằm trong transformation, nhận stream input và có thể bind tham số từ field.

## 1. XML Template

```xml
<step>
  <name>{{STEP_NAME}}</name>
  <type>ExecSQL</type>
  <description/>
  <distribute>Y</distribute>
  <custom_distribution/>
  <copies>1</copies>
  <partitioning>
    <method>none</method>
    <schema_name/>
  </partitioning>
  <connection>{{CONNECTION_NAME}}</connection>
  <execute_each_row>{{EXECUTE_EACH_ROW}}</execute_each_row>
  <single_statement>{{SINGLE_STATEMENT}}</single_statement>
  <replace_variables>{{REPLACE_VARIABLES}}</replace_variables>
  <quoteString>{{QUOTE_STRING}}</quoteString>
  <sql>{{SQL_STATEMENT}}</sql>
  <set_params>{{SET_PARAMS}}</set_params>
  <insert_field>{{INSERT_FIELD}}</insert_field>
  <update_field>{{UPDATE_FIELD}}</update_field>
  <delete_field>{{DELETE_FIELD}}</delete_field>
  <read_field>{{READ_FIELD}}</read_field>
  <arguments>
    <argument>
      <name>{{PARAM_FIELD_NAME}}</name>
    </argument>
    <!-- repeat for each ? placeholder in SQL -->
  </arguments>
  <attributes/>
  <cluster_schema/>
  <remotesteps>
    <input/>
    <output/>
  </remotesteps>
  <GUI>
    <xloc>{{X}}</xloc>
    <yloc>{{Y}}</yloc>
    <draw>Y</draw>
  </GUI>
</step>
```

## 2. Config Fields

| Field XML | Bắt buộc | Ý nghĩa / cách điền |
|---|---|---|
| `connection` | Y | Tên connection từ shared.xml |
| `execute_each_row` | Y | `Y`/`N` — chạy SQL cho mỗi dòng input (hữu ích cho parameterized DML) |
| `single_statement` | Y | `Y`/`N` — coi toàn bộ sql là một statement duy nhất |
| `replace_variables` | Y | `Y`/`N` — thay thế biến `${VAR}` trong SQL |
| `quoteString` | Y | `Y`/`N` — đặt dấu nháy quanh tham số string |
| `sql` | Y | Câu SQL. Phải XML-escape. Dùng `?` cho bind param |
| `set_params` | Y | `Y`/`N` — dùng prepared statement với tham số |
| `insert_field` | N | Tên field output chứa số dòng INSERT |
| `update_field` | N | Tên field output chứa số dòng UPDATE |
| `delete_field` | N | Tên field output chứa số dòng DELETE |
| `read_field` | N | Tên field output chứa số dòng READ |
| `arguments/argument/name` | N | Tên field input map vào `?` trong SQL (theo thứ tự) |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `connection` | `connection` | |
| `sql` | `sql` | Phải XML-escape |
| `execute_per_row` | `execute_each_row` | Y/N |
| `single_statement` | `single_statement` | Y/N |
| `variable_substitution` | `replace_variables` | Y/N |
| `bind_parameters` | `set_params` | Y/N |
| `parameters[]` | `arguments/argument/name` | Thứ tự map vào `?` |
| `output_insert_count` | `insert_field` | |
| `output_update_count` | `update_field` | |
| `output_delete_count` | `delete_field` | |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`engine/src/main/java/org/pentaho/di/trans/steps/sql/ExecSQLMeta.java :: getXML()`.

`getXML()` ghi theo đúng thứ tự: `<connection>`, `<execute_each_row>`,
`<single_statement>`, `<replace_variables>`, `<quoteString>` (chú ý chữ
`S` hoa), `<sql>`, `<set_params>`, `<insert_field>`, `<update_field>`,
`<delete_field>`, `<read_field>`, rồi khối `<arguments>` bao ngoài
danh sách `<argument>` (mỗi item chỉ có `<name>` — tên field input map
vào `?` theo thứ tự). `setDefault()` đặt `sql=""`, `arguments` rỗng.

```xml
<!-- Provenance: pattern phổ biến trong old_src/trans (nhiều trans dùng ExecSQL cho truncate hoặc DML) -->
<step>
  <name>Truncate target table</name>
  <type>ExecSQL</type>
  <connection>CONN_ENGINE_TCKT</connection>
  <execute_each_row>N</execute_each_row>
  <single_statement>Y</single_statement>
  <replace_variables>Y</replace_variables>
  <quoteString>N</quoteString>
  <sql>TRUNCATE TABLE ETL.TMP_FTP_DATA</sql>
  <set_params>N</set_params>
  <insert_field/>
  <update_field/>
  <delete_field/>
  <read_field/>
  <arguments>
  </arguments>
</step>
```

## 5. Lưu ý / bẫy

- **XML-escape SQL**: `<` → `&lt;`, `>` → `&gt;`, `&` → `&amp;` trong nội dung `<sql>`.
- **execute_each_row=Y + set_params=Y**: Khi muốn INSERT mỗi dòng bằng prepared statement. Mỗi `?` map tương ứng với `argument` theo thứ tự.
- **Khác TableOutput**: ExecSQL là câu SQL tùy ý (có thể DDL, MERGE, CALL). TableOutput chỉ cho INSERT/batch insert.
- **Không có error hop riêng**: Nếu SQL lỗi, step fail và trans dừng. Không có cơ chế skip dòng lỗi như TableOutput.
- **single_statement=N**: PDI sẽ tách theo `;` — cẩn thận nếu SQL chứa `;` bên trong string literal hoặc PL/SQL block.

## Production Example

Trích từ file production: `etl_trans_fin_smb_pnl_monthly.ktr`

```xml
<step>
  <name>delete dl cu</name>
  <type>ExecSQL</type>
  <description/>
  <distribute>Y</distribute>
  <custom_distribution/>
  <copies>1</copies>
  <partitioning>
    <method>none</method>
    <schema_name/>
  </partitioning>
  <connection>tckt_dc</connection>
  <execute_each_row>N</execute_each_row>
  <single_statement>N</single_statement>
  <replace_variables>Y</replace_variables>
  <quoteString>N</quoteString>
  <sql>delete from APPS.FIN_SMB_PNL_MONTHLY where transaction_date =to_date('${PRD_ID}','YYYYMMDD')</sql>
  <set_params>N</set_params>
  <insert_field/>
  <update_field/>
  <delete_field/>
  <read_field/>
  <arguments>
    </arguments>
  <attributes/>
  <cluster_schema/>
  <remotesteps>
    <input>
      </input>
    <output>
      </output>
  </remotesteps>
  <GUI>
    <xloc>329</xloc>
    <yloc>255</yloc>
    <draw>Y</draw>
  </GUI>
</step>
```
