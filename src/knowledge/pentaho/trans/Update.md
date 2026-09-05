# Update — Step cập nhật bản ghi

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>Update</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <connection>{{CONNECTION}}</connection>
    <skip_lookup>N</skip_lookup>
    <commit>100</commit>
    <use_batch>N</use_batch>
    <error_ignored>N</error_ignored>
    <ignore_flag_field/>
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
| `<lookup/schema>` | N | Schema của bảng đích. |
| `<lookup/table>` | Y | Bảng cần cập nhật. |
| `<skip_lookup>` | N | `N` mặc định. |
| `<commit>` | N | Số dòng mỗi lần commit; mặc định `100`. |
| `<use_batch>` | N | Bật batch update bằng `Y` nếu driver hỗ trợ. |
| `<error_ignored>` | N | Có bỏ qua lỗi update hay không. |
| `<lookup/key>` | Y | Khóa tìm bản ghi: `name` (field stream), `field` (cột bảng), `condition` (`=`), `name2` (BETWEEN). |
| `<lookup/value>` | Y | Field cập nhật: `name` (cột bảng đích), `rename` (field trong stream). |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: UPDATE` | `<type>` | `Update`. |
| `configuration.connection` | `<connection>` |  |
| `configuration.schema` | `<lookup/schema>` |  |
| `configuration.table` | `<lookup/table>` |  |
| `configuration.commit` | `<commit>` |  |
| `configuration.use_batch` | `<use_batch>` | Y/N. |
| `configuration.keys[].stream_field` | `<lookup/key/name>` |  |
| `configuration.keys[].table_field` | `<lookup/key/field>` |  |
| `configuration.update_fields[].table_field` | `<lookup/value/name>` | Cột trong bảng đích. |
| `configuration.update_fields[].stream_field` | `<lookup/value/rename>` | Field nguồn trong stream. |

Fill danh sách bằng `set_fields` (listTag=`lookup`, itemTag=`key`/`value`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`engine/src/main/java/org/pentaho/di/trans/steps/update/UpdateMeta.java :: getXML()`.

`getXML()` ghi theo đúng thứ tự: `<connection>`, `<skip_lookup>`,
`<commit>`, `<use_batch>`, `<error_ignored>`, `<ignore_flag_field>`,
rồi khối `<lookup>` chứa `<schema>`, `<table>`, danh sách `<key>`
(`name`=field stream, `field`=cột bảng, `condition`, `name2`) và danh
sách `<value>` (`name`=cột bảng đích, `rename`=field stream).
`setDefault()` đặt `commitSize="100"`, các flag `N`.

Ví dụ production: `all_steps_configured.ktr` (Spoon PDI 9.4 verified), step "Update".

## 5. Lưu ý / bẫy

- Khác `InsertUpdate`: `Update` chỉ cập nhật, KHÔNG insert bản ghi mới; dòng không khớp key sẽ báo lỗi (trừ khi `error_ignored=Y`).
- `<value>` của Update không có node `<update>` (khác InsertUpdate) — mọi value đều được ghi.
- **Bẫy `<value>` (đã đối chiếu source)**: ngược với `<key>` — ở `<value>`,
  `name` = CỘT BẢNG đích (dùng dựng câu SQL), `rename` = field trong stream.
  Đừng đảo hai node này.
- `error_ignored=Y` chỉ nên dùng khi có chiến lược thu nhận lỗi rõ ràng.

## Production Example

Trích từ Spoon PDI 9.4 (verified): `all_steps_configured.ktr`

```xml
<step>
    <name>Update</name>
    <type>Update</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <connection>conn_oracle_test</connection>
    <skip_lookup>N</skip_lookup>
    <commit>100</commit>
    <use_batch>N</use_batch>
    <error_ignored>N</error_ignored>
    <ignore_flag_field/>
    <lookup>
      <schema>TEST</schema>
      <table>DUMMY_T</table>
      <key>
        <name>ID</name>
        <field>ID</field>
        <condition>=</condition>
        <name2/>
      </key>
      <value>
        <name>NAME </name>
        <rename>NAME</rename>
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
      <xloc>187</xloc>
      <yloc>119</yloc>
      <draw>Y</draw>
    </GUI>
  </step>
```
