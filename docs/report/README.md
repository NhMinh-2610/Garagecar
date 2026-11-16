# Bộ tài liệu báo cáo GarageCar

**Phiên bản rà soát 04/11/2026 · 5 vai trò · không AI.** Nội dung dựa trên mã nguồn trong repository và phiếu giao nhiệm vụ của sinh viên. Đây là tài liệu kỹ thuật để ghép vào báo cáo theo mẫu của trường; không thay thế chữ ký, xác nhận GVHD hoặc các thông tin hành chính chưa được cung cấp.

| Tài liệu                                                                                                               | Nội dung sử dụng trong báo cáo                                                   |
| ---------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| [Yêu cầu và use case](requirements.md)                                                                                 | Bài toán, lý do, mục tiêu, phạm vi, vai trò, yêu cầu, quy tắc và đặc tả use case |
| [Sơ đồ use case và bảng đối chiếu](use-case-chi-tiet.md)                                                               | Ba sơ đồ theo tác nhân, bảng chức năng, quyền và liên kết đến code               |
| [Bản Word phân tích và use case](../../outputs/garagecar_report_20261104/GarageCar_Phan_tich_yeu_cau_va_Use_Case.docx) | Tài liệu tóm tắt có bảng và ba sơ đồ use case                                    |
| [Thiết kế hệ thống](design.md)                                                                                         | Kiến trúc, cơ sở dữ liệu, giao dịch, phân quyền, màn hình và triển khai          |
| [Từ điển dữ liệu](data-dictionary.md)                                                                                  | 29 bảng ORM, từng trường, kiểu, PK/FK, ràng buộc và bảng kỹ thuật                |
| [Danh mục API](api-catalog.md)                                                                                         | 102 route thực tế và liên kết tới hàm xử lý                                      |
| [Kiểm thử, demo và kế hoạch](testing-and-demo.md)                                                                      | Ma trận truy vết, ca kiểm thử, kết quả, kịch bản, kế hoạch 17 tuần và sản phẩm   |
| [Hướng dẫn hiểu code](../code-guide.md)                                                                                | Lộ trình đọc, ví dụ xuyên suốt, vị trí sửa tính năng và gỡ lỗi                   |
| [Nhật ký dọn code](cleanup-20261029.md)                                                                                | Thay đổi lần này, những phần giữ nguyên và cách nâng cấp                         |

## Danh sách sơ đồ

SVG có thể mở trực tiếp trong trình duyệt hoặc chèn vào Word. Các sơ đồ chỉ hiển thị quan hệ cần giải thích; từ điển dữ liệu là nguồn đầy đủ các FK. Mã nguồn vẽ nằm tại [scripts/build-report-diagrams.mjs](../../scripts/build-report-diagrams.mjs).

| Hình                                                                  | Nội dung                                                        |
| --------------------------------------------------------------------- | --------------------------------------------------------------- |
| [01 · Kiến trúc](diagrams/01-architecture.svg)                        | Web/PWA → API → PostgreSQL; app riêng đánh dấu chưa triển khai  |
| [02 · Use case dịch vụ](diagrams/02-use-cases.svg)                    | 5 tác nhân, ca sử dụng chính và ranh giới hệ thống              |
| [03 · Hoạt động](diagrams/03-service-activity.svg)                    | Tiếp nhận đến bàn giao, điểm quyết định và xử lý không hợp lệ   |
| [04 · Tuần tự](diagrams/04-sequence-convert.svg)                      | Chuyển báo giá thành phiếu và xuất kho trong một giao dịch      |
| [05 · Trạng thái](diagrams/05-ticket-state.svg)                       | Vòng đời phiếu sửa; điều kiện hoàn thành và thanh toán          |
| [06 · Quan hệ dữ liệu dịch vụ](diagrams/06-data-service.svg)          | Xe, lượt, báo giá, phiếu, hạng mục, kho, ảnh, chứng từ          |
| [07 · Quan hệ nhân sự/hộp thư](diagrams/07-data-support.svg)          | Tài khoản, hồ sơ, ca/nghỉ/chứng chỉ và hội thoại                |
| [08 · Triển khai](diagrams/08-deployment.svg)                         | Trình duyệt, Nginx, FastAPI và PostgreSQL trong cấu hình Docker |
| [09 · Bảo dưỡng](diagrams/09-maintenance.svg)                         | Nguồn tham khảo, lịch xác minh, hồ sơ xe và hàng đợi công bố    |
| [10 · Bố cục màn hình](diagrams/10-screen-map.svg)                    | Các vùng màn hình chính và tác nhân sử dụng                     |
| [11 · Khách hàng và cố vấn](diagrams/11-use-case-khach-co-van.svg)    | Use case đặt lịch, báo giá, tiếp nhận, hộp thư và bảo dưỡng     |
| [12 · Kỹ thuật viên và kế toán](diagrams/12-use-case-tho-ke-toan.svg) | Use case công việc xưởng, ca làm, thu–chi và báo cáo            |
| [13 · Quản trị viên](diagrams/13-use-case-quan-tri.svg)               | Use case quản lý tài khoản, nhân sự, dịch vụ, kho và tài chính  |

## Các điểm phải nói đúng khi trình bày

- Vai trò: quản trị viên, cố vấn dịch vụ, kỹ thuật viên, kế toán, khách hàng. Quản lý nhân sự thuộc quản trị viên; `/api/hr` vẫn là tên phân hệ.
- Không có hỏi đáp AI, SDK AI hoặc API nhà cung cấp AI. Hộp thư garage là tin nhắn giữa khách và nhân viên.
- Web/PWA đã có. Ứng dụng di động riêng vẫn thuộc phiếu nhiệm vụ nhưng **chưa được triển khai trong source hiện tại**. Không dùng ảnh/sơ đồ PWA để khẳng định đã có app native.
- Các lịch, tài khoản và ảnh có nhãn DEMO chỉ phục vụ minh họa. Thư viện bảo dưỡng tham khảo không đồng nghĩa mọi lịch đã được xác minh.
- Các file Word cũ `docs/project-proposal.docx`, `docs/project-brief.docx` và các tài liệu được tạo trước ngày 04/11/2026 có thể còn phạm vi cũ. Dùng bộ tài liệu này và bản Word trong bảng trên cho nội dung kỹ thuật mới.

Để cập nhật các bảng sau khi sửa source: chạy `python scripts/export-code-reference.py`. Để vẽ lại các sơ đồ gốc chạy `node scripts/build-report-diagrams.mjs`; ba sơ đồ use case chi tiết dùng `node scripts/build-usecase-diagrams.mjs`. Kiểm tra lại ý nghĩa sơ đồ khi quy trình thay đổi; vẽ lại không tự suy ra nghiệp vụ mới.
