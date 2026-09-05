# Mapping — Step gọi sub-transformation

## 1. XML Template

```xml
<step>
    <name>{{STEP_NAME}}</name>
    <type>Mapping</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <specification_method>filename</specification_method>
    <trans_object_id/>
    <trans_name/>
    <filename>{{TRANSFORMATION_FILE}}</filename>
    <directory_path/>
    <mappings>
      <input>
        <mapping>
          <input_step>{{INPUT_FIELD}}</input_step>
          <output_step>{{INPUT_MAPPING_FIELD}}</output_step>
          <main_path>Y</main_path>
          <rename_on_output>Y</rename_on_output>
          <description/>
        </mapping>
      </input>
      <output>
        <mapping>
          <input_step>{{OUTPUT_MAPPING_FIELD}}</input_step>
          <output_step>{{OUTPUT_FIELD}}</output_step>
          <main_path>Y</main_path>
          <rename_on_output>N</rename_on_output>
          <description/>
        </mapping>
      </output>
      <parameters>
        <inherit_all_vars>Y</inherit_all_vars>
        <!-- nếu map biến cụ thể, thêm item (MappingParameters.XML_VARIABLES_TAG = "variablemapping"):
        <variablemapping>
          <variable>{{VAR_NAME}}</variable>
          <input>{{VAR_VALUE}}</input>
        </variablemapping> -->
      </parameters>
    </mappings>
    <allow_multiple_input>N</allow_multiple_input>
    <allow_multiple_output>N</allow_multiple_output>
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
| `<specification_method>` | Y | Cách tham chiếu sub-transformation; nguồn dùng `filename`. |
| `<trans_object_id>` | N | Object id khi dùng repository (cần verify). |
| `<trans_name>` | N | Tên transformation khi dùng repository. |
| `<filename>` | Y | Đường dẫn file `.ktr` khi specification method là filename. |
| `<directory_path>` | N | Thư mục repository (cần verify). |
| `<mappings/input/mapping>` | N | Mapping field từ input sang sub-transformation. |
| `<mappings/output/mapping>` | N | Mapping field từ sub-transformation ra output. |
| `<mappings/parameters/inherit_all_vars>` | N | Kế thừa toàn bộ biến. |
| `<allow_multiple_input>` | N | Cho phép nhiều input mapping. |
| `<allow_multiple_output>` | N | Cho phép nhiều output mapping. |

## 3. YAML→XML Mapping

| YAML field | → XML field | Ghi chú |
|---|---|---|
| `type: MAPPING` | `<type>` | `Mapping`. |
| `configuration.specification_method` | `<specification_method>` |  |
| `configuration.filename` | `<filename>` |  |
| `configuration.input_mappings[]` | `<mappings/input/mapping>` | Skeleton có một item quan sát được. |
| `configuration.output_mappings[]` | `<mappings/output/mapping>` | Skeleton có một item quan sát được. |
| `configuration.inherit_all_variables` | `<mappings/parameters/inherit_all_vars>` | Y/N. |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`engine/src/main/java/org/pentaho/di/trans/steps/mapping/MappingMeta.java :: getXML()`
+ `MappingIODefinition.java :: getXML()` (`XML_TAG = "mapping"`)
+ `MappingParameters.java :: getXML()` (`XML_TAG = "parameters"`,
`XML_VARIABLES_TAG = "variablemapping"`).

`getXML()` ghi đúng thứ tự: `specification_method` (enum code),
`trans_object_id`, `trans_name`, `filename`, `directory_path`, khối
`<mappings>` (khối `<input>` chứa item `<mapping>` — 5 node:
`input_step`, `output_step`, `main_path`, `rename_on_output`,
`description` + 0..n khối `<connector>` (`parent`/`child`); khối
`<output>` tương tự; khối `<parameters>` chứa 0..n
`<variablemapping>` (`variable`/`input`) + `inherit_all_vars`),
`allow_multiple_input`, `allow_multiple_output`.

Nguồn ví dụ: `all_steps_configured.ktr` (Spoon PDI 9.4 verified), step "Mapping (sub-transformation)".

## 5. Lưu ý / bẫy

- `specification_method=filename` + `<filename>` trỏ tới `.ktr` con; nên dùng biến (`${SUB_KTR}`) hoặc đường dẫn tương đối, KHÔNG hardcode đường dẫn máy cụ thể.
- Khi `input_step`/`output_step` để trống + `inherit_all_vars=Y`: mapping truyền toàn bộ field/biến qua sub-transformation (không map field cụ thể).
- Với repository dùng `specification_method=rep_name` + `<trans_name>`/`<directory_path>` thay cho `<filename>`.
- Nếu map field cụ thể, điền `input_step`/`output_step` = tên MappingInput/MappingOutput step bên trong sub-transformation.

## Production Example

Trích từ Spoon PDI 9.4 (verified): `all_steps_configured.ktr` (đường dẫn thật đã thay bằng placeholder):

```xml
<step>
    <name>Mapping (sub-transformation)</name>
    <type>Mapping</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <specification_method>filename</specification_method>
    <trans_object_id/>
    <trans_name/>
    <filename>{{TRANSFORMATION_FILE}}</filename>
    <directory_path/>
    <mappings>
      <input>
        <mapping>
          <input_step/>
          <output_step/>
          <main_path>Y</main_path>
          <rename_on_output>Y</rename_on_output>
          <description/>
        </mapping>
      </input>
      <output>
        <mapping>
          <input_step/>
          <output_step/>
          <main_path>Y</main_path>
          <rename_on_output>N</rename_on_output>
          <description/>
          <connector>
            <parent>output</parent>
            <child>output</child>
          </connector>
        </mapping>
      </output>
      <parameters>
        <inherit_all_vars>Y</inherit_all_vars>
      </parameters>
    </mappings>
    <allow_multiple_input>Y</allow_multiple_input>
    <allow_multiple_output>Y</allow_multiple_output>
    <attributes/>
    <cluster_schema/>
    <remotesteps>
      <input>
      </input>
      <output>
      </output>
    </remotesteps>
    <GUI>
      <xloc>960</xloc>
      <yloc>352</yloc>
      <draw>Y</draw>
    </GUI>
  </step>
```

