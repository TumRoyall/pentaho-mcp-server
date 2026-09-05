# DBLookup — Step tra cứu dữ liệu trong database

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>DBLookup</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <connection>{{CONNECTION}}</connection>
    <cache>N</cache>
    <cache_load_all>N</cache_load_all>
    <cache_size>0</cache_size>
    <lookup>
      <schema>{{SCHEMA}}</schema>
      <table>{{TABLE}}</table>
      <orderby/>
      <fail_on_multiple>N</fail_on_multiple>
      <eat_row_on_failure>N</eat_row_on_failure>
      <key>
        <name>{{KEY_STREAM_FIELD}}</name>
        <field>{{KEY_TABLE_FIELD}}</field>
        <condition>=</condition>
        <name2/>
      </key>
      <value>
        <name>{{RETURN_TABLE_FIELD}}</name>
        <rename>{{RETURN_STREAM_FIELD}}</rename>
        <default/>
        <type>String</type>
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
| `<connection>` | Y | Connection database dùng để lookup. |
| `<cache>` | N | Bật cache bằng `Y`. |
| `<cache_load_all>` | N | Nạp toàn bộ bảng vào cache. |
| `<cache_size>` | N | Giới hạn số dòng cache; `0` theo nguồn. |
| `<lookup/schema>` | N | Schema bảng lookup. |
| `<lookup/table>` | Y | Tên bảng lookup. |
| `<lookup/orderby>` | N | Mệnh đề sắp xếp khi cần. |
| `<lookup/fail_on_multiple>` | N | Fail khi nhiều bản ghi cùng khớp. |
| `<lookup/eat_row_on_failure>` | N | Loại dòng khi lookup thất bại. |
| `<lookup/key>` | Y | Khóa lookup: `name` (field stream), `field` (cột bảng), `condition` (`=`...), `name2`. |
| `<lookup/value>` | Y | Field trả về: `name` (cột bảng), `rename` (tên field output), `default`, `type`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: DB_LOOKUP` | `<type>` | `DBLookup`. |
| `configuration.connection` | `<connection>` |  |
| `configuration.schema` | `<lookup/schema>` |  |
| `configuration.table` | `<lookup/table>` |  |
| `configuration.cache` | `<cache>` | Y/N. |
| `configuration.keys[].stream_field` | `<lookup/key/name>` |  |
| `configuration.keys[].table_field` | `<lookup/key/field>` |  |
| `configuration.return_fields[].table_field` | `<lookup/value/name>` |  |
| `configuration.return_fields[].output_name` | `<lookup/value/rename>` |  |

Fill danh sách bằng `set_fields` (listTag=`lookup`, itemTag=`key`/`value`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`engine/src/main/java/org/pentaho/di/trans/steps/databaselookup/DatabaseLookupMeta.java :: getXML()`.

`getXML()` ghi theo đúng thứ tự: `<connection>`, `<cache>`,
`<cache_load_all>`, `<cache_size>`, rồi khối `<lookup>` chứa
`<schema>`, `<table>`, `<orderby>`, `<fail_on_multiple>`,
`<eat_row_on_failure>`, danh sách `<key>` (`name`=field stream,
`field`=cột bảng, `condition`, `name2`) và danh sách `<value>`
(`name`=cột bảng, `rename`=tên field output, `default`, `type`).
Node `<type>` ghi bằng CHUỖI `ValueMetaFactory.getValueMetaName()`
(`String`, `Number`, `Integer`, `Date`…) — không phải số.
`loadXML()` đọc lại khớp; `rename` thiếu mặc định bằng `name`.

Ví dụ production: `all_steps_configured.ktr` (Spoon PDI 9.4 verified), step "Database lookup".

## 5. Lưu ý / bẫy

- **Bẫy `<value>`**: khác InsertUpdate, ở DBLookup `name` = cột trong bảng (nguồn giá trị), `rename` = tên field xuất ra stream.
- Nếu khóa lookup không duy nhất, cân nhắc `fail_on_multiple=Y` để tránh chọn kết quả không xác định.
- Spoon có thể ghi thêm các `<key>` rỗng (mỗi condition một dòng) — generator chỉ giữ các key có `field`/`name`.

## Production Example

Trích từ Spoon PDI 9.4 (verified): `all_steps_configured.ktr` (giữ 1 key có giá trị + 1 return field):

```xml
<step>
    <name>Database lookup</name>
    <type>DBLookup</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <connection>conn_oracle_test</connection>
    <cache>N</cache>
    <cache_load_all>N</cache_load_all>
    <cache_size>0</cache_size>
    <lookup>
      <schema>TEST</schema>
      <table>DUMMY_T</table>
      <orderby/>
      <fail_on_multiple>N</fail_on_multiple>
      <eat_row_on_failure>N</eat_row_on_failure>
      <key>
        <name>ID</name>
        <field>ID</field>
        <condition>=</condition>
        <name2/>
      </key>
      <value>
        <name>NAME</name>
        <rename>NAME</rename>
        <default/>
        <type>String</type>
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
      <xloc>299</xloc>
      <yloc>135</yloc>
      <draw>Y</draw>
    </GUI>
  </step>
```

