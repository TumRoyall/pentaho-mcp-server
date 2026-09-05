# InsertUpdate — Step chèn hoặc cập nhật bản ghi

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>InsertUpdate</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <connection>{{CONNECTION}}</connection>
    <commit>100</commit>
    <update_bypassed>N</update_bypassed>
    <lookup>
      <schema>{{SCHEMA}}</schema>
      <table>{{TABLE}}</table>
      <key>
        <name>{{KEY_STREAM_FIELD}}</name>
        <field>{{KEY_TABLE_FIELD}}</field>
        <condition>=</condition>
        <name2/>
      </key>
      <value>
        <name>{{UPDATE_TABLE_FIELD}}</name>
        <rename>{{UPDATE_STREAM_FIELD}}</rename>
        <update>Y</update>
      </value>
    </lookup>
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
| `<connection>` | Y | Connection tới database đích. |
| `<lookup/schema>` | N | Schema của bảng đích; có thể để trống theo connection. |
| `<lookup/table>` | Y | Bảng cần insert/update. |
| `<commit>` | N | Số dòng mỗi lần commit; giá trị mặc định `100`. |
| `<update_bypassed>` | N | `Y` để chỉ insert, bỏ qua phần update. |
| `<lookup/key>` | Y | Mỗi khóa dò bản ghi: `name` (field stream), `field` (cột bảng), `condition` (thường `=`), `name2` (dùng cho BETWEEN). |
| `<lookup/value>` | Y | Mỗi field ghi: `name` (cột bảng đích), `rename` (field trong stream), `update` (`Y`=cập nhật khi trùng, `N`=chỉ insert). |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: INSERT_UPDATE` | `<type>` | `InsertUpdate`. |
| `configuration.connection` | `<connection>` |  |
| `configuration.schema` | `<lookup/schema>` |  |
| `configuration.table` | `<lookup/table>` |  |
| `configuration.commit` | `<commit>` |  |
| `configuration.keys[].stream_field` | `<lookup/key/name>` | Field trong stream. |
| `configuration.keys[].table_field` | `<lookup/key/field>` | Cột trong bảng. |
| `configuration.keys[].condition` | `<lookup/key/condition>` | `=`, `<`, `>`, `LIKE`, `BETWEEN`... |
| `configuration.update_fields[].table_field` | `<lookup/value/name>` | Cột trong bảng đích. |
| `configuration.update_fields[].stream_field` | `<lookup/value/rename>` | Field nguồn trong stream. |
| `configuration.update_fields[].update` | `<lookup/value/update>` | `Y`/`N`. |

Danh sách `<key>`/`<value>` fill bằng `set_fields` (listTag=`lookup`, itemTag=`key` và `value`) hoặc `set_field_path`.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`engine/src/main/java/org/pentaho/di/trans/steps/insertupdate/InsertUpdateMeta.java :: getXML()`.

`getXML()` ghi theo đúng thứ tự: `<connection>`, `<commit>`,
`<update_bypassed>`, rồi khối `<lookup>` chứa `<schema>`, `<table>`,
danh sách `<key>` (`name`=field stream, `field`=cột bảng,
`condition`, `name2`) và danh sách `<value>` (`name`=cột bảng đích,
`rename`=field stream, `update`). `loadXML()` đọc lại đúng các node
này; `update` thiếu mặc định `TRUE`. `setDefault()` đặt
`commitSize="100"`.

Ví dụ production: `old_src/trans/trans_update_tr_mb_dim_time.ktr`, step "Insert / Update".

## 5. Lưu ý / bẫy

- Khóa lookup phải đủ xác định bản ghi; cấu hình thiếu key có thể biến thao tác thành insert ngoài ý muốn (duplicate).
- `<key>` dùng `name` = field trong stream, `field` = cột trong bảng; hai tên có thể khác nhau — không giả định chúng bằng nhau.
- **Bẫy `<value>` (đã đối chiếu source)**: ngược với `<key>` — ở `<value>`,
  `name` = CỘT BẢNG đích (dùng dựng câu SQL), `rename` = field trong stream
  (đọc từ input row). Đừng đảo hai node này.
- `<value>` với `update=N` sẽ chỉ set giá trị lúc insert, không ghi đè khi update.
- `condition` mặc định `=`; với BETWEEN cần điền cả `name2`.

## Production Example

Trích từ file production: `old_src/trans/trans_update_tr_mb_dim_time.ktr`

```xml
<step>
    <name>Insert / Update</name>
    <type>InsertUpdate</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <connection>tckt_dc</connection>
    <commit>100</commit>
    <update_bypassed>N</update_bypassed>
    <lookup>
      <schema>apps</schema>
      <table>mb_dim_time</table>
      <key>
        <name>DAYID</name>
        <field>DAYID</field>
        <condition>=</condition>
        <name2/>
      </key>
      <value>
        <name>IS_WORKING_DAY</name>
        <rename>IS_WORKING_DAY</rename>
        <update>Y</update>
      </value>
    </lookup>
    <attributes/>
    <cluster_schema/>
    <remotesteps>
      <input>
      </input>
      <output>
      </output>
    </remotesteps>
    <GUI>
      <xloc>581</xloc>
      <yloc>283</yloc>
      <draw>Y</draw>
    </GUI>
  </step>
```
