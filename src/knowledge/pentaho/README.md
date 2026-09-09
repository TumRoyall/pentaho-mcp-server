# Knowledge Base — Pentaho PDI 9.4 XML

Tài liệu XML chi tiết cho từng loại JOB ENTRY và TRANSFORMATION STEP của PDI 9.4.
PDI 9.4 là target duy nhất của project này. Đây là tài sản chung cho toàn bộ
project — dùng bởi cả designing, generating, và maintenance skills.

## Bằng chứng phiên bản (version evidence)

Mỗi dòng catalog mang ba trường bằng chứng, tách bạch rõ ràng:

- `source_version` — phiên bản PDI đã dùng để suy ra hình dạng XML (ví dụ `9.4`),
  hoặc `not_established` khi không xác lập được.
- `verified_versions` — scalar tách bằng dấu `|` (ví dụ `9.3|9.4`) liệt kê các
  phiên bản đã có **bằng chứng target**; rỗng nghĩa là chưa có xác minh target.
- `verification` — mức bằng chứng: `source_reviewed` (đọc `getXML()` của source
  PDI 9.4), `spoon_loaded` (artifact `.ktr`/`.kjb` mở/lưu bằng Spoon PDI 9.4),
  hoặc `runtime_passed` (chạy thật bằng Kitchen/Pan).

**Bằng chứng cấu trúc từ source (structural source evidence)** khác với **xác
minh chạy trên target (target-runtime verification)**. `source_reviewed` chứng
minh hình dạng XML khớp source code PDI 9.4; nó là bằng chứng target hợp lệ cho
PDI 9.4 nhưng KHÔNG thay thế cho việc load bằng Spoon hay chạy runtime. Chỉ khi
`verified_versions` chứa đúng `pdi_version` cấp catalog thì dòng đó mới đủ điều
kiện generator.

## Mục đích

1. **Designing skill** — biết type nào available, config gì cần chốt trong design.
2. **Generating skill** — tra cứu XML template, fill config đúng theo mapping.
3. **Maintenance skill** — biết field nào sửa được, field nào là structural.

## Cấu trúc

```text
knowledge/pentaho/
├── README.md          # file này
├── catalog.yaml       # index: type, status, eligibility, file path
├── job/               # 1 file mỗi loại JOB ENTRY
│   ├── START.md
│   ├── SUCCESS.md
│   ├── SQL.md
│   └── ...
├── trans/             # 1 file mỗi loại TRANSFORMATION STEP
│   ├── TableInput.md
│   ├── TableOutput.md
│   └── ...
└── patterns/          # topology patterns (nhiều step/entry phối hợp)
    └── (future)
```

## Quy tắc

- **Chỉ ghi những gì trích được từ file thật** hoặc xác minh bằng Spoon/Kitchen.
  Chưa xác minh → ghi `(cần verify)`, không đoán.
- Generator sinh tự do entry/step có `status: canonical`, `generator_eligible:
  true`, VÀ `verified_versions` chứa `pdi_version` cấp catalog (9.4); không cần
  `<!-- MANUAL_REVIEW -->`. Thiếu bằng chứng target 9.4 → không đủ điều kiện.
- Entry/step có `status: observed` và `generator_eligible: false` là **known
  generation gap**: chỉ sinh khi design đã duyệt có technical decision known-gap
  tương ứng, và PHẢI kèm đúng một `<!-- MANUAL_REVIEW -->`. Scaffolding qua
  `kettle_add_element` từ chối type observed trừ khi truyền `allowObserved: true`.
- Type KHÔNG có trong `catalog.yaml` (unknown): read/validate vẫn chạy, nhưng
  scaffolding LUÔN từ chối cho tới khi type được đưa vào qua intake.
- Mỗi file gồm 5 phần:
  1. XML template — block đầy đủ, chỗ cần điền theo config ghi rõ
  2. Config fields — bảng `| Field XML | Bắt buộc | Ý nghĩa / cách điền |`
  3. YAML→XML mapping — bảng `| YAML field | → XML field | Ghi chú |`
  4. Ví dụ thực tế — provenance (file:dòng)
  5. Lưu ý / bẫy — lỗi hay gặp

## Workflow thêm knowledge mới

Thứ tự bằng chứng (evidence order) — mạnh nhất trước:

1. Tìm bằng chứng theo thứ tự: (a) file `.kjb`/`.ktr` thật đã chạy production →
   (b) một block `<entry>`/`<step>` hoàn chỉnh do người dùng cung cấp kèm PDI
   version + plugin + mức verification. Không có bằng chứng → không thêm type.
2. Chạy `kettle_knowledge_analyze_xml` trên block: đây là intake **chỉ đọc**, trả
   về candidate (status, alias gợi ý, XML giữ nguyên byte, và findings như
   absolute path / possible secret). Nó KHÔNG ghi gì vào knowledge.
3. Trình candidate cho người dùng và CHỜ xác nhận. Không thêm dòng catalog nào
   trước khi người dùng xác nhận.
4. Tạo file mới theo format 5 phần; trích XML nguyên văn + ghi provenance
   (source artifact; `source PDI version: not established` nếu file không xác lập).
5. Cập nhật `catalog.yaml` — type mới **mặc định** `status: observed`,
   `generator_eligible: false`, `verified_versions` rỗng.
6. Chỉ thăng `status: canonical` + `generator_eligible: true` **sau khi** có bằng
   chứng target đúng PDI 9.4 (source_reviewed từ source 9.4, Spoon PDI 9.4 load,
   hoặc runtime), và ghi `9.4` vào `verified_versions`. Không bao giờ bịa bằng
   chứng phiên bản; không suy đoán tương thích PDI 11.

**Không bao giờ** chép secret/password/token, endpoint/URL, host/IP, hay đường
dẫn máy cụ thể vào template — thay bằng biến `${VAR_...}` hoặc placeholder mô tả.

## Nguồn gốc

Derived từ `PENTAHO_TEMPLATE/knowledge/pentaho/` — canonical template
`etl_job_template.kjb` và các project thực tế trong repo.
