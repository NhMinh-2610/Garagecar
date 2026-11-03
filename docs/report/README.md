# Bộ tài liệu báo cáo GarageCar

**Phiên bản rà soát 29/10/2026 · 5 vai trò · không AI.** Nội dung dựa trên mã nguồn trong repository và phiếu `20225886_NguyenNhatMinh_PhieuGiaoNhiemVu_DATN.pdf`. Đây là tài liệu kỹ thuật để ghép vào báo cáo theo mẫu của trường; không thay thế chữ ký, xác nhận GVHD hoặc các thông tin hành chính chưa được cung cấp.

| Tài liệu                                          | Nội dung sử dụng trong báo cáo                                                   |
| ------------------------------------------------- | -------------------------------------------------------------------------------- |
| [Yêu cầu và use case](requirements.md)            | Bài toán, lý do, mục tiêu, phạm vi, vai trò, yêu cầu, quy tắc và đặc tả use case |
| [Thiết kế hệ thống](design.md)                    | Kiến trúc, cơ sở dữ liệu, giao dịch, phân quyền, màn hình và triển khai          |
| [Từ điển dữ liệu](data-dictionary.md)             | 29 bảng ORM, từng trường, kiểu, PK/FK, ràng buộc và bảng kỹ thuật                |
| [Danh mục API](api-catalog.md)                    | 102 route thực tế và liên kết tới hàm xử lý                                      |
| [Kiểm thử, demo và kế hoạch](testing-and-demo.md) | Ma trận truy vết, ca kiểm thử, kết quả, kịch bản, kế hoạch 17 tuần và sản phẩm   |
| [Hướng dẫn hiểu code](../code-guide.md)           | Lộ trình đọc, ví dụ xuyên suốt, vị trí sửa tính năng và gỡ lỗi                   |
| [Nhật ký dọn code](cleanup-20261029.md)           | Thay đổi lần này, những phần giữ nguyên và cách nâng cấp                         |

## Danh sách sơ đồ

SVG có thể mở trực tiếp trong trình duyệt hoặc chèn vào Word. Các sơ đồ chỉ hiển thị quan hệ cần giải thích; từ điển dữ liệu là nguồn đầy đủ các FK. Mã nguồn vẽ nằm tại [scripts/build-report-diagrams.mjs](../../scripts/build-report-diagrams.mjs).

| Hình                                                         | Nội dung                                                        |
| ------------------------------------------------------------ | --------------------------------------------------------------- |
| [01 · Kiến trúc](diagrams/01-architecture.svg)               | Web/PWA → API → PostgreSQL; app riêng đánh dấu chưa triển khai  |
| [02 · Use case dịch vụ](diagrams/02-use-cases.svg)           | 5 tác nhân, ca sử dụng chính và ranh giới hệ thống              |
| [03 · Hoạt động](diagrams/03-service-activity.svg)           | Tiếp nhận đến bàn giao, điểm quyết định và xử lý không hợp lệ   |
| [04 · Tuần tự](diagrams/04-sequence-convert.svg)             | Chuyển báo giá thành phiếu và xuất kho trong một giao dịch      |
| [05 · Trạng thái](diagrams/05-ticket-state.svg)              | Vòng đời phiếu sửa; điều kiện hoàn thành và thanh toán          |
| [06 · Quan hệ dữ liệu dịch vụ](diagrams/06-data-service.svg) | Xe, lượt, báo giá, phiếu, hạng mục, kho, ảnh, chứng từ          |
| [07 · Quan hệ nhân sự/hộp thư](diagrams/07-data-support.svg) | Tài khoản, hồ sơ, ca/nghỉ/chứng chỉ và hội thoại                |
| [08 · Triển khai](diagrams/08-deployment.svg)                | Trình duyệt, Nginx, FastAPI và PostgreSQL trong cấu hình Docker |
| [09 · Bảo dưỡng](diagrams/09-maintenance.svg)                | Nguồn tham khảo, lịch xác minh, hồ sơ xe và hàng đợi công bố    |
| [10 · Bố cục màn hình](diagrams/10-screen-map.svg)           | Các vùng màn hình chính và tác nhân sử dụng                     |

## Các điểm phải nói đúng khi trình bày

- Vai trò: quản trị viên, cố vấn dịch vụ, kỹ thuật viên, kế toán, khách hàng. Quản lý nhân sự thuộc quản trị viên; `/api/hr` vẫn là tên phân hệ.
- Không có hỏi đáp AI, SDK AI hoặc API nhà cung cấp AI. Hộp thư garage là tin nhắn giữa khách và nhân viên.
- Web/PWA đã có. Ứng dụng di động riêng vẫn thuộc phiếu nhiệm vụ nhưng **chưa được triển khai trong source hiện tại**. Không dùng ảnh/sơ đồ PWA để khẳng định đã có app native.
- Các lịch, tài khoản và ảnh có nhãn DEMO chỉ phục vụ minh họa. Thư viện bảo dưỡng tham khảo không đồng nghĩa mọi lịch đã được xác minh.
- Các file Word cũ `docs/project-proposal.docx`, `docs/project-brief.docx` và tài liệu trong `outputs/` được giữ nguyên; có thể còn phạm vi cũ. Dùng bộ tài liệu này cho nội dung kỹ thuật mới.

Để cập nhật các bảng sau khi sửa source: chạy `python scripts/export-code-reference.py`. Để vẽ lại SVG: chạy `node scripts/build-report-diagrams.mjs`. Kiểm tra lại ý nghĩa sơ đồ khi quy trình thay đổi; vẽ lại không tự suy ra nghiệp vụ mới.
