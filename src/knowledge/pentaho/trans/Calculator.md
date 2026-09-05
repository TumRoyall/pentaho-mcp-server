# Calculator — Step tính toán field

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>Calculator</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <failIfNoFile>Y</failIfNoFile>
    <calculation>
      <field_name>{{RESULT_FIELD}}</field_name>
      <calc_type>{{CALC_TYPE}}</calc_type>
      <field_a>{{FIELD_A}}</field_a>
      <field_b>{{FIELD_B}}</field_b>
      <field_c/>
      <value_type>{{VALUE_TYPE}}</value_type>
      <value_length>-1</value_length>
      <value_precision>-1</value_precision>
      <remove>N</remove>
      <conversion_mask/>
      <decimal_symbol/>
      <grouping_symbol/>
      <currency_symbol/>
    </calculation>
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
| `<failIfNoFile>` | N | `setDefault()` = `true` → `Y`. Cờ báo lỗi khi thiếu file (dùng cho các calc load nội dung file). |
| `<calculation>` | Y | Mỗi phép tính = 1 node `<calculation>` nằm TRỰC TIẾP dưới `<step>` (không có tag list bao ngoài). |
| `<calculation>/<field_name>` | Y | Tên field kết quả ghi ra. |
| `<calculation>/<calc_type>` | Y | Loại phép tính, dùng chuỗi mô tả (xem danh sách bên dưới), vd `ADD`, `SUBTRACT`, `CONSTANT`, `COPY_FIELD`. |
| `<calculation>/<field_a>` | Tùy calc | Field/toán hạng A. |
| `<calculation>/<field_b>` | Tùy calc | Field/toán hạng B (calc 2 ngôi). |
| `<calculation>/<field_c>` | Tùy calc | Field/toán hạng C (calc 3 ngôi, vd `COMBINATION_1`, `ADD3`). |
| `<calculation>/<value_type>` | N | Kiểu dữ liệu kết quả, tên value-meta: `None`, `String`, `Integer`, `Number`, `Date`, `BigNumber`, `Boolean`, `Binary`, `Timestamp`. `None` = dùng kiểu mặc định của phép tính. |
| `<calculation>/<value_length>` | N | Độ dài; `setDefault`/parse dùng `-1` khi không đặt. |
| `<calculation>/<value_precision>` | N | Độ chính xác; `-1` khi không đặt. |
| `<calculation>/<remove>` | N | `Y` = field trung gian, loại khỏi output cuối. Mặc định `N`. |
| `<calculation>/<conversion_mask>` | N | Mask định dạng kết quả. |
| `<calculation>/<decimal_symbol>` | N | Ký hiệu thập phân. |
| `<calculation>/<grouping_symbol>` | N | Ký hiệu phân nhóm hàng nghìn. |
| `<calculation>/<currency_symbol>` | N | Ký hiệu tiền tệ. |

### Giá trị `calc_type` hợp lệ (từ `calc_desc[]`)

`-`, `CONSTANT`, `COPY_FIELD`, `ADD`, `SUBTRACT`, `MULTIPLY`, `DIVIDE`, `SQUARE`, `SQUARE_ROOT`, `PERCENT_1`, `PERCENT_2`, `PERCENT_3`, `COMBINATION_1`, `COMBINATION_2`, `ROUND_1`, `ROUND_2`, `ROUND_STD_1`, `ROUND_STD_2`, `CEIL`, `FLOOR`, `NVL`, `ADD_DAYS`, `YEAR_OF_DATE`, `MONTH_OF_DATE`, `DAY_OF_YEAR`, `DAY_OF_MONTH`, `DAY_OF_WEEK`, `WEEK_OF_YEAR`, `WEEK_OF_YEAR_ISO8601`, `YEAR_OF_DATE_ISO8601`, `BYTE_TO_HEX_ENCODE`, `HEX_TO_BYTE_DECODE`, `CHAR_TO_HEX_ENCODE`, `HEX_TO_CHAR_DECODE`, `CRC32`, `ADLER32`, `MD5`, `SHA1`, `LEVENSHTEIN_DISTANCE`, `METAPHONE`, `DOUBLE_METAPHONE`, `ABS`, `REMOVE_TIME_FROM_DATE`, `DATE_DIFF`, `ADD3`, `INIT_CAP`, `UPPER_CASE`, `LOWER_CASE`, `MASK_XML`, `USE_CDATA`, `REMOVE_CR`, `REMOVE_LF`, `REMOVE_CRLF`, `REMOVE_TAB`, `GET_ONLY_DIGITS`, `REMOVE_DIGITS`, `STRING_LEN`, `LOAD_FILE_CONTENT_BINARY`, `ADD_TIME_TO_DATE`, `QUARTER_OF_DATE`, `SUBSTITUTE_VARIABLE`, `UNESCAPE_XML`, `ESCAPE_HTML`, `UNESCAPE_HTML`, `ESCAPE_SQL`, `DATE_WORKING_DIFF`, `ADD_MONTHS`, `CHECK_XML_FILE_WELL_FORMED`, `CHECK_XML_WELL_FORMED`, `GET_FILE_ENCODING`, `DAMERAU_LEVENSHTEIN`, `NEEDLEMAN_WUNSH`, `JARO`, `JARO_WINKLER`, `SOUNDEX`, `REFINED_SOUNDEX`, `ADD_HOURS`, `ADD_MINUTES`, `DATE_DIFF_MSEC`, `DATE_DIFF_SEC`, `DATE_DIFF_MN`, `DATE_DIFF_HR`, `HOUR_OF_DAY`, `MINUTE_OF_HOUR`, `SECOND_OF_MINUTE`, `ROUND_CUSTOM_1`, `ROUND_CUSTOM_2`, `ADD_SECONDS`, `REMAINDER`.

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: CALCULATOR` | `<type>` | `Calculator`. |
| `configuration.fail_if_no_file` | `<failIfNoFile>` | Y/N; mặc định `Y`. |
| `configuration.calculations[].field_name` | `<calculation>/<field_name>` | Tên field kết quả. |
| `configuration.calculations[].calc_type` | `<calculation>/<calc_type>` | Một trong các chuỗi `calc_desc` ở trên. |
| `configuration.calculations[].field_a` | `<calculation>/<field_a>` | |
| `configuration.calculations[].field_b` | `<calculation>/<field_b>` | |
| `configuration.calculations[].field_c` | `<calculation>/<field_c>` | |
| `configuration.calculations[].value_type` | `<calculation>/<value_type>` | Tên value-meta; `None` = auto. |
| `configuration.calculations[].value_length` | `<calculation>/<value_length>` | Mặc định `-1`. |
| `configuration.calculations[].value_precision` | `<calculation>/<value_precision>` | Mặc định `-1`. |
| `configuration.calculations[].remove` | `<calculation>/<remove>` | Y/N; `Y` = field trung gian. |
| `configuration.calculations[].conversion_mask` | `<calculation>/<conversion_mask>` | |

Danh sách `<calculation>` nằm trực tiếp dưới `<step>`, KHÔNG có tag bao ngoài. Vì
`set_fields` cần một list/item tag, generator điền nhiều phép tính bằng cách
`add_element` step Calculator (đã có sẵn 1 `<calculation>` mẫu) rồi
`set_field_path` từng node của item đầu; item bổ sung phải chèn thủ công theo đúng
thứ tự node ở phần 1.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `engine/src/main/java/org/pentaho/di/trans/steps/calculator/CalculatorMeta.java :: getXML()` và `CalculatorMetaFunction.java :: getXML()`.

- `CalculatorMeta.getXML()` ghi `<failIfNoFile>` rồi lặp mảng `calculation[]`, mỗi phần tử gọi `CalculatorMetaFunction.getXML()`.
- `CalculatorMetaFunction.getXML()` mở/đóng tag hằng `XML_TAG = "calculation"` và ghi lần lượt: `field_name`, `calc_type` (= `getCalcTypeDesc()` → chuỗi `calc_desc`), `field_a`, `field_b`, `field_c`, `value_type` (= `ValueMetaFactory.getValueMetaName(valueType)`), `value_length`, `value_precision`, `remove`, `conversion_mask`, `decimal_symbol`, `grouping_symbol`, `currency_symbol`.
- Khung `<partitioning>`, `<attributes/>`, `<cluster_schema/>`, `<remotesteps>`, `<GUI>` do `StepMeta`/`BaseStep` bao ngoài, không do `getXML()` sinh.

Ví dụ 1 phép cộng `A + B` → field `total` kiểu Number:

```xml
    <calculation>
      <field_name>total</field_name>
      <calc_type>ADD</calc_type>
      <field_a>amount1</field_a>
      <field_b>amount2</field_b>
      <field_c/>
      <value_type>Number</value_type>
      <value_length>-1</value_length>
      <value_precision>-1</value_precision>
      <remove>N</remove>
      <conversion_mask/>
      <decimal_symbol/>
      <grouping_symbol/>
      <currency_symbol/>
    </calculation>
```

## 5. Lưu ý / bẫy

- `calc_type` dùng CHUỖI MÔ TẢ (`ADD`, `SUBTRACT`, ...), KHÔNG dùng số nguyên. Sai chuỗi → `getCalcFunctionType` trả về `CALC_NONE` (phép tính rỗng).
- `value_type` là TÊN value-meta (`Number`, `Integer`, `String`, `Date`, `None`...), không phải số. `None` để Calculator tự chọn kiểu mặc định theo `calc_type` (vd `ADD`→Number, `ROUND_1`→Integer, `YEAR_OF_DATE`→Integer).
- `remove=Y` biến field thành trung gian: dùng cho các bước tính nhiều tầng (tạo field tạm rồi loại khỏi output).
- Các phép tính 1 ngôi (vd `ABS`, `UPPER_CASE`, `YEAR_OF_DATE`) chỉ cần `field_a`; 3 ngôi (`COMBINATION_1`, `ADD3`) cần cả `field_c`.
- Với kiểu Integer/Number, nếu file cũ thiếu `conversion_mask`, Kettle tự set mask backward-compat (`0` cho Integer, `0.0` cho Number). Template mới nên để trống và để Spoon/engine xử lý.
- Nhiều `<calculation>` là các node ANH EM trực tiếp dưới `<step>` — không bao trong tag list.
