# Delete — Step xóa bản ghi theo khóa

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>Delete</type>
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
    <lookup>
      <schema>{{SCHEMA}}</schema>
      <table>{{TABLE}}</table>
      <key>
        <name>{{KEY_STREAM_FIELD}}</name>
        <field>{{KEY_TABLE_FIELD}}</field>
        <condition>=</condition>
        <name2/>
      </key>
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
| `<lookup/table>` | Y | Bảng cần xóa. |
| `<commit>` | N | Số dòng mỗi lần commit; mặc định `100`. |
| `<lookup/key>` | Y | Điều kiện khóa xác định dòng cần xóa: `name` (field stream), `field` (cột bảng), `condition` (`=`, `<`, `>`, `LIKE`, `BETWEEN`...), `name2` (BETWEEN). |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: DELETE` | `<type>` | `Delete`. |
| `configuration.connection` | `<connection>` |  |
| `configuration.schema` | `<lookup/schema>` |  |
| `configuration.table` | `<lookup/table>` |  |
| `configuration.commit` | `<commit>` |  |
| `configuration.keys[].stream_field` | `<lookup/key/name>` | Field trong stream. |
| `configuration.keys[].table_field` | `<lookup/key/field>` | Cột trong bảng. |
| `configuration.keys[].condition` | `<lookup/key/condition>` |  |

Fill danh sách bằng `set_fields` (listTag=`lookup`, itemTag=`key`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`engine/src/main/java/org/pentaho/di/trans/steps/delete/DeleteMeta.java :: getXML()`.

`getXML()` ghi theo đúng thứ tự: `<connection>`, `<commit>`, rồi khối
`<lookup>` chứa `<schema>`, `<table>` và danh sách `<key>`
(`name`=field stream, `field`=cột bảng, `condition`, `name2`).
Tên node dùng hằng `TAG_CONNECTION`/`TAG_COMMIT`/`TAG_SCHEMA`/
`TAG_TABLE`/`TAG_KEY`/`TAG_NAME`/`TAG_FIELD`/`TAG_CONDITION`/`TAG_NAME2`
— đúng chuỗi literal như template. `loadXML()` đọc lại khớp.

Ví dụ production: `all_steps_configured.ktr` (Spoon PDI 9.4 verified), step "Delete".

## 5. Lưu ý / bẫy

- Delete là thao tác phá hủy dữ liệu; thiết kế phải chốt đầy đủ key và kiểm tra null trước khi chạy.
- `name` = field trong stream cấp giá trị so sánh, `field` = cột trong bảng; hai tên có thể khác nhau.
- Không có `<value>` — Delete chỉ dùng `<key>` để lọc dòng cần xóa.

## Production Example

Trích từ Spoon PDI 9.4 (verified): `all_steps_configured.ktr` (Spoon lưu 1 key với `name`/`field` — làm sạch cặp trùng khi generate):

```xml
<step>
    <name>Delete</name>
    <type>Delete</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <connection>conn_oracle_test</connection>
    <commit>100</commit>
    <lookup>
      <schema>TEST</schema>
      <table>DUMMY_T</table>
      <key>
        <name>ID</name>
        <field>ID</field>
        <condition>=</condition>
        <name2/>
      </key>
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
      <xloc>379</xloc>
      <yloc>87</yloc>
      <draw>Y</draw>
    </GUI>
  </step>
```

