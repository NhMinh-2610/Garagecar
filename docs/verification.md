# Kiểm tra chức năng · 10/10/2026

Phạm vi: kiểm thử nghiệp vụ với PostgreSQL, tương tác frontend bằng HTML/script thật trong jsdom và HTTP qua bộ Docker PostgreSQL–FastAPI–Nginx. Các ca backend dùng schema `garage_test_*` tạm, không ghi vào bảng nghiệp vụ `public` đang sử dụng.

## Kết quả

| Kiểm tra              | Kết quả                                                                                                 |
| --------------------- | ------------------------------------------------------------------------------------------------------- |
| Backend/PostgreSQL    | **46/46 đạt**, gồm luồng nghiệp vụ và quyền truy cập                                                    |
| Frontend/jsdom        | **56/56 đạt**, tải HTML/script của sáu portal và thao tác giao diện                                     |
| HTTP qua Nginx Docker | **70/70 đạt**, đăng nhập, API theo vai trò và từ chối truy cập sai quyền                                |
| Chất lượng code       | Ruff lint/format đạt; Prettier và kiểm tra file/liên kết đạt                                            |
| Docker thực tế        | Build thành công; PostgreSQL, backend và Nginx đều healthy                                              |
| Cập nhật container    | Bộ dữ liệu demo vẫn còn 9 phiếu sau khi tạo lại backend                                                 |
| Backup/restore        | `pg_dump -Fc` → restore thành công vào database tạm riêng → đối chiếu 9 phiếu; database thử đã được dọn |
| Nén tài nguyên        | `workspace.css`: 36.921 byte → 9.829 byte qua gzip; không đại diện tốc độ tải toàn trang                |
| File môi trường       | Image không chứa `/app/.env`, backend chạy UID 10001; script tạo secret ngẫu nhiên và giữ `.env` cũ     |

Đã chạy backend bằng Python 3.13 trên Windows và khởi động/kiểm tra HTTP trong image Python 3.11. Pytest còn cảnh báo deprecation từ `python-jose`, không phát sinh lỗi chạy test.

## Nhóm chức năng

| Nhóm        | Nội dung đã có kiểm thử                                                                                                        |
| ----------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Tài khoản   | Đăng ký/đăng nhập, giới hạn đăng nhập, cấp tài khoản, liên kết xe/thợ, khóa tài khoản, đổi/reset mật khẩu và thu hồi phiên     |
| Phân quyền  | Sáu vai trò, khóa nhóm chức năng, quyền sở hữu xe/phiếu/hội thoại và giới hạn kế toán/nhân sự                                  |
| Tiếp nhận   | Biển số chuẩn hóa, nhận lại/giao xe, giới hạn xe trong ngày, ghi và xác nhận lịch hẹn                                          |
| Cố vấn      | Kiểm tra đầu vào, sơ bộ → khách duyệt → kiểm tra kỹ → chính thức → khách duyệt → chuyển xưởng; phiên bản báo giá và nghiệm thu |
| Xưởng       | Phân công, bắt đầu/hoàn thành, checklist, yêu cầu ảnh, mở lại công việc, mã/ảnh bao bì, điều kiện EV                           |
| Kho         | Giá từ server, nhập kho nguyên tử, xuất/hoàn kho, thiếu tồn, tương thích xe và chặn xuất hai lần khi gọi đồng thời             |
| Tài chính   | Chặn thu trước nghiệm thu, thu một lần, chứng từ/mã giao dịch, báo cáo theo thời gian, lập/duyệt/chi/hủy đề nghị               |
| Nhân sự     | Hồ sơ, ca làm, xung đột ca/nghỉ, chứng chỉ, thu hồi/xác minh và giới hạn tự duyệt                                              |
| Bảo dưỡng   | Quy tắc km/thời gian, tháng nhuận, bản xác minh, lịch sử, hàng đợi nhắc hạn và phạm vi xe điện VinFast                         |
| Chat        | Quyền truy cập, phân công/đóng hội thoại, con trỏ đã đọc, gửi lại không trùng, giữ nháp, chia sẻ lịch sử theo lựa chọn         |
| Giao diện   | Portal theo chức danh, lọc/phân trang, giữ bản nháp khi đồng bộ, điều hướng, tab, menu điện thoại và căn lề                    |
| PWA/hạ tầng | Tài nguyên manifest/cache, bỏ qua API có xác thực, API readiness, lỗi gateway dễ hiểu và khởi động Docker theo healthcheck     |

Test nằm trong [backend](../be/tests) và [frontend](../tests). Script [smoke-test.py](../scripts/smoke-test.py) kiểm tra đăng nhập/đọc API thật theo từng vai trò; không thay thế các test thao tác ghi nghiệp vụ.

## Các lỗi được sửa trong đợt rà soát

- Phiếu nháp tạo từ báo giá vẫn cho sửa hạng mục/xóa trên UI, dẫn đến lỗi API: giữ nguyên công việc khách đã duyệt, chỉ mở phần phân công.
- Đổi thợ trên phiếu không cập nhật lượt dịch vụ: đồng bộ hai bản ghi trong cùng giao dịch; phiếu theo báo giá yêu cầu thợ có tài khoản.
- Tra lượt dịch vụ phụ thuộc danh sách gần nhất: thêm lọc theo xe/lượt đang mở; ưu tiên công việc chưa kết thúc và kiểm tra đúng xe trước khi tạo phiếu.
- Danh sách dịch vụ truy vấn riêng cho từng dòng: tải xe, báo giá và liên kết phiếu theo nhóm; test với 106 lượt giới hạn tổng SELECT không quá 6, gồm xác thực.
- Proxy trả HTML lỗi làm hiện thông báo kỹ thuật: hiển thị lời nhắc thử lại, giữ nguyên nội dung phiếu.
- Yêu cầu thiếu token trả nhầm 403, header xác thực bị bỏ: trả 401 kèm `WWW-Authenticate: Bearer`; tài khoản đã đăng nhập thiếu quyền vẫn nhận 403.
- Docker dễ trùng PostgreSQL local, frontend lên trước API, thiếu nén và xử lý proxy: tách cổng, chờ readiness, nén phản hồi, giữ HTTPS khi chuyển hướng và giới hạn log.
- Thêm script khởi động demo, kiểm tra toàn bộ và kiểm tra HTTP thực; image backend có sẵn frontend và không chứa `.env`.

## Chạy lại

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\verify.ps1
docker compose config --quiet
powershell -NoProfile -ExecutionPolicy Bypass -File .\scripts\start-demo.ps1
.\.venv\Scripts\python.exe scripts/smoke-test.py --demo
```

## Giới hạn của kết quả

Đạt kiểm thử không có nghĩa mọi tình huống thực tế đã được chứng minh. Phiên rà soát này không có trình duyệt tích hợp để kiểm tra trực quan; vẫn cần thao tác trên Chrome/Safari và điện thoại thật để xác nhận camera, in chứng từ, quyền trình duyệt và cài PWA. Kiểm thử HTTP không đo tốc độ vẽ giao diện.

AI được kiểm tra bằng mock và phản hồi nhà cung cấp giả lập; chưa gọi OpenAI/Gemini/Ollama thật. Tunnel HTTPS chưa được mở công khai trong quá trình kiểm tra. Chưa thực hiện kiểm thử tải hàng trăm người đồng thời hoặc chạy dài ngày; không suy ra khả năng phục vụ thực tế từ số lượng test.

Database cũ có thể chứa phiếu thanh toán thiếu chứng từ; đối chiếu theo [vận hành](operations.md), không sửa tiền lịch sử bằng seed. Danh sách dịch vụ trả tối đa 100 lượt, ưu tiên lượt đang mở; sổ thu/chi và nhân sự giới hạn 1.000 bản ghi. Các phần chưa triển khai được ghi tại [định hướng](roadmap.md).
