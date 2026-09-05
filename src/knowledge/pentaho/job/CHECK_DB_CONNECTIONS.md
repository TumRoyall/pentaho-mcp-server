# CHECK_DB_CONNECTIONS — Job entry kiểm tra kết nối DB

Kiểm tra một/nhiều DB connection có mở được không, tuỳ chọn chờ trước khi kiểm.

## 1. XML Template

```xml
<entry>
      <name>{{ENTRY_NAME}}</name>
      <description/>
      <type>CHECK_DB_CONNECTIONS</type>
      <attributes/>
      <connections>
        <connection>
          <name>{{DB_CONNECTION}}</name>
          <waitfor>0</waitfor>
          <waittime>millisecond</waittime>
        </connection>
      </connections>
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
| `<connections>` | Y | Tag bao danh sách connection cần kiểm. |
| `<connections>/<connection>/<name>` | Y | Tên DB connection. THAM CHIẾU (phải tồn tại trong artifact). |
| `<connections>/<connection>/<waitfor>` | N | Số lượng thời gian chờ trước khi kiểm. `0`=không chờ. |
| `<connections>/<connection>/<waittime>` | N | Đơn vị chờ: `millisecond` / `second` / `minute` / `hour`. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: CHECK_DB_CONNECTIONS` | `<type>` | `CHECK_DB_CONNECTIONS`. |
| `configuration.connections[].name` | `<connections>/<connection>/<name>` | Tham chiếu DB. |
| `configuration.connections[].wait_for` | `<connections>/<connection>/<waitfor>` | |
| `configuration.connections[].wait_time` | `<connections>/<connection>/<waittime>` | Đơn vị chuỗi. |

Fill bằng `set_fields` (listTag=`connections`, itemTag=`connection`).

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `plugins/core/impl/src/main/java/org/pentaho/di/job/entries/checkdbconnection/JobEntryCheckDbConnections.java :: getXML()`.

- `getXML()` gọi `super.getXML()`, mở `<connections>`, lặp `connections[]` ghi `<connection>` với `name` (= tên DatabaseMeta), `waitfor`, `waittime` (= `getWaitTimeCode()`), đóng `</connections>`.
- `unitTimeCode = {"millisecond","second","minute","hour"}`.

## 5. Lưu ý / bẫy

- `<name>` là THAM CHIẾU DB connection; connection phải được khai báo trong artifact (shared/embedded).
- `waittime` dùng mã chuỗi (`millisecond`/`second`/`minute`/`hour`), không phải số.
- List `<connection>` nằm trong tag bao `<connections>` → fill bằng `set_fields`.
