# NullIf — Step đổi giá trị khớp thành null

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>NullIf</type>
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
        <name>{{FIELD_NAME}}</name>
        <value>{{MATCH_VALUE}}</value>
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
| `<fields>` | Y | Tag bao danh sách field cần xử lý. |
| `<fields>/<field>/<name>` | Y | Tên field đầu vào cần kiểm tra. |
| `<fields>/<field>/<value>` | Y | Giá trị so khớp; nếu field bằng đúng giá trị này → set thành NULL. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: NULL_IF` | `<type>` | `NullIf`. |
| `configuration.fields[].name` | `<fields>/<field>/<name>` | Field đầu vào. |
| `configuration.fields[].value` | `<fields>/<field>/<value>` | Giá trị khớp → NULL. |

Fill danh sách bằng `set_fields` (listTag=`fields`, itemTag=`field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `engine/src/main/java/org/pentaho/di/trans/steps/nullif/NullIfMeta.java :: getXML()`.

- `getXML()` mở tag `<fields>`, lặp mảng `fields[]`, mỗi phần tử ghi `<field>` với 2 node con `name` và `value`, rồi đóng `</fields>`.
- Item con là `NullIfMeta.Field` (chỉ có `fieldName`, `fieldValue`).
- `setDefault()` khởi tạo 0 field (list rỗng).
- Khung `<partitioning>`, `<attributes/>`, `<cluster_schema/>`, `<remotesteps>`, `<GUI>` do `StepMeta`/`BaseStep` bao ngoài, không do `getXML()` sinh.

Ví dụ set các field có giá trị `-1` về NULL:

```xml
    <fields>
      <field>
        <name>quantity</name>
        <value>-1</value>
        </field>
      <field>
        <name>amount</name>
        <value>-1</value>
        </field>
      </fields>
```

## 5. Lưu ý / bẫy

- So khớp theo GIÁ TRỊ đã chuyển chuỗi của field; kiểu dữ liệu field ảnh hưởng cách so (vd number `-1` khớp chuỗi `-1`).
- Hành vi với chuỗi rỗng vs NULL phụ thuộc system property `KETTLE_EMPTY_STRING_DIFFERS_FROM_NULL` (mặc định `N` = coi chuỗi rỗng như null). Không suy diễn thêm nếu chưa cần.
- List `<field>` nằm trong tag bao `<fields>` → generator fill bằng `set_fields`.
- NullIf KHÔNG đổi metadata (kiểu/độ dài) của field, chỉ đổi GIÁ TRỊ thành null.
