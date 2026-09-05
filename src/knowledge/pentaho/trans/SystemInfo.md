# SystemInfo

Transformation step sinh ra các giá trị hệ thống (ngày hiện tại, hostname, biến môi trường, ID batch, etc.) thành field trong stream.

## 1. XML Template

```xml
<step>
  <name>{{STEP_NAME}}</name>
  <type>SystemInfo</type>
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
      <name>{{OUTPUT_FIELD_NAME}}</name>
      <type>{{SYSTEM_INFO_TYPE}}</type>
    </field>
    <!-- repeat for each system value needed -->
  </fields>
  <attributes/>
  <cluster_schema/>
  <remotesteps>
    <input/>
    <output/>
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
| `fields/field/name` | Y | Tên field output |
| `fields/field/type` | Y | Loại thông tin hệ thống (xem bảng dưới) |

### System info types (code CHÍNH XÁC từ `SystemDataTypes.java` — PDI so khớp không phân biệt hoa thường, nhưng template nên dùng đúng chuỗi này)

| Type value | Ý nghĩa | Kiểu dữ liệu output |
|---|---|---|
| `system date (variable)` | Ngày giờ hiện tại | Date |
| `system date (fixed)` | Ngày giờ lúc trans bắt đầu | Date |
| `start date range` | Start date của range | Date |
| `end date range` | End date của range | Date |
| `Hostname` | Hostname máy chạy | String |
| `Hostname real` | Hostname thực | String |
| `IP address` | Địa chỉ IP | String |
| `transformation name` | Tên transformation | String |
| `transformation file name` | Tên file transformation (.ktr) | String |
| `batch ID` | PDI batch ID | Integer |
| `previous result nr errors` | Số lỗi từ result trước | Integer |
| `previous result nr lines input` | Số dòng input từ result trước | Integer |
| `previous result nr lines output` | Số dòng output từ result trước | Integer |
| `previous result nr lines read` | Số dòng read từ result trước | Integer |
| `previous result nr lines written` | Số dòng written từ result trước | Integer |
| `previous result nr lines updated` | Số dòng updated từ result trước | Integer |
| `previous result nr lines rejected` | Số dòng rejected từ result trước | Integer |
| `previous result nr lines deleted` | Số dòng deleted từ result trước | Integer |
| `previous result is stopped` | Result trước dừng? | Boolean |
| `previous result exist status` | Exit status (chú ý typo `exist` trong source PDI) | Integer |
| `previous result nr files` | Số file trong result | Integer |
| `previous result nr files retrieved` | Số file retrieved | Integer |
| `previous result nr rows` | Số dòng trong result rows | Integer |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `output_fields[].name` | `fields/field/name` | |
| `output_fields[].info_type` | `fields/field/type` | Chuỗi đúng format bảng trên |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`engine/src/main/java/org/pentaho/di/trans/steps/systemdata/SystemDataMeta.java :: getXML()`
+ `SystemDataTypes.java` (enum code).

`getXML()` chỉ ghi khối `<fields>` — mỗi `<field>` đúng 2 node (`name`,
`type` = `SystemDataTypes.getCode()`). `loadXML()` đọc lại khớp;
`getTypeFromString()` so khớp không phân biệt hoa thường.

```xml
<!-- Provenance: pattern quan sát trong old_src/trans (khối fields 2 node) -->
<step>
  <name>Get system date</name>
  <type>SystemInfo</type>
  <fields>
    <field>
      <name>SYSDATE</name>
      <type>system date (variable)</type>
    </field>
    <field>
      <name>BATCH_ID</name>
      <type>batch ID</type>
    </field>
    <field>
      <name>SERVER_NAME</name>
      <type>hostname</type>
    </field>
  </fields>
</step>
```

## 5. Lưu ý / bẫy

- **Sinh đúng 1 dòng**: Step này tạo 1 output row chứa các giá trị hệ thống. Nếu cần ghép với stream có nhiều dòng, dùng join hoặc đặt trước step cần thiết.
- **`system date (variable)` vs `(fixed)`**: `variable` lấy thời điểm row được xử lý, `fixed` lấy thời điểm trans bắt đầu. Thường dùng `fixed` cho audit timestamp.
- **Type string phải viết chính xác**: PDI parse theo chuỗi, viết sai chữ → step không hoạt động.
- **Thường kết hợp với RowGenerator**: Nếu cần inject system info vào đầu pipeline mà không có source row.

## Production Example

Trích từ file production: `etl_trans_ftp_dieuchinh_call_api_t24.ktr`

```xml
<step>
  <name>Get System Info</name>
  <type>SystemInfo</type>
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
      <name>now</name>
      <type>system date (fixed)</type>
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
    <xloc>384</xloc>
    <yloc>256</yloc>
    <draw>Y</draw>
  </GUI>
</step>
```
