# DataGrid — Step nhập dữ liệu tĩnh dạng lưới

Khai báo field và các dòng dữ liệu cố định ngay trong step (dùng cho seed/lookup nhỏ, test).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>DataGrid</type>
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
        <type>String</type>
        <format/>
        <currency/>
        <decimal/>
        <group/>
        <length>-1</length>
        <precision>-1</precision>
        <set_empty_string>N</set_empty_string>
        <field_null_if/>
      </field>
    </fields>
    <data>
      <line> <item>{{VALUE_ROW1}}</item> </line>
      <line> <item>{{VALUE_ROW2}}</item> </line>
    </data>
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
| `<fields>/<field>` | Y | Định nghĩa cột: node con bên dưới. |
| `<fields>/<field>/<name>` | Y | Tên cột output. |
| `<fields>/<field>/<type>` | Y | Kiểu value-meta: `String`/`Integer`/`Number`/`Date`/`Boolean`... |
| `<fields>/<field>/<format>` | N | Mask định dạng (parse giá trị trong `<data>`). |
| `<fields>/<field>/<currency>` `<decimal>` `<group>` | N | Ký hiệu tiền/thập phân/nhóm. |
| `<fields>/<field>/<length>` `<precision>` | N | Độ dài/độ chính xác; mặc định `-1`. |
| `<fields>/<field>/<set_empty_string>` | N | `Y`=coi giá trị rỗng là chuỗi rỗng thay vì null. |
| `<fields>/<field>/<field_null_if>` | N | Giá trị coi như null. |
| `<data>/<line>` | Y | Mỗi dòng dữ liệu; chứa các `<item>` theo THỨ TỰ field. |
| `<data>/<line>/<item>` | Y | Giá trị của cột (khớp thứ tự `<field>`). |

## 3. YAML→XML Mapping

| YAML | XML | Ghi chú |
|---|---|---|
| `type: DATA_GRID` | `<type>` | `DataGrid`. |
| `configuration.fields[].name` | `<fields>/<field>/<name>` | |
| `configuration.fields[].type` | `<fields>/<field>/<type>` | |
| `configuration.fields[].length` | `<fields>/<field>/<length>` | |
| `configuration.data[]` (mảng dòng) | `<data>/<line>` | Mỗi dòng là mảng item theo thứ tự field. |
| `configuration.data[][]` (giá trị ô) | `<data>/<line>/<item>` | |

`<fields>` fill bằng `set_fields` (listTag=`fields`, itemTag=`field`). `<data>` là
list `<line>` mà mỗi `<line>` chứa nhiều `<item>` không xuống dòng — cấu trúc lồng
đặc thù, generator điền thủ công theo đúng số cột (xem Lưu ý).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `engine/src/main/java/org/pentaho/di/trans/steps/datagrid/DataGridMeta.java :: getXML()`.

- `getXML()` mở `<fields>`, lặp mảng `fieldName[]` (bỏ field rỗng), mỗi `<field>` ghi: `name`, `type`, `format`, `currency`, `decimal`, `group`, `length`, `precision`, `set_empty_string`, `field_null_if` (hằng `FIELD_NULL_IF="field_null_if"`), đóng `</fields>`.
- Mở `<data>`, lặp `dataLines` (List<List<String>>): mỗi dòng ghi `<line> ` rồi các `<item>...</item>` (tham số `false` = KHÔNG xuống dòng giữa các item), rồi ` </line>`; đóng `</data>`.
- `setDefault()` khởi tạo 0 field (list rỗng).

## 5. Lưu ý / bẫy

- `<data>` có cấu trúc LỒNG đặc thù: list `<line>`, mỗi line chứa nhiều `<item>` NẰM TRÊN CÙNG MỘT DÒNG (không xuống dòng). `set_fields` không mô tả được item lồng — generator chèn `<line>` thủ công, đảm bảo SỐ `<item>` = SỐ `<field>` và ĐÚNG THỨ TỰ.
- Giá trị `<item>` là chuỗi; sẽ được parse theo `type`+`format` của field tương ứng.
- `<type>` dùng tên value-meta (chuỗi), không phải số.
- DataGrid dùng cho dữ liệu tĩnh nhỏ; dữ liệu lớn nên dùng CsvInput/TableInput.
