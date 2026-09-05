# MergeJoin — Step ghép hai stream đã sắp xếp

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>MergeJoin</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <join_type>INNER</join_type>
    <step1>{{LEFT_STEP}}</step1>
    <step2>{{RIGHT_STEP}}</step2>
    <keys_1>
      <key>{{LEFT_KEY_FIELD}}</key>
    </keys_1>
    <keys_2>
      <key>{{RIGHT_KEY_FIELD}}</key>
    </keys_2>
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
| `<join_type>` | Y | Kiểu join: `INNER`, `LEFT OUTER`, `RIGHT OUTER`, `FULL OUTER`. |
| `<step1>` | Y | Tên step đầu vào bên trái. |
| `<step2>` | Y | Tên step đầu vào bên phải. |
| `<keys_1>/<key>` | Y | Mỗi key của stream 1 là một node `<key>` chứa tên field (text). |
| `<keys_2>/<key>` | Y | Mỗi key của stream 2 tương ứng theo thứ tự với `keys_1`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: MERGE_JOIN` | `<type>` | `MergeJoin`. |
| `configuration.join_type` | `<join_type>` |  |
| `configuration.left_step` | `<step1>` | Tham chiếu step. |
| `configuration.right_step` | `<step2>` | Tham chiếu step. |
| `configuration.left_keys[]` | `<keys_1>/<key>` | Mỗi phần tử → một `<key>`. |
| `configuration.right_keys[]` | `<keys_2>/<key>` | Số lượng và thứ tự phải khớp `keys_1`. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`engine/src/main/java/org/pentaho/di/trans/steps/mergejoin/MergeJoinMeta.java :: getXML()`.

`getXML()` ghi theo đúng thứ tự: `<join_type>`, `<step1>`, `<step2>`
(tên step của 2 info hop), rồi khối `<keys_1>` / `<keys_2>` — mỗi key
là node `<key>FIELD</key>` dạng text đơn giản. `join_type` thuộc tập
`{"INNER", "LEFT OUTER", "RIGHT OUTER", "FULL OUTER"}`, default
`INNER` (`setDefault()`). `loadXML()`/`readData()` đọc lại khớp.

Ví dụ production: `old_src/trans/etl_tran_ftp_dieuchinh_get_auth_token.ktr`, step "MergeJoin" (khung join_type/step1/step2 từ production; item `<key>` là cấu trúc chuẩn PDI dạng text node).

## 5. Lưu ý / bẫy

- Hai stream phải được sort tương thích theo các key join trước khi vào Merge Join (thường có Sort rows đứng trước).
- `keys_1`/`keys_2` phải có **số lượng key bằng nhau** và **cùng thứ tự** — key thứ i của stream 1 ghép với key thứ i của stream 2.
- Item key là node `<key>FIELD</key>` (text đơn giản), không phải block con.
- Các tham chiếu `<step1>`/`<step2>` do generator nối bằng `set_field`/`set_field_path` cùng `edit_hops`; không hardcode giá trị thật trong template.

## Production Example

Trích từ file production: `old_src/trans/etl_tran_ftp_dieuchinh_get_auth_token.ktr` (join_type + step1/step2 thật; ví dụ này có `keys_1`/`keys_2` rỗng vì join theo dòng đơn):

```xml
<step>
    <name>Merge Join</name>
    <type>MergeJoin</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <join_type>INNER</join_type>
    <step1>Select values</step1>
    <step2>Table input</step2>
    <keys_1>
    </keys_1>
    <keys_2>
    </keys_2>
    <attributes/>
    <cluster_schema/>
    <remotesteps>
      <input>
      </input>
      <output>
      </output>
    </remotesteps>
    <GUI>
      <xloc>640</xloc>
      <yloc>352</yloc>
      <draw>Y</draw>
    </GUI>
  </step>
```

