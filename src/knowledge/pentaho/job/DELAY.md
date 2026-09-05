# DELAY — Job entry chờ một khoảng thời gian

Tạm dừng job trong khoảng thời gian cấu hình rồi tiếp tục.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>DELAY</type>
      <attributes/>
      <maximumTimeout>{{TIMEOUT}}</maximumTimeout>
      <scaletime>1</scaletime>
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
| `<maximumTimeout>` | Y | Số lượng thời gian chờ (theo đơn vị `scaletime`). |
| `<scaletime>` | Y | Đơn vị SỐ NGUYÊN: `0`=giây, `1`=phút, `2`=giờ. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: DELAY` | `<type>` | `DELAY`. |
| `configuration.timeout` | `<maximumTimeout>` | |
| `configuration.scale_time` | `<scaletime>` | `0`=giây/`1`=phút/`2`=giờ. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `engine/src/main/java/org/pentaho/di/job/entries/delay/JobEntryDelay.java :: getXML()`.

- `getXML()` gọi `super.getXML()` rồi ghi `maximumTimeout`, `scaletime`.

## 5. Lưu ý / bẫy

- `scaletime` là SỐ NGUYÊN đơn vị (`0`=giây, `1`=phút, `2`=giờ), không phải chuỗi.
- Thời gian chờ thực = `maximumTimeout` × đơn vị `scaletime`.
