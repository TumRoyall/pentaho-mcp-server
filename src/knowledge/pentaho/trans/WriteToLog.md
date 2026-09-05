# WriteToLog

Transformation step ghi giá trị field ra PDI log (console/log file) để debug hoặc audit.

## 1. XML Template

```xml
<step>
  <name>{{STEP_NAME}}</name>
  <type>WriteToLog</type>
  <description/>
  <distribute>Y</distribute>
  <custom_distribution/>
  <copies>1</copies>
  <partitioning>
    <method>none</method>
    <schema_name/>
  </partitioning>
  <loglevel>log_level_basic</loglevel>
  <displayHeader>Y</displayHeader>
  <limitRows>N</limitRows>
  <limitRowsNumber>0</limitRowsNumber>
  <logmessage/>
  <fields>
    <field>
      <name>FIELD_NAME</name>
    </field>
  </fields>
  <attributes/>
  <cluster_schema/>
  <remotesteps>
    <input/>
    <output/>
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
| `loglevel` | Y | Log level tối thiểu để message xuất hiện: `log_level_nothing`, `log_level_error`, `log_level_minimal`, `log_level_basic`, `log_level_detailed`, `log_level_debug`, `log_level_rowlevel` |
| `displayHeader` | Y | `Y`/`N` — hiển thị header (tên step, row number) |
| `limitRows` | Y | `Y`/`N` — giới hạn số dòng ghi log |
| `limitRowsNumber` | N | Số dòng tối đa (khi limitRows=Y). 0 = all |
| `logmessage` | N | Prefix message trước mỗi dòng log |
| `fields/field/name` | Y | Tên field cần ghi ra log. Trống = ghi tất cả |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `log_level` | `loglevel` | Dùng format `log_level_basic` |
| `display_header` | `displayHeader` | Y/N |
| `limit_rows` | `limitRows` | Y/N |
| `max_rows` | `limitRowsNumber` | |
| `message` | `logmessage` | |
| `fields[]` | `fields/field/name` | |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`engine/src/main/java/org/pentaho/di/trans/steps/writetolog/WriteToLogMeta.java :: getXML()`.

`getXML()` ghi đúng thứ tự: `loglevel`, `displayHeader`, `limitRows`,
`limitRowsNumber`, `logmessage`, khối `<fields>` (mỗi `<field>` chỉ 1
node `name`; fields rỗng = log tất cả field).

```xml
<!-- Provenance: khớp getXML() + pattern phổ biến trong old_src/trans cho debug -->
<step>
  <name>Log row count</name>
  <type>WriteToLog</type>
  <loglevel>log_level_basic</loglevel>
  <displayHeader>Y</displayHeader>
  <limitRows>Y</limitRows>
  <limitRowsNumber>10</limitRowsNumber>
  <logmessage>[DEBUG] Row sample</logmessage>
  <fields>
    <field>
      <name>RUN_ID</name>
    </field>
    <field>
      <name>ROW_COUNT</name>
    </field>
  </fields>
</step>
```

## 5. Lưu ý / bẫy

- **Không dùng cho production logging vĩnh viễn**: WriteToLog ghi vào PDI log (console hoặc log table), không vào bảng audit riêng. Cho audit vĩnh viễn, dùng TableOutput hoặc ETL_RUN_CONTROL.
- **Log level phải khớp job/trans setting**: Nếu job chạy ở `Basic` mà step set `log_level_detailed`, message sẽ không xuất hiện.
- **limitRows quan trọng**: Nếu stream có triệu dòng mà không limit, log sẽ bùng nổ.
- **fields trống = ghi tất cả field**: Có thể rất dài nếu stream nhiều cột.
- **Không block stream**: Dòng đi qua WriteToLog không bị thay đổi, step chỉ "nhìn" và log.

## Production Example

Trích từ file production: `etl_tran_ftp_dieuchinh_get_auth_token.ktr`

```xml
<step>
  <name>Write to log 2</name>
  <type>WriteToLog</type>
  <description/>
  <distribute>Y</distribute>
  <custom_distribution/>
  <copies>1</copies>
  <partitioning>
    <method>none</method>
    <schema_name/>
  </partitioning>
  <loglevel>log_level_basic</loglevel>
  <displayHeader>Y</displayHeader>
  <limitRows>N</limitRows>
  <limitRowsNumber>0</limitRowsNumber>
  <logmessage/>
  <fields>
    <field>
      <name>result</name>
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
    <xloc>288</xloc>
    <yloc>352</yloc>
    <draw>Y</draw>
  </GUI>
</step>
```
