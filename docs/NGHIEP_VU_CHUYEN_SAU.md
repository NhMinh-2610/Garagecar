# Phân vai và nghiệp vụ gara vừa/lớn

Cập nhật 08/10/2026. Tài liệu mô tả chức năng đã có trong code; không coi các tác vụ này là một hệ thống ERP hoặc kế toán pháp định hoàn chỉnh.

## Không gian làm việc độc lập

| Chức danh | Trang | Công việc và kiểm soát |
|---|---|---|
| Cố vấn dịch vụ | `/advisor` | Tiếp nhận, xác nhận lịch hẹn, liên kết chủ xe, kiểm tra đầu vào, báo giá nhiều phiên bản, phân công kiểm tra kỹ, theo dõi bảo dưỡng, nghiệm thu, bàn giao và phản hồi sau sửa. Không thu/chi tiền hay sửa hồ sơ nhân sự. |
| Kế toán | `/accountant` | Thu đủ tiền sau nghiệm thu, ghi phương thức và mã giao dịch, xem phiếu thu/doanh thu, lập đề nghị chi có chứng từ, chi sau khi quản trị duyệt. Không thay hạng mục, cấp tài khoản hay phân ca. |
| Nhân sự | `/hr` | Hồ sơ từng nhân viên, ca làm, duyệt nghỉ, xác minh và thu hồi hồ sơ đào tạo/chứng chỉ. Không lập báo giá, thu tiền hay cấp quyền tài khoản. |
| Kỹ thuật viên | `/mechanic` | Phiếu được giao, chẩn đoán, cập nhật công việc với ảnh kết quả, ảnh bao bì và mã vật tư, xem lịch làm/yêu cầu nghỉ của mình. |
| Khách hàng | `/customer` | Xe và lịch sử của mình, duyệt phiên bản báo giá, lịch bảo dưỡng, thông báo, bằng chứng ảnh và đặt lịch. |
| Quản trị | `/admin` | Điều phối, quản lý kho/danh mục, cấp tài khoản/quyền, duyệt chi và xem các phân hệ nghiệp vụ theo quyền còn được cấp. |

Các trang dùng chung thành phần giao diện nhưng có HTML/menu riêng và kiểm tra vai trò trước khi tải dữ liệu. `/staff` chỉ chuyển đến trang đúng vai trò. API kiểm tra quyền độc lập với menu; khóa tính năng ở admin vẫn có hiệu lực.

## Hoàn thành công việc có bằng chứng

1. Thợ bắt đầu phiếu được giao.
2. Khi xác nhận từng hạng mục, mở form chụp/chọn ảnh kết quả, điền kết quả đo kiểm và ghi chú.
3. Hạng mục có vật tư cần thêm ảnh bao bì/nhãn, mã sản phẩm hoặc mã vạch, số lô/serial nếu có. Mã phải trùng SKU hoặc barcode đã khai báo; kho chưa có SKU phải được quản trị bổ sung từ nhãn thật.
4. Backend lưu ảnh và ghi chú, người gửi, thời điểm nhận, mã mong đợi và mã đã nhập. Mã SKU của hạng mục được lưu để giữ nhận dạng khi danh mục thay đổi.
5. Chỉ xác nhận hạng mục khi đã có đủ bằng chứng của lần thực hiện hiện tại. Mở lại hạng mục tăng số lần thực hiện và yêu cầu ảnh mới; ảnh cũ giữ nguyên trong lịch sử.
6. Khi mọi hạng mục đã xong, kết thúc phiếu. Cố vấn xem ảnh, nghiệm thu kết quả/an toàn/chạy thử; kế toán thu tiền; cố vấn giao xe.

Ảnh chỉ được xem bởi chủ xe, thợ được giao, cố vấn hoặc quản trị có quyền xưởng. Kế toán và nhân sự không được truy cập API ảnh. API ảnh yêu cầu Bearer token và trả `Cache-Control: private, no-store`; không có URL ảnh công khai, không đưa token vào đường dẫn và service worker không cache API.

Ảnh đầu vào JPEG/PNG/WebP tối đa 3 MB sau nén, tối đa 16 megapixel; server đọc ảnh thật, xoay theo EXIF và ghi lại JPEG tối đa 1920 px, bỏ metadata EXIF. PWA nén ảnh camera lớn trước khi gửi, nhận file gốc tối đa 20 MB. Mỗi hạng mục/mỗi lần thực hiện tối đa 12 ảnh. Hiện lưu ảnh trong PostgreSQL để dữ liệu và ảnh cùng giao dịch/backup; khi vận hành quy mô lớn cần đánh giá dung lượng và chuyển sang object storage có kiểm soát truy cập.

Ảnh và mã đúng chỉ hỗ trợ truy vết, không chứng minh phụ tùng chính hãng hay tự động xác nhận phù hợp VIN. Chưa có OCR, giải mã barcode tự động hoặc kiểm chứng nhà cung cấp. Không cho phép xác nhận công việc offline rồi tự gửi lại khi có mạng.

## Kho và cấu hình phụ tùng

Quản trị vào Kho → Sửa để khai báo SKU thật, barcode, hãng sản xuất và cờ vật tư cao áp. Mã SKU đã dùng trên phiếu không đổi sang một sản phẩm khác; cần tạo mã kho riêng.

Nút **Tương thích** nhập một hoặc nhiều cấu hình: hãng, dòng, khoảng năm model, động cơ/mã hệ truyền động và liên kết tài liệu xác nhận. Khi có cấu hình khai báo, backend chỉ xuất vật tư nếu hồ sơ xe khớp hãng/dòng/năm/động cơ; thiếu hồ sơ hoặc không khớp bị chặn và giao dịch không làm giảm tồn kho. Danh sách trống biểu thị chưa khai báo, cần cố vấn kiểm tra thủ công. Không coi bộ lọc theo dòng xe trong thư viện là danh sách SKU đặt hàng.

## Kiểm soát thu–chi

- Thu một lần toàn bộ số tiền của phiếu đã hoàn thành, có nghiệm thu nếu thuộc luồng báo giá.
- Phương thức tiền mặt/chuyển khoản/thẻ; chuyển khoản hoặc thẻ cần mã giao dịch. Đây là ghi nhận tại quầy, không tích hợp cổng thanh toán.
- Mỗi phiếu sửa có tối đa một phiếu thu mới. Phiếu thu lưu số tiền, người nhận, phương thức, mã và thời điểm; gửi lại cùng xác nhận không tạo lần thu thứ hai. Không sửa đè thông tin thu đã ghi.
- Đề nghị chi cần người nhận, loại chi, số chứng từ duy nhất, số tiền dương và căn cứ. Quản trị duyệt, người lập không tự duyệt. Chỉ đề nghị được duyệt mới được chi; không chi hai lần.
- Đề nghị chưa duyệt có thể được người lập hoặc quản trị hủy; giữ lịch sử. Đề nghị đã chi không bị xóa/hủy bằng các API này.
- Phiếu đã thu trước migration không được tự dựng thông tin người nhận/phương thức. Vẫn tra cứu trong lịch sử cũ.

Chưa triển khai thanh toán một phần, hoàn tiền, sổ cái kép, chốt quỹ, bảng lương, thuế hoặc hóa đơn điện tử. Danh sách thu/chi hiện trả tối đa 1.000 bản ghi gần nhất; không dùng tổng của danh sách đó như báo cáo toàn bộ sổ kế toán.

## Nhân sự và năng lực

- Phân ca theo nhân viên, giờ bắt đầu/kết thúc có múi giờ Việt Nam, vị trí/khu vực và ghi chú. Một ca tối đa 16 giờ; không phân trùng ca cho cùng người hoặc trùng kỳ nghỉ đã duyệt.
- Ca có thể hủy và giữ lịch sử; vị trí trong ca không phải hệ thống giữ chỗ độc quyền cho cầu nâng/khoang sửa.
- Mỗi nhân viên gửi yêu cầu nghỉ của chính mình. Nhân sự/quản trị duyệt hoặc từ chối có ghi chú; không tự duyệt. Nếu đang có ca trùng, phải hủy/phân lại trước khi duyệt nghỉ.
- Chứng chỉ ghi người được đào tạo, nhóm năng lực, đơn vị cấp, mã hồ sơ, ngày hiệu lực và hết hạn, người xác minh. Có thu hồi kèm căn cứ, giữ lịch sử; không tự xác minh hồ sơ của mình.
- Vật tư đánh dấu cao áp yêu cầu người gửi bằng chứng/xác nhận công việc có hồ sơ `ev_safety` còn hiệu lực và chưa bị thu hồi.

Hồ sơ chứng chỉ trong ứng dụng không thay thế đào tạo thực hành hoặc quy trình an toàn của hãng. Không cung cấp hướng dẫn thao tác điện cao áp; garage phải có người đủ năng lực và tài liệu được phép sử dụng. Chưa có chấm công, tính lương hoặc phân lịch tài nguyên tự động.

## VinFast và mở rộng danh mục

Danh mục hiện có **15 hãng, 100 dòng xe, 41 nhóm bộ phận**. Thêm VinFast, Nissan, Suzuki, Isuzu, Subaru, Mercedes-Benz, BMW, MG bên cạnh 7 hãng cũ. Có cả dòng xe cũ đang lưu hành; đây không phải thống kê thị phần hoặc danh sách sản phẩm đang bán.

VinFast tách nhóm xe điện VF/Green/EC Van với Fadil, Lux A2.0, Lux SA2.0, President có động cơ đốt trong. Khi chọn VF 8 thuần điện, thư viện bỏ nhóm dầu/lọc động cơ, bugi, nhiên liệu; có nhóm phanh, lốp, lọc cabin, điện 12 V, làm mát pin, giảm tốc, cổng sạc và các cụm điện theo trang bị. Không đặt lịch thay pin kéo hoặc bộ điện công suất theo một số km chung.

Gợi ý theo hệ truyền động chỉ giới hạn nhóm tra cứu; vẫn phải kiểm tra trang bị và biến thể thực tế. Danh mục không chứa mã OEM tự tạo. Lịch VinFast cần sách đúng dòng/đời/cấu hình, nguồn/trang/phiên bản và quản trị xác minh trước khi tự tạo nhắc hạn.

Nguồn hãng đã đối chiếu:

| Hãng | Nguồn trực tiếp | Cách dùng |
|---|---|---|
| VinFast | [Dịch vụ bảo dưỡng](https://vinfastauto.com/vn_vi/dich-vu-bao-duong-oto); [sổ VF 8 VN](https://static-cms-prod.vinfastauto.com/20241206_VF8_VN_1.6_SVC30000403.pdf); [sổ VF 3 VN](https://static-cms-prod.vinfastauto.com/250618_vf3_vn_vi_1.5_svc69000164aa.pdf) | Đối chiếu dòng xăng/điện, hồ sơ bảo dưỡng và tài liệu đúng xe; không chuyển mọi mốc trên một trang tổng hợp sang tất cả VF. |
| Nissan | [Lịch bảo dưỡng theo mẫu](https://www.nissanvietnam.vn/lich-bao-duong-c5.html) | Chọn mẫu trước khi nhập lịch; e-POWER có động cơ đốt trong. |
| Suzuki | [Hậu mãi ô tô](https://suzuki.com.vn/pages/hau-mai) | Tra chính sách và yêu cầu dịch vụ theo xe. |
| Isuzu | [Thông tin và câu hỏi thường gặp](https://isuzu-vietnam.com/cau-hoi-thuong-gap) | Phân biệt mẫu du lịch/bán tải và tài liệu xe tải. |
| Subaru | [Subaru Service](https://www.subaru.asia/vn/en/owners/subaru-service.php) | Kiểm tra dịch vụ và vật tư theo cấu hình xe. |
| Mercedes-Benz | [Phụ tùng chính hãng](https://www.mercedes-benz.com.vn/vi/passengercars/services/genuine-parts.html) | Tra mã và nguồn phụ tùng thực tế. |
| BMW | [Dịch vụ và bảo dưỡng](https://www.bmw.vn/vi/services-workshop/services-and-workshop-2025/) | Tham khảo quy trình dịch vụ và yêu cầu từng xe. |
| MG | [Chính sách bảo hành](https://mgmotor.vn/wp-content/uploads/2025/04/Chinh-sach-bao-hanh-MG.pdf) | Phân biệt bảo hành với vật tư và việc bảo dưỡng theo sách xe. |

Các ghi chú phân loại và kiểm soát phần mềm là thiết kế của project; không coi đó là tài liệu sửa chữa hoặc chứng nhận của hãng.

## Nâng cấp dữ liệu

Migration `005_professional_workflow` thêm 7 bảng nghiệp vụ, các trường mã/cấu hình vật tư, số lần bằng chứng và mã vật tư lưu trên hạng mục. Không sửa giá, số lượng hay nội dung phiếu cũ.

```powershell
python be/manage.py upgrade
```

Lệnh yêu cầu backup PostgreSQL thành công. Migration `006_car_brands` bổ sung các hãng đã nghiên cứu vào bảng `brands`, không đổi tên hãng cũ. Khi database đã ở `006`, khởi động lại backend để dùng code mới. Sau nâng cấp, quản trị khai báo SKU/barcode thật, cấp tài khoản đúng vai trò và nhân sự nhập hồ sơ đào tạo đã xác minh. Không tự tạo chứng chỉ hoặc tài khoản demo mới.
