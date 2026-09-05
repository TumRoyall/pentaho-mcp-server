# Dummy — Step trung gian không biến đổi dòng

## 1. XML Template

```xml
<step>
  <name>{{STEP_NAME}}</name>
  <type>Dummy</type>
  <description/>
  <distribute>Y</distribute>
  <custom_distribution/>
  <copies>1</copies>
  <partitioning><method>none</method><schema_name/></partitioning>
  <attributes/>
  <cluster_schema/>
  <remotesteps><input/><output/></remotesteps>
  <GUI><xloc>200</xloc><yloc>100</yloc><draw>Y</draw></GUI>
</step>
```

## 2. Config Fields

| Field XML | Bắt buộc | Ý nghĩa / cách điền |
|---|---|---|
| `<name>` | Y | Tên hiển thị của step. |
| `<type>` | Y | Luôn là `Dummy`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: DUMMY` | `<type>` | Ghi `Dummy`. |
| `name` | `<name>` | Tên step. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `engine/src/main/java/org/pentaho/di/trans/steps/dummytrans/DummyTransMeta.java` :: không override `getXML()`.

`Dummy` không có node phần thân do meta class ghi; ví dụ quan sát trước đó chỉ dùng boilerplate `StepMeta` với `<name>do nothing</name>` và `<type>Dummy</type>`.

## 5. Lưu ý / bẫy

- Đây là step pass-through; không thêm node cấu hình riêng giữa `<partitioning>` và `<attributes/>`.
- Các node `attributes`, `cluster_schema`, `remotesteps` và `GUI` là khung `StepMeta`, không phải cấu hình Dummy.
