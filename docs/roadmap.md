# Định hướng phát triển

## Ý tưởng project

GarageCar/AutoPro hỗ trợ garage đa hãng quy mô vừa và lớn, nơi tiếp nhận, xưởng, kho, kế toán và nhân sự có trách nhiệm riêng nhưng cần cùng một nguồn dữ liệu. Khách muốn xem tiến độ/chi phí; thợ cần cập nhật công việc và bằng chứng ngay tại xe. PWA trên điện thoại kết hợp web quản trị đáp ứng hai cách sử dụng trong cùng project.

Điểm trọng tâm là quản lý công việc có thể truy vết: khách duyệt đúng báo giá, vật tư đi cùng công việc, thợ xác nhận bằng ảnh/mã, cố vấn nghiệm thu, kế toán thu tiền và lịch bảo dưỡng có nguồn xác minh theo cấu hình xe.

## Phạm vi hiện tại

| Đã có trong code                                                        | Chưa triển khai                                                |
| ----------------------------------------------------------------------- | -------------------------------------------------------------- |
| Sáu portal/vai trò độc lập, khóa chức năng, thu hồi phiên               | Đa chi nhánh, SSO và phân quyền tổ chức nhiều cấp              |
| Tiếp nhận, báo giá theo phiên bản, phiếu sửa, ảnh/mã vật tư, nghiệm thu | Chẩn đoán OBD, OCR/barcode tự động và kiểm chứng nhà cung cấp  |
| Kho, lịch sử nhập/xuất, cấu hình tương thích                            | Đặt hàng/nhà cung cấp, lô/serial đầy đủ, SKU/OEM theo VIN      |
| Thư viện 15 hãng/100 dòng/41 nhóm bộ phận, gồm VinFast                  | Lịch đã xác minh cho mọi đời/cấu hình và cập nhật sách tự động |
| Lịch bảo dưỡng có kiểm duyệt, hàng đợi nhắc hạn                         | SMS/email, push khi đóng ứng dụng                              |
| Thu tiền một lần, đề nghị/duyệt chi, báo cáo doanh thu                  | Thanh toán một phần, hoàn tiền, sổ cái kép, hóa đơn điện tử    |
| Phân ca, nghỉ phép, chứng chỉ                                           | Chấm công, tính lương và phân lịch tài nguyên tự động          |
| Chat AI qua provider, hộp thư khách/cố vấn                              | RAG đọc tài liệu hãng, chat ảnh/thoại, WebSocket               |
| PWA dùng chung backend, giao diện responsive                            | Công việc offline và app native riêng                          |

## Thứ tự ưu tiên tiếp theo

1. **Kiểm chứng vận hành:** dùng database thử riêng để chạy trọn vòng dịch vụ, đối chiếu tiền/tồn kho và lấy phản hồi trực tiếp từ từng chức danh.
2. **Lịch bảo dưỡng thực:** chọn các dòng phổ biến của garage, bổ sung đúng tài liệu/phạm vi và người chịu trách nhiệm xác minh; không duyệt hàng loạt mẫu nghiên cứu.
3. **Hạ tầng:** backup được thử phục hồi, lưu ảnh có kiểm soát, giám sát và điều phối worker/tần suất khi chạy nhiều tiến trình.
4. **Kho và tài chính chuyên sâu:** triển khai từng nghiệp vụ còn thiếu cùng người phụ trách, có chứng từ và dữ liệu thử rõ ràng.
5. **Hỗ trợ di động:** thông báo có sự đồng ý của người dùng, cải thiện camera và trải nghiệm trên thiết bị thật; chỉ làm offline khi xử lý được xung đột/trùng thao tác.

Tài liệu nghiên cứu và dữ liệu demo là cơ sở phát triển, không thay thế quy trình được garage xác nhận. Các file Word [ý tưởng](project-proposal.docx) và [thuyết minh](project-brief.docx) được giữ làm tài liệu trình bày trước đây; hướng dẫn kỹ thuật hiện hành bắt đầu tại [README](../README.md).
