# TypeExitExcelWriterStep — Step ghi Excel 2007+ (Excel Writer)

Ghi dữ liệu ra file Excel (.xlsx), hỗ trợ template, chọn sheet, append, style theo field.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>TypeExitExcelWriterStep</type>
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
    <makeSheetActive>Y</makeSheetActive>
    <startingCell>A1</startingCell>
    <appendOmitHeader>N</appendOmitHeader>
    <appendOffset>0</appendOffset>
    <appendEmpty>0</appendEmpty>
    <rowWritingMethod>overwrite</rowWritingMethod>
    <forceFormulaRecalculation>N</forceFormulaRecalculation>
    <leaveExistingStylesUnchanged>N</leaveExistingStylesUnchanged>
    <appendLines>N</appendLines>
    <add_to_result_filenames>Y</add_to_result_filenames>
    <file>
      <name>{{FILE_PATH}}</name>
      <extention>xlsx</extention>
      <do_not_open_newfile_init>N</do_not_open_newfile_init>
      <split>N</split>
      <add_date>N</add_date>
      <add_time>N</add_time>
      <SpecifyFormat>N</SpecifyFormat>
      <date_time_format/>
      <sheetname>{{SHEET_NAME}}</sheetname>
      <autosizecolums>N</autosizecolums>
      <stream_data>N</stream_data>
      <protect_sheet>N</protect_sheet>
      <password/>
      <protected_by/>
      <splitevery>0</splitevery>
      <if_file_exists>new</if_file_exists>
      <if_sheet_exists>new</if_sheet_exists>
    </file>
    <template>
      <enabled>N</enabled>
      <sheet_enabled>N</sheet_enabled>
      <filename>template.xls</filename>
      <sheetname/>
      <hidden>N</hidden>
    </template>
    <fields>
      <field>
        <name>{{FIELD_NAME}}</name>
        <type>String</type>
        <format/>
        <title>{{COLUMN_TITLE}}</title>
        <titleStyleCell/>
        <styleCell/>
        <commentField/>
        <commentAuthorField/>
        <formula>N</formula>
        <hyperlinkField/>
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
| `<header>` | N | `setDefault`=Y. Ghi dòng tiêu đề cột. |
| `<footer>` | N | `setDefault`=N. |
| `<makeSheetActive>` | N | `setDefault`=Y. Đặt sheet vừa ghi thành active. |
| `<startingCell>` | N | `setDefault`=`A1`. Ô bắt đầu ghi. |
| `<appendOmitHeader>` | N | Bỏ header khi append. |
| `<appendOffset>` / `<appendEmpty>` | N | Dòng offset/số dòng trống khi append. |
| `<rowWritingMethod>` | N | `overwrite` (ghi đè) hoặc `push` (đẩy xuống). `setDefault`=`overwrite`. |
| `<forceFormulaRecalculation>` | N | Buộc Excel tính lại công thức khi mở. |
| `<leaveExistingStylesUnchanged>` | N | Giữ style sẵn có. |
| `<appendLines>` | N | Nối vào sheet hiện có thay vì ghi đè. |
| `<add_to_result_filenames>` | N | `setDefault`=Y. Thêm file vào result filenames. |
| `<file>/<name>` | Y | Đường dẫn file (KHÔNG kèm đuôi). |
| `<file>/<extention>` | N | Đuôi file; `setDefault`=`xls`, dùng `xlsx` cho Excel 2007+. LƯU Ý node ghi sai chính tả là `extention`. |
| `<file>/<sheetname>` | N | `setDefault`=`Sheet1`. Sheet ghi vào. |
| `<file>/<if_file_exists>` | N | `new` (tạo file mới) hoặc `reuse`. `setDefault`=`new`. |
| `<file>/<if_sheet_exists>` | N | `new` hoặc `reuse`. `setDefault`=`new`. |
| `<file>/<protect_sheet>` / `<password>` | N | Bảo vệ sheet; password nếu dùng đặt bằng `${VAR}`. |
| `<file>/<splitevery>` | N | Tách file sau N dòng; `0`=không tách. |
| `<template>/<enabled>` | N | `Y`=dùng file template Excel làm khung. |
| `<template>/<filename>` | N | Đường dẫn template; `setDefault`=`template.xls`. |
| `<fields>/<field>` | N | Danh sách cột xuất. Trống = ghi toàn bộ stream. |

### Node con của mỗi `<field>`
`name` (field nguồn), `type` (value-meta desc: `String`, `Number`, `Integer`, `Date`, `Boolean`...), `format` (mask), `title` (tiêu đề cột), `titleStyleCell`, `styleCell` (ô tham chiếu style từ template), `commentField`, `commentAuthorField`, `formula` (Y/N), `hyperlinkField`.

## 3. YAML→XML Mapping

| YAML | XML | Ghi chú |
|---|---|---|
| `type: EXCEL_WRITER` | `<type>` | `TypeExitExcelWriterStep`. |
| `configuration.file` | `<file>/<name>` | Không kèm đuôi. |
| `configuration.extension` | `<file>/<extention>` | `xlsx`. |
| `configuration.sheet_name` | `<file>/<sheetname>` | |
| `configuration.if_file_exists` | `<file>/<if_file_exists>` | `new`/`reuse`. |
| `configuration.if_sheet_exists` | `<file>/<if_sheet_exists>` | `new`/`reuse`. |
| `configuration.header` | `<header>` | Y/N. |
| `configuration.template.enabled` | `<template>/<enabled>` | Y/N. |
| `configuration.template.filename` | `<template>/<filename>` | |
| `configuration.fields[].name` | `<fields>/<field>/<name>` | |
| `configuration.fields[].type` | `<fields>/<field>/<type>` | |
| `configuration.fields[].title` | `<fields>/<field>/<title>` | |
| `configuration.fields[].format` | `<fields>/<field>/<format>` | |

Fill `<fields>` bằng `set_fields` (listTag=`fields`, itemTag=`field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `plugins/excel/core/src/main/java/org/pentaho/di/trans/steps/excelwriter/ExcelWriterStepMeta.java :: getXML()` (+ `ExcelWriterStepField.java` cho item `<field>`).

- `getXML()` ghi lần lượt các node cấp step: `header`, `footer`, `makeSheetActive`, `startingCell`, `appendOmitHeader`, `appendOffset`, `appendEmpty`, `rowWritingMethod`, `forceFormulaRecalculation`, `leaveExistingStylesUnchanged`, `appendLines`, `add_to_result_filenames`.
- Block `<file>`: `name`, `extention`, `do_not_open_newfile_init`, `split`, `add_date`, `add_time`, `SpecifyFormat`, `date_time_format`, `sheetname`, `autosizecolums`, `stream_data`, `protect_sheet`, `password` (= `Encr.encryptPasswordIfNotUsingVariables`), `protected_by`, `splitevery`, `if_file_exists`, `if_sheet_exists`.
- Block `<template>`: `enabled`, `sheet_enabled`, `filename`, `sheetname`, `hidden`.
- Block `<fields>`: chỉ ghi field có `name` khác rỗng; mỗi `<field>` gồm `name`, `type` (`getTypeDesc()`), `format`, `title`, `titleStyleCell`, `styleCell`, `commentField`, `commentAuthorField`, `formula`, `hyperlinkField`.
- Giá trị mặc định lấy từ `setDefault()`: `header=Y`, `sheetname=Sheet1`, `startingCell=A1`, `extension=xls`, `if_file_exists=new`, `if_sheet_exists=new`, `rowWritingMethod=overwrite`, `add_to_result_filenames=Y`, các cờ còn lại `N`.
- Hằng chuỗi: `IF_FILE_EXISTS_CREATE_NEW="new"`, `IF_SHEET_EXISTS_CREATE_NEW="new"`, `ROW_WRITE_OVERWRITE="overwrite"`, `ROW_WRITE_PUSH_DOWN="push"`.

## 5. Lưu ý / bẫy

- Node đuôi file ghi SAI CHÍNH TẢ trong source là `<extention>` (không phải `extension`). Phải dùng đúng `extention`.
- `<password>`: source mã hoá bằng `Encr.encryptPasswordIfNotUsingVariables`. Nếu dùng biến `${VAR}` thì để nguyên (không mã hoá); template mặc định để rỗng — KHÔNG nhét password thật.
- `extension` mặc định của source là `xls`; với Excel 2007+ phải đặt `xlsx`.
- `<file>/<name>` KHÔNG kèm đuôi — đuôi lấy từ `<extention>`.
- `<fields>` trống = ghi toàn bộ field của stream; điền field khi cần đặt tiêu đề/kiểu/format/style cụ thể.
- Đây là step Excel 2007+ (xlsx), khác `ExcelOutput` cũ (.xls).
- List `<field>` nằm trong tag bao `<fields>` → fill bằng `set_fields`.
