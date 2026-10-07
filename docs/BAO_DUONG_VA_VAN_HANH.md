# Bộ phận phổ biến và cách áp dụng vào AutoPro

Đối chiếu ngày 07/10/2026. Phạm vi là xe con, SUV và bán tải thường được gara đa hãng tiếp nhận. Danh sách dòng xe là phạm vi tra cứu, không phải thống kê thị phần.

## 1. Kết quả đã triển khai

- Danh mục **24 bộ phận**, gợi ý kiểm tra, vật tư và điều kiện áp dụng; lưu trong `be/data/maintenance_catalog.json`, có API và giao diện tra cứu.
- Tra cứu **7 hãng**: Honda, Toyota, Hyundai, Kia, Mazda, Ford, Mitsubishi.
- Hồ sơ xe theo năm model, VIN nếu có, động cơ, hộp số, thị trường, điều kiện sử dụng, ngày dùng lần đầu và ODO.
- Lịch bảo dưỡng riêng từng cấu hình, có nguồn/trang/phiên bản. Cố vấn lập nháp, quản trị xác minh; lịch đã xác minh không sửa đè.
- Tính mốc đầu và mốc lặp; km hoặc tháng, điều kiện nào đến trước. Không có mốc lặp thì yêu cầu xác minh, không tự tạo chu kỳ.
- Lịch sử kiểm tra/thay thế độc lập. Không dùng một lần kiểm tra để reset lịch thay bộ phận.
- Hàng đợi nhắc hạn trong PostgreSQL: quét mỗi 5 phút, không tạo trùng cùng chu kỳ; cố vấn kiểm tra rồi gửi vào ứng dụng khách.
- Luồng kiểm tra đầu vào → báo giá sơ bộ → khách xác nhận → kiểm tra kỹ → báo giá chính thức → khách duyệt → xuất kho/tạo phiếu → nghiệm thu → thu tiền → giao xe.
- Tài khoản cố vấn, kế toán, nhân sự, quản trị, thợ, khách; khóa chức năng từ admin và kiểm tra quyền tại API.
- PWA cho khách/thợ dùng chung backend. Chỉ cache giao diện công khai; cần mạng để lưu công việc và đọc dữ liệu cá nhân.

Chưa có danh mục mã phụ tùng theo VIN, push khi đóng ứng dụng, SMS/email, thanh toán một phần, hóa đơn điện tử hoặc tính lương. Giao diện thể hiện đúng các giới hạn này.

## 2. Phân biệt bốn loại dữ liệu

| Loại | Nội dung | Có được tự nhắc khách? |
|---|---|---|
| Danh mục bộ phận | Công dụng, cách kiểm tra, vật tư gợi ý | Không |
| Mẫu nghiên cứu | Mốc đọc được nhưng còn giới hạn đời xe/thị trường/cấu hình | Không |
| Lịch đã xác minh | Đúng nguồn, trang, phiên bản, phạm vi và mọi chú thích | Khi hồ sơ xe khớp; thông báo vẫn chờ cố vấn kiểm tra |
| Lịch sử thực hiện | Ngày, ODO, thao tác, phiếu hoàn thành hoặc căn cứ xác nhận lịch sử | Dùng làm mốc tính lần tiếp theo |

“Có dầu hộp số trong danh mục” không xác nhận dầu nào phù hợp. Phải đối chiếu VIN, mã hộp số và chuẩn chất lỏng. Một cấp bảo dưỡng gồm nhiều kiểm tra cũng không có nghĩa thay mọi bộ phận ở cấp đó.

## 3. Đối chiếu các hãng và bộ phận thường gặp

| Hãng / phạm vi nguồn | Hạng mục và điểm khác biệt | Cách xử lý trong app |
|---|---|---|
| Honda City 1.5, 2023YM–2026YM, **Malaysia** | Lịch mẫu: dầu 10.000 km/6 tháng, lọc dầu 20.000/12, dầu truyền động 40.000/24, bugi iridium 100.000/60; nước làm mát lần đầu 200.000/120 | Mẫu bị khóa theo thị trường MY; không áp sang City VN. Mốc lặp nước làm mát để trống khi chưa xác minh. |
| Honda tại VN | Có sách theo dòng và thông báo sửa hướng dẫn cho phạm vi CR-V e:HEV cụ thể | Đối chiếu VIN/thời gian sản xuất; không dùng thông báo cho toàn bộ CR-V. |
| Toyota Vios 1.5 G/E, NGC102, **Malaysia** | Tài liệu tham khảo: CVT/bugi 100.000 km; nước làm mát đầu 160.000, lặp 80.000; các đời NCP150/NCP93 khác bảng | Không suy ra số tháng từ số km. Tài liệu hiệu lực 09/2024 không chứng minh xe thuộc model year 2024. |
| Hyundai Accent PE 2021 | Bảng phân biệt bugi thường và iridium/platinum; chú thích SP-IV 90.000 km/48 tháng phải xét cùng bảng tổng quát | Mẫu nháp cần bổ sung mã động cơ/hộp số. Không dùng lịch PE 2021 cho Accent BN7; không đưa mục 4WD của bảng chung vào xe FWD. |
| Kia | Hãng mô tả các cấp dịch vụ: lọc, phanh, đai, chất lỏng, điện/điện tử và điều hòa | Chỉ dùng để xây checklist. Lịch từng bộ phận phải tra sách đúng Morning/K3/Seltos/Carnival… và động cơ/hộp số thực tế. |
| Mazda | Cấp 1 trên trang hãng: 5.000 km/3 tháng; kiểm tra mức dầu, làm mát, phanh, bình điện và đai | Đó là cấp kiểm tra, không phải chu kỳ thay mọi chi tiết. Lọc gió, bugi, dầu hộp số và bình điện phải đối chiếu cấu hình. |
| Ford Ranger 2022– | PDF tách IOLM, đai cam Panther 2.0L, lọc nhiên liệu, loại hộp số và dẫn động | IOLM cần xử lý theo cảnh báo thực tế. Bảng nhiều cột chưa kiểm tra trực quan nên không nhập tự động các mốc phụ tùng; không dùng cho Territory/Explorer. |
| Mitsubishi | Kỳ dịch vụ chung 5.000 km/3 tháng; riêng All New Triton **4N16** 10.000 km/6 tháng. Hãng phân biệt I/R/L | Tách biến thể động cơ. Kỳ vào xưởng khác lịch thay từng chi tiết; 4WD, CVT và AT không gộp. |

Nguồn chính hãng:

1. [Honda VN – sách hướng dẫn](https://www.honda.com.vn/o-to/dich-vu-sau-ban-hang/huong-dan-su-dung), [Honda Malaysia – City 1.5](https://www.honda.com.my/doc/maintenance/2496).
2. [Toyota VN – Vios 2024](https://www.toyota.com.vn/hdsd/vios/2024), [Toyota Malaysia – các biến thể Vios](https://www.toyota.com.my/content/dam/malaysia/price-list-maintenance-packages/periodic-maintenance/september-2024/Vios-September-2024.pdf).
3. [Hyundai Thành Công – sách bảo hành/hướng dẫn](https://baohanhdientu.hyundai.thanhcong.vn/warranty), [Accent PE 2021](https://baohanhdientu.hyundai.thanhcong.vn/web/content/362/Accent%20PE%202021.pdf?unique=914fda49679483d1ccb931206a3830b1635a4a02), bảng PDF trang 185 và chú thích, thông số PDF trang 227.
4. [Kia Việt Nam – cấp bảo dưỡng](https://www.kiavietnam.com.vn/bao-duong-dinh-ki).
5. [Mazda Việt Nam – cấp bảo dưỡng](https://mazdamotors.vn/maintenance).
6. [Ford Việt Nam – lịch Ranger](https://www.ford.com.vn/content/dam/Ford/website-assets/ap/vn/Owner-Dashboard/Service%20%26%20Maintainance/maintenance-schedule-plan/lich-bao-duong-ranger.pdf), [hướng dẫn dầu/IOLM](https://www.ford.com.vn/support/how-tos/oil-change/oil-change-information/bao-lau-nen-thay-dau).
7. [Mitsubishi Motors Việt Nam – bảng dịch vụ và ký hiệu](https://www.mitsubishi-motors.com.vn/dich-vu/bao-duong-dinh-ky).

Các URL/trang/mốc của mẫu trước được giữ trong [maintenance-reference.json](research/maintenance-reference.json), vẫn tắt áp dụng. File danh mục chạy trong app chỉ có 2 mẫu nháp để hướng dẫn nhập; **không seed lịch đã duyệt vào database**.

## 4. Bộ phận, đo kiểm và vật tư

| Bộ phận | Áp dụng / Đo kiểm | Vật tư liên quan | Lưu ý |
|---|---|---|---|
| Dầu động cơ | Xăng / diesel / hybrid có động cơ đốt trong; Kiểm tra mức, rò rỉ; thay dầu đúng độ nhớt và chuẩn hãng, không chỉ dựa SAE. | Dầu đúng SAE/API/ACEA hoặc chuẩn riêng OEM; vòng đệm nút xả | Cảnh báo áp suất dầu, rò rỉ hoặc IOLM cần kiểm tra sớm; không chờ lịch. |
| Lọc dầu động cơ | Động cơ đốt trong; Thay lọc; kiểm tra gioăng, van và rò rỉ sau khi chạy thử. | Lọc đúng mã VIN, gioăng/đệm | Không coi thay dầu là tự động đã thay lọc: phải ghi riêng. |
| Lọc gió động cơ | Động cơ đốt trong; Kiểm tra bẩn/rách; vệ sinh hoặc thay theo sách và tình trạng. | Lọc gió đúng hình dạng, kích thước | Đi đường bụi có thể cần kiểm tra sớm hơn. |
| Lọc điều hòa | Xe có trang bị; Kiểm tra lưu lượng gió, bụi/mùi; vệ sinh khoang hoặc thay lọc. | Lọc cabin thường/than hoạt tính đúng mã | Không tự suy ra cần nạp gas khi lọc bẩn. |
| Bugi đánh lửa | Động cơ xăng; không áp dụng diesel; Kiểm tra mã, vật liệu điện cực, khe hở và lực siết; thay đúng loại. | Bugi thường / platinum / iridium theo động cơ | Bugi thường và iridium có thể có chu kỳ rất khác nhau. |
| Lọc nhiên liệu | Theo trang bị, phân biệt xăng và diesel; Kiểm tra/thay; diesel có thể phải xả nước theo cảnh báo. | Lọc, gioăng; nhiên liệu theo quy trình mồi hệ thống | Lọc xăng nằm trong bình và lọc diesel không dùng chung quy trình. |
| Nước làm mát | Theo động cơ / hệ thống làm mát trang bị; Kiểm tra mức, rò rỉ và tình trạng; thay/xả khí đúng quy trình. | Dung dịch đúng chuẩn, tỷ lệ pha; vòng đệm khi cần | Lần thay đầu có thể dài hơn chu kỳ lặp. Không mở nắp khi nóng. |
| Dầu phanh / ly hợp | Theo hệ thống thủy lực; Kiểm tra mức, rò rỉ; thay và xả khí đúng chuẩn hãng. | Dầu DOT đúng sách; không trộn tùy tiện | Đừng dùng kiểm tra mức dầu để reset mốc thay dầu. |
| Má phanh | Phanh đĩa; Đo bề dày, kiểm tra mòn lệch, tiếng kêu và đèn báo. | Má đúng cầu trước/sau; bộ phụ kiện theo thiết kế | Thay theo đo kiểm/giới hạn hãng, không đặt tuổi thọ km chung. |
| Đĩa phanh | Phanh đĩa; Đo chiều dày, độ đảo; kiểm tra xước/nứt. | Đĩa đúng kích thước và mã; dụng cụ đo | Ghi số đo và giới hạn MIN TH từ tài liệu/chi tiết. |
| Guốc phanh / trống phanh | Xe có phanh tang trống; Đo mòn, kiểm tra xi lanh và rò rỉ; điều chỉnh khi cần. | Guốc, lò xo, xi lanh theo chẩn đoán | Không áp dụng cho cầu chỉ dùng phanh đĩa. |
| Lốp xe | Tất cả xe; Đo độ sâu gai, áp suất, kiểm tra nứt/phồng; đối chiếu cỡ và tải. | Lốp đúng cỡ, chỉ số tải/tốc độ; van | Thay theo tình trạng và hướng dẫn hãng lốp/xe; không cố định km. |
| Đảo lốp | Tùy cấu hình lốp; Đảo đúng sơ đồ; kiểm tra lốp định hướng, cỡ trước/sau và TPMS. | Dụng cụ siết lực; van khi cần | Lốp khác cỡ trước/sau có thể không đảo theo sơ đồ thông thường. |
| Ắc quy 12 V | Theo trang bị; Đo tình trạng/khả năng khởi động, kiểm tra cực và giá đỡ. | Ắc quy thường / EFB / AGM đúng thiết kế | Start-stop cần loại phù hợp, có thể cần đăng ký/reset sau thay. |
| Dây đai phụ | Xe có trang bị; Kiểm tra nứt, sờn, độ căng và puly. | Dây đai, tăng đai/puly theo chẩn đoán | Khác dây đai cam; không gộp chu kỳ. |
| Dây đai cam | Chỉ động cơ dùng đai cam; Xác định động cơ dùng đai khô/đai trong dầu; thay đúng quy trình. | Bộ đai cam, tăng đai, phụ kiện theo sách | Không áp mốc đai cam cho động cơ dùng xích cam. |
| Dầu hộp số | Phân biệt MT / AT / CVT / DCT; Kiểm tra rò rỉ; thay đúng chuẩn, nhiệt độ và cách kiểm tra mức. | ATF/CVTF/MTF/DCTF đúng chuẩn; lọc/gioăng khi sách yêu cầu | Không dùng dầu CVT cho AT; điều kiện kéo tải có thể đổi lịch. |
| Dầu cầu / vi sai | Xe có cụm vi sai cần bảo dưỡng; Kiểm tra rò rỉ, thay theo cấu hình dẫn động. | Dầu đúng độ nhớt/chuẩn, đệm nút | Chỉ áp dụng đúng cầu và bộ vi sai của xe. |
| Dầu hộp số phụ | 4WD/AWD có trang bị; Kiểm tra/thay theo tài liệu hộp phân phối. | Dầu đúng chuẩn hộp phân phối | Không thêm hạng mục này mặc định cho xe FWD. |
| Lái, rô tuyn, giảm xóc | Tất cả xe theo cấu hình; Kiểm tra độ rơ, chụp bụi, rò rỉ giảm xóc; đo góc khi cần. | Rô tuyn/cao su/giảm xóc chỉ sau chẩn đoán | Cân chỉnh sau sửa chữa có ảnh hưởng hình học bánh xe. |
| Gạt mưa, đèn, còi | Tất cả xe; Kiểm tra gạt, phun rửa, đèn tín hiệu và còi. | Lưỡi gạt, bóng đèn đúng loại; nước rửa kính | Theo tình trạng; không đặt lịch thay đồng loạt. |
| Hệ thống điều hòa | Xe có trang bị; Đo nhiệt độ, kiểm tra rò rỉ và lượng môi chất theo chẩn đoán. | Môi chất/lubricant đúng nhãn xe, gioăng phù hợp | Không nạp gas định kỳ nếu chưa xác định thiếu hoặc rò. |
| DPF / EGR / SCR | Diesel có đúng trang bị; Đọc lỗi, kiểm tra điều kiện tái sinh, dùng dung dịch đúng SCR nếu có. | Dung dịch SCR đúng chuẩn; phụ tùng sau chẩn đoán | Không coi mọi xe diesel đều có SCR; không tự xóa/cắt hệ thống. |
| Làm mát pin / inverter | Hybrid có trang bị; Kiểm tra cửa hút gió/lọc và mạch làm mát đúng hướng dẫn. | Lọc, nước làm mát đúng mạch | Công việc điện áp cao cần kỹ thuật viên và quy trình hãng. |

Không đặt tuổi thọ km chung cho má/đĩa phanh, lốp, ắc quy, giảm xóc và gas điều hòa. Cố vấn ghi kết quả chẩn đoán, số đo, tiêu chuẩn chấp nhận và vật tư thực sự cần thay vào báo giá.

Với động cơ diesel, không gán bugi đánh lửa; với xe không có 4WD, không thêm hộp số phụ; với động cơ dùng xích cam, không gán lịch đai cam. Hạng mục điện áp cao chỉ thực hiện bởi người có đào tạo và quy trình phù hợp của hãng.

## 5. Cách dùng bản đã code

1. Admin cấp tài khoản ở **Quản trị Nhân sự**: chọn cố vấn/kế toán/nhân sự/thợ/khách.
2. Cố vấn tiếp nhận xe, liên kết khách theo email đã xác minh. Đăng nhập staff qua `/staff`.
3. Mở **Bảo dưỡng & Nhắc hạn** → tra hãng và bộ phận; nhập lịch từ sách với phạm vi chính xác. Admin kiểm tra nguồn và bấm **Xác minh & Kích hoạt**. Không xác minh mẫu còn “CẦN XÁC MINH”.
4. Chọn xe → **Cập nhật hồ sơ / ODO** → chọn lịch khớp. Nếu thiếu lịch sử thay trước đó, đối chiếu sổ và ghi công việc đã thực hiện trước khi tư vấn.
5. Quét nhắc hạn hoặc chờ tác vụ 5 phút. Cố vấn kiểm tra ODO, lịch sử, điều kiện thực tế rồi **Gửi vào app khách**.
6. Khách xem thông báo/lịch theo xe và đặt lịch. Cảnh báo không thay thế kết quả kiểm tra thực tế tại garage.
7. Trong **Cố vấn & Báo giá**, tạo kiểm tra đầu vào, phân công thợ có tài khoản, lập sơ bộ. Khách duyệt trực tiếp; nếu xác nhận qua điện thoại/tại quầy, cố vấn phải ghi căn cứ xác nhận.
8. Thợ được giao ghi chẩn đoán. Cố vấn lập bản chính thức; khách duyệt đúng phiên bản. Thay chẩn đoán hoặc lập phiên bản mới sẽ vô hiệu hóa xác nhận trước.
9. Chuyển báo giá chính thức vào xưởng: kiểm tra tồn/giá, tạo phiếu và xuất kho trong cùng giao dịch. Không được sửa các dòng khách đã duyệt.
10. Thợ hoàn thành checklist. Cố vấn nghiệm thu, ghi chạy thử hoặc lý do không chạy thử. Kế toán thu đủ tiền; cố vấn giao xe. Phiếu cũ vẫn giữ quy trình trước, không dựng xác nhận/QA hồi tố.

## 6. Dữ liệu và kiểm thử

| Bảng | Mục đích |
|---|---|
| `maintenance_profiles` | Phạm vi, quy tắc, nguồn và người xác minh |
| `vehicle_care` | Hồ sơ kỹ thuật, ODO mới nhất, lịch áp dụng |
| `maintenance_records` | Lịch sử thao tác từng bộ phận |
| `maintenance_reminders` | Chu kỳ duy nhất, hàng đợi kiểm tra và thông báo đã gửi |
| `service_visits` | Đầu vào, chẩn đoán, người phụ trách, nghiệm thu |
| `service_quotes` | Phiên bản, giá vật tư tại báo giá, quyết định khách |
| `employee_profiles` | Liên hệ, bộ phận, vị trí, ngày vào làm |

Migration `004_garage_care` bổ sung các bảng, liên kết phiếu–lượt dịch vụ và khóa chức năng; không sửa tổng tiền cũ, không đoán liên kết danh tính hay nhập lịch OEM đã duyệt.

Kiểm thử PostgreSQL dùng schema ngẫu nhiên riêng: lịch tháng/ngày cuối tháng, điều kiện km/thời gian, thị trường, ODO cũ, quyền chủ xe, không tạo nhắc trùng, phiên bản báo giá cũ, đổi giá và rollback tồn kho, chuyển đồng thời, nghiệm thu/thu tiền và khóa chức năng. Kiểm thử jsdom chạy HTML/JS thật với API giả lập; chưa phải xác nhận bố cục bằng trình duyệt thật.

## 7. Cài PWA

Mở địa chỉ HTTPS của garage bằng Chrome Android → **Cài AutoPro** khi trình duyệt cho phép; iPhone dùng Safari → Chia sẻ → Thêm vào Màn hình chính. Khi chạy local có thể thử trên `http://localhost:8000`; địa chỉ IP LAN qua HTTP không đáp ứng secure context trên điện thoại. Xem [yêu cầu cài PWA của MDN](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/Guides/Making_PWAs_installable).

Ứng dụng có biểu tượng, manifest và service worker, không tải lại trang khi có phiên bản mới giữa lúc nhập liệu. Mất mạng giữ thao tác chưa lưu ở màn hình hiện tại và báo trạng thái; không tự gửi lại các giao dịch thu tiền, duyệt báo giá hay xuất kho. Thông báo trong app không phải push nền khi đóng app.
