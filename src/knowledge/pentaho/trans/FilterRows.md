# FilterRows — Chia dòng theo điều kiện

## 1. XML Template

```xml
<step>
  <name>{{STEP_NAME}}</name>
  <type>FilterRows</type>
  <description/>
  <distribute>Y</distribute>
  <custom_distribution/>
  <copies>1</copies>
  <partitioning><method>none</method><schema_name/></partitioning>
  <send_true_to>{{TRUE_TARGET_STEP}}</send_true_to>
  <send_false_to>{{FALSE_TARGET_STEP}}</send_false_to>
  <compare>
    <condition>
      <negated>N</negated>
      <leftvalue>{{INPUT_FIELD}}</leftvalue>
      <function>=</function>
      <rightvalue/>
      <value>
        <name>constant</name><type>String</type><text>{{CONSTANT}}</text>
        <length>-1</length><precision>-1</precision><isnull>N</isnull><mask/>
      </value>
    </condition>
  </compare>
  <attributes/>
  <cluster_schema/>
  <remotesteps><input/><output/></remotesteps>
  <GUI><xloc>300</xloc><yloc>100</yloc><draw>Y</draw></GUI>
</step>
```

## 2. Config Fields

| Field XML | Bắt buộc | Ý nghĩa / cách điền |
|---|---|---|
| `<send_true_to>` | N | Tên step đích nhánh true. |
| `<send_false_to>` | N | Tên step đích nhánh false. |
| `<compare>/<condition>` | N | Điều kiện nguyên tử hoặc điều kiện lồng. |
| `<condition>/<operator>` | N | Khi khác `-`, chọn `OR`, `AND`, `XOR`, `OR NOT`, hoặc `AND NOT` (các real operators của `Condition`). Phủ định condition được biểu diễn bằng `<negated>Y</negated>`, không cần operator `NOT` riêng. |
| `<function>` | N | Một trong các chuỗi nguồn: `=`, `<>`, `<`, `<=`, `>`, `>=`, `REGEXP`, `IS NULL`, `IS NOT NULL`, `IN LIST`, `CONTAINS`, `STARTS WITH`, `ENDS WITH`, `LIKE`, `TRUE`. |
| `<leftvalue>`, `<rightvalue>` | N | So sánh field; `rightvalue` là field bên phải. |
| `<value>` | N | Hằng số, gồm `name`, `type`, `text`, `length`, `precision`, `isnull`, `mask`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: FILTER_ROWS` | `<type>` | Ghi `FilterRows`. |
| `configuration.true_target` | `<send_true_to>` | Tham chiếu tên step. |
| `configuration.false_target` | `<send_false_to>` | Tham chiếu tên step. |
| `configuration.condition` | `<compare>/<condition>` | Serialize theo `Condition`. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `engine/src/main/java/org/pentaho/di/trans/steps/filterrows/FilterRowsMeta.java` :: `getXML()`; condition: `core/src/main/java/org/pentaho/di/core/Condition.java` và `core/src/main/java/org/pentaho/di/core/row/ValueMetaAndData.java` :: `getXML()`.

Phần thân luôn ghi `send_true_to`, `send_false_to`, rồi `<compare>`; `Condition` ghi `negated`, tùy chọn `operator`, và condition nguyên tử hoặc `<conditions>` lồng. Theo `Condition.getRealOperators()`, các operator ghép là `OR`, `AND`, `OR NOT`, `AND NOT`, `XOR`; `-` là không có operator và phủ định được ghi bằng `negated=Y`. Ví dụ production đã quan sát so sánh field `FLAG` với hằng `1.0` kiểu `BigNumber` và nhánh true `Set variables`.

## 5. Lưu ý / bẫy

- `send_true_to` và `send_false_to` là tên step/hop; cập nhật cùng graph khi đổi tên step.
- Điều kiện gộp phải dùng `<conditions>` chứa các `<condition>` con, không thêm `<conditions>` vào condition nguyên tử.
- Với hằng số, `ValueMetaAndData` không dùng placeholder làm type; chọn đúng type PDI cho `<text>`.
