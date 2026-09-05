# Sequence — Step sinh số tuần tự (Add sequence)

Gán số tuần tự vào field mới, dùng counter nội bộ hoặc sequence trong database.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>Sequence</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <valuename>{{OUTPUT_FIELD}}</valuename>
    <use_database>N</use_database>
    <connection/>
    <schema/>
    <seqname>SEQ_</seqname>
    <use_counter>Y</use_counter>
    <counter_name/>
    <start_at>1</start_at>
    <increment_by>1</increment_by>
    <max_value>999999999</max_value>
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
| `<valuename>` | Y | Tên field output chứa số tuần tự. `setDefault`=`valuename`. |
| `<use_database>` | Y | `N`=counter nội bộ, `Y`=DB sequence. `setDefault`=N. |
| `<connection>` | N | Tên connection (chỉ khi `use_database=Y`). |
| `<schema>` | N | Schema chứa sequence (chỉ khi DB). |
| `<seqname>` | N | Tên sequence DB. `setDefault`=`SEQ_`. |
| `<use_counter>` | Y | `Y`=dùng counter nội bộ. `setDefault`=Y. |
| `<counter_name>` | N | Tên counter chia sẻ (nếu cần dùng chung). |
| `<start_at>` | Y | Giá trị bắt đầu. `setDefault`=`1`. |
| `<increment_by>` | Y | Bước tăng. `setDefault`=`1`. |
| `<max_value>` | Y | Giá trị tối đa trước khi quay vòng. `setDefault`=`999999999`. |

## 3. YAML→XML Mapping

| YAML | XML | Ghi chú |
|---|---|---|
| `type: SEQUENCE` | `<type>` | `Sequence`. |
| `configuration.value_name` | `<valuename>` | |
| `configuration.use_database` | `<use_database>` | true→Y. |
| `configuration.connection` | `<connection>` | Chỉ khi DB. |
| `configuration.schema` | `<schema>` | |
| `configuration.sequence_name` | `<seqname>` | |
| `configuration.use_counter` | `<use_counter>` | |
| `configuration.start_at` | `<start_at>` | |
| `configuration.increment_by` | `<increment_by>` | |
| `configuration.max_value` | `<max_value>` | |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/addsequence/AddSequenceMeta.java :: getXML()`.

- `getXML()` ghi lần lượt (flat, không list): `valuename`, `use_database`, `connection` (= tên DatabaseMeta hoặc rỗng), `schema`, `seqname`, `use_counter`, `counter_name`, `start_at`, `increment_by`, `max_value`.
- `setDefault()`: `valuename=valuename`, `use_database=false`, `schema=""`, `seqname=SEQ_`, `use_counter=true`, `start_at=1`, `increment_by=1`, `max_value=999999999`.

## 5. Lưu ý / bẫy

- Counter nội bộ (`use_counter=Y`) reset mỗi lần chạy; muốn liên tục qua nhiều lần chạy phải dùng DB sequence (`use_database=Y` + `connection`/`seqname`).
- Khi chạy nhiều copy song song, counter nội bộ có thể trùng — cân nhắc `counter_name` (counter chia sẻ) hoặc DB sequence.
- `<connection>` là THAM CHIẾU tên DB connection; khi dùng DB sequence, generator set qua `set_field` và đảm bảo connection tồn tại trong artifact.
- Field output luôn kiểu Integer.
