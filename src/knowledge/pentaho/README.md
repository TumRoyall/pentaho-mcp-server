# Knowledge Base — Pentaho PDI 11 XML

Tài liệu XML chi tiết cho từng loại JOB ENTRY và TRANSFORMATION STEP của PDI 11.
Đây là tài sản chung cho toàn bộ project — dùng bởi cả designing, generating,
và maintenance skills.

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
- Generator sinh tự do entry/step có `status: canonical` VÀ
  `generator_eligible: true`, không cần `<!-- MANUAL_REVIEW -->`.
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
   `generator_eligible: false`.
6. Chỉ thăng `status: canonical` + `generator_eligible: true` **sau khi** đã
   verify trên đúng PDI target (Spoon/Kitchen load hoặc runtime). Không suy đoán
   tương thích PDI 11.

**Không bao giờ** chép secret/password/token, endpoint/URL, host/IP, hay đường
dẫn máy cụ thể vào template — thay bằng biến `${VAR_...}` hoặc placeholder mô tả.

## Nguồn gốc

Derived từ `PENTAHO_TEMPLATE/knowledge/pentaho/` — canonical template
`etl_job_template.kjb` và các project thực tế trong repo.
