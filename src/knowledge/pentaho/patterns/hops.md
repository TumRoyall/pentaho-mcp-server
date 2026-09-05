# Pattern — Hops (các loại nối) trong Job và Transformation

> Hop không phải là một step/entry nên không nằm trong `catalog.yaml`. Đây là
> tài liệu topology cho generator/maintenance: nối các element bằng đúng loại
> hop mà Spoon serialize. Mọi node dưới đây truy được về source PDI.

Có ba nơi định nghĩa "nối" trong Kettle, và chúng KHÁC nhau:

1. Job hop — `<hop>` trong `<hops>` của `.kjb` (có ngữ nghĩa success/failure/uncond).
2. Transformation hop — `<hop>` trong `<order>` của `.ktr` (chỉ bật/tắt, không ngữ nghĩa).
3. Transformation error hop — cặp `<error>` (trong `<step_error_handling>`) + một
   trans hop thường; đây là "mũi tên đỏ" trong Spoon.

Tool liên quan: `kettle_edit_hops` (loại 1 & 2), `kettle_add_error_hop` (loại 3).

---

## 1. Job hop — ba loại ngữ nghĩa

Nguồn: `engine/.../org/pentaho/di/job/JobHopMeta.java :: getXML()`.
Một job hop luôn serialize đủ 7 node theo thứ tự:

```xml
    <hop>
      <from>{{FROM_ENTRY}}</from>
      <to>{{TO_ENTRY}}</to>
      <from_nr>0</from_nr>
      <to_nr>0</to_nr>
      <enabled>Y</enabled>
      <evaluation>Y</evaluation>
      <unconditional>N</unconditional>
    </hop>
```

`evaluation` + `unconditional` xác định LOẠI hop (màu mũi tên trong Spoon):

| Loại | `evaluation` | `unconditional` | Khi nào chạy entry kế | Màu Spoon |
|---|---|---|---|---|
| Unconditional | Y | Y | Luôn chạy, bất kể kết quả entry trước | xám/đen |
| On success | Y | N | Chỉ khi entry trước thành công | xanh |
| On failure | N | N | Chỉ khi entry trước thất bại | đỏ |

Bẫy — hop rời khỏi START:
`JobHopMeta` constructor gọi `setUnconditional()` khi `from.isStart()`. Nghĩa là
hop đi ra từ entry START (type `SPECIAL`, `<start>Y</start>`) BẮT BUỘC là
unconditional. `kettle_edit_hops` tự đặt `unconditional=Y` cho hop `add` từ START;
đừng ép `N`.

Cách tạo bằng tool:
- Success (mặc định): `kettle_edit_hops {action:add, from, to}`.
- Failure (nhánh lỗi): `kettle_edit_hops {action:add, from, to, evaluation:"N"}`.
- Unconditional tường minh: `kettle_edit_hops {action:add, from, to, unconditional:"Y"}`
  (không cần cho hop từ START — đã tự động).

---

## 2. Transformation hop — không có ngữ nghĩa điều kiện

Nguồn: `engine/.../org/pentaho/di/trans/TransHopMeta.java :: getXML()`.
Chỉ 3 node; KHÔNG có `evaluation`/`unconditional`/`from_nr`/`to_nr`:

```xml
    <hop>
      <from>{{FROM_STEP}}</from>
      <to>{{TO_STEP}}</to>
      <enabled>Y</enabled>
    </hop>
```

Row đi theo hop nào là do step nguồn quyết định, KHÔNG do hop:
- FilterRows: `<send_true_to>` / `<send_false_to>` (mỗi cái = tên một step; phải có
  hop thường tương ứng tới step đó).
- SwitchCase: `<default_target_step>` + từng `<target_step>` trong `<cases>`.
- Các step nhiều output khác: xem `STEP_REFERENCE_TAGS` trong `src/core/model.js`.

Nghĩa là: sau khi set `send_true_to`/`target_step`, PHẢI thêm một trans hop thường
`from=stepNguồn, to=targetStep` thì Spoon mới vẽ và Kettle mới nối. Thiếu hop =
transformation gãy lúc chạy (validate cảnh báo mức warning).

---

## 3. Transformation error hop ("mũi tên đỏ")

Nguồn khung `<error>`: `engine/.../org/pentaho/di/trans/step/StepErrorMeta.java :: getXML()`.
Đây KHÔNG phải một hop đơn thuần. Nó gồm hai phần, và `kettle_add_error_hop` ghi
cả hai trong một lần sửa nguyên tử:

(a) Một block `<error>` (đủ 10 node, đúng thứ tự) nằm trong container cấp
transformation `<step_error_handling>` (đặt sau step cuối, trước
`<slave-step-copy-partition-distribution>`):

```xml
  <step_error_handling>
    <error>
      <source_step>{{SOURCE_STEP}}</source_step>
      <target_step>{{TARGET_STEP}}</target_step>
      <is_enabled>Y</is_enabled>
      <nr_valuename/>
      <descriptions_valuename/>
      <fields_valuename/>
      <codes_valuename/>
      <max_errors/>
      <max_pct_errors/>
      <min_pct_rows/>
    </error>
  </step_error_handling>
```

(b) Một trans hop thường `source_step -> target_step` (mục 2) để nối đồ thị.

Ý nghĩa các node (theo StepErrorMeta):

| Node | Ý nghĩa / cách điền |
|---|---|
| `source_step` | Step phát sinh lỗi, đẩy row lỗi ra |
| `target_step` | Step nhận row lỗi (thường một sink/reject) |
| `is_enabled` | Y bật xử lý lỗi; N tắt (block vẫn được ghi) |
| `nr_valuename` | Tên field chứa SỐ lỗi (rỗng = không thêm) |
| `descriptions_valuename` | Tên field chứa mô tả lỗi (rỗng = không thêm) |
| `fields_valuename` | Tên field chứa danh sách field gây lỗi (rỗng = không thêm) |
| `codes_valuename` | Tên field chứa mã lỗi (rỗng = không thêm) |
| `max_errors` | Ngưỡng số lỗi trước khi dừng cứng (rỗng = không giới hạn) |
| `max_pct_errors` | Ngưỡng phần trăm lỗi trước khi dừng cứng |
| `min_pct_rows` | Số row tối thiểu đọc trước khi tính phần trăm |

Bẫy:
- Một step nguồn chỉ có ĐÚNG MỘT error hop. `kettle_add_error_hop` từ chối nếu
  `source` đã có block `<error>`.
- Bốn `*_valuename` mặc định rỗng (self-closing). Muốn thêm field lỗi vào stream:
  điền qua opts của tool, hoặc sau đó dùng `kettle_set_field_path` trên block.
- Error hop CHỈ có ở transformation. Job không có xử lý lỗi cấp entry theo cách
  này — nhánh thất bại của job dùng job hop `evaluation=N` (mục 1).

Cách tạo bằng tool:
```
kettle_add_error_hop {path, source, target,
  nrErrorsField?, errorDescField?, errorFieldsField?, errorCodesField?,
  maxErrors?, maxPctErrors?, minPctRows?, enabled?}
```

---

## Provenance

- Job hop 7 node + rule START→unconditional:
  `pentaho-kettle source 9.4 — org/pentaho/di/job/JobHopMeta.java :: getXML(), constructor`
- Trans hop 3 node:
  `pentaho-kettle source 9.4 — org/pentaho/di/trans/TransHopMeta.java :: getXML()`
- Error block 10 node:
  `pentaho-kettle source 9.4 — org/pentaho/di/trans/step/StepErrorMeta.java :: getXML()`
- Ví dụ thật error hop: `assemblies/samples/.../CSV Input - Reading customer data with error logging.ktr`,
  `engine/.../test_kjbs/expected_complete_with_failure/fail_on_exec_hello_world.ktr`
