# SIMPLE_EVAL — Entry đánh giá giá trị đơn giản

## 1. XML Template — String

```xml
<entry>
  <name>VALIDATE_PRD_ID</name>
  <description/>
  <type>SIMPLE_EVAL</type>
  <attributes/>
  <valuetype>variable</valuetype>
  <fieldname/>
  <variablename>${PRD_ID}</variablename>
  <fieldtype>string</fieldtype>
  <mask/>
  <comparevalue>^[0-9]{8}$</comparevalue>
  <minvalue/>
  <maxvalue/>
  <successcondition>regexp</successcondition>
  <successnumbercondition>equal</successnumbercondition>
  <successbooleancondition>false</successbooleancondition>
  <successwhenvarset>N</successwhenvarset>
  <parallel>N</parallel>
  <draw>Y</draw>
  <nr>0</nr>
  <xloc>200</xloc>
  <yloc>96</yloc>
  <attributes_kjc/>
</entry>
```

## 1. XML Template — Number

```xml
<entry>
  <name>CHECK_COUNT</name>
  <description/>
  <type>SIMPLE_EVAL</type>
  <attributes/>
  <valuetype>variable</valuetype>
  <fieldname/>
  <variablename>${RUNNING_RUN_COUNT}</variablename>
  <fieldtype>number</fieldtype>
  <mask/>
  <comparevalue>0</comparevalue>
  <minvalue/>
  <maxvalue/>
  <successcondition>equal</successcondition>
  <successnumbercondition>equal</successnumbercondition>
  <successbooleancondition>false</successbooleancondition>
  <successwhenvarset>N</successwhenvarset>
  <parallel>N</parallel>
  <draw>Y</draw>
  <nr>0</nr>
  <xloc>200</xloc>
  <yloc>96</yloc>
  <attributes_kjc/>
</entry>
```

## 2. Config Fields

| Field XML | Bắt buộc | Giá trị / Cách điền |
|-----------|----------|---------------------|
| `<valuetype>` | Y | `variable`, `field` (đúng thứ tự mảng `valueTypeCode`) |
| `<fieldname>` | N | Tên field (khi valuetype=field); để trống khi dùng variable |
| `<variablename>` | Y (khi valuetype=variable) | `${VAR_NAME}` |
| `<fieldtype>` | Y | `string`, `number`, `datetime`, `boolean` (mảng `fieldTypeCode` — KHÔNG phải `date_time`) |
| `<mask>` | N | Mask convert (date/number); thường trống |
| `<comparevalue>` | Y | Giá trị so sánh |
| `<minvalue>` / `<maxvalue>` | N | Cận dưới/trên khi condition `between` |
| `<successcondition>` | Y (string) | `equal`, `different`, `contains`, `notcontains`, `startswith`, `notstatwith` (đúng typo source), `endswith`, `notendwith`, `regexp`, `inlist`, `notinlist` — KHÔNG gạch dưới |
| `<successnumbercondition>` | Y (number) | `equal`, `different`, `smaller`, `smallequal`, `greater`, `greaterequal`, `between`, `inlist`, `notinlist` — KHÔNG gạch dưới |
| `<successbooleancondition>` | Y (boolean) | `true`, `false` |
| `<successwhenvarset>` | N | `Y`/`N` — success khi variable được set (bất kể giá trị) |

## 3. YAML → XML Mapping

| YAML | XML | Ghi chú |
|------|-----|---------|
| `type: SIMPLE_EVAL` | `<type>SIMPLE_EVAL</type>` | |
| `config.variable` | `<variablename>` | Bao gồm `${...}` |
| `config.field_type` | `<fieldtype>` | |
| `config.compare_value` | `<comparevalue>` | |
| `config.condition` | `<successcondition>` hoặc `<successnumbercondition>` | Tùy fieldtype |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`engine/src/main/java/org/pentaho/di/job/entries/simpleeval/JobEntrySimpleEval.java :: getXML()`
+ mảng code `valueTypeCode`, `fieldTypeCode`, `successConditionCode`,
`successNumberConditionCode`, `successBooleanConditionCode`.

`getXML()` = `super.getXML()` + đúng thứ tự 12 node: `valuetype`,
`fieldname`, `variablename`, `fieldtype`, `mask`, `comparevalue`,
`minvalue`, `maxvalue`, `successcondition`, `successnumbercondition`,
`successbooleancondition`, `successwhenvarset`. Spoon LUÔN ghi đủ 12
node (template cũ thiếu `fieldname`/`mask`/`minvalue`/`maxvalue` và các
node success* không dùng).

Nguồn ví dụ: `job_ftp_cd_thucap/job_ftp_cd_thucap_daily.kjb:1225-1269` (legacy).

## 5. Lưu ý / bẫy

- Cả hai nhánh success/failure đều phải có hop với `evaluation` đúng.
- Missing variable → cần explicit rule (không tự assume empty).
- **Bẫy code string không gạch dưới**: `regexp` (không phải `regex`), `startswith`/`notstatwith`/`endswith`/`notendwith` (không gạch dưới), `smallequal`/`greaterequal` (không gạch dưới), `datetime` (không phải `date_time`). Ghi sai → `loadXML` map về default, điều kiện đánh giá sai âm thầm.

## Production Example

Trích từ file production: `etl_job_engine_tckt_ftp_tt2_daily.kjb`

```xml
<entry>
  <name>Check all table not empty</name>
  <description/>
  <type>SIMPLE_EVAL</type>
  <attributes/>
  <valuetype>variable</valuetype>
  <fieldname/>
  <variablename>${IS_EMPTY_TABLE}</variablename>
  <fieldtype>number</fieldtype>
  <mask/>
  <comparevalue>0</comparevalue>
  <minvalue/>
  <maxvalue/>
  <successcondition>equal</successcondition>
  <successnumbercondition>equal</successnumbercondition>
  <successbooleancondition>false</successbooleancondition>
  <successwhenvarset>N</successwhenvarset>
  <parallel>N</parallel>
  <draw>Y</draw>
  <nr>0</nr>
  <xloc>1536</xloc>
  <yloc>256</yloc>
  <attributes_kjc/>
</entry>
```
