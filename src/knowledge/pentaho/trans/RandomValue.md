# RandomValue — Step sinh giá trị ngẫu nhiên

Sinh field ngẫu nhiên: số, integer, chuỗi, UUID, hoặc HMAC.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>RandomValue</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <fields>
      <field>
        <name>{{OUTPUT_FIELD}}</name>
        <type>random uuid</type>
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
      <xloc>{{X}}</xloc>
      <yloc>{{Y}}</yloc>
      <draw>Y</draw>
    </GUI>
  </step>
```

## 2. Config Fields

| Field XML | Bắt buộc | Ý nghĩa / cách điền |
|---|---|---|
| `<fields>/<field>` | Y | Mỗi field ngẫu nhiên sinh ra. |
| `<fields>/<field>/<name>` | Y | Tên field output. |
| `<fields>/<field>/<type>` | Y | Loại giá trị ngẫu nhiên (mã chuỗi, xem bên dưới). |

### Giá trị `<type>` hợp lệ (mã từ `functions[].getCode()`)
`random number` (Number), `random integer` (Integer), `random string` (String 13),
`random uuid` (String 36), `random uuid4` (String 36), `random machmacmd5` (String 100),
`random machmacsha1` (String 100).

## 3. YAML→XML Mapping

| YAML | XML | Ghi chú |
|---|---|---|
| `type: RANDOM_VALUE` | `<type>` | `RandomValue`. |
| `configuration.fields[].name` | `<fields>/<field>/<name>` | |
| `configuration.fields[].type` | `<fields>/<field>/<type>` | Mã chuỗi ở trên. |

Fill `<fields>` bằng `set_fields` (listTag=`fields`, itemTag=`field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `engine/src/main/java/org/pentaho/di/trans/steps/randomvalue/RandomValueMeta.java :: getXML()`.

- `getXML()` mở `<fields>`, lặp `fieldName[]`, mỗi `<field>` ghi `name` và `type` (= `functions[fieldType[i]].getCode()`), đóng `</fields>`.
- Bảng `functions[]` ánh xạ hằng TYPE_RANDOM_* → mã chuỗi: NUMBER→`random number`, INTEGER→`random integer`, STRING→`random string`, UUID→`random uuid`, UUID4→`random uuid4`, HMACMD5→`random machmacmd5`, HMACSHA1→`random machmacsha1`.
- `setDefault()` khởi tạo list rỗng (khi tạo mới field mặc định type NUMBER).

## 5. Lưu ý / bẫy

- `<type>` dùng MÃ CHUỖI có dấu cách (vd `random uuid`), không phải số. Sai mã → type NONE → check báo lỗi "FieldHasNoType".
- Lưu ý chính tả mã HMAC trong source: `random machmacmd5` / `random machmacsha1` (đúng như literal trong Java).
- Độ dài field theo type: string=13, uuid/uuid4=36, hmac=100 (do engine set, không cần ghi trong template).
- List `<field>` nằm trong tag bao `<fields>` → fill bằng `set_fields`.
