# Nghiệp vụ và vai trò

## Phân công

| Vai trò       | Công việc chính                                                                           | Giới hạn mặc định                                 |
| ------------- | ----------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Quản trị      | Giám sát, kho/danh mục, phân quyền tài khoản, duyệt chi, cấu hình lịch bảo dưỡng          | Có toàn bộ nhóm chức năng                         |
| Cố vấn        | Tiếp nhận, kiểm tra đầu vào, báo giá, điều phối, nghiệm thu, giao xe, nhắc khách, hộp thư | Không quản lý nhân sự hoặc thu tiền               |
| Kế toán       | Thu tiền, chứng từ, đề nghị chi, doanh thu                                                | Không sửa kết quả xưởng hoặc xem ảnh sửa chữa     |
| Nhân sự       | Hồ sơ nhân viên, phân ca, nghỉ phép, chứng chỉ                                            | Không cấp tài khoản admin hoặc xem tài chính      |
| Kỹ thuật viên | Kiểm tra kỹ, phiếu được giao, bằng chứng thực hiện, tra kho, lịch cá nhân                 | Không xác nhận thanh toán hoặc tự duyệt chứng chỉ |
| Khách hàng    | Xe của mình, lịch hẹn, duyệt báo giá, tiến độ/ảnh/chi phí, bảo dưỡng, hỏi AI, nhắn garage | Không xem xe hoặc hội thoại của người khác        |

Quản trị có thể khóa bớt nhóm chức năng của từng tài khoản. API kiểm tra lại quyền ở mỗi yêu cầu; ẩn menu chỉ là hỗ trợ giao diện. Những thao tác cá nhân như xem ca hoặc xin nghỉ vẫn gắn với chính người đăng nhập.

## Luồng dịch vụ

1. **Đặt lịch/tiếp nhận:** cố vấn xác nhận thông tin và liên kết đúng tài khoản chủ xe.
2. **Kiểm tra đầu vào:** ghi tình trạng, ODO, yêu cầu khách; lập báo giá sơ bộ.
3. **Khách xác nhận sơ bộ:** thống nhất phạm vi trước khi kiểm tra kỹ.
4. **Chẩn đoán tại xưởng:** kỹ thuật viên kiểm tra, đề xuất công việc/vật tư; cố vấn lập báo giá chính thức.
5. **Khách duyệt phiên bản:** thay đổi nội dung cần phiên bản và xác nhận mới.
6. **Tạo phiếu/xuất kho:** kiểm tra tồn kho, tương thích và người được giao trong cùng giao dịch.
7. **Thực hiện:** thợ cập nhật checklist, gửi ảnh và mã vật tư theo từng hạng mục.
8. **Nghiệm thu:** cố vấn kiểm tra kết quả, ảnh, an toàn và chạy thử theo phạm vi cần thiết.
9. **Thu tiền:** kế toán mở mục tài chính, ghi nhận thanh toán; nút ở xưởng chuyển đến mục này.
10. **Giao xe/chăm sóc:** cố vấn bàn giao, theo dõi sau sửa và duyệt thông báo bảo dưỡng.

Trạng thái phiếu sửa: `draft` → `working` → `completed` → `paid`. Phiếu thuộc lượt dịch vụ phải qua nghiệm thu trước khi thu; phiếu lịch sử không liên kết lượt dịch vụ giữ khả năng xử lý tương thích. Không dùng nút hoàn thành để ghi nhận tiền đã thu.

## Ảnh và xác nhận vật tư

- Mỗi hạng mục/lần thực hiện cần ảnh hoàn thành. Hạng mục dùng vật tư cần thêm ảnh bao bì/nhãn và nhập mã SKU hoặc barcode khớp mã mong đợi.
- Mở lại công việc tăng số lần thực hiện và yêu cầu bằng chứng mới; ảnh cũ giữ trong lịch sử.
- API nhận JPEG/PNG/WebP tối đa 3 MB và 16 megapixel; chuẩn hóa JPEG tối đa 1920 px, xoay EXIF và bỏ metadata. PWA nén ảnh gốc tối đa 20 MB trước khi gửi. Tối đa 12 ảnh mỗi hạng mục/lần thực hiện.
- Chủ xe, thợ được giao, cố vấn và quản trị có quyền phù hợp mới xem được ảnh. Không có URL ảnh công khai hoặc token trong đường dẫn.

Ảnh/mã hỗ trợ truy vết, chưa chứng minh hàng chính hãng hay phù hợp VIN. Chưa có OCR hoặc tự đọc barcode. Ảnh đang lưu trong PostgreSQL để cùng backup/giao dịch; lưu trữ object storage là phần nâng cấp sau.

## Kho và công việc

Công việc đi cùng vật tư phù hợp; công việc kiểm tra không bắt buộc có vật tư. Phiếu lưu mã và giá vật tư tại thời điểm lập. Nhập kho có lịch sử tăng/giảm, không tạo vật tư trùng chỉ để cộng số lượng.

Cấu hình tương thích gồm hãng, dòng, khoảng năm, động cơ và nguồn xác nhận. Khi đã khai báo cấu hình, hồ sơ xe không khớp hoặc thiếu thông tin sẽ bị chặn xuất. Chưa khai báo cấu hình vẫn cần người phụ trách kiểm tra thủ công, không được hiểu là phù hợp mọi xe.

Vật tư đánh dấu cao áp yêu cầu người gửi bằng chứng/xác nhận có chứng chỉ `ev_safety` còn hiệu lực, chưa thu hồi. Hồ sơ trong app là kiểm soát nghiệp vụ; quy trình an toàn và đào tạo của garage vẫn phải được thực hiện ngoài phần mềm.

## Thu–chi và báo cáo

Thu một lần toàn bộ phiếu hoàn thành, tối đa một phiếu thu mới cho mỗi phiếu sửa. Ghi người thu, thời điểm, phương thức và mã giao dịch với chuyển khoản/thẻ; đây là ghi nhận tại quầy. Retry không tạo lần thu thứ hai, không sửa đè chứng từ đã thu.

Đề nghị chi cần số chứng từ duy nhất, người nhận, số tiền và căn cứ. Quản trị duyệt, người lập không tự duyệt; chỉ chi sau duyệt và không chi hai lần. Hủy đề nghị chưa duyệt giữ lại lịch sử. Phiếu thu cũ không tự được bổ sung phương thức/người thu khi thiếu dữ liệu.

Báo cáo doanh thu có kỳ tháng/quý/năm. Giá trị kho theo số lượng và đơn giá hiện tại không phải giá vốn hay lợi nhuận kế toán. Danh sách thu/chi giới hạn 1.000 bản ghi gần nhất, không dùng tổng danh sách để thay báo cáo toàn sổ.

## Nhân sự

Phân ca theo nhân viên, thời gian có múi giờ Việt Nam, khu vực và ghi chú; một ca tối đa 16 giờ. Chặn trùng ca hoặc trùng kỳ nghỉ đã duyệt. Hủy/phân lại ca trước khi duyệt nghỉ bị xung đột; vị trí trong ca chưa phải cơ chế đặt chỗ cầu nâng.

Nhân viên tự gửi đơn nghỉ, nhân sự/quản trị duyệt hoặc từ chối có ghi chú và không tự duyệt. Chứng chỉ có nhóm năng lực, đơn vị/mã hồ sơ, thời hạn, người xác minh; thu hồi có căn cứ và giữ lịch sử, không tự xác minh chứng chỉ của mình.

Chưa triển khai thanh toán một phần, hoàn tiền, hóa đơn điện tử, sổ cái kép, chốt quỹ, chấm công, tính lương hoặc phân lịch tài nguyên tự động. Xem [định hướng](roadmap.md).
