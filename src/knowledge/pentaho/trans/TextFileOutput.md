# TextFileOutput — Step xuất file CSV/text

## 1. XML Template

```xml
<step>
  <name>EXPORT_CSV</name>
  <type>TextFileOutput</type>
  <description/>
  <distribute>Y</distribute>
  <custom_distribution/>
  <copies>1</copies>
  <partitioning>
    <method>none</method>
    <schema_name/>
  </partitioning>
  <separator>,</separator>
  <enclosure>"</enclosure>
  <enclosure_forced>N</enclosure_forced>
  <enclosure_fix_disabled>N</enclosure_fix_disabled>
  <header>Y</header>
  <footer>N</footer>
  <format>DOS</format>
  <compression>None</compression>
  <encoding>UTF-8</encoding>
  <endedLine/>
  <fileNameInField>N</fileNameInField>
  <fileNameField/>
  <create_parent_folder>Y</create_parent_folder>
  <file>
    <name>${EXPORT_DIR}/export_file</name>
    <servlet_output>N</servlet_output>
    <do_not_open_new_file_init>N</do_not_open_new_file_init>
    <extention>csv</extention>
    <append>N</append>
    <split>N</split>
    <haspartno>N</haspartno>
    <add_date>N</add_date>
    <add_time>N</add_time>
    <SpecifyFormat>N</SpecifyFormat>
    <date_time_format/>
    <add_to_result_filenames>Y</add_to_result_filenames>
    <pad>N</pad>
    <fast_dump>N</fast_dump>
    <splitevery>0</splitevery>
  </file>
  <fields>
    <field>
      <name>FIELD_NAME</name>
      <type>String</type>
      <format/>
      <currency/>
      <decimal/>
      <group/>
      <nullif/>
      <trim_type>none</trim_type>
      <length>-1</length>
      <precision>-1</precision>
    </field>
  </fields>
  <attributes/>
  <cluster_schema/>
  <remotesteps>
    <input/>
    <output/>
  </remotesteps>
  <GUI>
    <xloc>500</xloc>
    <yloc>100</yloc>
    <draw>Y</draw>
  </GUI>
</step>
```

## 2. Config Fields

| Field XML | Bắt buộc | Giá trị / Cách điền |
|-----------|----------|---------------------|
| `<separator>` | Y | Delimiter (`,`, `\t`, `|`) |
| `<enclosure>` | Y | Text qualifier (`"`) |
| `<header>` | Y | `Y` = có header row |
| `<format>` | Y | `DOS` (CRLF) hoặc `UNIX` (LF) |
| `<encoding>` | Y | `UTF-8` |
| `<file>/<name>` | Y | Output path — dùng variable |
| `<file>/<extention>` | Y | Extension (`csv`, `txt`) |
| `<file>/<add_to_result_filenames>` | N | `Y` nếu downstream cần file |
| `<fields>/<field>` | Y | Ordered output fields |

## 3. YAML → XML Mapping

| YAML | XML | Ghi chú |
|------|-----|---------|
| `type: TEXT_FILE_OUTPUT` | `<type>TextFileOutput</type>` | |
| `config.separator` | `<separator>` | |
| `config.output_path` | `<file>/<name>` | Variable-backed |
| `config.extension` | `<file>/<extention>` | |
| `config.fields[]` | `<fields>/<field>` | Order = column order |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`engine/src/main/java/org/pentaho/di/trans/steps/textfileoutput/TextFileOutputMeta.java :: getXML()`.

`getXML()` ghi đúng thứ tự: `separator`, `enclosure`,
`enclosure_forced`, `enclosure_fix_disabled`, `header`, `footer`,
`format`, `compression`, `encoding`, `endedLine`, `fileNameInField`,
`fileNameField`, `create_parent_folder`, khối `<file>` (`saveSource` →
`<name>` rồi `servlet_output`, `do_not_open_new_file_init`,
`extention` (đúng chính tả này), `append`, `split`, `haspartno`,
`add_date`, `add_time`, `SpecifyFormat` (S hoa), `date_time_format`,
`add_to_result_filenames`, `pad`, `fast_dump`, `splitevery`), rồi khối
`<fields>` (mỗi `<field>` 10 node: `name`, `type` chuỗi ValueMetaName,
`format`, `currency`, `decimal`, `group`, `nullif`, `trim_type`,
`length`, `precision`).

Ví dụ production: `etl_trans_ftp_dieuchinh_export_file.ktr`, step "Text file output".

## 5. Lưu ý / bẫy

- Output path PHẢI dùng variable — không hardcode.
- Field order quyết định thứ tự cột trong file.
- `add_to_result_filenames=Y` khi SFTP/mail sau đó.

## Production Example

Trích từ file production: `etl_trans_ftp_dieuchinh_export_file.ktr`

```xml
<step>
  <name>Text file output</name>
  <type>TextFileOutput</type>
  <description/>
  <distribute>Y</distribute>
  <custom_distribution/>
  <copies>1</copies>
  <partitioning>
    <method>none</method>
    <schema_name/>
  </partitioning>
  <separator>,</separator>
  <enclosure>"</enclosure>
  <enclosure_forced>N</enclosure_forced>
  <enclosure_fix_disabled>N</enclosure_fix_disabled>
  <header>Y</header>
  <footer>N</footer>
  <format>DOS</format>
  <compression>None</compression>
  <encoding>UTF-8</encoding>
  <endedLine/>
  <fileNameInField>Y</fileNameInField>
  <fileNameField>FILENAME</fileNameField>
  <create_parent_folder>Y</create_parent_folder>
  <file>
    <name>E:/FTPHachtoanTudong/${PRD_ID}/VN0010001.${PRD_ID}.FTPDC</name>
    <servlet_output>N</servlet_output>
    <do_not_open_new_file_init>Y</do_not_open_new_file_init>
    <extention>csv</extention>
    <append>N</append>
    <split>N</split>
    <haspartno>N</haspartno>
    <add_date>N</add_date>
    <add_time>N</add_time>
    <SpecifyFormat>N</SpecifyFormat>
    <date_time_format/>
    <add_to_result_filenames>Y</add_to_result_filenames>
    <pad>N</pad>
    <fast_dump>N</fast_dump>
    <splitevery>0</splitevery>
  </file>
  <fields>
    <field>
      <name>DEBIT.ACCT.NO</name>
      <type>String</type>
      <format/>
      <currency/>
      <decimal/>
      <group/>
      <nullif/>
      <trim_type>both</trim_type>
      <length>-1</length>
      <precision>-1</precision>
    </field>
    <field>
      <name>DEBIT.CURRENCY</name>
      <type>String</type>
      <format/>
      <currency/>
      <decimal/>
      <group/>
      <nullif/>
      <trim_type>both</trim_type>
      <length>-1</length>
      <precision>-1</precision>
    </field>
    <field>
      <name>DEBIT.AMOUNT</name>
      <type>Number</type>
      <format>0.#####</format>
      <currency/>
      <decimal>.</decimal>
      <group/>
      <nullif/>
      <trim_type>both</trim_type>
      <length>-1</length>
      <precision>-1</precision>
    </field>
    <field>
      <name>CREDIT.VALUE.DATE</name>
      <type>String</type>
      <format/>
      <currency/>
      <decimal/>
      <group/>
      <nullif/>
      <trim_type>both</trim_type>
      <length>-1</length>
      <precision>-1</precision>
    </field>
    <field>
      <name>CREDIT.ACCT.NO</name>
      <type>String</type>
      <format/>
      <currency/>
      <decimal/>
      <group/>
      <nullif/>
      <trim_type>both</trim_type>
      <length>-1</length>
      <precision>-1</precision>
    </field>
    <field>
      <name>PAYMENT.DETAILS-1</name>
      <type>String</type>
      <format/>
      <currency/>
      <decimal/>
      <group/>
      <nullif/>
      <trim_type>both</trim_type>
      <length>-1</length>
      <precision>-1</precision>
    </field>
    <field>
      <name>PAYMENT.DETAILS-2</name>
      <type>String</type>
      <format/>
      <currency/>
      <decimal/>
      <group/>
      <nullif/>
      <trim_type>both</trim_type>
      <length>-1</length>
      <precision>-1</precision>
    </field>
    <field>
      <name>PAYMENT.DETAILS-3</name>
      <type>String</type>
      <format/>
      <currency/>
      <decimal/>
      <group/>
      <nullif/>
      <trim_type>both</trim_type>
      <length>-1</length>
      <precision>-1</precision>
    </field>
    <field>
      <name>PAYMENT.DETAILS-4</name>
      <type>String</type>
      <format/>
      <currency/>
      <decimal/>
      <group/>
      <nullif/>
      <trim_type>both</trim_type>
      <length>-1</length>
      <precision>-1</precision>
    </field>
    <field>
      <name>CREDIT.CURRENCY</name>
      <type>String</type>
      <format/>
      <currency/>
      <decimal/>
      <group/>
      <nullif/>
      <trim_type>both</trim_type>
      <length>-1</length>
      <precision>-1</precision>
    </field>
    <field>
      <name>COMMISSION.CODE</name>
      <type>String</type>
      <format/>
      <currency/>
      <decimal/>
      <group/>
      <nullif/>
      <trim_type>both</trim_type>
      <length>-1</length>
      <precision>-1</precision>
    </field>
    <field>
      <name>CHARGE.CODE</name>
      <type>String</type>
      <format/>
      <currency/>
      <decimal/>
      <group/>
      <nullif/>
      <trim_type>both</trim_type>
      <length>-1</length>
      <precision>-1</precision>
    </field>
    <field>
      <name>COMMISSION.TYPE</name>
      <type>String</type>
      <format/>
      <currency/>
      <decimal/>
      <group/>
      <nullif/>
      <trim_type>both</trim_type>
      <length>-1</length>
      <precision>-1</precision>
    </field>
    <field>
      <name>CHARGES.ACCT.NO</name>
      <type>String</type>
      <format/>
      <currency/>
      <decimal/>
      <group/>
      <nullif/>
      <trim_type>both</trim_type>
      <length>-1</length>
      <precision>-1</precision>
    </field>
    <field>
      <name>PROFIT.CENTRE.DEPT</name>
      <type>String</type>
      <format/>
      <currency/>
      <decimal/>
      <group/>
      <nullif/>
      <trim_type>both</trim_type>
      <length>-1</length>
      <precision>-1</precision>
    </field>
    <field>
      <name>TXN.PURPOSE</name>
      <type>Number</type>
      <format>0.#####</format>
      <currency/>
      <decimal>.</decimal>
      <group/>
      <nullif/>
      <trim_type>both</trim_type>
      <length>-1</length>
      <precision>-1</precision>
    </field>
    <field>
      <name>MB.PAY.METHOD</name>
      <type>Number</type>
      <format>0.#####</format>
      <currency/>
      <decimal>.</decimal>
      <group/>
      <nullif/>
      <trim_type>both</trim_type>
      <length>-1</length>
      <precision>-1</precision>
    </field>
    <field>
      <name>ORDERING.BANK</name>
      <type>String</type>
      <format/>
      <currency/>
      <decimal/>
      <group/>
      <nullif/>
      <trim_type>both</trim_type>
      <length>-1</length>
      <precision>-1</precision>
    </field>
    <field>
      <name>CO.CODE</name>
      <type>String</type>
      <format/>
      <currency/>
      <decimal/>
      <group/>
      <nullif/>
      <trim_type>both</trim_type>
      <length>-1</length>
      <precision>-1</precision>
    </field>
    <field>
      <name>PROFIT.CENTRE.CUST</name>
      <type>String</type>
      <format/>
      <currency/>
      <decimal/>
      <group/>
      <nullif/>
      <trim_type>both</trim_type>
      <length>-1</length>
      <precision>-1</precision>
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
    <xloc>672</xloc>
    <yloc>256</yloc>
    <draw>Y</draw>
  </GUI>
</step>
```
