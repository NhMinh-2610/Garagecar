# Bảo dưỡng và nguồn nghiên cứu

## Phạm vi dữ liệu

Danh mục trong [maintenance_catalog.json](../be/data/maintenance_catalog.json) có **41 nhóm bộ phận, 15 hãng và 100 dòng xe**: Honda, Toyota, Hyundai, Kia, Mazda, Ford, Mitsubishi, VinFast, Nissan, Suzuki, Isuzu, Subaru, Mercedes-Benz, BMW, MG. Đây là phạm vi tra cứu gồm cả xe cũ, không phải thống kê thị phần hoặc danh sách xe đang bán.

Danh mục gợi ý công dụng, kiểm tra, nhóm vật tư và hệ truyền động. Không tạo mã OEM giả, không xác nhận vật tư phù hợp chỉ từ tên hãng/dòng. Phụ tùng và chất lỏng cần đối chiếu VIN, biến thể, chuẩn và nguồn thực tế.

| Nhóm phổ biến     | Ví dụ                                             | Điểm phải phân biệt                                                     |
| ----------------- | ------------------------------------------------- | ----------------------------------------------------------------------- |
| Động cơ đốt trong | Dầu/lọc dầu, lọc gió, bugi, lọc nhiên liệu, đai   | Xăng/diesel/hybrid, vật liệu bugi, mã động cơ, SAE và chuẩn hãng        |
| Truyền động       | Dầu CVT/AT/MT, vi sai, hộp phân phối, bộ giảm tốc | Mã hộp số, dẫn động, chất lỏng đúng loại; không gộp chu kỳ              |
| Phanh/lốp/gầm     | Má/đĩa/dầu phanh, lốp, cân chỉnh, giảm xóc        | Đo kiểm và tình trạng; cấp kiểm tra không đồng nghĩa phải thay          |
| Điều hòa/điện phụ | Lọc cabin, gas theo chẩn đoán, bình 12 V          | Không suy lọc bẩn là phải nạp gas; đúng kích thước/thông số             |
| Xe điện           | Làm mát pin, cổng sạc, pin kéo, điện công suất    | Đúng trang bị và tài liệu; không đặt lịch thay pin kéo theo số km chung |

VinFast tách xe điện VF/Green/EC Van và xe động cơ đốt trong Fadil/Lux/President. Chọn VF 8 thuần điện loại nhóm dầu động cơ, bugi và nhiên liệu khỏi gợi ý; vẫn cần kiểm tra đúng cấu hình thực tế. Không suy lịch bảo dưỡng của một mẫu VF cho mọi xe điện.

## Bốn lớp thông tin

| Lớp               | Mục đích                                                            | Áp dụng nhắc hạn                                   |
| ----------------- | ------------------------------------------------------------------- | -------------------------------------------------- |
| Danh mục bộ phận  | Tra cứu và tạo checklist                                            | Không tự áp dụng                                   |
| Mẫu nghiên cứu    | Lưu mốc tham khảo, nguồn và điểm chưa xác minh                      | Bản nháp, không áp dụng cho khách                  |
| Lịch đã xác minh  | Đúng hãng/dòng/năm/động cơ/hộp số/thị trường, nguồn/trang/phiên bản | Hồ sơ xe phải khớp; thông báo vẫn qua cố vấn duyệt |
| Lịch sử thực hiện | Ngày, ODO, kiểm tra/thay thế và căn cứ                              | Làm mốc tính lần tiếp theo                         |

Danh mục ứng dụng có hai mẫu lịch nháp. Bộ `--demo` tạo thêm lịch đã duyệt **giả lập**, chỉ khớp các cấu hình mang dấu `DEMO`; không dùng cho xe thật. Dữ liệu tham khảo chi tiết trước đây được giữ tại [maintenance-reference.json](research/maintenance-reference.json).

## Xác minh và nhắc hạn

1. Hoàn thiện hồ sơ: năm model, VIN nếu có, động cơ, hộp số, thị trường, điều kiện sử dụng, ngày sử dụng đầu tiên và ODO.
2. Cố vấn lập lịch nháp, nhập nguồn, trang, phiên bản, phạm vi và chú thích. Quản trị xác minh; không sửa đè lịch đã xác minh.
3. Khai báo mốc đầu và mốc lặp theo km/tháng. Điều kiện nào đến trước thì áp dụng; thiếu mốc lặp cần xác minh, không tự suy ra.
4. Ghi riêng thao tác kiểm tra và thay thế; kiểm tra không reset lịch thay. Nhập lịch sử ngoài garage phải có căn cứ.
5. Worker quét khoảng 5 phút, ghi hàng đợi trong PostgreSQL và tránh trùng cùng chu kỳ. Cố vấn kiểm tra rồi công bố cho khách trong ứng dụng.

Cảnh báo thực tế, triệu chứng bất thường hoặc điều kiện sử dụng có thể cần kiểm tra sớm hơn. Phần mềm quản lý hồ sơ và nhắc việc, không thay tài liệu sửa chữa đúng xe.

## Nguồn đã dùng trong project

Các liên kết dưới đây được giữ từ đợt nghiên cứu của project. Trước khi duyệt lịch thực tế cần mở lại đúng bản tài liệu và đối chiếu đầy đủ bảng/chú thích; bảng không xác nhận mọi mốc đã nhập vào database.

| Hãng          | Nguồn                                                                                                                                                                                                                                             | Lưu ý áp dụng                                                        |
| ------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| Honda         | [Thư viện VN](https://www.honda.com.vn/o-to/dich-vu-sau-ban-hang/huong-dan-su-dung), [City Malaysia](https://www.honda.com.my/doc/maintenance/2496)                                                                                               | Mẫu Malaysia không áp sang City VN; kiểm tra đính chính đúng phạm vi |
| Toyota        | [Vios VN](https://www.toyota.com.vn/hdsd/vios/2024), [Vios Malaysia](https://www.toyota.com.my/content/dam/malaysia/price-list-maintenance-packages/periodic-maintenance/september-2024/Vios-September-2024.pdf)                                  | Tách NGC102/NCP150/NCP93; không suy model year từ ngày hiệu lực bảng |
| Hyundai       | [Thư viện Thành Công](https://baohanhdientu.hyundai.thanhcong.vn/warranty), [Accent PE 2021](https://baohanhdientu.hyundai.thanhcong.vn/web/content/362/Accent%20PE%202021.pdf?unique=914fda49679483d1ccb931206a3830b1635a4a02)                   | PE 2021 khác BN7; phân biệt bugi/hộp số và chú thích                 |
| Kia           | [Bảo dưỡng định kỳ](https://www.kiavietnam.com.vn/bao-duong-dinh-ki)                                                                                                                                                                              | Cấp dịch vụ hỗ trợ checklist; lịch chi tiết theo sách từng xe        |
| Mazda         | [Bảo dưỡng](https://mazdamotors.vn/maintenance)                                                                                                                                                                                                   | Cấp kiểm tra không phải chu kỳ thay mọi bộ phận                      |
| Ford          | [Lịch Ranger](https://www.ford.com.vn/content/dam/Ford/website-assets/ap/vn/Owner-Dashboard/Service%20%26%20Maintainance/maintenance-schedule-plan/lich-bao-duong-ranger.pdf)                                                                     | Đúng động cơ/hộp số/dẫn động; IOLM theo cảnh báo và tài liệu         |
| Mitsubishi    | [Bảo dưỡng định kỳ](https://www.mitsubishi-motors.com.vn/dich-vu/bao-duong-dinh-ky)                                                                                                                                                               | Tách biến thể động cơ, CVT/AT và 4WD; phân biệt I/R/L                |
| VinFast       | [Dịch vụ](https://vinfastauto.com/vn_vi/dich-vu-bao-duong-oto), [VF 8 VN](https://static-cms-prod.vinfastauto.com/20241206_VF8_VN_1.6_SVC30000403.pdf), [VF 3 VN](https://static-cms-prod.vinfastauto.com/250618_vf3_vn_vi_1.5_svc69000164aa.pdf) | Tách xăng/điện và đúng đời/cấu hình; không áp một lịch cho cả hãng   |
| Nissan        | [Lịch theo mẫu](https://www.nissanvietnam.vn/lich-bao-duong-c5.html)                                                                                                                                                                              | Chọn đúng mẫu; e-POWER vẫn có động cơ đốt trong                      |
| Suzuki        | [Hậu mãi](https://suzuki.com.vn/pages/hau-mai)                                                                                                                                                                                                    | Kiểm tra yêu cầu từng xe                                             |
| Isuzu         | [Thông tin dịch vụ](https://isuzu-vietnam.com/cau-hoi-thuong-gap)                                                                                                                                                                                 | Tách xe du lịch/bán tải và xe tải                                    |
| Subaru        | [Subaru Service](https://www.subaru.asia/vn/en/owners/subaru-service.php)                                                                                                                                                                         | Đối chiếu cấu hình và vật tư                                         |
| Mercedes-Benz | [Phụ tùng](https://www.mercedes-benz.com.vn/vi/passengercars/services/genuine-parts.html)                                                                                                                                                         | Tra mã và nguồn phụ tùng thực tế                                     |
| BMW           | [Dịch vụ](https://www.bmw.vn/vi/services-workshop/services-and-workshop-2025/)                                                                                                                                                                    | Đối chiếu yêu cầu từng xe                                            |
| MG            | [Chính sách bảo hành](https://mgmotor.vn/wp-content/uploads/2025/04/Chinh-sach-bao-hanh-MG.pdf)                                                                                                                                                   | Phân biệt bảo hành và bảo dưỡng                                      |

Chưa có danh mục SKU/OEM theo VIN, chẩn đoán OBD, push khi đóng ứng dụng hoặc SMS/email. Lộ trình mở rộng có tại [roadmap.md](roadmap.md).
