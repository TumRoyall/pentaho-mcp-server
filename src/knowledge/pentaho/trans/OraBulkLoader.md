# OraBulkLoader — Step nạp dữ liệu vào Oracle bằng SQL*Loader

Ghi stream ra control/data file rồi gọi `sqlldr` để bulk load vào bảng Oracle.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>OraBulkLoader</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <connection>{{DB_CONNECTION}}</connection>
    <commit>100000</commit>
    <bind_size>0</bind_size>
    <read_size>0</read_size>
    <errors>50</errors>
    <schema>{{SCHEMA}}</schema>
    <table>{{TABLE}}</table>
    <load_method>AUTO_END</load_method>
    <load_action>APPEND</load_action>
    <sqlldr>sqlldr</sqlldr>
    <control_file>control${Internal.Step.CopyNr}.cfg</control_file>
    <data_file>load${Internal.Step.CopyNr}.dat</data_file>
    <log_file/>
    <bad_file/>
    <discard_file/>
    <direct_path>N</direct_path>
    <erase_files>Y</erase_files>
    <encoding/>
    <dbname_override/>
    <character_set/>
    <fail_on_warning>N</fail_on_warning>
    <fail_on_error>N</fail_on_error>
    <parallel>N</parallel>
    <alt_rec_term/>
    <mapping>
      <stream_name>{{TABLE_COLUMN}}</stream_name>
      <field_name>{{STREAM_FIELD}}</field_name>
      <date_mask/>
    </mapping>
    <attributes/>
    <cluster_schema/>
    <remotesteps>
      <input>
      </input>
      <output>
      </output>
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
| `<connection>` | Y | Tên DB connection Oracle. THAM CHIẾU. |
| `<commit>` | N | Commit size. `setDefault`=`100000`. |
| `<bind_size>` `<read_size>` | N | `setDefault`=`0` (dùng mặc định nền tảng). |
| `<errors>` | N | Số lỗi tối đa. `setDefault`=`50`. |
| `<schema>` `<table>` | Y | Schema/bảng đích. |
| `<load_method>` | N | `AUTO_END` / `AUTO_CONCURRENT` / `MANUAL`. `setDefault`=`AUTO_END`. |
| `<load_action>` | N | `APPEND` / `INSERT` / `REPLACE` / `TRUNCATE`. `setDefault`=`APPEND`. |
| `<sqlldr>` | N | Đường dẫn tới `sqlldr`. `setDefault`=`sqlldr`. |
| `<control_file>` `<data_file>` | N | File control/data tạm; mặc định theo CopyNr. |
| `<log_file>` `<bad_file>` `<discard_file>` | N | File log/bad/discard của sqlldr. |
| `<direct_path>` | N | `Y`=direct path load. |
| `<erase_files>` | N | Xoá file tạm sau khi load. `setDefault`=`Y`. |
| `<encoding>` `<character_set>` | N | Encoding / character set Oracle. |
| `<fail_on_warning>` `<fail_on_error>` | N | Ứng xử khi sqlldr cảnh báo/lỗi. |
| `<parallel>` | N | Load song song. |
| `<mapping>` | Y | Ánh xạ cột bảng ↔ field stream (node anh em, KHÔNG có tag bao). |

### Node con của mỗi `<mapping>`
`stream_name` (tên CỘT trong bảng Oracle), `field_name` (tên FIELD trong stream), `date_mask` (mask ngày nếu cần).

## 3. YAML→XML Mapping

| YAML | XML | Ghi chú |
|---|---|---|
| `type: ORA_BULK_LOADER` | `<type>` | `OraBulkLoader`. |
| `configuration.connection` | `<connection>` | Tham chiếu DB. |
| `configuration.schema` | `<schema>` | |
| `configuration.table` | `<table>` | |
| `configuration.load_action` | `<load_action>` | APPEND/INSERT/REPLACE/TRUNCATE. |
| `configuration.load_method` | `<load_method>` | AUTO_END/AUTO_CONCURRENT/MANUAL. |
| `configuration.mappings[].column` | `<mapping>/<stream_name>` | Cột bảng. |
| `configuration.mappings[].field` | `<mapping>/<field_name>` | Field stream. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `plugins/oracle-bulk-loader/impl/src/main/java/org/pentaho/di/trans/steps/orabulkloader/OraBulkLoaderMeta.java :: getXML()`.

- Thân step ghi lần lượt: `connection`, `commit`, `bind_size`, `read_size`, `errors`, `schema`, `table`, `load_method`, `load_action`, `sqlldr`, `control_file`, `data_file`, `log_file`, `bad_file`, `discard_file`, `direct_path`, `erase_files`, `encoding`, `dbname_override`, `character_set`, `fail_on_warning`, `fail_on_error`, `parallel`, `alt_rec_term`.
- Sau đó lặp mảng `fieldTable[]` ghi từng `<mapping>` (`stream_name`, `field_name`, `date_mask`) — KHÔNG có tag list bao.
- Hằng: `METHOD_AUTO_END="AUTO_END"`, `ACTION_APPEND="APPEND"`; defaults commit=100000, errors=50, bind/read=0.

## 5. Lưu ý / bẫy

- Cần Oracle client + `sqlldr` trên máy chạy; đây là bulk loader phụ thuộc môi trường.
- `stream_name` trong `<mapping>` là tên CỘT BẢNG; `field_name` là FIELD STREAM — dễ nhầm thứ tự (tên node ngược trực giác).
- `<mapping>` là node ANH EM trực tiếp dưới `<step>` (KHÔNG có tag bao) — giống Calculator; generator chèn `add_element` + `set_field_path`, item bổ sung chèn thủ công.
- `<connection>` là THAM CHIẾU DB connection Oracle; phải tồn tại trong artifact.
- `load_action`/`load_method` dùng mã HOA cố định (không dịch).
