# BlockUntilStepsFinish — Step chặn tới khi các step khác chạy xong

Giữ luồng lại cho đến khi các step được liệt kê hoàn thành (đồng bộ hoá).

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>BlockUntilStepsFinish</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <steps>
      <step>
        <name>{{WAIT_FOR_STEP}}</name>
        <CopyNr>0</CopyNr>
      </step>
    </steps>
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
| `<steps>` | Y | Tag bao danh sách step cần chờ. |
| `<steps>/<step>/<name>` | Y | Tên step phải hoàn thành trước. THAM CHIẾU STEP. |
| `<steps>/<step>/<CopyNr>` | N | Số copy của step (thường `0`). Lưu ý HOA `CopyNr`. |

## 3. YAML→XML Mapping

| YAML | XML | Ghi chú |
|---|---|---|
| `type: BLOCK_UNTIL_STEPS_FINISH` | `<type>` | `BlockUntilStepsFinish`. |
| `configuration.wait_for_steps[].name` | `<steps>/<step>/<name>` | Tham chiếu step. |
| `configuration.wait_for_steps[].copy_nr` | `<steps>/<step>/<CopyNr>` | Mặc định `0`. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `plugins/core/impl/src/main/java/org/pentaho/di/trans/steps/blockuntilstepsfinish/BlockUntilStepsFinishMeta.java :: getXML()`.

- `getXML()` mở `<steps>`, lặp `stepName[]`, mỗi item ghi `<step>` với `name` và `CopyNr`, đóng `</steps>`.
- `setDefault()` khởi tạo list rỗng.

## 5. Lưu ý / bẫy

- Item list dùng tag `<step>` TRÙNG TÊN với phần tử step gốc — nhưng ở đây nằm trong `<steps>` nên không xung đột; giữ đúng cấu trúc.
- `<name>` là THAM CHIẾU STEP cần chờ: generator điền tên step thật; các step đó cũng phải nối tới BlockUntilStepsFinish qua hop trong luồng.
- `<CopyNr>` viết HOA đúng như source (`CopyNr`), không phải `copynr`.
- List item lồng đặc thù (itemTag=`step` trùng tên) — cân nhắc chèn thủ công nếu `set_fields` xử lý nhầm với step gốc.
