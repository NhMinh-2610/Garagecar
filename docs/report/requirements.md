# Bài toán, yêu cầu và use case

## 1. Bài toán và lý do chọn đề tài

Garage có nhiều bước giao việc: khách đặt lịch, cố vấn tiếp nhận, kỹ thuật viên kiểm tra/sửa, người phụ trách kho cấp vật tư, kế toán thu tiền và bộ phận điều hành theo dõi nhân viên. Nếu hồ sơ nằm rời ở giấy, bảng tính hoặc tin nhắn, thông tin báo giá, việc thực hiện và số tiền đã thu dễ bị lệch giữa các bộ phận. Đây là **phân tích bài toán thiết kế**, chưa phải kết quả khảo sát định lượng tại một garage cụ thể.

| Khó khăn                                               | Hệ thống giải quyết                                           | Bằng chứng cần trình bày                   |
| ------------------------------------------------------ | ------------------------------------------------------------- | ------------------------------------------ |
| Tiếp nhận thiếu thông tin, khó biết xe đang ở bước nào | Hồ sơ xe, lượt dịch vụ, tình trạng đầu vào, trạng thái        | Một xe đi qua các portal với cùng ID       |
| Báo giá thay đổi nhưng khách chưa thống nhất           | Báo giá có phiên bản, sơ bộ/chính thức, quyết định được lưu   | Khách xác nhận đúng báo giá đang hiển thị  |
| Khó đối chiếu công việc và phụ tùng thực dùng          | Hạng mục liên kết vật tư, xuất kho trong giao dịch, ảnh và mã | Phiếu, tồn trước/sau, ảnh cùng hạng mục    |
| Nhầm hoàn thành sửa với đã thanh toán                  | Tách hoàn thành, nghiệm thu, thu và giao xe                   | Chặn thu trước QC; phiếu thu duy nhất      |
| Khách phải gọi nhiều lần để hỏi tiến độ                | Tra xe/phiếu của mình, ảnh, báo giá và hộp thư                | Khách xem tiến độ và trao đổi với cố vấn   |
| Nhắc bảo dưỡng chung chung                             | Lịch theo cấu hình xe, nguồn xác minh, km/thời gian           | Xe chỉ dùng lịch phù hợp, nhắc chờ công bố |
| Khó theo dõi ca/nghỉ và năng lực thợ                   | Admin quản lý nhân sự, ca, nghỉ, chứng chỉ                    | Chặn trùng ca và thiếu chứng chỉ cao áp    |

Đề tài tập trung vào một chuỗi dịch vụ có thể truy vết và dữ liệu nhất quán giữa các vai trò. Không đặt mục tiêu chẩn đoán tự động hoặc tích hợp AI.

## 2. Mục tiêu và phạm vi

| Mục tiêu                        | Kết quả cần có                                        | Trạng thái trong repository                        |
| ------------------------------- | ----------------------------------------------------- | -------------------------------------------------- |
| Quản lý dịch vụ xuyên suốt      | Tiếp nhận → báo giá → duyệt → sửa → QC → thu → giao   | Có code và kiểm thử nghiệp vụ                      |
| Quản lý theo 5 vai trò          | Quyền API, quyền sở hữu, menu tương ứng               | Có; nhân sự gộp vào admin                          |
| Web cho các bộ phận             | Admin/cố vấn/kế toán; thợ và khách cũng truy cập được | Có                                                 |
| PWA cho sử dụng trên điện thoại | Giao diện thích ứng, manifest, service worker         | Có; cần kiểm tra cài/camera trên thiết bị thật     |
| App di động riêng               | Màn hình di động gọi chung backend                    | Chưa có source; cần hoàn thành theo phiếu nhiệm vụ |
| Báo cáo và truy vết             | Doanh thu, kho, chứng từ, ảnh, lịch sử quyết định     | Có trong phạm vi mô tả dưới đây                    |

Ngoài phạm vi hiện tại: AI; đa chi nhánh; nhà cung cấp/đơn mua hàng chuyên sâu; chẩn đoán OBD; OCR/barcode tự động; thanh toán trực tuyến; thanh toán một phần/hoàn tiền; hóa đơn điện tử; tính lương/chấm công; đồng bộ giao dịch offline; push khi đóng app. Các phần chưa triển khai không được viết như kết quả đã đạt.

## 3. Tác nhân và ma trận quyền

Quyền trong bảng là mặc định, còn phụ thuộc trạng thái nghiệp vụ, quyền bị khóa và quyền sở hữu. “Cá nhân” là bản ghi gắn với tài khoản đăng nhập; không có nghĩa xem toàn bộ nhân viên.

| Nhóm nghiệp vụ        | Quản trị                             | Cố vấn                             | Kỹ thuật viên                               | Kế toán                                    | Khách hàng                     |
| --------------------- | ------------------------------------ | ---------------------------------- | ------------------------------------------- | ------------------------------------------ | ------------------------------ |
| Tài khoản/phân quyền  | Quản lý                              | Cá nhân                            | Cá nhân                                     | Cá nhân                                    | Đăng ký/cá nhân                |
| Xe/lịch hẹn/tiếp nhận | Quản lý                              | Quản lý                            | Xem trong công việc được giao               | Dữ liệu cần cho tài chính                  | Xe của mình; gửi đặt lịch      |
| Báo giá               | Lập/điều phối                        | Lập/điều phối                      | Chẩn đoán được giao                         | Thông tin giới hạn cần cho thu             | Xác nhận của xe mình           |
| Phiếu sửa             | Quản lý theo quy tắc                 | Phân công                          | Bắt đầu/cập nhật/hoàn thành phiếu được giao | Thu phiếu đủ điều kiện                     | Xem phiếu xe mình              |
| Bằng chứng sửa        | Theo quyền                           | Xem                                | Nộp theo phân công                          | Không                                      | Xem của xe mình                |
| Kho/danh mục          | Quản lý                              | Tra khi lập báo giá                | Tra vật tư                                  | Không quản lý                              | Không                          |
| Nghiệm thu/giao xe    | Thực hiện                            | Thực hiện                          | Không                                       | Không                                      | Xem kết quả                    |
| Thu–chi/doanh thu     | Quản lý; không tự duyệt chi mình lập | Không                              | Không                                       | Thu, lập/chi đề nghị đã duyệt, xem báo cáo | Xem chi phí/chứng từ xe mình   |
| Nhân sự/ca/chứng chỉ  | Quản lý; không tự duyệt              | Cá nhân                            | Cá nhân                                     | Cá nhân                                    | Không                          |
| Bảo dưỡng             | Cấu hình/quản lý                     | Hồ sơ/nhắc hạn theo quyền          | Nghiệp vụ bảo dưỡng theo quyền/phân công    | Không                                      | Xem xe mình và nhắc đã công bố |
| Hộp thư               | Xem/phân công/trả lời                | Chưa phân công hoặc mình phụ trách | Không                                       | Không                                      | Hội thoại của mình             |

Đặt lịch công khai là thao tác trước đăng nhập; không tạo thêm một vai trò đăng nhập thứ sáu. `bookings` hiện lưu thông tin liên hệ, chưa có liên kết FK tới tài khoản để khẳng định một danh sách “lịch hẹn của tôi” theo sở hữu.

## 4. Danh mục yêu cầu chức năng

| Mã   | Yêu cầu                                 | Tiêu chí chấp nhận chính                                          | Module                         |
| ---- | --------------------------------------- | ----------------------------------------------------------------- | ------------------------------ |
| FR01 | Đăng ký, đăng nhập, đổi mật khẩu        | Đăng ký công khai chỉ tạo khách; token cũ bị thu hồi sau đổi/khóa | auth/accounts                  |
| FR02 | Quản lý tài khoản và giới hạn chức năng | Chỉ 5 vai trò; không cấp quyền vượt vai trò                       | accounts/permissions           |
| FR03 | Quản lý xe và tiếp nhận lịch            | Biển số/thông tin hợp lệ, liên kết đúng khách                     | vehicles/bookings              |
| FR04 | Mở lượt dịch vụ                         | Ghi nhu cầu và kiểm tra đầu vào, chặn luồng đang mở xung đột      | service                        |
| FR05 | Lập/duyệt báo giá                       | Lưu phiên bản và quyết định, phân biệt sơ bộ/chính thức           | service                        |
| FR06 | Phân thợ/chẩn đoán                      | Tài khoản/thợ hợp lệ, đúng lượt được giao                         | service/mechanics              |
| FR07 | Chuyển báo giá sang phiếu               | Báo giá chính thức đã duyệt, xuất kho và phiếu cùng giao dịch     | service/repair_service         |
| FR08 | Thực hiện sửa và bằng chứng             | Đúng thợ, đúng trạng thái, đủ ảnh/mã theo lần thực hiện           | repairs/evidence               |
| FR09 | Nghiệm thu và bàn giao                  | Hoàn thành rồi QC; giao xe theo điều kiện thanh toán              | service/vehicles               |
| FR10 | Kho và giá công                         | Tồn không âm, ghi biến động, kiểm tra cấu hình vật tư             | inventory/settings             |
| FR11 | Thu tiền và chứng từ                    | Đủ điều kiện, một phiếu thu, retry không nhân đôi                 | repairs/finance                |
| FR12 | Đề nghị/duyệt/chi                       | Không tự duyệt; không chi lặp; chứng từ duy nhất                  | finance_operations             |
| FR13 | Báo cáo doanh thu                       | Tổng hợp phiếu paid theo kỳ được chọn                             | reports                        |
| FR14 | Hồ sơ, ca, nghỉ, chứng chỉ              | Admin quản lý; chặn xung đột/tự duyệt; nhân viên xem cá nhân      | employees/hr_operations        |
| FR15 | Hồ sơ và lịch bảo dưỡng                 | Nguồn/phạm vi xác minh, ODO và thời gian hợp lệ                   | maintenance                    |
| FR16 | Nhắc hạn và chăm sóc sau sửa            | Nhắc chờ duyệt, khách chỉ xem đã công bố; follow-up sau bàn giao  | maintenance/advisor_operations |
| FR17 | Hộp thư garage                          | Kiểm tra hội thoại sở hữu/phân công, gửi lại không trùng          | messaging                      |
| FR18 | Web/PWA                                 | Tải đúng portal; cache tài nguyên tĩnh, không cache API cá nhân   | fe/shared/service-worker       |
| FR19 | App di động riêng                       | Xác thực và thao tác bằng API chung, kiểm thử trên thiết bị       | Chưa triển khai                |

## 5. Yêu cầu phi chức năng và cách đánh giá

| Mã    | Yêu cầu                | Cách đánh giá thực tế                                                                 |
| ----- | ---------------------- | ------------------------------------------------------------------------------------- |
| NFR01 | Phân quyền và riêng tư | Test 401/403, chủ xe, người được phân công, ảnh riêng tư                              |
| NFR02 | Nhất quán tiền/tồn     | Test giao dịch rollback, request đồng thời, retry và đối chiếu ledger                 |
| NFR03 | Dễ thao tác            | Thử bộ lọc, phân trang, bản nháp khi lỗi, menu điện thoại; lấy phản hồi người dùng    |
| NFR04 | Khả năng bảo trì       | Module rõ trách nhiệm, lint/format, migration, tài liệu và test chạy được             |
| NFR05 | Khôi phục dữ liệu      | Backup và restore DB thử; đối chiếu tiền/tồn/ảnh sau phục hồi                         |
| NFR06 | Hiệu năng truy vấn     | Kiểm tra số SELECT trong danh sách dịch vụ; đo tải thật trước khi công bố năng lực    |
| NFR07 | Tương thích thiết bị   | Thử trình duyệt/điện thoại thật cho camera, in, cài PWA; jsdom chỉ kiểm tra logic/DOM |

Chưa có số đo tải đồng thời hoặc khảo sát hài lòng để khẳng định hệ thống đạt một SLA cụ thể. Không tự đặt kết quả như “giảm 80% thời gian” khi chưa đo.

## 6. Quy tắc nghiệp vụ

| Mã   | Quy tắc                                                                                    |
| ---- | ------------------------------------------------------------------------------------------ |
| BR01 | Quyền chủ xe dựa trên `customerId`, thợ dựa trên ID liên kết, không theo tên               |
| BR02 | Quyền chức năng chỉ được thu hẹp bởi `disabledPermissions`                                 |
| BR03 | Phải duyệt đúng báo giá chính thức trước khi chuyển phiếu theo lượt                        |
| BR04 | Hạng mục từ báo giá đã duyệt không được sửa tùy ý trên phiếu                               |
| BR05 | Giá/tồn/tương thích được kiểm tra lại trong giao dịch; lỗi không lưu phiếu một phần        |
| BR06 | Hạng mục dùng vật tư cần ảnh hoàn thành, ảnh bao bì và mã đúng; mở lại tăng lần bằng chứng |
| BR07 | Cao áp yêu cầu chứng chỉ EV còn hiệu lực; không tự xác minh chứng chỉ của mình             |
| BR08 | Hoàn thành công việc khác với thanh toán; phiếu theo lượt phải có QC trước thu             |
| BR09 | Một phiếu thu cho một phiếu sửa; giữ giá trị lịch sử sau thu                               |
| BR10 | Không tự duyệt chi/nghỉ; không trùng ca hoặc nghỉ đã duyệt                                 |
| BR11 | Lịch bảo dưỡng phải phù hợp cấu hình; nguồn demo chưa phải căn cứ bảo dưỡng xe thật        |
| BR12 | Khách chỉ thấy nhắc hạn đã công bố; worker không tự gửi SMS/email                          |
| BR13 | Hội thoại đúng khách/xe, tin nhắn dùng mã gửi chống trùng                                  |

## 7. Danh mục use case

| Mã   | Tên                            | Tác nhân chính                       | Kết quả                                  |
| ---- | ------------------------------ | ------------------------------------ | ---------------------------------------- |
| UC01 | Quản lý tài khoản và quyền     | Quản trị                             | Tài khoản hợp lệ và phiên được kiểm soát |
| UC02 | Đặt lịch/tiếp nhận xe          | Khách, cố vấn                        | Lịch yêu cầu và hồ sơ xe/lượt            |
| UC03 | Lập và xác nhận báo giá        | Cố vấn, khách                        | Báo giá có phiên bản và quyết định       |
| UC04 | Phân công và kiểm tra kỹ       | Cố vấn, thợ                          | Chẩn đoán gắn lượt và người thực hiện    |
| UC05 | Tạo phiếu từ báo giá           | Cố vấn                               | Phiếu/hạng mục và biến động kho          |
| UC06 | Thực hiện và xác nhận hạng mục | Thợ                                  | Checklist và bằng chứng đúng lần         |
| UC07 | Nghiệm thu/giao xe             | Cố vấn                               | QC và trạng thái bàn giao                |
| UC08 | Thu tiền/in chứng từ           | Kế toán                              | Phiếu paid và chứng từ duy nhất          |
| UC09 | Quản lý kho/danh mục           | Quản trị                             | Tồn và biến động hợp lệ                  |
| UC10 | Quản lý thu–chi/báo cáo        | Kế toán, quản trị                    | Đề nghị/duyệt/chi và tổng hợp            |
| UC11 | Quản lý nhân sự                | Quản trị, nhân viên với việc cá nhân | Hồ sơ/ca/nghỉ/chứng chỉ                  |
| UC12 | Quản lý bảo dưỡng/nhắc hạn     | Quản trị, cố vấn, khách              | Lịch phù hợp, nhắc được công bố          |
| UC13 | Nhắn tin garage                | Khách, cố vấn, quản trị              | Hội thoại đúng quyền, không trùng tin    |
| UC14 | Theo dõi xe/dịch vụ            | Khách                                | Xe, tiến độ, chi phí và ảnh của mình     |

Quản trị có thể thực hiện nghiệp vụ khi có quyền tương ứng nhưng vẫn chịu các điều kiện trạng thái và không tự duyệt. Sơ đồ [use case](diagrams/02-use-cases.svg) trình bày các nhóm chính; bảng trên là danh mục chi tiết.

## 8. Đặc tả use case trọng tâm

### UC03 — Lập và xác nhận báo giá

| Thành phần     | Đặc tả                                                                                                                                                                 |
| -------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kích hoạt      | Cố vấn chọn lập báo giá trên lượt                                                                                                                                      |
| Tiền điều kiện | Lượt hợp lệ; người lập có quyền workshop; báo giá chính thức cần bước chẩn đoán phù hợp                                                                                |
| Luồng chính    | Chọn công việc/vật tư → nhập số lượng và công → server kiểm tra/tính tiền → lưu phiên bản pending → khách xem đúng xe/báo giá → xác nhận hoặc từ chối → lưu quyết định |
| Thay thế       | Khách xác nhận trực tiếp tại garage: cố vấn ghi nhận theo endpoint cho phép và lưu căn cứ; không giả làm khách đăng nhập                                               |
| Ngoại lệ       | Nội dung thiếu/giá không hợp lệ bị từ chối; phiên bản cũ bị superseded không thể dùng để tạo phiếu                                                                     |
| Hậu điều kiện  | Quyết định gắn phiên bản, chưa tự trừ kho ở bước lập báo giá                                                                                                           |

### UC05 — Tạo phiếu từ báo giá

| Thành phần     | Đặc tả                                                                                                                                                        |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Kích hoạt      | Cố vấn chọn Tạo phiếu & Giao thợ                                                                                                                              |
| Tiền điều kiện | Báo giá final đã approved, lượt chưa có phiếu, thợ hợp lệ có tài khoản                                                                                        |
| Luồng chính    | Khóa xe/lượt → kiểm tra báo giá → kiểm tra thợ → tạo phiếu/hạng mục → kiểm tra giá, tương thích, tồn → ghi xuất kho → đánh dấu converted/in_workshop → commit |
| Ngoại lệ       | Thiếu tồn, giá đổi, thợ bị khóa, báo giá chưa duyệt hoặc đã chuyển: trả lỗi; không xuất kho một phần                                                          |
| Hậu điều kiện  | Một phiếu cho lượt, tổng tiền khớp, tồn và ledger đồng nhất                                                                                                   |

### UC06 — Hoàn thành sửa chữa

| Thành phần     | Đặc tả                                                                                                               |
| -------------- | -------------------------------------------------------------------------------------------------------------------- |
| Tiền điều kiện | Phiếu được giao, thợ đang hoạt động, có workshop                                                                     |
| Luồng chính    | Bắt đầu working → nộp ảnh hoàn thành → với vật tư thêm ảnh bao bì/mã → xác nhận từng hạng mục → khi đủ thì completed |
| Ngoại lệ       | Thiếu ảnh/mã sai, ảnh quá giới hạn, không có chứng chỉ cao áp: không xác nhận; mở lại hạng mục tăng evidenceRound    |
| Hậu điều kiện  | Lưu người/thời điểm/bằng chứng, chưa tự thu tiền                                                                     |

### UC08 — Thu tiền

| Thành phần     | Đặc tả                                                                                                                               |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Tiền điều kiện | Có finance, phiếu completed; phiếu liên kết lượt đã QC                                                                               |
| Luồng chính    | Xem tổng và QC → chọn phương thức → nhập tham chiếu khi cần → gửi → server khóa phiếu, kiểm tra → ghi receipt và paid cùng giao dịch |
| Ngoại lệ       | Chưa hoàn thành/QC hoặc thiếu tham chiếu bị chặn; retry không tạo receipt thứ hai                                                    |
| Hậu điều kiện  | Chứng từ giữ giá trị và người thu; xe chưa tự được coi là đã bàn giao                                                                |

### UC11 — Ca làm, nghỉ phép và chứng chỉ

| Thành phần     | Đặc tả                                                                                                                                     |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Tiền điều kiện | Admin có hr để quản lý; nhân viên đăng nhập để xem/gửi việc cá nhân                                                                        |
| Luồng chính    | Admin cập nhật hồ sơ, phân ca → nhân viên xem lịch/gửi nghỉ → admin kiểm tra xung đột và quyết định → admin xác minh chứng chỉ có thời hạn |
| Ngoại lệ       | Trùng ca/nghỉ đã duyệt, tự duyệt nghỉ hoặc tự xác minh chứng chỉ bị chặn; phải xử lý ca xung đột trước khi duyệt nghỉ                      |
| Hậu điều kiện  | Giữ quyết định, thời điểm/người thực hiện; thu hồi chứng chỉ giữ lịch sử                                                                   |

### UC12 — Công bố nhắc bảo dưỡng

| Thành phần     | Đặc tả                                                                                                                              |
| -------------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Tiền điều kiện | Hồ sơ xe có thông tin cấu hình/ODO và lịch xác minh phù hợp                                                                         |
| Luồng chính    | Tính chu kỳ từ lịch sử theo km/thời gian → tạo nhắc pending theo khóa chu kỳ → cố vấn/admin kiểm tra nội dung → publish → khách xem |
| Ngoại lệ       | Không có lịch phù hợp: chưa có căn cứ tính theo lịch; nhắc trùng chu kỳ không được nhân bản                                         |
| Hậu điều kiện  | Thông báo nội bộ app có người công bố; chưa có SMS/email/push                                                                       |

### UC13 — Nhắn garage

| Thành phần     | Đặc tả                                                                                                    |
| -------------- | --------------------------------------------------------------------------------------------------------- |
| Tiền điều kiện | Có messages; xe/hội thoại thuộc khách hoặc thuộc phạm vi cố vấn                                           |
| Luồng chính    | Khách mở hội thoại → nhập và gửi với UUID → lưu tin → cố vấn đọc/nhận/trả lời → cập nhật con trỏ đọc      |
| Ngoại lệ       | Mạng lỗi giữ nháp và UUID để retry; sai quyền bị chặn; hội thoại đóng không nhận tin mới theo quy tắc API |
| Hậu điều kiện  | Lịch sử tin không bị nhân đôi; admin có thể phân công lại                                                 |

Các ca còn lại theo API và quy tắc BR tương ứng; kịch bản kiểm chứng nằm trong [kiểm thử/demo](testing-and-demo.md).
