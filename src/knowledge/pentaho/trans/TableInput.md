# TableInput — Step đọc dữ liệu từ bảng

## 1. XML Template

```xml
<step>
  <name>READ_SOURCE_TABLE</name>
  <type>TableInput</type>
  <description/>
  <distribute>Y</distribute>
  <custom_distribution/>
  <copies>1</copies>
  <partitioning>
    <method>none</method>
    <schema_name/>
  </partitioning>
  <connection>CONN_ODS</connection>
  <sql>SELECT col1, col2, col3
FROM SCHEMA.TABLE_NAME
WHERE TXN_DATE = TO_DATE('${PRD_ID}','YYYYMMDD')</sql>
  <limit>0</limit>
  <lookup/>
  <execute_each_row>N</execute_each_row>
  <variables_active>Y</variables_active>
  <lazy_conversion_active>N</lazy_conversion_active>
  <cached_row_meta_active>N</cached_row_meta_active>
  <row-meta/>
  <attributes/>
  <cluster_schema/>
  <remotesteps>
    <input/>
    <output/>
  </remotesteps>
  <GUI>
    <xloc>100</xloc>
    <yloc>100</yloc>
    <draw>Y</draw>
  </GUI>
</step>
```

## 2. Config Fields

| Field XML | Bắt buộc | Giá trị / Cách điền |
|-----------|----------|---------------------|
| `<connection>` | Y | Tên connection (phải khớp shared.xml) |
| `<sql>` | Y | SQL query — **giữ NGUYÊN VĂN** từ design YAML |
| `<limit>` | N | Giới hạn dòng; `0` = không giới hạn (default từ `setDefault()`) |
| `<lookup>` | N | Tên step cấp input qua info hop; để trống nếu không dùng |
| `<execute_each_row>` | N | `N` mặc định (chạy 1 lần); `Y` = chạy mỗi dòng input |
| `<variables_active>` | Y | `Y` nếu SQL có `${VAR}` |
| `<lazy_conversion_active>` | N | `N` mặc định |
| `<cached_row_meta_active>` | N | `N` mặc định |
| `<row-meta/>` | N | Để trống — Spoon tự detect |

## 3. YAML → XML Mapping

| YAML | XML | Ghi chú |
|------|-----|---------|
| `type: TABLE_INPUT` | `<type>TableInput</type>` | |
| `configuration.connection` | `<connection>` | |
| `configuration.query_contract` | `<sql>` | **XML escape**: `<` → `&lt;`, `>` → `&gt;`, `&` → `&amp;` |
| SQL có `${...}` | `<variables_active>Y</variables_active>` | |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`engine/src/main/java/org/pentaho/di/trans/steps/tableinput/TableInputMeta.java :: getXML()`.

`getXML()` ghi theo đúng thứ tự: `<connection>`, `<sql>`, `<limit>`,
`<lookup>` (tên step của info hop), `<execute_each_row>`,
`<variables_active>`, `<lazy_conversion_active>`,
`<cached_row_meta_active>`, rồi cached row-meta (`<row-meta>`).
`loadXML()` đọc lại đúng các node này. `setDefault()` đặt
`sql="SELECT <values> FROM <table name> WHERE <conditions>"`,
`rowLimit="0"`; các flag boolean mặc định `N`.

Ví dụ production: `etl_pentaho/tckt/etl-casa-sync-test/etl_trans_ods_tckt_casa_bal.ktr:444-...`

## 5. Lưu ý / bẫy — CRITICAL

- **XML escape BẮT BUỘC**: `WHERE x < y` phải viết `WHERE x &lt; y` — quên → XML hỏng.
- `row-meta` để trống — sinh tay dễ sai type.
- `cached_row_meta_active=N` — luôn N cho generated files.
- `<lookup>` là tham chiếu step nối bằng info hop — generator nối bằng
  `set_field` + `edit_hops`, không hardcode tên step trong template.

## Production Example

Trích từ file production: `etl_tran_ftp_dieuchinh_get_auth_token.ktr`

```xml
<step>
  <name>Table input</name>
  <type>TableInput</type>
  <description/>
  <distribute>Y</distribute>
  <custom_distribution/>
  <copies>1</copies>
  <partitioning>
    <method>none</method>
    <schema_name/>
  </partitioning>
  <connection>tckt_dc</connection>
  <sql>SELECT 
    SYSDATE CREATED_DATE,
    SYSDATE + 3/24 EXPIRED_DATE 
FROM DUAL</sql>
  <limit>0</limit>
  <lookup/>
  <execute_each_row>N</execute_each_row>
  <variables_active>N</variables_active>
  <lazy_conversion_active>N</lazy_conversion_active>
  <cached_row_meta_active>N</cached_row_meta_active>
  <row-meta>
    <value-meta>
      <type>Date</type>
      <storagetype>normal</storagetype>
      <name>CREATED_DATE</name>
      <length>0</length>
      <precision>-1</precision>
      <origin>Table input</origin>
      <comments>CREATED_DATE</comments>
      <conversion_Mask/>
      <decimal_symbol>.</decimal_symbol>
      <grouping_symbol>,</grouping_symbol>
      <currency_symbol/>
      <trim_type>none</trim_type>
      <case_insensitive>N</case_insensitive>
      <collator_disabled>Y</collator_disabled>
      <collator_strength>0</collator_strength>
      <sort_descending>N</sort_descending>
      <output_padding>N</output_padding>
      <date_format_lenient>N</date_format_lenient>
      <date_format_locale>en_US</date_format_locale>
      <date_format_timezone>Asia/Bangkok</date_format_timezone>
      <lenient_string_to_number>N</lenient_string_to_number>
    </value-meta>
    <value-meta>
      <type>Date</type>
      <storagetype>normal</storagetype>
      <name>EXPIRED_DATE</name>
      <length>0</length>
      <precision>-1</precision>
      <origin>Table input</origin>
      <comments>EXPIRED_DATE</comments>
      <conversion_Mask/>
      <decimal_symbol>.</decimal_symbol>
      <grouping_symbol>,</grouping_symbol>
      <currency_symbol/>
      <trim_type>none</trim_type>
      <case_insensitive>N</case_insensitive>
      <collator_disabled>Y</collator_disabled>
      <collator_strength>0</collator_strength>
      <sort_descending>N</sort_descending>
      <output_padding>N</output_padding>
      <date_format_lenient>N</date_format_lenient>
      <date_format_locale>en_US</date_format_locale>
      <date_format_timezone>Asia/Bangkok</date_format_timezone>
      <lenient_string_to_number>N</lenient_string_to_number>
    </value-meta>
  </row-meta>
  <attributes/>
  <cluster_schema/>
  <remotesteps>
    <input>
      </input>
    <output>
      </output>
  </remotesteps>
  <GUI>
    <xloc>464</xloc>
    <yloc>352</yloc>
    <draw>Y</draw>
  </GUI>
</step>
```
