# START — Entry khởi đầu

## 1. XML Template

```xml
<entry>
  <name>Start</name>
  <description/>
  <type>SPECIAL</type>
  <attributes/>
  <start>Y</start>
  <dummy>N</dummy>
  <repeat>N</repeat>
  <schedulerType>0</schedulerType>
  <intervalSeconds>0</intervalSeconds>
  <intervalMinutes>60</intervalMinutes>
  <hour>12</hour>
  <minutes>0</minutes>
  <weekDay>1</weekDay>
  <DayOfMonth>1</DayOfMonth>
  <parallel>N</parallel>
  <draw>Y</draw>
  <nr>0</nr>
  <xloc>64</xloc>
  <yloc>96</yloc>
  <attributes_kjc/>
</entry>
```

## 2. Config Fields

| Field XML | Bắt buộc | Giá trị / Cách điền |
|-----------|----------|---------------------|
| `<type>` | Y | Cố định `SPECIAL` |
| `<start>` | Y | `Y` — đánh dấu entry khởi đầu |
| `<dummy>` | Y | `N` |
| `<repeat>` | N | `N` — không lặp lịch |
| Scheduler fields | N | Giữ nguyên giá trị mặc định |

## 3. YAML → XML Mapping

| YAML | XML | Ghi chú |
|------|-----|---------|
| `type: START` | `<type>SPECIAL</type>` + `<start>Y</start>` | Job phải có đúng 1 entry START |
| `name` | `<name>` | Mặc định `Start` |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`engine/src/main/java/org/pentaho/di/job/entries/special/JobEntrySpecial.java :: getXML()`.

`getXML()` = `super.getXML()` (khung `JobEntryBase`: `name`,
`description`, `type`, `attributes`) + đúng thứ tự: `start`, `dummy`,
`repeat`, `schedulerType`, `intervalSeconds`, `intervalMinutes`,
`hour`, `minutes`, `weekDay`, `DayOfMonth` (chú ý `DayOfMonth` viết hoa
D). START = `type` SPECIAL + `<start>Y</start>`.

Nguồn ví dụ: `knowledge/pentaho/templates/base-project/etl_job_template.kjb:294-315`.

## 5. Lưu ý / bẫy

- Job XML phải có ĐÚNG 1 entry với `<start>Y</start>` — thiếu → Spoon báo "No start point".
- `SPECIAL` còn dùng cho FAILURE (phân biệt bằng `<start>N`).

## Production Example

Trích từ file production: `etl_job_engine_tckt_ftp_tt2_daily.kjb`

```xml
<entry>
  <name>Start</name>
  <description/>
  <type>SPECIAL</type>
  <attributes/>
  <start>Y</start>
  <dummy>N</dummy>
  <repeat>N</repeat>
  <schedulerType>0</schedulerType>
  <intervalSeconds>0</intervalSeconds>
  <intervalMinutes>60</intervalMinutes>
  <hour>12</hour>
  <minutes>0</minutes>
  <weekDay>1</weekDay>
  <DayOfMonth>1</DayOfMonth>
  <parallel>N</parallel>
  <draw>Y</draw>
  <nr>0</nr>
  <xloc>16</xloc>
  <yloc>160</yloc>
  <attributes_kjc/>
</entry>
```
