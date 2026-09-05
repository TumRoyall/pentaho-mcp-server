# StreamLookup — Step tra cứu từ một stream khác

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>StreamLookup</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <from>{{LOOKUP_STEP}}</from>
    <input_sorted>N</input_sorted>
    <preserve_memory>Y</preserve_memory>
    <sorted_list>N</sorted_list>
    <integer_pair>N</integer_pair>
    <lookup>
      <key>
        <name>{{MAIN_KEY_FIELD}}</name>
        <field>{{LOOKUP_KEY_FIELD}}</field>
      </key>
      <value>
        <name>{{LOOKUP_VALUE_FIELD}}</name>
        <rename>{{OUTPUT_FIELD}}</rename>
        <default/>
        <type>String</type>
      </value>
    </lookup>
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
| `<from>` | Y | Tên step cung cấp stream lookup (info stream). Được set qua info hop, không hardcode. |
| `<input_sorted>` | N | `Y` nếu input đã sort theo khóa. `getXML` ghi từ `isInputSorted()`. |
| `<preserve_memory>` | N | `setDefault()` = `true` → `Y`. Giữ cấu trúc tiết kiệm bộ nhớ. |
| `<sorted_list>` | N | `setDefault()` = `false` → `N`. Dùng danh sách đã sort. |
| `<integer_pair>` | N | `setDefault()` = `false` → `N`. Tối ưu cặp integer. |
| `<lookup>` | Y | Tag bao chứa các `<key>` và `<value>`. |
| `<lookup>/<key>/<name>` | Y | Field khóa trên STREAM CHÍNH. |
| `<lookup>/<key>/<field>` | Y | Field khóa tương ứng trên STREAM LOOKUP. |
| `<lookup>/<value>/<name>` | Y | Field trên stream lookup cần lấy về. |
| `<lookup>/<value>/<rename>` | N | Tên field khi đưa vào stream chính (đổi tên). |
| `<lookup>/<value>/<default>` | N | Giá trị mặc định khi không tìm thấy khóa. |
| `<lookup>/<value>/<type>` | N | Kiểu value-meta của field trả về: `String`, `Integer`, `Number`, `Date`... |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: STREAM_LOOKUP` | `<type>` | `StreamLookup`. |
| `configuration.lookup_step` | `<from>` | Tham chiếu step (info hop). |
| `configuration.input_sorted` | `<input_sorted>` | Y/N. |
| `configuration.preserve_memory` | `<preserve_memory>` | Y/N; mặc định `Y`. |
| `configuration.keys[].name` | `<lookup>/<key>/<name>` | Field khóa stream chính. |
| `configuration.keys[].lookup_field` | `<lookup>/<key>/<field>` | Field khóa stream lookup. |
| `configuration.return_fields[].name` | `<lookup>/<value>/<name>` | Field lấy từ lookup. |
| `configuration.return_fields[].rename` | `<lookup>/<value>/<rename>` | Đổi tên output. |
| `configuration.return_fields[].default` | `<lookup>/<value>/<default>` | Giá trị mặc định. |
| `configuration.return_fields[].type` | `<lookup>/<value>/<type>` | Value-meta name. |

`<lookup>` chứa HAI loại item khác nhau (`<key>` và `<value>`) → fill bằng HAI lần
`set_fields`: `listTag=lookup, itemTag=key` và `listTag=lookup, itemTag=value`.

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `engine/src/main/java/org/pentaho/di/trans/steps/streamlookup/StreamLookupMeta.java :: getXML()`.

- `getXML()` ghi lần lượt: `<from>` (= `getStepIOMeta().getInfoStreams().get(0).getStepname()`), `<input_sorted>`, `<preserve_memory>`, `<sorted_list>`, `<integer_pair>`.
- Mở `<lookup>`, lặp `keystream[]` ghi từng `<key>` (`name` = field khóa stream chính, `field` = field khóa stream lookup), rồi lặp `value[]` ghi từng `<value>` (`name`, `rename`, `default`, `type` = `ValueMetaFactory.getValueMetaName(...)`), đóng `</lookup>`.
- `setDefault()`: `preserve_memory=Y`, `sorted_list=N`, `integer_pair=N`, list rỗng.
- `<from>` KHÔNG phải node cấu hình cố định — nó là tên step của info stream (lookup), phải được nối bằng info hop.

## 5. Lưu ý / bẫy

- `<from>` là THAM CHIẾU STEP LOOKUP (info stream). Generator phải: (1) `set_field` `<from>` = tên step lookup, (2) `edit_hops` tạo hop từ step lookup tới step StreamLookup (info hop). KHÔNG hardcode tên step.
- `<lookup>` chứa cả `<key>` và `<value>` — hai loại item, fill bằng hai lần `set_fields` với itemTag khác nhau.
- `<key>`: `name` là field bên STREAM CHÍNH, `field` là field bên STREAM LOOKUP — dễ nhầm thứ tự.
- `<value>/<type>` dùng tên value-meta (chuỗi), không phải số.
- `preserve_memory=Y` là mặc định (tiết kiệm bộ nhớ); đặt `N` chỉ khi cần tốc độ và stream lookup nhỏ.
