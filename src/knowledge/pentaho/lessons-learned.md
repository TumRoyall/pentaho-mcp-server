# Lessons Learned — Pentaho Generation & Modification

Mỗi entry ghi lại một lỗi thực tế đã xảy ra khi generate hoặc modify .kjb/.ktr,
kèm nguyên nhân gốc và rule phòng tránh. File này là append-only — không xóa, không sửa
entry cũ, không đánh lại số.

**Cách dùng:**
- Generator/modifier đọc file này trước khi sinh output, scan cột "Preventive rule" cho
  những rule áp dụng với type đang xử lý.
- Sau khi phát hiện bug, dùng skill `learning-from-mistakes` để thêm entry mới.

**Format:** Xem `skills/learning-from-mistakes/references/lesson-format.md`

---

## Quick-reference rules

Bảng tóm tắt tất cả preventive rules — đọc nhanh trước khi generate:

| LES | Severity | Types | Rule |
|-----|----------|-------|------|
| *(chưa có entry nào — thêm khi phát hiện lỗi thực tế)* | | | |

---

## Entries

*(Thêm entry mới bên dưới dòng này, theo format LES-NNN)*

