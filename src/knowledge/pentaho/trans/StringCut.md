# StringCut — Step cắt chuỗi con theo vị trí

Cắt substring của field theo vị trí bắt đầu/kết thúc, ghi ra field mới hoặc ghi đè.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>StringCut</type>
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
        <in_stream_name>{{INPUT_FIELD}}</in_stream_name>
        <out_stream_name>{{OUTPUT_FIELD}}</out_stream_name>
        <cut_from>{{CUT_FROM}}</cut_from>
        <cut_to>{{CUT_TO}}</cut_to>
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
| `<fields>/<field>` | Y | Mỗi field cần cắt. |
| `<fields>/<field>/<in_stream_name>` | Y | Field đầu vào (chuỗi nguồn). |
| `<fields>/<field>/<out_stream_name>` | N | Field kết quả; bỏ trống = ghi đè lên field đầu vào. |
| `<fields>/<field>/<cut_from>` | Y | Vị trí bắt đầu cắt (0-based). |
| `<fields>/<field>/<cut_to>` | Y | Vị trí kết thúc (exclusive). |

## 3. YAML→XML Mapping

| YAML | XML | Ghi chú |
|---|---|---|
| `type: STRING_CUT` | `<type>` | `StringCut`. |
| `configuration.fields[].in_stream` | `<fields>/<field>/<in_stream_name>` | |
| `configuration.fields[].out_stream` | `<fields>/<field>/<out_stream_name>` | Rỗng = ghi đè. |
| `configuration.fields[].cut_from` | `<fields>/<field>/<cut_from>` | |
| `configuration.fields[].cut_to` | `<fields>/<field>/<cut_to>` | |

Fill `<fields>` bằng `set_fields` (listTag=`fields`, itemTag=`field`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `engine/src/main/java/org/pentaho/di/trans/steps/stringcut/StringCutMeta.java :: getXML()`.

- `getXML()` mở `<fields>`, lặp `fieldInStream[]`, mỗi `<field>` ghi: `in_stream_name`, `out_stream_name`, `cut_from`, `cut_to`, đóng `</fields>`.
- `setDefault()` khởi tạo list rỗng.

## 5. Lưu ý / bẫy

- `cut_from`/`cut_to` là chỉ số ký tự (0-based, `cut_to` exclusive). Vượt độ dài chuỗi có thể gây lỗi/kết quả rỗng — cần kiểm soát ở dữ liệu.
- `out_stream_name` trống → GHI ĐÈ field đầu vào; đặt tên khác nếu muốn giữ field gốc.
- List `<field>` nằm trong tag bao `<fields>` → fill bằng `set_fields`.
