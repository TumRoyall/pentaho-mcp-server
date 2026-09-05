# SetSessionVariableStep

Step gán biến session (dùng chung theo phiên carte/server) với giá trị mặc định — thường dùng trong luồng gọi API/lấy token.

## 1. XML Template

```xml
<step>
    <name>Set session variables</name>
    <type>SetSessionVariableStep</type>
    <description/>
    <distribute>Y</distribute>
    <custom_distribution/>
    <copies>1</copies>
    <partitioning>
      <method>none</method>
      <schema_name/>
    </partitioning>
    <fields>
      <field>
        <name/>
        <variable>OAUTH_GRANT_TYPE</variable>
        <default_value>client_credentials</default_value>
      </field>
      <field>
        <name/>
        <variable>OAUTH_CLIENT_ID</variable>
        <default_value>${VAR_OAUTH_CLIENT_ID}</default_value>
      </field>
      <field>
        <name/>
        <variable>OAUTH_CLIENT_SECRET</variable>
        <default_value>${VAR_OAUTH_CLIENT_SECRET}</default_value>
      </field>
      <field>
        <name/>
        <variable>URL_GET_TOKEN</variable>
        <default_value>${VAR_URL_GET_TOKEN}</default_value>
      </field>
    </fields>
    <use_formatting>Y</use_formatting>
    <attributes/>
    <cluster_schema/>
    <remotesteps>
      <input>
      </input>
      <output>
      </output>
    </remotesteps>
    <GUI>
      <xloc>256</xloc>
      <yloc>64</yloc>
      <draw>N</draw>
    </GUI>
  </step>
```

## 2. Config Fields

| Field XML | Bắt buộc | Ý nghĩa / cách điền |
|---|---|---|
| `<type>` | Y | `SetSessionVariableStep` |
| `<fields>/<field>/<variable>` | Y | Tên biến session cần đặt |
| `<fields>/<field>/<default_value>` | N | Giá trị mặc định; dùng biến `${...}` cho secret |
| `<fields>/<field>/<name>` | N | Field nguồn (nếu lấy giá trị từ stream); có thể trống |
| `<use_formatting>` | N | `Y`=áp dụng format |

## 3. YAML→XML Mapping

| YAML | XML | Ghi chú |
|---|---|---|
| `type: SET_SESSION_VARIABLE` | `<type>SetSessionVariableStep</type>` | |
| `config.variables[].name` | `<fields>/<field>/<variable>` | |
| `config.variables[].default` | `<fields>/<field>/<default_value>` | Không hardcode secret |

## 4. Lưu ý / bẫy

- observed-only component; verify in Spoon before production use.
- Block gốc chứa client_id/secret/token/URL thật; đã thay bằng `${VAR_...}` — TUYỆT ĐỐI không nhét credential trực tiếp vào `<default_value>`.
- Biến session khác biến thường: chỉ áp dụng trong phạm vi session của Carte/DI server.

## 5. Provenance

- Source artifact: old_src\trans\etl_trans_f2b_get_token.ktr
- Source PDI version: not established
- Plugin: not established
