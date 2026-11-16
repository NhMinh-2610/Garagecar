# Chuẩn bị gặp GVHD: câu hỏi dự kiến và kịch bản demo AutoPro

Ngày chuẩn bị: 16/11/2026.

**Căn cứ:** hai tài liệu `Y_tuong_project_AutoPro.docx`, `Y_tuong_project_AutoPro_Thuyet_minh.docx`, README và mã nguồn hiện tại. Bản PDF `20225886_NguyenNhatMinh_PhieuGiaoNhiemVu_DATN.pdf` không còn tại đường dẫn trong project; chưa thể đối chiếu nguyên văn phiếu giao nhiệm vụ. Những câu hỏi dưới đây là dự đoán, không phải thông tin về kế hoạch của thầy.

**Mức xác minh:** đã đối chiếu tài liệu và mã nguồn; đây là kịch bản diễn tập, chưa phải biên bản chạy demo giao diện thành công. Chạy thử toàn bộ trên database demo trước buổi gặp.

## 1. Nếu buổi trước thầy hỏi use case, hôm nay nên chuẩn bị gì?

Ưu tiên chuẩn bị theo chuỗi: **use case chi tiết → dữ liệu → xử lý → màn hình → bằng chứng kiểm thử**. Buổi hướng dẫn có thể tập trung vào tiến độ và phần sửa theo góp ý cũ; không cần mở đầu bằng toàn bộ kiến trúc hay bảo mật.

| Khả năng | Câu thầy có thể hỏi | Cách trả lời bám vào dự án |
|---|---|---|
| Rất nên chuẩn bị | “Sau góp ý use case lần trước em đã sửa gì?” | Mở bản use case đã chỉnh, chỉ ra từng điểm sửa thực tế. Không tự nhận đã sửa nếu chưa có bản đối chiếu. Nêu rõ tác nhân nào thực hiện từng công việc. |
| Rất nên chuẩn bị | “Chọn một use case rồi nói từ đầu đến cuối; lỗi thì sao?” | Chọn **Chuyển báo giá đã duyệt thành phiếu sửa chữa**. Trình bày điều kiện đầu vào, luồng chính, trường hợp khách chưa duyệt/thiếu kho/thợ không đủ quyền và kết quả sau giao dịch. |
| Rất nên chuẩn bị | “CSDL của em có những bảng gì, quan hệ thế nào?” | Đi từ khách → xe → lượt dịch vụ → phiên bản báo giá → phiếu sửa → hạng mục → vật tư; phiếu thu gắn với phiếu sửa. Giải thích bằng một xe trong demo. |
| Nên chuẩn bị | “Tại sao phải tách báo giá, phiếu sửa và phiếu thu?” | Báo giá là đề nghị được khách duyệt theo phiên bản; phiếu sửa ghi công việc thực hiện; phiếu thu ghi nhận khoản đã nhận. Chưa sửa hoặc chưa thu không thể được coi là doanh thu. |
| Nên chuẩn bị | “Khách đổi ý hoặc phát sinh chi phí thì sao?” | Trước khi chuyển phiếu: lập báo giá chính thức mới và khách duyệt lại. Không khẳng định có quy trình phụ thu sau khi vào xưởng nếu chưa triển khai và kiểm chứng. |
| Nên chuẩn bị | “Hai người cùng dùng số vật tư cuối cùng thì sao?” | Backend dùng transaction và khóa bản ghi kho; kiểm tra tồn trong giao dịch. Chỉ giao dịch đủ tồn được xuất, giao dịch thất bại không để lại phiếu dở dang. Chuẩn bị kết quả test để minh họa nếu được hỏi sâu. |
| Nên chuẩn bị | “Khách có xem được xe người khác? Thợ có tự thu tiền không?” | Quyền được kiểm tra tại API và theo liên kết tài khoản. Khách theo `customerId`; thợ theo hồ sơ được giao; kế toán thực hiện thu tiền. Ẩn nút trên giao diện chưa đủ bảo vệ. |
| Nên chuẩn bị | “Đã làm được gì, còn thiếu gì so với đề tài?” | Chỉ chức năng đang chạy. Hiện có web/PWA; không gọi là app Android/iOS native. AI mặc định là mock; thu tiền là ghi nhận tại quầy, chưa phải cổng thanh toán. |
| Có thể hỏi | “Vì sao tài liệu có 3 vai trò mà phần mềm có 6?” | Bản ý tưởng ban đầu gộp tiếp nhận, kho, thu tiền vào admin. Code hiện tách admin, cố vấn, kế toán, nhân sự, thợ, khách. Cần cập nhật use case và ma trận quyền theo phạm vi được thầy chấp thuận. |
| Có thể hỏi | “Giá trị của đề tài ngoài CRUD là gì?” | Chứng minh liên kết duyệt chi phí, thực hiện, xuất kho, ảnh công việc, nghiệm thu, thu tiền và lịch sử trên cùng một lượt sửa xe. |

### Câu mở đầu khi gặp thầy — khoảng 30 giây

> “Hôm trước thầy góp ý phần use case. Hôm nay em xin trình bày rõ một luồng nghiệp vụ từ tiếp nhận đến bàn giao, các dữ liệu liên quan và những điều kiện hệ thống phải kiểm soát. Sau đó em demo cùng một xe để đối chiếu tiến độ, vật tư và tiền thu. Những điểm em đã chỉnh theo góp ý là: [điền đúng các thay đổi thực tế].”

Không nói đã đọc lại đúng phiếu PDF khi chưa có bản gốc. Nếu yêu cầu trong phiếu khác bản ý tưởng, ưu tiên đối chiếu lại phạm vi với thầy.

## 2. Một use case chi tiết để trả lời ngay

**UC: Chuyển báo giá chính thức đã duyệt thành phiếu sửa chữa.**

| Thành phần | Nội dung |
|---|---|
| Mục tiêu | Giao công việc đã thống nhất với khách cho thợ và ghi nhận vật tư cần dùng. |
| Tác nhân chính | Cố vấn dịch vụ hoặc admin có quyền xưởng. |
| Bên liên quan | Khách đã duyệt báo giá; thợ nhận việc. Việc khách duyệt là use case trước đó. |
| Tiền điều kiện | Xe đang được tiếp nhận, có lượt dịch vụ hợp lệ; chẩn đoán và báo giá chính thức; đúng phiên bản đã được duyệt; chưa chuyển thành phiếu; thợ hoạt động và đủ quyền; vật tư đủ tồn và đáp ứng cấu hình tương thích nếu đã khai báo. |
| Kích hoạt | Cố vấn bấm “Phân công & Chuyển vào xưởng”. |
| Luồng chính | 1. Chọn thợ. 2. Server xác thực quyền và trạng thái báo giá. 3. Kiểm tra thợ, giá và vật tư. 4. Trong transaction, tạo phiếu/hạng mục, trừ kho, lưu nhật ký và đánh dấu báo giá đã chuyển. 5. Trả mã phiếu; thợ thấy công việc được giao. |
| Ngoại lệ | Chưa được duyệt: từ chối. Thiếu kho/giá thay đổi: yêu cầu xử lý trước. Thợ bị khóa quyền xưởng: từ chối. Chuyển lại cùng báo giá: không được tạo phiếu hoặc trừ kho lần hai. |
| Hậu điều kiện thành công | Một phiếu `draft` gắn với lượt dịch vụ; lượt ở `in_workshop`; tồn giảm đúng số lượng; chưa ghi doanh thu. |
| Hậu điều kiện thất bại | Không có phiếu dở dang hoặc giảm kho một phần. |

Nếu hỏi `include`/`extend`: `include` biểu diễn hành vi dùng chung bắt buộc; `extend` biểu diễn hành vi bổ sung có điều kiện tại điểm mở rộng. Không dùng chúng để biểu diễn thứ tự thời gian; dùng activity/sequence cho luồng xử lý. “Đã đăng nhập” có thể là tiền điều kiện, không nhất thiết kéo `include Đăng nhập` vào mọi use case.

## 3. Chuẩn bị dữ liệu trước buổi demo

**Kịch bản chính: một xe xăng, một hạng mục thay lọc dầu, một phiếu thu.** Các thông tin dưới đây đều là dữ liệu mô phỏng, không phải chỉ dẫn kỹ thuật hoặc báo giá garage thực tế.

| Dữ liệu | Giá trị chuẩn bị | Kiểm tra trước |
|---|---|---|
| Khách | Tài khoản khách demo đã có | Xe được liên kết đúng ID tài khoản, không chỉ cùng tên. |
| Cố vấn | Tài khoản vai trò `advisor` | Có quyền tiếp nhận và xưởng. Tạo bằng admin nếu chưa có. |
| Kế toán | Tài khoản vai trò `accountant` | Có quyền tài chính/báo cáo. Tạo bằng admin nếu chưa có. |
| Thợ | Tài khoản thợ gắn với hồ sơ kỹ thuật viên | Cả tài khoản/hồ sơ hoạt động; quyền xưởng được mở. |
| Xe | Biển số ví dụ `30A-68686`, Toyota Vios | Dùng biển chưa có, hoặc xe đã giao được tiếp nhận lại; không có lượt/phiếu đang mở. |
| Vật tư | `Lọc dầu DEMO`, SKU `DEMO-FILTER-001` | Nhập mới rồi vào **Sửa vật tư** khai báo SKU trước khi lập báo giá/phiếu. SKU này chỉ dùng trong dữ liệu mô phỏng. |
| Tồn ban đầu | 10 chiếc | Ghi lại màn hình hoặc nhật ký; không có người khác dùng mã vật tư này trong buổi demo. |
| Giá và tiền công | 100.000đ/chiếc; số lượng 1; tiền công 50.000đ/dòng | Tổng dự kiến **150.000đ**; tiền công tính một lần cho dòng. |
| Ảnh | Một ảnh nhãn/bao bì và một ảnh kết quả, JPEG/PNG/WebP nhỏ | Dùng ảnh thử có quyền sử dụng; mã nhập `DEMO-FILTER-001`; không chứa thông tin riêng tư. Không coi ảnh là bằng chứng phụ tùng chính hãng. |
| Báo cáo | Ghi số thực thu tháng trước demo là `R` | Sau đúng một lần thu, kỳ tháng hiện tại phải là `R + 150.000đ` nếu không có phát sinh khác. |

Lưu ý quan trọng:

- Seed mặc định chỉ tạo `admin@autopro.com`, `mechanic@autopro.com`, `customer@autopro.com`, mật khẩu `123456` trong môi trường demo. Không mặc định có tài khoản cố vấn/kế toán/nhân sự. Seed bỏ qua khi database đã có user; không dùng seed để reset dữ liệu cũ.
- Xe seed `51A12345` đã có phiếu chờ; vật tư seed chưa khai báo SKU. Dùng bộ dữ liệu riêng ở trên để tránh vướng điều kiện sẵn có.
- Nhiều tab cùng trình duyệt/profile trên cùng origin chia sẻ `localStorage`. Dùng profile trình duyệt riêng cho từng vai trò, các trình duyệt khác nhau, hoặc đăng xuất/đăng nhập tuần tự. Nhiều cửa sổ ẩn danh trong cùng một phiên cũng có thể chia sẻ đăng nhập.
- Dùng thống nhất một địa chỉ: Docker thường là `http://localhost:3000`; FastAPI chạy trực tiếp thường là `http://localhost:8000`. Kiểm tra cổng thực tế trước buổi gặp.
- Kiểm tra frontend/backend và migrations đang chạy đúng phiên bản. Code mới trong workspace không tự chứng minh container đang chạy đã cập nhật. Nếu cần nâng cấp, làm trước trên database demo theo hướng dẫn backup/migration; không nâng cấp dữ liệu thật ngay khi trình bày.
- Tắt mạng Internet không đồng nghĩa PWA thực hiện được nghiệp vụ offline: các thao tác cần backend/database hoạt động.

## 4. Kịch bản demo chính — khoảng 12–15 phút

Không đi qua từng menu theo kiểu giới thiệu tính năng. Theo dõi **cùng biển số, mã lượt, mã báo giá, mã phiếu** xuyên suốt; ghi các mã sau khi tạo để tìm nhanh.

| Thời gian | Vai trò và thao tác | Kết quả cần chỉ ra | Câu nói mẫu |
|---|---|---|---|
| 0:00–0:40 | Mở sơ đồ/use case hoặc trang tổng quan; giới thiệu tình huống | Phạm vi một garage, một lượt sửa | “Em minh họa khách mang xe đến bảo dưỡng; các bộ phận dùng chung hồ sơ và dữ liệu.” |
| 0:40–1:20 | Khách gửi yêu cầu đặt lịch; cố vấn xem và xác nhận | `pending` rồi `confirmed`, lưu mã yêu cầu | “Gửi biểu mẫu mới là yêu cầu; garage xác nhận sau khi kiểm tra khả năng tiếp nhận.” |
| 1:20–2:30 | Cố vấn → **Tiếp nhận & Lịch hẹn** → **Tiếp nhận xe**; chọn tài khoản khách, nhập xe. Sang **Kiểm tra & Báo giá** → **Kiểm tra đầu vào**, chọn xe/thợ, ghi nhu cầu và kiểm tra ban đầu | Xe gắn đúng khách; có lượt `intake`; chưa có phiếu và chưa xuất kho | “Hồ sơ xe dùng lại nhiều lần; lượt dịch vụ ghi riêng lần tiếp nhận hôm nay.” |
| 2:30–3:40 | Cố vấn → **Lập báo giá sơ bộ**, thêm một dòng thay lọc dầu, chọn vật tư, SL 1, công 50.000đ; khách → **Báo giá & Xác nhận**, mở chi tiết và xác nhận | Tổng 150.000đ; lượt chuyển sang `diagnosis`; tồn vẫn 10 | “Khách đồng ý phương án sơ bộ trước kiểm tra kỹ. Báo giá chưa làm giảm tồn kho.” |
| 3:40–4:30 | Thợ được giao → **Kiểm tra kỹ được giao** → **Ghi kiểm tra kỹ** | Lưu kết quả kiểm tra mô phỏng, đề nghị một hạng mục thay lọc dầu | “Kết quả kiểm tra là căn cứ cho báo giá chính thức; đây là dữ liệu diễn tập.” |
| 4:30–5:40 | Cố vấn → **Lập báo giá chính thức**, nhập lại dòng đã thống nhất; khách xem và xác nhận đúng phiên bản | Lượt `ready`; lưu lịch sử báo giá; tổng 150.000đ; tồn vẫn 10 | “Sự đồng ý của khách áp dụng cho đúng phiên bản công việc và chi phí đang xem.” |
| 5:40–6:30 | Cố vấn → **Phân công & Chuyển vào xưởng**, chọn thợ; admin mở kho/nhật ký để đối chiếu | Một phiếu `draft`; lượt `in_workshop`; tồn **10 → 9**, có phát sinh xuất | “Chỉ lúc chuyển thành công việc thực hiện, hệ thống mới xuất vật tư và giao phiếu cho thợ.” |
| 6:30–8:30 | Thợ → phiếu được giao → **Bắt đầu sửa**; tick hạng mục để mở form; chọn ảnh kết quả, ảnh bao bì, nhập SKU và ghi chú; **Gửi ảnh & Xác nhận hoàn thành**; **Hoàn thành phiếu** | `draft → working → completed`; đủ checklist/ảnh; tồn 9; chưa thu tiền | “Thợ phải có bằng chứng của lần thực hiện hiện tại. Hoàn thành kỹ thuật chưa đồng nghĩa đã thu tiền hay giao xe.” |
| 8:30–9:30 | Cố vấn xem ảnh → **Nghiệm thu**; tick công việc và an toàn; ghi kết quả chạy thử hoặc lý do phù hợp với tình huống mô phỏng | Lượt `qc_passed`; phiếu vẫn `completed` | “Cố vấn kiểm tra lại kết quả trước khi chuyển kế toán thu tiền.” |
| 9:30–10:30 | Kế toán → **Thu tiền & Phiếu thu** → chọn đúng phiếu → kiểm tra 150.000đ → xác nhận thu đủ tiền, chọn tiền mặt | Phiếu `paid`; một phiếu thu có người nhận/thời điểm; doanh thu tăng 150.000đ | “Đây là ghi nhận tiền đã nhận tại quầy; không phải giao dịch qua cổng thanh toán.” |
| 10:30–11:30 | Cố vấn → tiếp nhận → **Giao xe**; khách mở lại lịch sử và phiếu đã thanh toán | Xe `delivered`; lượt `closed`; khách xem lại được chi phí/lịch sử | “Bàn giao chỉ thực hiện sau nghiệm thu và thanh toán; dữ liệu được giữ cho lần sửa tiếp theo.” |
| 11:30–12:30 | Mở kho, phiếu thu và báo cáo tháng hiện tại để kết luận | Tồn 9; đúng một phiếu thu 150.000đ; tổng kỳ `R + 150.000đ` | “Ba số liệu đối chiếu khớp: một vật tư đã xuất, một hạng mục hoàn thành và một lần thu tiền.” |

Nếu chuyển profile mà chưa thấy dữ liệu, dùng nút **Làm mới**. Portal có polling định kỳ; không gọi đây là WebSocket hoặc cam kết cập nhật tức thời.

### Hai tình huống ngoại lệ nên chèn vào demo

1. **Sau khi thợ hoàn thành nhưng trước nghiệm thu:** kế toán thử thu tiền phiếu đó. Mong đợi bị từ chối, không phát sinh phiếu thu; sau đó trở về cố vấn để nghiệm thu và tiếp tục luồng. Nếu giao diện không cho mở thao tác, chỉ ra điều kiện bị chặn; muốn chứng minh API cần chuẩn bị request hợp lệ trên database demo từ trước.
2. **Tại form ảnh trước xác nhận hạng mục:** nhập mã `SAI-MA-DEMO`, gửi. Mong đợi báo không khớp vật tư, hạng mục vẫn chưa hoàn thành. Sửa thành `DEMO-FILTER-001` và gửi lại để tiếp tục. Luồng giao diện gửi ảnh bao bì trước ảnh kết quả nên sai mã bị chặn ngay bước đầu; kiểm tra gallery khi diễn tập để xác nhận không có bản ghi ngoài dự kiến.

Nói mỗi tình huống trong 15–20 giây: **“Thao tác bị chặn vì…, dữ liệu vẫn…, em sửa điều kiện rồi tiếp tục.”** Không dành toàn bộ buổi demo cho thao tác gây lỗi.

### Lời kết — khoảng 20 giây

> “Qua một lượt dịch vụ, em đã đối chiếu được việc khách duyệt chi phí, giao việc cho thợ, xuất kho, lưu kết quả, nghiệm thu và thu tiền. Tồn giảm từ 10 còn 9; một phiếu thu 150.000đ; khách xem lại lịch sử. Phần tiếp theo em cần hoàn thiện là [nêu đúng các hạng mục còn thiếu và mốc dự kiến của mình].”

## 5. Nếu thầy chỉ cho 5 phút

Chuẩn bị sẵn **một lượt đã có báo giá chính thức được khách duyệt nhưng chưa chuyển phiếu**, tồn vẫn 10, tổng 150.000đ. Nói rõ bước nào đã chuẩn bị trước.

| Mốc | Nội dung |
|---|---|
| 0:00–0:40 | Tình huống, use case và báo giá đã duyệt. |
| 0:40–1:30 | Chuyển vào xưởng; chỉ phiếu được tạo và tồn 10 → 9. |
| 1:30–3:00 | Thợ bắt đầu, gửi hai ảnh/mã đúng, hoàn thành. |
| 3:00–4:10 | Cố vấn nghiệm thu; kế toán thu 150.000đ. |
| 4:10–5:00 | Giao xe, mở lịch sử, đối chiếu kho/phiếu thu; nêu một ngoại lệ đã kiểm thử. |

Nếu không đủ thời gian thao tác nhiều vai trò, ưu tiên trình diễn luồng đúng và giải thích bằng ảnh/video diễn tập có ghi rõ là bản ghi. Không dùng dữ liệu dựng như kết quả vừa chạy trực tiếp.

## 6. Các câu trả lời ngắn nên tập nói

- **“Đăng nhập có phải actor không?”** — “Đăng nhập là chức năng; actor là người hoặc hệ thống bên ngoài tương tác. Các actor ở đây là khách, thợ, cố vấn, kế toán, nhân sự và admin theo phạm vi hiện tại.”
- **“Xe và phiếu sao không gộp một bảng?”** — “Một xe có nhiều lần dịch vụ. Tách phiếu/hạng mục giúp lưu lịch sử, nhiều công việc và giá tại từng thời điểm.”
- **“Một phiếu có mấy vật tư?”** — “Một phiếu có nhiều hạng mục. Hiện mỗi hạng mục tham chiếu tối đa một mã kho; nếu một công việc cần nhiều mã vật tư phải tách dòng hoặc mở rộng thiết kế. Em không khẳng định đã có bảng vật tư nhiều dòng cho từng công việc nếu chưa triển khai.”
- **“Đổi giá vật tư thì phiếu cũ có đổi không?”** — “Giá/tên được chụp lại trên hạng mục; thay danh mục không tự sửa chi phí lịch sử. Với báo giá chưa chuyển, giá thay đổi cần xử lý/duyệt lại trước xuất kho.”
- **“Hoàn thành, đã thanh toán, đã giao khác gì?”** — “Hoàn thành là kết thúc công việc kỹ thuật; đã thanh toán là ghi nhận thu đủ tiền; đã giao là bàn giao sau các điều kiện nghiệp vụ.”
- **“Sửa xong đã tính doanh thu chưa?”** — “Chưa. Doanh thu thực thu tính khi phiếu đã thanh toán, theo thời điểm thu, không theo ngày tạo phiếu.”
- **“Tại sao FastAPI và PostgreSQL?”** — “FastAPI phù hợp API Python có kiểm tra dữ liệu; PostgreSQL phù hợp dữ liệu quan hệ và giao dịch phiếu–kho–thu tiền. Lý do chính là đáp ứng cách xử lý của đề tài, không chỉ vì công nghệ phổ biến.”
- **“Có realtime/offline không?”** — “Trang làm mới định kỳ. Có PWA nhưng các thao tác nghiệp vụ và gửi ảnh cần kết nối backend; chưa coi là hệ thống xử lý offline.”
- **“AI ở đâu?”** — “Có phần tích hợp chuẩn bị sẵn nhưng mặc định đang mô phỏng; em chưa coi đó là chẩn đoán AI đã được đánh giá.”
- **“Đã khảo sát thực tế garage nào?”** — Chỉ trình bày nơi, người, biểu mẫu và quy tắc đã thực sự khảo sát. Nếu chưa khảo sát đủ, nói rõ phần đang là giả định cần xác nhận; không dựng tên garage hoặc xác nhận nghiệp vụ.

## 7. Checklist ngay trước khi gặp thầy

- [ ] Có bản use case đã sửa và ghi cụ thể góp ý lần trước → thay đổi tương ứng.
- [ ] Thống nhất tên đề tài/sản phẩm: tài liệu và giao diện hiện dùng AutoPro/GarageCar; dùng đúng tên trong phiếu chính thức khi có bản gốc.
- [ ] Có sơ đồ CSDL đọc được và một use case chi tiết; biết giải thích quan hệ, khóa ngoại, trạng thái.
- [ ] Làm rõ phạm vi 3 vai trò trong đề xuất cũ và 6 vai trò trong code; không mở rộng cam kết ngoài yêu cầu thầy chốt.
- [ ] Chạy thử đủ luồng 12 phút, cả hai tình huống ngoại lệ; ghi mã xe/lượt/phiếu để tìm nhanh.
- [ ] Tài khoản, quyền, SKU, ảnh, tồn kho và dữ liệu báo cáo đã chuẩn bị; chưa tiêu thụ mất lượt dành cho demo chính.
- [ ] Nếu diễn tập rồi chạy lại: tiếp nhận lại xe đã bàn giao hoặc dùng xe mới; đối chiếu tồn và doanh thu nền mới, không mặc định luôn là 10 và 0.
- [ ] Có bản ghi/ảnh diễn tập và database demo dự phòng. Khi lỗi: nói rõ lỗi, dùng bản ghi có nhãn, không sửa code hoặc xóa database ngay trước thầy.
- [ ] Có danh sách phần đã làm, phần chưa làm, vấn đề cần thầy quyết định và kế hoạch tiếp theo với thời hạn thực tế.

## 8. Nguồn đối chiếu trong project

| Nguồn | Dùng để kiểm tra |
|---|---|
| `docs/Y_tuong_project_AutoPro.docx` | Mục tiêu và luồng garage ban đầu. |
| `docs/Y_tuong_project_AutoPro_Thuyet_minh.docx` | Use case, quy tắc kho/tiền, phạm vi đề xuất 3 vai trò. |
| `README.md`, `be/seed.py` | Cách chạy, tài khoản seed và điều kiện seed. |
| `fe/shared/service.js`, `be/routers/service.py` | Báo giá sơ bộ/chính thức, duyệt, chuyển phiếu, nghiệm thu. |
| `fe/shared/evidence.js`, `be/routers/evidence.py` | Ảnh công việc, mã vật tư và kiểm soát quyền xem. |
| `fe/mechanic/js/tasks.js` | Bắt đầu, form xác nhận hạng mục, hoàn thành phiếu. |
| `fe/staff/app.js`, `be/routers/vehicles.py`, `be/routers/repairs.py` | Tiếp nhận, thu tiền và điều kiện bàn giao. |
| `docs/DATA_WORKFLOW.md`, `docs/NGHIEP_VU_CHUYEN_SAU.md` | Liên kết dữ liệu và quy tắc nghiệp vụ; đối chiếu code khi tài liệu cũ có nội dung chưa cập nhật. |
