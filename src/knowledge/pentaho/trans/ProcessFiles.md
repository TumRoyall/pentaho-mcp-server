# ProcessFiles — Step copy/move/delete file theo field

Xử lý file theo từng dòng: lấy đường dẫn từ field, thực hiện copy/move/delete.

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>ProcessFiles</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <sourcefilenamefield>{{SOURCE_FILE_FIELD}}</sourcefilenamefield>
    <targetfilenamefield>{{TARGET_FILE_FIELD}}</targetfilenamefield>
    <operation_type>copy</operation_type>
    <addresultfilenames>N</addresultfilenames>
    <overwritetargetfile>N</overwritetargetfile>
    <createparentfolder>N</createparentfolder>
    <simulate>Y</simulate>
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
| `<sourcefilenamefield>` | Y | Field chứa đường dẫn file nguồn. |
| `<targetfilenamefield>` | Tùy | Field chứa đường dẫn đích (bắt buộc với copy/move; bỏ qua với delete). |
| `<operation_type>` | Y | `copy` / `move` / `delete`. `setDefault`=`copy`. |
| `<addresultfilenames>` | N | `Y`=thêm file vào result filenames. Mặc định `N`. |
| `<overwritetargetfile>` | N | `Y`=ghi đè file đích nếu tồn tại. Mặc định `N`. |
| `<createparentfolder>` | N | `Y`=tạo thư mục cha đích nếu chưa có. Mặc định `N`. |
| `<simulate>` | N | `Y`=chạy thử KHÔNG thao tác thật. `setDefault`=`Y` (LƯU Ý mặc định là bật). |

## 3. YAML→XML Mapping

| YAML | XML | Ghi chú |
|---|---|---|
| `type: PROCESS_FILES` | `<type>` | `ProcessFiles`. |
| `configuration.source_field` | `<sourcefilenamefield>` | |
| `configuration.target_field` | `<targetfilenamefield>` | |
| `configuration.operation` | `<operation_type>` | `copy`/`move`/`delete`. |
| `configuration.overwrite` | `<overwritetargetfile>` | Y/N. |
| `configuration.create_parent` | `<createparentfolder>` | Y/N. |
| `configuration.simulate` | `<simulate>` | Y/N; nhớ đặt `N` khi chạy thật. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 — `engine/src/main/java/org/pentaho/di/trans/steps/processfiles/ProcessFilesMeta.java :: getXML()`.

- `getXML()` ghi (flat): `sourcefilenamefield`, `targetfilenamefield`, `operation_type` (= `getOperationTypeCode()`), `addresultfilenames`, `overwritetargetfile`, `createparentfolder`, `simulate`.
- `operationTypeCode = {"copy","move","delete"}`; `OPERATION_TYPE_COPY=0`.
- `setDefault()`: `operation_type=copy`, `simulate=true`, các cờ còn lại `false`.

## 5. Lưu ý / bẫy

- `simulate` mặc định `Y` (chạy thử, KHÔNG thao tác file thật). PHẢI đặt `N` khi muốn thực thi thật — đây là bẫy phổ biến.
- `operation_type` dùng mã chuỗi `copy`/`move`/`delete`, không phải số.
- Với `delete` thì `targetfilenamefield` không cần; với `copy`/`move` thì bắt buộc.
- Đường dẫn lấy từ field input (không hardcode trong step); thường có Get File Names hoặc TableInput phía trước.
