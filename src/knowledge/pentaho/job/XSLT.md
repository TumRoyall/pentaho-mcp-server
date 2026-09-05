# XSLT — Job entry biến đổi XML bằng XSLT

Áp dụng file XSL lên file XML để sinh file output.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>XSLT</type>
      <attributes/>
      <xmlfilename>{{XML_FILE}}</xmlfilename>
      <xslfilename>{{XSL_FILE}}</xslfilename>
      <outputfilename>{{OUTPUT_FILE}}</outputfilename>
      <iffileexists>1</iffileexists>
      <addfiletoresult>N</addfiletoresult>
      <filenamesfromprevious>N</filenamesfromprevious>
      <xsltfactory>JAXP</xsltfactory>
      <parameters>
        <parameter>
          <field>{{SOURCE_FIELD}}</field>
          <name>{{PARAM_NAME}}</name>
        </parameter>
      </parameters>
      <outputproperties>
        <outputproperty>
          <name>{{PROP_NAME}}</name>
          <value>{{PROP_VALUE}}</value>
        </outputproperty>
      </outputproperties>
      <parallel>N</parallel>
      <draw>Y</draw>
      <nr>0</nr>
      <xloc>{{X}}</xloc>
      <yloc>{{Y}}</yloc>
      <attributes_kjc/>
    </entry>
```

## 2. Config Fields

| Field XML | Bắt buộc | Ý nghĩa / cách điền |
|---|---|---|
| `<xmlfilename>` | Y | File XML nguồn (khi `filenamesfromprevious=N`). |
| `<xslfilename>` | Y | File XSL biến đổi. |
| `<outputfilename>` | Y | File kết quả. |
| `<iffileexists>` | N | Ứng xử khi output tồn tại: `0`=tạo unique, `1`=xoá & tạo mới, `2`=không làm gì (SỐ). |
| `<addfiletoresult>` | N | Thêm output vào result filenames. |
| `<filenamesfromprevious>` | N | `Y`=lấy tên file từ result entry trước. |
| `<xsltfactory>` | N | Factory XSLT: `JAXP` hoặc `SAXON`. |
| `<parameters>/<parameter>` | N | Tham số truyền vào XSLT: `field` (field nguồn), `name` (tên param). |
| `<outputproperties>/<outputproperty>` | N | Thuộc tính output: `name`, `value`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: XSLT` | `<type>` | `XSLT`. |
| `configuration.xml_file` | `<xmlfilename>` | |
| `configuration.xsl_file` | `<xslfilename>` | |
| `configuration.output_file` | `<outputfilename>` | |
| `configuration.xslt_factory` | `<xsltfactory>` | `JAXP`/`SAXON`. |
| `configuration.parameters[].name` | `<parameters>/<parameter>/<name>` | |
| `configuration.parameters[].field` | `<parameters>/<parameter>/<field>` | |
| `configuration.output_properties[].name` | `<outputproperties>/<outputproperty>/<name>` | |

Fill 2 list bằng `set_fields`: (listTag=`parameters`, itemTag=`parameter`) và
(listTag=`outputproperties`, itemTag=`outputproperty`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `plugins/xml/core/src/main/java/org/pentaho/di/job/entries/xslt/JobEntryXSLT.java :: getXML()`.

- `getXML()` gọi `super.getXML()` rồi ghi: `xmlfilename`, `xslfilename`, `outputfilename`, `iffileexists`, `addfiletoresult`, `filenamesfromprevious`, `xsltfactory`.
- Mở `<parameters>`, lặp ghi `<parameter>` (`field`, `name`), đóng.
- Mở `<outputproperties>`, lặp ghi `<outputproperty>` (`name`, `value`), đóng.

## 5. Lưu ý / bẫy

- `iffileexists` là SỐ (`0`/`1`/`2`), không phải chuỗi.
- Trong `<parameter>`, thứ tự node là `field` TRƯỚC `name` (theo source) — giữ đúng.
- `xsltfactory` phổ biến là `JAXP` (JDK) hoặc `SAXON` (cần thư viện).
- Hai list riêng biệt (`parameters`, `outputproperties`) — fill bằng hai lần `set_fields`.
