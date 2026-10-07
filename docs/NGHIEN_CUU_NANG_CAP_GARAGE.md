# AutoPro: nghiên cứu nâng cấp cho garage vừa và lớn

Ngày đối chiếu: 07/10/2026. Phạm vi: một garage, gồm web quản lý và ứng dụng cho khách hàng/kỹ thuật viên.

**Trạng thái cập nhật 07/10/2026:** đã triển khai bản vận hành gồm danh mục 24 bộ phận/7 hãng, hồ sơ và lịch bảo dưỡng có xác minh, nhắc hạn trong app, kiểm tra đầu vào/báo giá/duyệt/nghiệm thu, 3 vị trí mới và PWA. Xem [nghiên cứu chi tiết và cách dùng bản đã code](BAO_DUONG_VA_VAN_HANH.md). Các mục dưới đây giữ bản phân tích thiết kế ban đầu; phần Flutter, push, hóa đơn điện tử, lương và các giai đoạn mở rộng vẫn là đề xuất.

## 1. Nội dung trình bày với thầy

> AutoPro được định hướng thành hệ thống quản lý dịch vụ cho garage vừa và lớn. Web phục vụ quản trị, cố vấn dịch vụ, điều hành xưởng, kế toán và nhân sự; app phục vụ khách hàng và kỹ thuật viên. Điểm chính là hồ sơ xe và lịch kiểm tra/thay thế theo đúng phiên bản xe, số km và thời gian, có nguồn từ hãng. Quy trình bổ sung kiểm tra ban đầu, báo giá sơ bộ, chẩn đoán trong xưởng, khách duyệt báo giá chi tiết, thực hiện, kiểm tra chất lượng và bàn giao. Các bộ phận dùng chung dữ liệu và được cấp quyền theo công việc.

| Yêu cầu | Giải pháp đề xuất | Giá trị |
|---|---|---|
| Bảo dưỡng theo từng loại xe | Hồ sơ hãng/dòng/đời xe/động cơ/hộp số/thị trường, lịch có nguồn và phiên bản; theo dõi lần thực hiện từng hạng mục | Nhắc đúng xe, phân biệt kiểm tra với thay thế |
| Nghiệp vụ garage vừa/lớn | Tách tiếp nhận, chẩn đoán, báo giá, điều phối, vật tư, nghiệm thu và thu tiền | Biết xe đang ở bước nào, ai chịu trách nhiệm |
| Web kết hợp app | Web cho bộ phận quản lý; app cho khách và thợ; chung backend | Thợ thao tác tại xe; khách nhận thông tin trên điện thoại |
| Thêm vị trí nhân sự | Cố vấn dịch vụ, kế toán, nhân sự; quyền theo phân hệ và phạm vi dữ liệu | Cấp đúng quyền; hỗ trợ một người kiêm nhiệm |

Không dùng nhận định “garage nhỏ không ai dùng” làm kết luận thị trường. Đối tượng vừa/lớn là phạm vi lựa chọn của đề tài; nhu cầu thực tế cần kiểm chứng bằng khảo sát garage.

## 2. Khoảng trống ở phiên bản trước khi nâng cấp

| Hiện trạng được đọc trong code | Cần bổ sung |
|---|---|
| `Vehicle` có hãng/dòng xe dạng chuỗi, chủ xe và trạng thái | VIN, năm mẫu xe, ngày bắt đầu sử dụng, phiên bản động cơ/hộp số, thị trường và lịch sử số km |
| `RepairTicket` theo `draft → working → completed → paid` | Hồ sơ tiếp nhận, kiểm tra/chẩn đoán, báo giá có phiên bản, phê duyệt, nghiệm thu |
| Mỗi phiếu có một thợ chính và checklist hoàn thành | Phân công theo công việc, ca làm và khoang sửa; thợ chẩn đoán có thể khác thợ thực hiện |
| Tạo phiếu đang trừ tồn kho | Tách báo giá khỏi xuất kho; giữ hàng sau duyệt, xuất khi giao vật tư cho công việc |
| Mỗi phiếu thu đủ tiền một lần | Sổ thanh toán, cọc, công nợ và hoàn tiền; báo cáo thực thu tách khỏi giá trị dịch vụ |
| Tạo tài khoản chỉ hỗ trợ admin/mechanic/customer | Cố vấn, kế toán, nhân sự và quyền backend; `accountant` có trong enum nhưng chưa hoạt động đầy đủ |
| Frontend hiện là HTML/CSS/JS cho ba portal | App gọi API hiện có và API nghiệp vụ bổ sung |
| Làm mới có bảo vệ trạng thái đang nhập ở `fe/shared/core.js` | App/web mới tiếp tục giữ bản nháp và xử lý xung đột phiên bản |

Các điểm đối chiếu chính: [Vehicle](../be/models/vehicle.py), [RepairTicket](../be/models/repair_ticket.py), [luồng sửa chữa](../be/services/repair_service.py), [vai trò](../be/core/constants.py), [schema tài khoản](../be/schemas/auth.py), [phân quyền](../be/middleware/auth.py).

## 3. Kết quả nghiên cứu lịch bảo dưỡng

### 3.1. Nguồn và nguyên tắc áp dụng

Honda Việt Nam hướng dẫn tra lịch chi tiết trong sách sử dụng/sổ bảo hành và nêu việc bảo dưỡng phụ thuộc quãng đường, thời gian. Vì vậy danh mục không thể chỉ có một lịch cho cả hãng. [Honda Việt Nam: bảo dưỡng định kỳ](https://www.honda.com.vn/o-to/dich-vu-sau-ban-hang/bao-duong-dinh-ky).

Honda từng đính chính sách hướng dẫn nhanh CR-V e:HEV RS: mốc thay dầu đúng là 5.000 km hoặc 6 tháng. Thông báo xác định nhóm xe sản xuất 24/08/2023–12/03/2024. Đây là ví dụ cần lưu cả phiên bản tài liệu và thông tin đính chính. [Honda: thông báo triệu hồi/đính chính](https://www.honda.com.vn/o-to/trieu-hoi).

Các số liệu dưới đây là mẫu nghiên cứu, không phải lịch dùng chung cho mọi xe cùng tên. “Đã đọc nguồn” không thay thế bước xác nhận phiên bản xe thực tế và duyệt lịch của người phụ trách kỹ thuật.

### 3.2. Mẫu ở Việt Nam: sách gắn nhãn Hyundai Accent PE 2021

Trang in 7-10–7-11, PDF 185; cần duyệt cấu hình và chú thích.

| Hạng mục | Mốc thể hiện trong sách |
|---|---|
| Dầu động cơ | Thay tại 1.000 km/1 tháng; các cột tiếp theo 5.000 km/6 tháng, 10.000 km/12 tháng… |
| Bugi thường / iridium hoặc platinum | 40.000 / 100.000 km |
| Lọc gió điều hòa | 20.000 km |
| Dầu phanh/ly hợp | 40.000 km hoặc 24 tháng |
| Dầu hộp số SP-IV | Chú thích riêng: 90.000 km hoặc 48 tháng |

[Hyundai Thành Công: sách Accent PE 2021](https://baohanhdientu.hyundai.thanhcong.vn/web/content/362/Accent%20PE%202021.pdf?unique=914fda49679483d1ccb931206a3830b1635a4a02).

Chú thích SP-IV khác dòng chung 40.000 km. Đai/xích cam cần xác minh; lịch đang chờ duyệt.

### 3.3. Mẫu tham khảo khác thị trường: Honda City 1.5, Malaysia

Bảng chính hãng ghi City 1.5 2023YM–2026YM, trang PDF 1. Mốc km/tháng lấy điều kiện đến trước.

| Hạng mục | Mốc trong bảng |
|---|---|
| Dầu động cơ | 10.000 km / 6 tháng |
| Lọc dầu | 20.000 km / 12 tháng |
| Lọc gió động cơ, lọc cabin | 30.000 km / 18 tháng |
| Dầu hộp số | 40.000 km / 24 tháng |
| Dầu phanh | 60.000 km / 36 tháng |
| Bugi iridium | 100.000 km / 60 tháng |
| Nước làm mát | Mốc thay hiển thị 200.000 km / 120 tháng; chưa suy ra chu kỳ tiếp theo |

[Honda Malaysia: City 1.5 2023YM–2026YM](https://www.honda.com.my/doc/maintenance/2496).

Dùng để chứng minh cấu trúc lịch theo phiên bản/thị trường, chưa áp cho City Việt Nam. Không nhập giá RM vào báo giá garage.

### 3.4. Mẫu tham khảo khác thị trường: Toyota Vios NGC102, Malaysia

Nguồn: bảng dịch vụ hiệu lực 01/09/2024, trang PDF 1, ghi Vios 1.5G/1.5E Auto, mã NGC102. Ngày hiệu lực bảng không phải năm mẫu xe.

| Hạng mục | Mốc công bố |
|---|---|
| Dầu CVT | 100.000 km |
| Bugi iridium | 100.000 km |
| Lọc nhiên liệu | 80.000 km |
| Nước làm mát SLLC | Lần đầu 160.000 km; sau đó mỗi 80.000 km |

[Toyota Malaysia: bảng Vios, trang 1](https://www.toyota.com.my/content/dam/malaysia/price-list-maintenance-packages/periodic-maintenance/september-2024/Vios-September-2024.pdf#page=1).

Tài liệu có nhiều mã xe khác nhau trên các trang khác nhau. Không gộp NGC102, NCP150, NCP93 và NCP42 thành một lịch, không suy thêm hạn tháng khi dòng hạng mục chưa nêu.

### 3.5. Các nguồn Việt Nam còn cần hoàn tất đối chiếu

| Xe mục tiêu | Nguồn hãng đã tìm | Phần còn thiếu |
|---|---|---|
| Honda City bản Việt Nam | [Thư viện Honda Việt Nam](https://www.honda.com.vn/o-to/dich-vu-sau-ban-hang/huong-dan-su-dung) | Chọn đúng đời/phiên bản; đối chiếu đủ bảng và chú thích. Một số PDF bị chặn truy cập trong phiên nghiên cứu |
| Toyota Vios 2024 Việt Nam | [Thư viện Vios 2024](https://www.toyota.com.vn/hdsd/vios/2024) | Nội dung nhúng chưa đọc được đủ lịch; cần đối chiếu thêm sổ bảo hành/bảo dưỡng |
| Hyundai Accent BN7 2024 Việt Nam | [Thư viện Hyundai Thành Công](https://baohanhdientu.hyundai.thanhcong.vn/warranty), [sách BN7 2024](https://baohanhdientu.hyundai.thanhcong.vn/web/content/2339/S%C3%A1ch%20H%C6%B0%E1%BB%9Bng%20d%E1%BA%ABn%20s%E1%BB%AD%20d%E1%BB%A5ng%20xe%20Hyundai%20Accent%20BN7%202024%20b%E1%BA%A3n%20ti%E1%BA%BFng%20Vi%E1%BB%87t.pdf?unique=4401da1f7e80d6d5c43475a069dbc0c0416766c5) | File vượt giới hạn đọc của công cụ; chưa xác nhận mốc từng bộ phận. Không dùng lịch PE 2021 thay thế |

Không khẳng định đã nghiên cứu đầy đủ tất cả dòng xe. MVP nên hoàn thiện 2–3 cấu hình xe cụ thể thường gặp tại garage khảo sát rồi mở rộng. Chỉ lịch được duyệt và khớp xe mới sinh nhắc hạn. Bộ nguồn/mẫu cấu trúc nằm trong [maintenance-reference.json](research/maintenance-reference.json); toàn bộ mẫu đang tắt áp dụng.

### 3.6. Phân loại bộ phận cần quản lý

| Nhóm | Ví dụ | Cách hệ thống xử lý |
|---|---|---|
| Thay theo lịch được hãng xác định | Dầu máy, lọc dầu, bugi đúng loại, dầu hộp số, nước làm mát | Lưu mốc lần đầu/lặp lại, km/tháng, đặc tả và điều kiện |
| Kiểm tra theo lịch, thay theo tình trạng | Má/đĩa phanh, lốp, ắc quy 12V, gạt mưa, ống/dây, hệ thống treo | Ghi số đo, ảnh, kết luận; không tự tạo yêu cầu thay |
| Phụ thuộc cấu hình | Đai cam hoặc xích cam; CVT/AT/MT/DCT; lọc nhiên liệu | Xác nhận mã động cơ/hộp số và trang bị; không chỉ khớp tên dòng xe |
| Hệ thống đặc thù | Hybrid/EV, pin cao áp, làm mát pin, thiết bị hỗ trợ lái | Chỉ mở công việc khi có quy trình và nhân sự đủ chuyên môn phù hợp |
| Triệu hồi/chiến dịch kỹ thuật | Linh kiện hoặc phần mềm thuộc thông báo hãng | Tách khỏi nhắc bảo dưỡng; đối chiếu VIN/phạm vi chiến dịch, cố vấn xác nhận |

Đây là phân loại thiết kế cho hệ thống, không phải hướng dẫn kỹ thuật thay thế.

## 4. Nhắc hạn bảo dưỡng và thông báo

### 4.1. Hồ sơ đầu vào

- Hãng, dòng, năm mẫu xe, mã/phiên bản động cơ, hộp số, nhiên liệu và thị trường.
- VIN/số khung khi có; xác nhận cấu hình thủ công nếu chưa giải mã VIN.
- Ngày bắt đầu sử dụng có chứng cứ; lịch sử số km với thời điểm đo/người xác nhận.
- Lần thực hiện từng hạng mục: kiểm tra hay thay, ngày, số km, vật tư/đặc tả và phiếu nguồn.
- Điều kiện sử dụng theo sách hãng; cố vấn/kỹ thuật xác nhận lịch bình thường hay khắc nghiệt.

Không lấy `receivedDate` làm ngày xe bắt đầu sử dụng. Không coi lịch sử tại garage là toàn bộ lịch sử của xe. Khách khai đã thay ngoài garage thì ghi nguồn “khách cung cấp”, trạng thái chưa xác nhận.

### 4.2. Cách tính và trạng thái

1. Chọn đúng phiên bản lịch đã duyệt, khớp thị trường và cấu hình. Thiếu thông tin thì chuyển “Cần xác minh”.
2. Chọn mốc nền phù hợp: ngày/số km bắt đầu sử dụng đối với lần đầu; lần thực hiện cùng hành động đối với chu kỳ tính từ lần làm gần nhất. Lịch theo mốc tuyệt đối giữ các mốc riêng.
3. Tính hạn số km và hạn ngày theo tháng lịch. Cuối tháng được giới hạn về ngày hợp lệ của tháng đích, không quy đổi mỗi tháng thành 30 ngày.
4. Đến hạn khi số km đã xác nhận đạt mốc **hoặc** ngày hiện tại đạt hạn. Thiếu số km vẫn có thể kết luận đến hạn theo ngày nếu ngày nền đáng tin cậy; chưa đủ cơ sở cho cả hai thì chưa kết luận “chưa đến hạn”.
5. “Sắp đến hạn” dùng ngưỡng garage cấu hình, ví dụ 30 ngày/500 km. Đây là lựa chọn sản phẩm, không phải yêu cầu hãng.
6. Lần kiểm tra không đặt lại hạn thay thế. Hoàn thành thay thế được nghiệm thu mới ghi sự kiện và tính kỳ sau. Phiếu hủy/hoàn tác phải sửa bằng bản ghi điều chỉnh có nhật ký.

| Trạng thái | Hiển thị và thao tác |
|---|---|
| Cần xác minh | Cố vấn bổ sung cấu hình/số km/lịch sử; chưa gửi lời khẳng định cần thay |
| Sắp đến hạn | Danh sách nội bộ; cố vấn rà soát và liên hệ/khách đặt lịch |
| Đến hạn / Quá hạn | Nêu rõ hạng mục, kiểm tra hay thay theo lịch, căn cứ km hoặc ngày, nguồn và ngày cập nhật |
| Đã xử lý | Liên kết sự kiện đã nghiệm thu; vẫn giữ lịch sử thông báo |
| Khách từ chối / Hẹn lại | Ghi lý do và ngày theo dõi; không tự đánh dấu bảo dưỡng hoàn tất |

Mẫu nội dung: “Xe 30A-… đã đến kỳ kiểm tra phanh theo lịch được garage xác nhận. Số km cập nhật ngày …: … km. Vui lòng đặt lịch để kỹ thuật viên kiểm tra tình trạng.” Không gửi câu “phanh đã hỏng” từ phép tính lịch.

### 4.3. Kênh và trách nhiệm

MVP: danh sách nhắc hạn trên web cho cố vấn/quản đốc, hộp thư trên app cho khách/thợ. Cố vấn duyệt thông báo gửi khách; nếu khách chưa cài app, có tác vụ liên hệ và ghi kết quả. SMS/Zalo/email là tích hợp giai đoạn sau theo lựa chọn kênh của khách.

Worker chạy định kỳ, ghi nhiệm vụ nhắc hạn và hộp thư vào PostgreSQL. Khóa duy nhất theo xe + quy tắc + kỳ hạn ngăn tạo trùng khi worker chạy lại. Outbox và trạng thái gửi/retry tách khỏi giao dịch hoàn thành bảo dưỡng. Push chỉ là kênh báo có cập nhật; app tải nội dung sau khi xác thực, không đưa thông tin nhạy cảm vào màn hình khóa.

FCM có hướng dẫn Flutter; iOS cần cấu hình APNs và người dùng cần cấp quyền thông báo. Không coi gửi push thành công là khách đã đọc; hộp thư trong database và nhiệm vụ liên hệ vẫn là nguồn theo dõi. [Firebase: thiết lập](https://firebase.google.com/docs/cloud-messaging/flutter/get-started), [nhận thông báo](https://firebase.google.com/docs/cloud-messaging/flutter/receive-messages).

## 5. Quy trình garage vừa/lớn

Toyota mô tả vai trò cố vấn tiếp nhận, tư vấn/báo giá, khách xác nhận rồi kỹ thuật viên thực hiện. Quy trình sửa hộp số cũng có chẩn đoán, xác nhận phương án trước sửa và kiểm tra sau hoàn tất. Luồng dưới đây là thiết kế mở rộng cho AutoPro dựa trên các bước này, không phải quy trình nội bộ được sao chép toàn bộ từ một garage. [Toyota Đà Nẵng: quy trình dịch vụ](https://danang.toyota.com.vn/quy-trinh-3-buoc-bao-duong-xe-toyota-hybrid-tai-viet-nam), [Toyota Việt Nam: quy trình sửa hộp số](https://www.toyota.com.vn/tin-tuc/thong-tin-bo-tro/sua-chua-hop-so-toyota-44215).

| Bước | Người phụ trách | Dữ liệu/đầu ra cần có |
|---|---|---|
| 1. Đặt lịch và xếp tải | Cố vấn | Dịch vụ, thời lượng dự kiến, kỹ năng, khoang/ca; lịch chờ xác nhận |
| 2. Tiếp nhận | Cố vấn | Khách/xe, số km, nhiên liệu, triệu chứng, ảnh ngoại thất, đồ nhận giữ, giờ hẹn trả |
| 3. Kiểm tra ban đầu | Cố vấn | Checklist quan sát, kết luận sơ bộ, yêu cầu chẩn đoán; giá dự kiến ghi rõ chưa chốt |
| 4. Duyệt kiểm tra | Khách và cố vấn | Phạm vi/chi phí chẩn đoán, chấp thuận; dịch vụ xác định rõ có thể duyệt gói trực tiếp |
| 5. Chẩn đoán chi tiết | Thợ được phân công | Mã lỗi, số đo, ảnh, nguyên nhân, hạng mục đề nghị và thời gian thực hiện |
| 6. Báo giá chi tiết | Cố vấn | Bản báo giá có phiên bản: công, nhiều vật tư, lượng, giá, thuế/giảm giá, hạn giao |
| 7. Khách duyệt | Khách | Đồng ý/từ chối từng hạng mục hoặc toàn bộ phiên bản; phát sinh phải duyệt bổ sung |
| 8. Điều phối và thực hiện | Quản đốc, thợ, kho | Công việc đã duyệt, phân công/khoang, giữ hàng, phiếu xuất/hoàn, tiến độ/ảnh |
| 9. Nghiệm thu | Người kiểm tra chất lượng | Checklist, kết quả chạy thử khi phù hợp; chưa đạt thì trả việc sửa lại |
| 10. Thu tiền và bàn giao | Kế toán, cố vấn | Phiếu thu/cọc/công nợ, chứng từ; giải thích việc đã làm, hạng mục từ chối, lịch theo dõi |

Ba trạng thái nên độc lập: tiến độ kỹ thuật, phê duyệt báo giá và thanh toán. Xe làm xong chưa chắc đã thu tiền; thu tiền không chứng minh xe đã đạt nghiệm thu.

Quy tắc quan trọng:

- Báo giá sơ bộ không trừ kho và không trở thành doanh thu.
- Khách duyệt đúng phiên bản báo giá; chỉnh giá/số lượng tạo bản mới, không sửa bản đã duyệt.
- Tách quyền chẩn đoán khỏi quyền sửa chữa; thợ có thể vào xưởng để kiểm tra khi khách đã duyệt kiểm tra.
- Giữ hàng sau duyệt không đồng nghĩa vật tư đã lắp. Tồn thực, lượng đã giữ và lượng khả dụng cần tách.
- Một công việc có thể cần nhiều vật tư; một mã vật tư có thể phù hợp nhiều cấu hình xe. Lưu tương thích/mã OEM/đặc tả, không ghép theo tên gần giống.
- Giao xe cần nghiệm thu đạt và điều kiện thanh toán/công nợ được chấp thuận. Chính sách công nợ chỉ áp dụng khi garage bật chức năng và người có quyền phê duyệt.
- Báo cáo tách thực thu, giá trị dịch vụ và công nợ; năng suất thợ dựa trên công việc/giờ công, không chỉ số phiếu.
- Giai đoạn đầu ưu tiên sửa chữa chung và bảo dưỡng. Đồng sơn, bảo hiểm, bảo hành và nhiều chi nhánh mở rộng sau.

## 6. Vị trí và phương án khóa chức năng

### 6.1. Vai trò đề xuất

| Vai trò | Công việc | Thiết bị chính |
|---|---|---|
| Quản trị/chủ garage | Cấu hình, cấp quyền, duyệt ngoại lệ, xem hiệu quả | Web |
| Cố vấn dịch vụ (`service_advisor`) | Tiếp nhận, kiểm tra ban đầu, dự toán, báo giá, xin duyệt, liên hệ nhắc hạn và bàn giao | Web/tablet |
| Điều hành xưởng | Xếp ca/khoang, phân công, theo dõi chất lượng | Web/tablet |
| Kỹ thuật viên | Chẩn đoán và thực hiện việc được giao; ảnh/checklist/yêu cầu vật tư | App |
| Kế toán (`accountant`) | Chứng từ, thu/chi, công nợ, đối soát, báo cáo tiền | Web |
| Nhân sự (`hr`) | Hồ sơ nhân viên, chuyên môn/chứng chỉ, ca làm, nghỉ phép | Web |
| Thủ kho | Nhập/xuất/hoàn, giữ vật tư, kiểm kê, đề nghị mua | Web/tablet |
| Khách hàng | Xe, đặt lịch, duyệt báo giá, tiến độ, lịch sử và nhắc hạn | App |

Ưu tiên thêm ba vị trí thầy yêu cầu: cố vấn, kế toán, nhân sự. Điều hành xưởng và thủ kho là nhóm quyền có thể kiêm nhiệm ở MVP; garage lớn có thể tách tài khoản riêng.

### 6.2. Ma trận quyền mặc định

“Phụ trách” là trong phạm vi được giao; khách chỉ được thao tác trên xe/phiếu của mình.

| Chức năng | Cố vấn | Thợ | Kế toán | Nhân sự | Khách |
|---|---|---|---|---|---|
| Tiếp nhận, kiểm tra sơ bộ | Tạo/sửa | Xem khi được giao | Xem thông tin liên quan chứng từ | Không | Xem của mình |
| Chẩn đoán, checklist sửa | Xem | Cập nhật việc được giao | Không sửa | Không | Xem bản công bố |
| Lập báo giá | Tạo/gửi | Đề nghị hạng mục | Xem bản được duyệt | Không | Duyệt/từ chối của mình |
| Thu tiền, công nợ | Xem trạng thái | Không | Ghi nhận/đối soát | Không | Xem của mình |
| Hồ sơ và ca nhân viên | Không | Xem ca bản thân | Xem dữ liệu được cấp cho trả lương | Quản lý | Không |
| Cấp quyền tài khoản | Không | Không | Không | Đề nghị, không tự cấp quyền admin | Không |
| Nhắc bảo dưỡng | Rà soát/liên hệ | Xem xe được giao | Không | Không | Xem xe của mình |

Quyền phân công và quyền nghiệm thu được cấp riêng cho quản đốc/người kiểm tra. Chủ garage kiểm soát cấp quyền; HR không được nâng quyền chính mình.

**Đề xuất chọn quyền theo phân hệ, có vai trò mặc định:**

- Một người có thể nhận nhiều nhóm quyền, ví dụ cố vấn + thủ kho. Không cần cấp toàn quyền admin để kiêm nhiệm.
- Tách `jobPosition` (chức danh) khỏi quyền truy cập. Đổi chức danh không tự cấp quyền.
- `user_roles → role_permissions` cấp thao tác như `intake.write`, `quote.send`, `work.assigned.update`, `payment.create`, `employees.manage`.
- Garage có cấu hình bật/tắt phân hệ, ví dụ công nợ hoặc nhân sự nâng cao. Quyền hiệu lực = phân hệ đang bật + quyền tài khoản + phạm vi bản ghi + trạng thái nghiệp vụ.
- Web/app ẩn thao tác không được cấp; backend vẫn kiểm tra quyền ở mọi API. Gọi URL trực tiếp cũng phải bị từ chối.
- Khóa phân hệ giữ lịch sử đã phát sinh; chế độ đọc/xử lý hồ sơ tồn đọng phải được quy định trước, không làm mất chứng từ.
- Quyền thay đổi được đọc từ database và thu hồi phiên/cache khi cần; lưu nhật ký người thay đổi.
- Giai đoạn đầu nhân sự chỉ quản lý hồ sơ/ca/chuyên môn. Bảng lương và kế toán tổng hợp là phạm vi riêng; không gọi phân hệ Thu tiền hiện tại là phần mềm kế toán đầy đủ.

## 7. Web kết hợp app và giải pháp công nghệ

### 7.1. Chức năng từng nền tảng

| Nền tảng | Màn hình ưu tiên |
|---|---|
| Web quản lý | Hàng đợi tiếp nhận, kiểm tra sơ bộ, báo giá, điều phối khoang/ca, nhắc hạn, kho, tài chính, nhân sự, báo cáo |
| App khách | Xe của tôi, lịch hẹn, báo giá chờ duyệt, tiến độ, lịch sử, nhắc bảo dưỡng, chứng từ, liên hệ cố vấn |
| App thợ | Việc được giao, nhận việc, chẩn đoán/số đo/ảnh, checklist, yêu cầu vật tư, tạm dừng và lý do, gửi nghiệm thu |

Đề xuất MVP: một ứng dụng Flutter có hai không gian theo quyền đăng nhập; màn hình thợ và khách được thiết kế riêng. Không cho người dùng tự chuyển quyền bằng nút chọn vai trò. Nếu garage yêu cầu phân phối nội bộ cho thợ, có thể tách hai app từ các package dùng chung.

Android trước là đề xuất demo, chưa phải quyết định đã thống nhất. iOS cần môi trường build/ký/phát hành phù hợp. PWA có thể hỗ trợ thử luồng nhưng không được ghi thành app Android/iOS đã hoàn thành.

### 7.2. Bảng giải pháp công nghệ

| Thành phần | Phương án | Lý do |
|---|---|---|
| Backend | Giữ FastAPI, tách service nghiệp vụ và API có version khi cần | Tái sử dụng project và kiểm tra quy tắc ở một nơi |
| Database | Giữ PostgreSQL + SQLAlchemy async + Alembic | Giao dịch kho/tiền và dữ liệu quan hệ; migration có backup |
| Quản trị database | pgAdmin4 | Công cụ quản lý PostgreSQL; app không kết nối pgAdmin hay database trực tiếp |
| Web | Tái sử dụng bố cục/màu admin; chia module theo quyền | Phù hợp bảng, form và nhiều phân hệ |
| Mobile | Đề xuất Flutter; views/view models/repositories/services | Tách giao diện khỏi truy cập API, dễ giữ bản nháp và kiểm thử |
| Thông báo | Hộp thư PostgreSQL + outbox/worker; FCM khi có app | Có lịch sử, chống trùng, retry; push hỗ trợ báo cập nhật |
| Ảnh kiểm tra | Lưu file/object storage, metadata trong PostgreSQL | Phân quyền tải ảnh theo xe/phiếu |
| Đồng bộ | API chung, phiên bản bản ghi, thao tác có mã chống lặp | Ngăn ghi đè và tạo phiếu/thu tiền trùng khi retry |
| Bảo mật | Tài khoản/JWT hiện có, bổ sung quyền/phạm vi và quản lý phiên cho mobile | Không tạo hệ đăng nhập riêng cho app |

Flutter có hướng dẫn phân tầng UI và dữ liệu qua view model, repository và service; kiến trúc trên là lựa chọn đề xuất cho project. [Flutter: hướng dẫn kiến trúc](https://docs.flutter.dev/app-architecture/guide).

Luồng dữ liệu: **Web và app → FastAPI → PostgreSQL**. Worker dùng cùng quy tắc backend để tạo nhắc hạn; không có database nghiệp vụ riêng cho từng vai trò.

UX mobile: thao tác chính rõ ràng, nút dễ bấm, checklist theo công việc, ảnh gắn đúng hạng mục, màn hình có trạng thái đang gửi/thành công/thất bại. Bản nháp giữ khi mất mạng. Dữ liệu tải nền không ghi đè form đang sửa.

MVP mất mạng: cho xem cache có thời điểm cập nhật và lưu bản nháp ảnh/checklist; duyệt báo giá, xuất kho, chuyển trạng thái và thu tiền cần kết nối. Bản nháp chưa gửi không hiển thị như đã hoàn thành. Phần offline đầy đủ cần xử lý xung đột trước khi mở rộng.

## 8. Thiết kế dữ liệu đề xuất

Đây là bảng thiết kế, chưa phải schema đã migration.

| Nhóm | Bảng/quan hệ đề xuất | Quy tắc |
|---|---|---|
| Cấu hình xe | `vehicle_variants`, bổ sung liên kết vào `vehicles` | Hãng/dòng/năm mẫu/động cơ/hộp số/thị trường; xe “khác” chờ xác minh |
| Số km | `odometer_observations` | Thời điểm, số km, nguồn, người xác nhận; giảm số km phải giải thích/sửa bằng bản ghi |
| Tài liệu/lịch hãng | `maintenance_sources`, `maintenance_profiles`, `maintenance_rules` | URL, trang in và trang PDF, phiên bản, điều kiện, mốc đầu/lặp, người duyệt |
| Lịch sử từng hạng mục | `vehicle_service_events` | Hành động kiểm tra/thay, ngày/số km, cấu hình lúc làm, nguồn, phiếu nghiệm thu |
| Nhắc hạn | `maintenance_due_tasks`, `notifications`, `notification_deliveries` | Chống trùng theo kỳ hạn; kết quả liên hệ, trạng thái gửi/đọc |
| Tiếp nhận/chẩn đoán | `service_visits`, `inspection_reports`, `inspection_findings`, `attachments` | Tách sơ bộ/chuyên sâu/nghiệm thu; ảnh và số đo có người ghi |
| Báo giá | `quotes`, `quote_revisions`, `quote_lines`, `quote_approvals` | Snapshot giá/công/vật tư; duyệt gắn đúng revision và khách có quyền |
| Thực hiện | Mở rộng phiếu hiện tại hoặc `work_orders`, `work_tasks`, `task_assignments`, `quality_checks` | Truy nguyên đến báo giá đã duyệt; nhiều người/ca/khoang |
| Vật tư | `part_fitments`, `parts_reservations`, phiếu xuất/hoàn và ledger hiện có | Một việc nhiều vật tư; giữ/xuất/hoàn nguyên tử, đúng cấu hình |
| Tiền | `invoices`, `payments`, `payment_allocations`, điều chỉnh/hoàn | Decimal/NUMERIC; bất biến chứng từ đã chốt; chống thu trùng |
| Nhân sự/quyền | `employee_profiles`, `shifts`, `user_roles`, `role_permissions`, cấu hình module | Hồ sơ thợ mở rộng và giữ liên kết tài khoản; phạm vi dữ liệu |
| Nhật ký | `audit_events` | Ai, thời điểm, thao tác, đối tượng và lý do thay đổi quan trọng |

`maintenance_rules` cần tối thiểu: hành động, điều kiện cấu hình, kiểu lịch (mốc tuyệt đối hoặc từ lần làm gần nhất), mốc lần đầu km/tháng, chu kỳ tiếp theo km/tháng, chế độ sử dụng, nguồn/trang và trạng thái duyệt. Null có nghĩa chưa được nguồn xác nhận hoặc không có chiều hạn đó; không tự đổi thành 0.

API mới dự kiến: kiểm tra theo lượt tiếp nhận; báo giá/phê duyệt; công việc được giao; hạn bảo dưỡng theo xe; hộp thư theo tài khoản; chứng từ/thanh toán; hồ sơ/ca nhân viên. Thiết kế phân quyền đi cùng từng endpoint, không thêm role vào enum rồi cho dùng toàn bộ API admin.

Chuyển đổi dữ liệu: bổ sung bảng/cột nullable trước, giữ lịch sử xe/phiếu/tiền cũ; không tự điền số km, VIN hoặc lịch thay thế từ dữ liệu không có chứng cứ. Hoàn tất kiểm thử trên schema riêng, backup rồi mới nâng cấp database thật. Việc mở lịch bảo dưỡng cần một bước duyệt dữ liệu độc lập.

## 9. Phân kỳ và tiêu chí nghiệm thu

| Giai đoạn | Kết quả cần có | Tiêu chí kiểm chứng |
|---|---|---|
| 1. Xác nhận nghiệp vụ và quyền | Chọn garage khảo sát; cố vấn/kế toán/HR dùng được phân hệ đúng quyền | Gọi API trái quyền bị từ chối; khóa module không rò dữ liệu; giữ tài khoản cũ |
| 2. Tiếp nhận và báo giá | Kiểm tra sơ bộ/chẩn đoán, báo giá version, khách duyệt | Báo giá không trừ kho; phát sinh cần duyệt mới; không bắt đầu việc chưa được phép |
| 3. Hồ sơ xe và bảo dưỡng | 2–3 cấu hình xe VN có lịch đầy đủ được duyệt; nhắc nội bộ và hộp thư | Khớp đúng phiên bản; km HOẶC ngày; không nhắc từ lịch khác thị trường/thiếu nguồn |
| 4. App demo | App khách/thợ gọi cùng backend trên thiết bị Android | Khách A không đọc xe B; thợ chỉ sửa việc giao; giữ bản nháp khi đồng bộ/mất mạng |
| 5. Vận hành mở rộng | Khoang/ca, QA, thanh toán nhiều lần, báo cáo | Giữ/xuất kho không âm; không thu trùng; xe chỉ bàn giao sau QA và điều kiện tài chính |

Ca kiểm thử bảo dưỡng phải có: đến hạn theo ngày dù ít chạy; đến hạn theo km trước ngày; mốc đầu khác chu kỳ sau; kiểm tra không reset thay; thiếu lịch sử; số km cũ; chuyển lịch bình thường/khắc nghiệt; đính chính tài liệu; worker chạy lại không tạo trùng; khách hẹn lại không biến thành đã bảo dưỡng.

Trước khi chốt phạm vi, khảo sát với garage: các vai trò có kiêm nhiệm không; loại xe/cấu hình thường gặp; tài liệu đang dùng; thời gian chẩn đoán và cách xin khách duyệt; cách xuất/hoàn vật tư; tiêu chí QA; chính sách cọc/công nợ; cách xếp ca/khoang; thiết bị điện thoại và vùng mạng yếu; cách liên hệ khách không cài app. Chưa có dữ liệu phỏng vấn garage thực tế trong nghiên cứu này.
