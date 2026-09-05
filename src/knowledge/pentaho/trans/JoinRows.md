# JoinRows

Transformation step thực hiện Cartesian join (hoặc join có điều kiện) giữa hai hay nhiều input stream.

> Lưu ý: JoinRows (hay "Join Rows - cartesian product") khác với Merge Join (sorted merge join). JoinRows không yêu cầu input được sort.

## 1. XML Template

```xml
<step>
  <name>{{STEP_NAME}}</name>
  <type>JoinRows</type>
  <description/>
  <distribute>Y</distribute>
  <custom_distribution/>
  <copies>1</copies>
  <partitioning>
    <method>none</method>
    <schema_name/>
  </partitioning>
  <directory>{{TEMP_DIRECTORY}}</directory>
  <prefix>{{TEMP_FILE_PREFIX}}</prefix>
  <cache_size>{{CACHE_SIZE}}</cache_size>
  <main>{{MAIN_STEP_NAME}}</main>
  <compare>
    <condition>
      <negated>{{NEGATED}}</negated>
      <leftvalue>{{LEFT_FIELD}}</leftvalue>
      <function>{{OPERATOR}}</function>
      <rightvalue>{{RIGHT_FIELD}}</rightvalue>
      <value>
        <name>{{CONSTANT_NAME}}</name>
        <type>{{CONSTANT_TYPE}}</type>
        <text>{{CONSTANT_VALUE}}</text>
      </value>
    </condition>
  </compare>
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
| `directory` | Y | Thư mục temp cho spill-to-disk (thường `temp`) |
| `prefix` | Y | Prefix cho temp file (ví dụ `out`) |
| `cache_size` | Y | Số dòng giữ trong memory trước khi spill (mặc định 500) |
| `main` | N | Tên step "chính" (nếu có nhiều input, step này là driving side) |
| `compare/condition/negated` | N | `Y`/`N` — đảo ngược điều kiện |
| `compare/condition/leftvalue` | N | Field bên trái của join condition |
| `compare/condition/function` | N | Toán tử: `=`, `<>`, `<`, `<=`, `>`, `>=`, `IS NULL`, `IS NOT NULL`, `LIKE`, `REGEXP` |
| `compare/condition/rightvalue` | N | Field bên phải |
| `compare/condition/value` | N | Giá trị hằng (nếu so sánh với constant thay vì field) |

Nếu không có condition → Cartesian product (mỗi dòng trái × mỗi dòng phải).

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `temp_directory` | `directory` | |
| `temp_prefix` | `prefix` | |
| `cache_size` | `cache_size` | |
| `main_step` | `main` | |
| `join_condition.left` | `compare/condition/leftvalue` | |
| `join_condition.operator` | `compare/condition/function` | |
| `join_condition.right` | `compare/condition/rightvalue` | |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`engine/src/main/java/org/pentaho/di/trans/steps/joinrows/JoinRowsMeta.java :: getXML()`.

`getXML()` ghi đúng thứ tự: `directory`, `prefix`, `cache_size`,
`main`, rồi khối `<compare>` chứa `condition.getXML()` (node
`<condition>` — KHÔNG phải node con trực tiếp của `<step>`; template
cũ đặt `<condition>` sai cấp). `condition == null` → khối `<compare>`
rỗng.

```xml
<!-- Provenance: khớp getXML() + pattern trong old_src/trans -->
<step>
  <name>Join with parameters</name>
  <type>JoinRows</type>
  <directory>temp</directory>
  <prefix>out</prefix>
  <cache_size>500</cache_size>
  <main/>
  <compare>
    <condition>
      <negated>N</negated>
      <leftvalue/>
      <function>=</function>
      <rightvalue/>
    </condition>
  </compare>
</step>
```

## 5. Lưu ý / bẫy

- **Bẫy `<compare>`**: `getXML()` bọc condition trong `<compare>`. Ghi `<condition>` trực tiếp dưới `<step>` (như template cũ) → Spoon không đọc được condition.

- **Cartesian product cực kỳ nguy hiểm với data lớn**: N × M dòng → N*M output. Chỉ dùng khi một bên rất nhỏ (ví dụ 1 dòng tham số).
- **Khác Merge Join**: Merge Join yêu cầu cả hai input đã sort theo key. JoinRows không cần sort nhưng performance kém hơn cho equi-join.
- **Spill to disk**: Khi data vượt cache_size, PDI ghi ra temp file. Đảm bảo đủ disk space.
- **Condition trống = full cartesian**: Nếu muốn equi-join, nên dùng Merge Join hoặc Database Join thay vì JoinRows.
- **Thường dùng với RowGenerator/GetVariable**: Khi cần inject biến vào mỗi dòng data, tạo 1 dòng biến rồi cross-join.

## Production Example

Trích từ file production: `etl_trans_tkct_build_mail_send_ftp_rate.ktr`

```xml
<step>
  <name>Join rows (cartesian product)</name>
  <type>JoinRows</type>
  <description/>
  <distribute>Y</distribute>
  <custom_distribution/>
  <copies>1</copies>
  <partitioning>
    <method>none</method>
    <schema_name/>
  </partitioning>
  <directory>%%java.io.tmpdir%%</directory>
  <prefix>out</prefix>
  <cache_size>500</cache_size>
  <main>Group by</main>
  <compare>
    <condition>
      <negated>N</negated>
      <leftvalue/>
      <function>=</function>
      <rightvalue/>
    </condition>
  </compare>
  <attributes/>
  <cluster_schema/>
  <remotesteps>
    <input>
      </input>
    <output>
      </output>
  </remotesteps>
  <GUI>
    <xloc>576</xloc>
    <yloc>192</yloc>
    <draw>Y</draw>
  </GUI>
</step>
```
