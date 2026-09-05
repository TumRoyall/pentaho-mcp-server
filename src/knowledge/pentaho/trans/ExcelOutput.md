# ExcelOutput — Step xuất file Excel

## 1. XML Template

```xml
<step>
  <name>EXPORT_EXCEL</name>
  <type>ExcelOutput</type>
  <description/>
  <distribute>Y</distribute>
  <custom_distribution/>
  <copies>1</copies>
  <partitioning>
    <method>none</method>
    <schema_name/>
  </partitioning>
  <header>Y</header>
  <footer>N</footer>
  <encoding>UTF-8</encoding>
  <append>N</append>
  <add_to_result_filenames>Y</add_to_result_filenames>
  <file>
    <name>${EXPORT_DIR}/report</name>
    <extention>xls</extention>
    <do_not_open_newfile_init>N</do_not_open_newfile_init>
    <create_parent_folder>Y</create_parent_folder>
    <split>N</split>
    <add_date>N</add_date>
    <add_time>N</add_time>
    <SpecifyFormat>N</SpecifyFormat>
    <date_time_format/>
    <sheetname>Data</sheetname>
    <autosizecolums>N</autosizecolums>
    <nullisblank>N</nullisblank>
    <protect_sheet>N</protect_sheet>
    <password>${EXCEL_PASSWORD}</password>
    <splitevery>0</splitevery>
    <usetempfiles>N</usetempfiles>
    <tempdirectory/>
  </file>
  <template>
    <enabled>N</enabled>
    <append>N</append>
    <filename/>
  </template>
  <fields>
    <field>
      <name>FIELD_NAME</name>
      <type>String</type>
      <format/>
    </field>
  </fields>
  <custom>
    <header_font_name>times</header_font_name>
    <header_font_size>10</header_font_size>
    <header_font_bold>N</header_font_bold>
    <header_font_italic>N</header_font_italic>
    <header_font_underline>no</header_font_underline>
    <header_font_orientation>horizontal</header_font_orientation>
    <header_font_color>black</header_font_color>
    <header_background_color>none</header_background_color>
    <header_row_height>255</header_row_height>
    <header_alignment>left</header_alignment>
    <header_image/>
    <row_font_name>times</row_font_name>
    <row_font_size>10</row_font_size>
    <row_font_color>black</row_font_color>
    <row_background_color>none</row_background_color>
  </custom>
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
| `<file>/<name>` | Y | Output path — variable |
| `<file>/<extention>` | Y | `xls` (đúng chính tả này) |
| `<file>/<sheetname>` | Y | Sheet name |
| `<file>/<do_not_open_newfile_init>` | N | Chú ý: `newfile` liền, không phải `new_file_init` |
| `<file>/<password>` | N | Mật khẩu protect sheet — dùng `${VAR}` |
| `<template>/<enabled>` + `<append>` + `<filename>` | N | Template Excel; đúng thứ tự này |
| `<header>` | N | `Y` = có header row |
| `<fields>/<field>` | Y | Mỗi field chỉ 3 node: `name`, `type`, `format` |
| `<custom>` | N | Định dạng font/màu header + row; giữ default |

## 3. YAML → XML Mapping

| YAML | XML | Ghi chú |
|------|-----|---------|
| `type: EXCEL_OUTPUT` | `<type>ExcelOutput</type>` | |
| `config.output_path` | `<file>/<name>` | |
| `config.sheet_name` | `<file>/<sheetname>` | |
| `config.fields[]` | `<fields>/<field>` | Mỗi field: name/type/format |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`plugins/excel/core/src/main/java/org/pentaho/di/trans/steps/exceloutput/ExcelOutputMeta.java :: getXML()`.

`getXML()` ghi đúng thứ tự: `header`, `footer`, `encoding`, `append`,
`add_to_result_filenames`, khối `<file>` (17 node: `name`,
`extention`, `do_not_open_newfile_init`, `create_parent_folder`,
`split`, `add_date`, `add_time`, `SpecifyFormat`, `date_time_format`,
`sheetname`, `autosizecolums`, `nullisblank`, `protect_sheet`,
`password`, `splitevery`, `usetempfiles`, `tempdirectory`), khối
`<template>` (`enabled`, `append`, `filename`), khối `<fields>` (mỗi
`<field>` chỉ 3 node), rồi khối `<custom>` (font header + row).

Ví dụ production: `etl_trans_ftp_dieuchinh_export_file.ktr`, step "Microsoft Excel output".

## 5. Lưu ý / bẫy

- `ExcelOutput` sinh `.xls` (legacy) — cần `.xlsx` thì verify plugin khác.
- File path dùng variable.
- **Bẫy tên node (đã đối chiếu source)**: `do_not_open_newfile_init`
  (`newfile` liền), `extention` (thiếu `s`), `autosizecolums` (thiếu `n`),
  `SpecifyFormat` (S hoa). Sai một ký tự → Spoon bỏ qua node.

## Production Example

Trích từ file production: `etl_trans_ftp_dieuchinh_export_file.ktr`

```xml
<step>
  <name>Microsoft Excel output</name>
  <type>ExcelOutput</type>
  <description/>
  <distribute>Y</distribute>
  <custom_distribution/>
  <copies>1</copies>
  <partitioning>
    <method>none</method>
    <schema_name/>
  </partitioning>
  <header>Y</header>
  <footer>N</footer>
  <encoding>UTF-8</encoding>
  <append>N</append>
  <add_to_result_filenames>Y</add_to_result_filenames>
  <file>
    <name>${EXPORT_DIR}/VN0010001.${PRD_ID}.FTPDC</name>
    <extention>xls</extention>
    <do_not_open_newfile_init>N</do_not_open_newfile_init>
    <create_parent_folder>N</create_parent_folder>
    <split>N</split>
    <add_date>N</add_date>
    <add_time>N</add_time>
    <SpecifyFormat>N</SpecifyFormat>
    <date_time_format>MM/dd/yyyy HH:mm:ss</date_time_format>
    <sheetname>Sheet1</sheetname>
    <autosizecolums>N</autosizecolums>
    <nullisblank>N</nullisblank>
    <protect_sheet>N</protect_sheet>
    <password>Encrypted </password>
    <splitevery>5000</splitevery>
    <usetempfiles>N</usetempfiles>
    <tempdirectory/>
  </file>
  <template>
    <enabled>N</enabled>
    <append>N</append>
    <filename>template.xls</filename>
  </template>
  <fields>
    <field>
      <name>DEBIT.ACCT.NO</name>
      <type>String</type>
      <format/>
    </field>
    <field>
      <name>DEBIT.CURRENCY</name>
      <type>String</type>
      <format/>
    </field>
    <field>
      <name>DEBIT.AMOUNT</name>
      <type>Number</type>
      <format>#</format>
    </field>
    <field>
      <name>CREDIT.VALUE.DATE</name>
      <type>String</type>
      <format/>
    </field>
    <field>
      <name>CREDIT.ACCT.NO</name>
      <type>String</type>
      <format/>
    </field>
    <field>
      <name>PAYMENT.DETAILS-1</name>
      <type>String</type>
      <format/>
    </field>
    <field>
      <name>PAYMENT.DETAILS-2</name>
      <type>String</type>
      <format/>
    </field>
    <field>
      <name>PAYMENT.DETAILS-3</name>
      <type>String</type>
      <format/>
    </field>
    <field>
      <name>PAYMENT.DETAILS-4</name>
      <type>String</type>
      <format/>
    </field>
    <field>
      <name>CREDIT.CURRENCY</name>
      <type>String</type>
      <format/>
    </field>
    <field>
      <name>COMMISSION.CODE</name>
      <type>String</type>
      <format/>
    </field>
    <field>
      <name>CHARGE.CODE</name>
      <type>String</type>
      <format/>
    </field>
    <field>
      <name>COMMISSION.TYPE</name>
      <type>String</type>
      <format/>
    </field>
    <field>
      <name>CHARGES.ACCT.NO</name>
      <type>String</type>
      <format/>
    </field>
    <field>
      <name>PROFIT.CENTRE.DEPT</name>
      <type>String</type>
      <format/>
    </field>
    <field>
      <name>TXN.PURPOSE</name>
      <type>Number</type>
      <format>#</format>
    </field>
    <field>
      <name>MB.PAY.METHOD</name>
      <type>Number</type>
      <format>#</format>
    </field>
    <field>
      <name>ORDERING.BANK</name>
      <type>String</type>
      <format/>
    </field>
    <field>
      <name>CO.CODE</name>
      <type>String</type>
      <format/>
    </field>
    <field>
      <name>PROFIT.CENTRE.CUST</name>
      <type>String</type>
      <format/>
    </field>
  </fields>
  <custom>
    <header_font_name>times</header_font_name>
    <header_font_size>10</header_font_size>
    <header_font_bold>N</header_font_bold>
    <header_font_italic>N</header_font_italic>
    <header_font_underline>no</header_font_underline>
    <header_font_orientation>horizontal</header_font_orientation>
    <header_font_color>black</header_font_color>
    <header_background_color>none</header_background_color>
    <header_row_height>255</header_row_height>
    <header_alignment>left</header_alignment>
    <header_image/>
    <row_font_name>times</row_font_name>
    <row_font_size>10</row_font_size>
    <row_font_color>black</row_font_color>
    <row_background_color>none</row_background_color>
  </custom>
  <attributes/>
  <cluster_schema/>
  <remotesteps>
    <input>
      </input>
    <output>
      </output>
  </remotesteps>
  <GUI>
    <xloc>416</xloc>
    <yloc>448</yloc>
    <draw>Y</draw>
  </GUI>
</step>
```
