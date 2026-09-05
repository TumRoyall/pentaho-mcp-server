# FAILURE — Entry kết thúc thất bại

## 1. XML Template

```xml
<entry>
  <name>Failure</name>
  <description/>
  <type>SPECIAL</type>
  <attributes/>
  <start>N</start>
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
  <xloc>700</xloc>
  <yloc>300</yloc>
  <attributes_kjc/>
</entry>
```

## 2. Config Fields

| Field XML | Bắt buộc | Giá trị / Cách điền |
|-----------|----------|---------------------|
| `<type>` | Y | `SPECIAL` |
| `<start>` | Y | `N` — KHÔNG phải điểm khởi đầu |
| `<dummy>` | Y | `N` |

## 3. YAML → XML Mapping

| YAML | XML | Ghi chú |
|------|-----|---------|
| `type: FAILURE` | `<type>SPECIAL</type>` + `<start>N</start>` | Phân biệt với START bằng `<start>N` |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`engine/src/main/java/org/pentaho/di/job/entries/special/JobEntrySpecial.java :: getXML()`
(cùng class với START; FAILURE = `type` SPECIAL + `<start>N</start>`).

## 5. Lưu ý / bẫy

- SPECIAL phân biệt Start/Failure bằng `<start>Y|N</start>`.
- **Không có node `<abort>`** trong `JobEntrySpecial` 9.4 — ví dụ cũ có `<abort>` + `<start>` đặt cuối là sai thứ tự serialize, đã thay bằng template khớp `getXML()`.
- Khi gen gặp type FAILURE, thêm `<!-- MANUAL_REVIEW -->` nếu chưa runtime validated.

## Production Example

FAILURE dùng xml_type = SPECIAL giống START nhưng với `<start>N</start>`.
Trích từ file production: `etl_job_engine_tckt_ftp_tt2_daily.kjb` (đã chuẩn hoá thứ tự node theo `getXML()`):

```xml
<entry>
  <name>Failure</name>
  <description/>
  <type>SPECIAL</type>
  <attributes/>
  <start>N</start>
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
  <xloc>700</xloc>
  <yloc>300</yloc>
  <attributes_kjc/>
</entry>
```
