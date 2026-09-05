# Rest — Step gọi HTTP API

## 1. XML Template

```xml
<step>
  <name>CALL_API</name>
  <type>Rest</type>
  <description/>
  <distribute>Y</distribute>
  <custom_distribution/>
  <copies>1</copies>
  <partitioning>
    <method>none</method>
    <schema_name/>
  </partitioning>
  <applicationType>TEXT PLAIN</applicationType>
  <method>POST</method>
  <url/>
  <urlInField>Y</urlInField>
  <dynamicMethod>N</dynamicMethod>
  <methodFieldName/>
  <urlField>api_url</urlField>
  <bodyField>request_body</bodyField>
  <httpLogin/>
  <httpPassword/>
  <proxyHost/>
  <proxyPort/>
  <preemptive>N</preemptive>
  <trustStoreFile/>
  <trustStorePassword/>
  <headers>
    <header>
      <field>auth_header_value</field>
      <name>Authorization</name>
    </header>
  </headers>
  <parameters/>
  <matrixParameters/>
  <result>
    <name>response_body</name>
    <code>response_code</code>
    <response_time>response_time</response_time>
    <response_header/>
  </result>
  <attributes/>
  <cluster_schema/>
  <remotesteps>
    <input/>
    <output/>
  </remotesteps>
  <GUI>
    <xloc>200</xloc>
    <yloc>100</yloc>
    <draw>Y</draw>
  </GUI>
</step>
```

## 2. Config Fields

| Field XML | Bắt buộc | Giá trị / Cách điền |
|-----------|----------|---------------------|
| `<method>` | Y | `GET`, `POST`, `PUT`, `DELETE`, `PATCH` |
| `<url>` | Y (khi urlInField=N) | Static URL |
| `<urlInField>` | N | `Y` = URL từ input field |
| `<urlField>` | Y (khi urlInField=Y) | Field chứa URL |
| `<bodyField>` | N | Field chứa request body |
| `<headers>/<header>` | N | Mỗi: `field` (từ stream) + `name` (header name) |
| `<result>/<name>` | Y | Output field: response body |
| `<result>/<code>` | Y | Output field: HTTP status code |

## 3. YAML → XML Mapping

| YAML | XML | Ghi chú |
|------|-----|---------|
| `type: REST` | `<type>Rest</type>` | |
| `config.method` | `<method>` | |
| `config.url_field` | `<urlField>` | |
| `config.body_field` | `<bodyField>` | |
| `config.headers[]` | `<headers>/<header>` | |
| `config.result_fields.body` | `<result>/<name>` | |
| `config.result_fields.code` | `<result>/<code>` | |

## 4. Ví dụ thực tế

Nguồn: pentaho-kettle source 9.4 —
`engine/src/main/java/org/pentaho/di/trans/steps/rest/RestMeta.java :: getXML()`.

`getXML()` ghi đúng thứ tự: `applicationType`, `method`, `url`,
`urlInField`, `dynamicMethod`, `methodFieldName`, `urlField`,
`bodyField`, `httpLogin`, `httpPassword` (encrypt nếu không dùng
variable), `proxyHost`, `proxyPort`, `preemptive`, `trustStoreFile`,
`trustStorePassword`, khối `<headers>` (mỗi `<header>` 2 node: `field`
= field stream, `name` = header name), khối `<parameters>` (mỗi
`<parameter>` 2 node `field`/`name`), khối `<matrixParameters>` (mỗi
`<matrixParameter>` 2 node `field`/`name`), khối `<result>` (4 node:
`name`, `code`, `response_time`, `response_header`).

## 5. Lưu ý / bẫy

- Endpoint/credential PHẢI dùng variable hoặc input field.
- Response code PHẢI được evaluate trước parse JSON.
- Không log request/response body chứa sensitive data.

## Production Example

Trích từ file production: `etl_tran_ftp_dieuchinh_get_auth_token.ktr`

```xml
<step>
  <name>REST Client</name>
  <type>Rest</type>
  <description/>
  <distribute>N</distribute>
  <custom_distribution/>
  <copies>1</copies>
  <partitioning>
    <method>none</method>
    <schema_name/>
  </partitioning>
  <applicationType>FORM URLENCODED</applicationType>
  <method>POST</method>
  <url>${AUTH_TOKEN_URL}</url>
  <urlInField>N</urlInField>
  <dynamicMethod>N</dynamicMethod>
  <methodFieldName/>
  <urlField/>
  <bodyField>authParams</bodyField>
  <httpLogin/>
  <httpPassword>Encrypted </httpPassword>
  <proxyHost/>
  <proxyPort/>
  <preemptive>N</preemptive>
  <trustStoreFile/>
  <trustStorePassword>Encrypted </trustStorePassword>
  <headers>
    <header>
      <field>Authorization</field>
      <name>Authorization</name>
    </header>
    <header>
      <field>Content-Type</field>
      <name>Content-Type</name>
    </header>
  </headers>
  <parameters>
      </parameters>
  <matrixParameters>
      </matrixParameters>
  <result>
    <name>result</name>
    <code/>
    <response_time/>
    <response_header/>
  </result>
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
    <yloc>176</yloc>
    <draw>Y</draw>
  </GUI>
</step>
```
