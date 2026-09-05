# TableOutput — Step ghi dữ liệu ra bảng

## 1. XML Template

```xml
<step>
  <name>WRITE_ETL_TARGET_TABLE</name>
  <type>TableOutput</type>
  <description/>
  <distribute>Y</distribute>
  <custom_distribution/>
  <copies>1</copies>
  <partitioning>
    <method>none</method>
    <schema_name/>
  </partitioning>
  <connection>CONN_ENGINE</connection>
  <schema>ETL</schema>
  <table>TARGET_TABLE</table>
  <commit>${ETL_COMMIT_SIZE}</commit>
  <truncate>Y</truncate>
  <ignore_errors>N</ignore_errors>
  <use_batch>Y</use_batch>
  <specify_fields>Y</specify_fields>
  <partitioning_enabled>N</partitioning_enabled>
  <partitioning_field/>
  <partitioning_daily>N</partitioning_daily>
  <partitioning_monthly>Y</partitioning_monthly>
  <tablename_in_field>N</tablename_in_field>
  <tablename_field/>
  <tablename_in_table>Y</tablename_in_table>
  <return_keys>N</return_keys>
  <return_field/>
  <fields>
    <field>
      <column_name>COL1</column_name>
      <stream_name>COL1</stream_name>
    </field>
    <field>
      <column_name>COL2</column_name>
      <stream_name>COL2</stream_name>
    </field>
  </fields>
  <attributes/>
  <cluster_schema/>
  <remotesteps>
    <input/>
    <output/>
  </remotesteps>
  <GUI>
    <xloc>400</xloc>
    <yloc>100</yloc>
    <draw>Y</draw>
  </GUI>
</step>
```

## 2. Config Fields

| Field XML | Bắt buộc | Giá trị / Cách điền |
|-----------|----------|---------------------|
| `<connection>` | Y | Tên connection (shared.xml) |
| `<schema>` | Y | Schema bảng đích (tách từ `SCHEMA.TABLE`) |
| `<table>` | Y | Tên bảng đích |
| `<commit>` | N | Commit size; default `1000` từ `setDefault()`; có thể dùng `${ETL_COMMIT_SIZE}` |
| `<truncate>` | Y | `Y` = truncate trước ghi, `N` = append |
| `<ignore_errors>` | N | `N` mặc định |
| `<use_batch>` | N | `Y` |
| `<specify_fields>` | Y | `Y` — khai báo mapping tường minh (default source là `N`) |
| `<fields>/<field>` | Y | Mỗi field: `<column_name>` (cột bảng) + `<stream_name>` (field stream) |

## 3. YAML → XML Mapping

| YAML | XML | Ghi chú |
|------|-----|---------|
| `type: TABLE_OUTPUT` | `<type>TableOutput</type>` | |
| `configuration.connection` | `<connection>` | |
| `configuration.target_object: "ETL.TABLE"` | `<schema>ETL</schema>` + `<table>TABLE</table>` | Tách theo dấu `.` |
| `configuration.truncate_table: true` | `<truncate>Y</truncate>` | |
| `configuration.commit_size` | `<commit>` | |
| `configuration.field_mapping[].stream_field` | `<stream_name>` | |
| `configuration.field_mapping[].target_field` | `<column_name>` | |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`engine/src/main/java/org/pentaho/di/trans/steps/tableoutput/TableOutputMeta.java :: getXML()`.

`getXML()` ghi theo đúng thứ tự: `<connection>`, `<schema>`, `<table>`,
`<commit>`, `<truncate>`, `<ignore_errors>`, `<use_batch>`,
`<specify_fields>`, `<partitioning_enabled>`, `<partitioning_field>`,
`<partitioning_daily>`, `<partitioning_monthly>`, `<tablename_in_field>`,
`<tablename_field>`, `<tablename_in_table>`, `<return_keys>`,
`<return_field>`, rồi khối `<fields>` bao ngoài danh sách `<field>`
(mỗi item: `<column_name>` + `<stream_name>`). Đây là dạng list **có tag
bao** → generator fill bằng `set_fields` (`listTag=fields`,
`itemTag=field`).

Ví dụ production: `etl_pentaho/tckt/etl-casa-sync-test/etl_trans_ods_tckt_casa_bal.ktr:770-861`

## 5. Lưu ý / bẫy — CRITICAL

- `specify_fields=Y` mà `<fields>` thiếu cột → dữ liệu MẤT (không lỗi, chỉ không ghi).
- `truncate=Y` → mất dữ liệu cũ — dev phải chốt ở design.
- Field count XML PHẢI = field count YAML.
- Cột nguồn không khớp cột đích → **DỪNG** báo dev, không tự đổi tên.

## Production Example

Trích từ file production: `etl_tran_ftp_dieuchinh_get_auth_token.ktr`

```xml
<step>
  <name>Table output</name>
  <type>TableOutput</type>
  <description/>
  <distribute>Y</distribute>
  <custom_distribution/>
  <copies>1</copies>
  <partitioning>
    <method>none</method>
    <schema_name/>
  </partitioning>
  <connection>tckt_dc</connection>
  <schema>ETL</schema>
  <table>etl_put_notify_token</table>
  <commit>1000</commit>
  <truncate>N</truncate>
  <ignore_errors>N</ignore_errors>
  <use_batch>Y</use_batch>
  <specify_fields>Y</specify_fields>
  <partitioning_enabled>N</partitioning_enabled>
  <partitioning_field/>
  <partitioning_daily>N</partitioning_daily>
  <partitioning_monthly>Y</partitioning_monthly>
  <tablename_in_field>N</tablename_in_field>
  <tablename_field/>
  <tablename_in_table>Y</tablename_in_table>
  <return_keys>N</return_keys>
  <return_field/>
  <fields>
    <field>
      <column_name>ACCESS_TOKEN</column_name>
      <stream_name>ACCESS_TOKEN</stream_name>
    </field>
    <field>
      <column_name>CREATED_DATE</column_name>
      <stream_name>CREATED_DATE</stream_name>
    </field>
    <field>
      <column_name>EXPIRED_DATE</column_name>
      <stream_name>EXPIRED_DATE</stream_name>
    </field>
  </fields>
  <attributes/>
  <cluster_schema/>
  <remotesteps>
    <input>
      </input>
    <output>
      </output>
  </remotesteps>
  <GUI>
    <xloc>848</xloc>
    <yloc>352</yloc>
    <draw>Y</draw>
  </GUI>
</step>
```
