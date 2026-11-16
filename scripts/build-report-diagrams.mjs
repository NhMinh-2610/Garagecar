/* Sơ đồ báo cáo bằng SVG thuần: mở/in được mà không cần dịch vụ ngoài. */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(root, "docs/report/diagrams");
fs.mkdirSync(out, { recursive: true });
const esc = (s) =>
  String(s).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
const palette = { blue: "#eaf2ff", green: "#e7f7ee", amber: "#fff3db", gray: "#f0f3f7" };
let elements = [];
function text(x, y, lines, size = 17, anchor = "middle", color = "#182d49") {
  const list = Array.isArray(lines) ? lines : [lines];
  list.forEach((line, i) =>
    elements.push(
      `<text x="${x}" y="${y + i * size * 1.45}" text-anchor="${anchor}" font-size="${size}" fill="${color}">${esc(line)}</text>`,
    ),
  );
}
function box(x, y, w, h, lines, color = "blue", dashed = false) {
  elements.push(
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="12" fill="${palette[color]}" stroke="#8096b0" stroke-width="1.5" ${dashed ? 'stroke-dasharray="7 5"' : ""}/>`,
  );
  text(x + w / 2, y + h / 2 - ((lines.length - 1) * 23) / 2 + 6, lines, 16);
}
function line(points, label = "", lx, ly, arrow = true, dashed = false) {
  elements.push(
    `<polyline points="${points.map((p) => p.join(",")).join(" ")}" fill="none" stroke="#526c8a" stroke-width="1.7" ${arrow ? 'marker-end="url(#arrow)"' : ""} ${dashed ? 'stroke-dasharray="6 5"' : ""}/>`,
  );
  if (arrow) {
    const [x, y] = points.at(-1),
      [px, py] = points.at(-2);
    const angle = Math.atan2(y - py, x - px);
    const corners = [
      [x, y],
      [
        x - 9 * Math.cos(angle) + 4 * Math.sin(angle),
        y - 9 * Math.sin(angle) - 4 * Math.cos(angle),
      ],
      [
        x - 9 * Math.cos(angle) - 4 * Math.sin(angle),
        y - 9 * Math.sin(angle) + 4 * Math.cos(angle),
      ],
    ];
    elements.push(
      `<polygon points="${corners.map((p) => p.join(",")).join(" ")}" fill="#526c8a"/>`,
    );
  }
  if (label) text(lx, ly, label, 14);
}
function actor(x, y, label) {
  elements.push(
    `<g fill="none" stroke="#365879" stroke-width="2"><circle cx="${x}" cy="${y}" r="13"/><path d="M${x},${y + 13}v39 m-24,-24h48 m-24,24l-20,29 m20,-29l20,29"/></g>`,
  );
  text(x, y + 105, label, 16);
}
function oval(x, y, w, h, lines) {
  elements.push(
    `<ellipse cx="${x + w / 2}" cy="${y + h / 2}" rx="${w / 2}" ry="${h / 2}" fill="${palette.blue}" stroke="#8096b0" stroke-width="1.5"/>`,
  );
  text(x + w / 2, y + h / 2 - ((lines.length - 1) * 21) / 2 + 5, lines, 15);
}
function begin(title, subtitle) {
  elements = [];
  text(40, 43, title, 26, "start");
  text(40, 75, subtitle, 15, "start", "#53657a");
}
function save(name, width, height) {
  fs.writeFileSync(
    path.join(out, name + ".svg"),
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title"><title id="title">${esc(name)}</title><defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10Z" fill="#526c8a"/></marker></defs><rect width="100%" height="100%" fill="white"/><g font-family="Segoe UI, Arial, sans-serif">${elements.join("\n")}</g></svg>\n`,
  );
}

begin(
  "01 · Kiến trúc GarageCar",
  "Đường liền: đã triển khai. Đường nét đứt: hạng mục trong phiếu nhiệm vụ chưa có source.",
);
box(40, 125, 300, 110, ["Web trên máy tính", "Admin · Cố vấn · Kế toán", "Thợ · Khách"], "blue");
box(
  420,
  125,
  300,
  110,
  ["PWA trên điện thoại", "Cùng mã frontend HTML/CSS/JS", "Manifest + Service Worker"],
  "blue",
);
box(
  800,
  125,
  280,
  110,
  ["App di động riêng", "CHƯA TRIỂN KHAI", "Dự kiến gọi API chung"],
  "amber",
  true,
);
line([
  [190, 235],
  [190, 285],
  [555, 285],
  [555, 330],
]);
line(
  [
    [570, 235],
    [570, 330],
  ],
  "JSON / Bearer JWT",
  685,
  290,
);
line(
  [
    [940, 235],
    [940, 285],
    [740, 285],
    [740, 330],
  ],
  "Dự kiến",
  936,
  274,
  true,
  true,
);
box(
  180,
  330,
  740,
  115,
  [
    "FastAPI · Một backend, các router theo nghiệp vụ",
    "Xác thực → quyền → kiểm tra đầu vào → xử lý giao dịch",
    "Dịch vụ · Kho · Tài chính · Nhân sự · Bảo dưỡng · Hộp thư",
  ],
  "green",
);
line(
  [
    [550, 445],
    [550, 505],
  ],
  "SQLAlchemy async / asyncpg",
  735,
  482,
);
box(330, 505, 440, 100, ["PostgreSQL", "Hồ sơ, tiền/tồn, lịch sử, ảnh và tin nhắn"], "green");
box(40, 520, 240, 85, ["JSON tham khảo bảo dưỡng", "Không thay dữ liệu DB"], "gray");
line([
  [160, 520],
  [160, 390],
  [180, 390],
]);
text(
  550,
  662,
  [
    "Không AI. Worker nhắc hạn chạy cùng backend; người phụ trách duyệt công bố.",
    "PWA không cache giao dịch API và cần mạng để đọc/ghi dữ liệu cá nhân.",
  ],
  16,
);
save("01-architecture", 1120, 730);

begin(
  "02 · Use case tổng quan",
  "Tác nhân chính theo từng nhóm; UC03/UC12 còn có tương tác của khách theo đặc tả chi tiết.",
);
elements.push(
  '<rect x="225" y="115" width="1080" height="740" rx="6" fill="none" stroke="#8096b0" stroke-width="2"/>',
);
text(765, 145, "Hệ thống GarageCar · 5 vai trò", 19);
const rows = [
  [
    "Quản trị viên",
    [
      ["UC01", "Tài khoản và quyền"],
      ["UC09", "Kho / Danh mục"],
      ["UC11", "Quản lý nhân sự"],
      ["UC12", "Bảo dưỡng / Nhắc hạn"],
    ],
  ],
  [
    "Cố vấn dịch vụ",
    [
      ["UC03", "Lập báo giá"],
      ["UC05", "Chuyển phiếu sửa"],
      ["UC07", "QC / Bàn giao"],
    ],
  ],
  [
    "Kỹ thuật viên",
    [
      ["UC04", "Kiểm tra kỹ"],
      ["UC06", "Thực hiện / Bằng chứng"],
    ],
  ],
  [
    "Kế toán",
    [
      ["UC08", "Thu tiền / Chứng từ"],
      ["UC10", "Thu–chi / Báo cáo"],
    ],
  ],
  [
    "Khách hàng",
    [
      ["UC14", "Theo dõi xe của mình"],
      ["UC13", "Nhắn garage"],
      ["UC02", "Gửi đặt lịch"],
    ],
  ],
];
rows.forEach(([label, cases], i) => {
  const y = 212 + i * 140;
  actor(110, y + 3, label);
  cases.forEach((item, j) => {
    const x = 258 + j * 255;
    line(
      [
        [135, y + 30],
        [205, y + 30],
        [205, y - 28 - j * 8],
        [x + 115, y - 28 - j * 8],
        [x + 115, y - 5],
      ],
      "",
      0,
      0,
      false,
    );
    oval(x, y - 5, 230, 76, item);
  });
});
text(
  50,
  895,
  [
    "Quản trị có thể xử lý nghiệp vụ theo quyền; vẫn chịu điều kiện trạng thái và quy tắc không tự duyệt.",
    "UC12 Bảo dưỡng/nhắc hạn: admin/cố vấn quản lý, khách xem xe mình. Các liên hệ phụ xem bảng use case.",
    "Nhân viên xem ca/gửi nghỉ cá nhân. Đặt lịch công khai không tạo thêm vai trò đăng nhập.",
  ],
  15,
  "start",
);
save("02-use-cases", 1350, 985);

begin(
  "03 · Luồng hoạt động dịch vụ",
  "Luồng thông thường theo lượt; các nhánh lỗi giữ dữ liệu để chỉnh sửa, không lưu giao dịch dở dang.",
);
const activities = [
  ["Cố vấn", "Tiếp nhận / Kiểm tra đầu vào"],
  ["Cố vấn + Khách", "Báo giá sơ bộ / Đồng ý phạm vi"],
  ["Thợ được giao", "Kiểm tra kỹ / Ghi chẩn đoán"],
  ["Cố vấn + Khách", "Báo giá chính thức / Duyệt phiên bản"],
  ["Cố vấn + Backend", "Kiểm tra giá, thợ, tồn / Tạo phiếu"],
  ["Kỹ thuật viên", "Thực hiện / Ảnh và mã / Hoàn thành"],
  ["Cố vấn", "Nghiệm thu công việc và an toàn"],
  ["Kế toán", "Ghi nhận thu đủ / Lưu chứng từ"],
  ["Cố vấn", "Giao xe / Chăm sóc sau sửa"],
];
activities.forEach(([who, what], i) => {
  const y = 130 + i * 103;
  box(270, y, 460, 74, [what], i === 7 ? "green" : "blue");
  text(245, y + 43, who, 14, "end");
  if (i < activities.length - 1)
    line([
      [500, y + 74],
      [500, y + 103],
    ]);
});
box(
  785,
  230,
  285,
  92,
  ["Chưa đồng ý", "Chỉnh/lập lại hoặc kết thúc", "lượt chưa có phiếu"],
  "amber",
);
line(
  [
    [730, 270],
    [785, 270],
  ],
  "Không",
  758,
  256,
);
line([
  [730, 475],
  [765, 475],
  [765, 277],
  [785, 277],
]);
box(
  785,
  538,
  285,
  92,
  ["Giá/tồn/thợ không hợp lệ", "Rollback toàn bộ", "Kiểm tra rồi thử lại"],
  "amber",
);
line([
  [730, 578],
  [785, 578],
]);
box(
  785,
  720,
  285,
  100,
  ["Thiếu bằng chứng / chưa QC", "Chặn chuyển bước", "Hoàn thiện điều kiện"],
  "amber",
);
line([
  [730, 681],
  [765, 681],
  [765, 755],
  [785, 755],
]);
line([
  [730, 784],
  [785, 784],
]);
text(
  50,
  1100,
  "Thu tiền không đồng nghĩa giao xe. Mũi tên đi xuống chỉ tiếp tục khi điều kiện của bước đã đạt.",
  16,
  "start",
);
save("03-service-activity", 1120, 1140);

begin(
  "04 · Tuần tự chuyển báo giá thành phiếu",
  "POST /api/service/quotes/{quote_id}/convert — một giao dịch backend.",
);
const lanes = [
  [100, "Cố vấn"],
  [325, "Web/PWA"],
  [580, "API / Service"],
  [940, "PostgreSQL"],
];
lanes.forEach(([x, label]) => {
  box(x - 85, 115, 170, 50, [label]);
  line(
    [
      [x, 165],
      [x, 890],
    ],
    "",
    0,
    0,
    false,
    true,
  );
});
function message(from, to, y, label, reply = false) {
  line(
    [
      [from, y],
      [to, y],
    ],
    label,
    (from + to) / 2,
    y - 12,
    true,
    reply,
  );
}
message(100, 325, 215, "Chọn thợ / Tạo phiếu");
message(325, 580, 285, "POST + token + mechanicId");
message(580, 940, 355, "Đọc tài khoản, quyền và phiên");
message(940, 580, 410, "Thông tin hiện tại", true);
message(580, 940, 475, "Khóa xe/lượt; đọc báo giá final approved");
message(580, 940, 545, "Kiểm tra thợ, giá, tương thích và tồn");
message(580, 940, 615, "Ghi phiếu + hạng mục + xuất kho");
message(580, 940, 685, "Đổi trạng thái báo giá/lượt; COMMIT");
message(580, 325, 755, "201 + ticketId", true);
message(325, 100, 820, "Mở đúng phiếu / Cập nhật", true);
box(
  120,
  930,
  880,
  84,
  [
    "Nếu điều kiện không đạt: trả lỗi, rollback; không trừ kho hoặc tạo phiếu một phần.",
    "Gửi lại báo giá đã chuyển không được tạo thêm phiếu; UI giữ dữ liệu để xử lý lỗi.",
  ],
  "amber",
);
save("04-sequence-convert", 1120, 1060);

begin(
  "05 · Trạng thái phiếu sửa chữa",
  "Trạng thái của RepairTicket, khác với trạng thái xe và lượt dịch vụ.",
);
const stateXs = [50, 330, 610, 890];
["draft", "working", "completed", "paid"].forEach((state, i) =>
  box(stateXs[i], 230, 200, 85, [state], i === 3 ? "green" : "blue"),
);
line(
  [
    [250, 272],
    [330, 272],
  ],
  "Bắt đầu",
  290,
  252,
);
line(
  [
    [530, 272],
    [610, 272],
  ],
  "Hoàn tất",
  570,
  252,
);
line(
  [
    [810, 272],
    [890, 272],
  ],
  "Thu tiền",
  850,
  252,
);
box(50, 120, 200, 65, ["Tạo từ báo giá hoặc", "phiếu trực tiếp hợp lệ"], "gray");
line([
  [150, 185],
  [150, 230],
]);
box(
  265,
  370,
  295,
  100,
  ["Thợ được giao / admin", "Có quyền workshop", "Phiếu đủ điều kiện bắt đầu"],
  "gray",
);
box(
  585,
  370,
  250,
  100,
  ["Tất cả hạng mục xong", "Bằng chứng hợp lệ", "Đúng lần thực hiện"],
  "gray",
);
box(
  860,
  370,
  250,
  100,
  ["Kế toán / admin + finance", "QC nếu có lượt dịch vụ", "Một chứng từ thu"],
  "gray",
);
text(
  50,
  545,
  [
    "Phiếu trực tiếp ở draft có thể xóa và trả kho; phiếu gắn báo giá không được xóa.",
    "Mở lại một hạng mục trong khi working tăng evidenceRound, không đổi vòng đời phiếu.",
    "Gửi lại thao tác paid không tạo lần thu thứ hai. Không có trạng thái refunded/partial-paid trong bản này.",
  ],
  16,
  "start",
);
save("05-ticket-state", 1160, 650);

begin(
  "06 · Quan hệ dữ liệu dịch vụ",
  "Mũi tên từ bảng con tới bảng được tham chiếu; nhãn là FK. Mỗi bảng cha có thể có 0..n dòng con nếu không ghi UNIQUE.",
);
const serviceNodes = [
  [40, 130, "users", ["PK id"]],
  [400, 130, "vehicles", ["PK id", "FK customerId (nullable)"]],
  [800, 130, "mechanics", ["PK id", "FK userId (nullable, UNIQUE)"]],
  [40, 340, "service_quotes", ["PK id", "FK visitId", "items: JSON, revision, stage"]],
  [400, 340, "service_visits", ["PK id", "FK vehicleId, mechanicId", "advisorId, qcBy → users"]],
  [
    800,
    340,
    "repair_tickets",
    ["PK id", "FK vehicleId, mechanicId", "serviceVisitId nullable UNIQUE"],
  ],
  [40, 590, "inventories", ["PK id", "sku, barcode, quantity"]],
  [400, 590, "repair_items", ["PK id", "FK repairTicketId, inventoryId", "inventoryId nullable"]],
  [800, 590, "payment_receipts", ["PK id", "FK ticketId UNIQUE", "receivedBy → users"]],
  [40, 820, "inventory_movements", ["FK inventoryId", "reference: văn bản, không FK"]],
  [400, 820, "repair_evidence", ["FK itemId", "createdBy → users", "round, image, productCode"]],
];
serviceNodes.forEach(([x, y, name, fields]) => box(x, y, 280, 125, [name, ...fields]));
line(
  [
    [400, 190],
    [320, 190],
  ],
  "customerId",
  360,
  178,
);
line(
  [
    [800, 160],
    [770, 160],
    [770, 108],
    [180, 108],
    [180, 130],
  ],
  "userId",
  500,
  100,
);
line(
  [
    [320, 400],
    [400, 400],
  ],
  "visitId",
  360,
  388,
);
line(
  [
    [540, 340],
    [540, 255],
  ],
  "vehicleId",
  584,
  298,
);
line(
  [
    [800, 400],
    [680, 400],
  ],
  "serviceVisitId",
  741,
  387,
);
line(
  [
    [940, 340],
    [940, 255],
  ],
  "mechanicId",
  991,
  301,
);
line(
  [
    [850, 340],
    [850, 290],
    [650, 290],
    [650, 255],
  ],
  "vehicleId",
  752,
  281,
);
line(
  [
    [540, 590],
    [540, 530],
    [880, 530],
    [880, 465],
  ],
  "repairTicketId",
  700,
  518,
);
line(
  [
    [400, 652],
    [320, 652],
  ],
  "inventoryId",
  360,
  640,
);
line(
  [
    [940, 590],
    [940, 465],
  ],
  "ticketId",
  984,
  527,
);
line(
  [
    [180, 820],
    [180, 715],
  ],
  "inventoryId",
  230,
  776,
);
line(
  [
    [540, 820],
    [540, 715],
  ],
  "itemId",
  575,
  776,
);
text(
  50,
  1000,
  [
    "Các FK người tạo/duyệt và quan hệ phụ xem từ điển dữ liệu. Một FK nullable có 0..1 cha, FK bắt buộc có 1 cha.",
    "serviceVisitId và ticketId UNIQUE: tối đa một phiếu/lượt và một chứng từ/phiếu. Booking lưu liên hệ, chưa có FK users.",
  ],
  15,
  "start",
);
save("06-data-service", 1120, 1080);

begin(
  "07 · Quan hệ nhân sự và hộp thư",
  "Mũi tên từ bảng con tới bảng cha; trường người tạo/duyệt chi tiết xem từ điển dữ liệu.",
);
box(435, 135, 260, 95, ["users", "PK id · 5 vai trò"], "green");
const staffNodes = [
  [40, "employee_profiles", "userId PK/FK", "Tối đa 1 hồ sơ / user"],
  [305, "staff_shifts", "userId FK", "Nhiều ca / user"],
  [570, "leave_requests", "userId FK", "Nhiều đơn / user"],
  [835, "staff_certificates", "userId FK", "Nhiều chứng chỉ / user"],
];
staffNodes.forEach(([x, title, key, note]) => {
  box(x, 330, 245, 110, [title, key, note]);
  line([
    [x + 122, 330],
    [x + 122, 280],
    [565, 280],
    [565, 230],
  ]);
});
box(40, 570, 285, 115, [
  "support_conversations",
  "customerId → users",
  "advisorId → users (nullable)",
  "vehicleId → vehicles (nullable)",
]);
box(430, 570, 290, 115, [
  "support_messages",
  "conversationId FK",
  "senderId → users",
  "UUID chống trùng",
]);
box(825, 570, 260, 115, [
  "support_reads",
  "PK conversationId + userId",
  "lastReadMessageId: số",
  "không phải FK",
]);
line(
  [
    [430, 625],
    [325, 625],
  ],
  "conversationId",
  378,
  611,
);
line(
  [
    [955, 685],
    [955, 755],
    [180, 755],
    [180, 685],
  ],
  "conversationId",
  540,
  743,
);
text(
  50,
  815,
  [
    "users → hội thoại/tin/con trỏ: một người có nhiều bản ghi; mỗi FK user bắt buộc trỏ đúng một tài khoản.",
    "Tin nhắn duy nhất theo conversationId + senderId + clientMessageId; con trỏ đọc riêng từng người.",
    "HR là chức năng của admin, không phải bảng hay vai trò mới. Migration giữ nguyên userId và toàn bộ lịch sử.",
  ],
  15,
  "start",
);
save("07-data-support", 1120, 920);

begin(
  "08 · Triển khai Docker demo",
  "Cấu hình tại docker-compose.yml; không biểu diễn kết quả triển khai production.",
);
box(50, 150, 290, 100, ["Trình duyệt / PWA", "Máy tính hoặc điện thoại", "Web port mặc định 3000"]);
box(435, 150, 280, 100, ["Nginx · frontend", "Phục vụ fe/", "Proxy /api → backend"], "green");
box(815, 150, 270, 100, ["FastAPI · backend", "Uvicorn", "Migration → startup"], "green");
line(
  [
    [340, 200],
    [435, 200],
  ],
  "HTTP(S)",
  388,
  185,
);
line(
  [
    [715, 200],
    [815, 200],
  ],
  "/api",
  766,
  185,
);
box(
  815,
  390,
  270,
  100,
  ["PostgreSQL 16 · db", "db:5432 trong mạng Docker", "Volume pgdata"],
  "green",
);
line(
  [
    [950, 250],
    [950, 390],
  ],
  "asyncpg",
  997,
  327,
);
box(
  435,
  390,
  280,
  100,
  ["pgAdmin / pg_dump", "Cổng host loopback 5434", "Backup và kiểm tra dữ liệu"],
  "gray",
);
line(
  [
    [715, 440],
    [815, 440],
  ],
  "SQL",
  766,
  425,
);
box(
  50,
  390,
  290,
  100,
  ["Tài nguyên tĩnh", "Service worker / offline shell", "API không cache"],
  "gray",
);
line(
  [
    [195, 250],
    [195, 390],
  ],
  "Cache tĩnh",
  254,
  327,
);
text(
  50,
  560,
  [
    "API trực tiếp ở host 127.0.0.1:8001; DB host 127.0.0.1:5434. Biến cổng có thể thay đổi.",
    "PWA/camera trên điện thoại cần HTTPS phù hợp. URL/thiết bị thật phải kiểm tra khi demo.",
    "Database Docker độc lập với PostgreSQL Windows. Không xóa volume khi cần giữ dữ liệu.",
  ],
  16,
  "start",
);
save("08-deployment", 1120, 670);

begin(
  "09 · Bảo dưỡng theo quy tắc",
  "Không AI: dựa vào cấu hình xe, nguồn được xác minh, ODO và lịch sử dịch vụ.",
);
box(
  50,
  140,
  310,
  100,
  ["Danh mục JSON tham khảo", "Bộ phận / hãng / dòng xe", "Chưa phải lịch được duyệt"],
  "gray",
);
box(
  420,
  140,
  310,
  100,
  ["maintenance_profiles", "scope + rules + source", "Người phụ trách xác minh"],
  "blue",
);
box(790, 140, 280, 100, ["vehicle_care", "Cấu hình, ODO, ngày dùng", "profileId phù hợp"], "blue");
line(
  [
    [360, 190],
    [420, 190],
  ],
  "Tra cứu",
  389,
  174,
  true,
  true,
);
line(
  [
    [730, 190],
    [790, 190],
  ],
  "Chọn",
  759,
  174,
);
box(
  50,
  390,
  310,
  100,
  ["maintenance_records", "Công việc đã thực hiện", "Ngày + ODO + liên kết phiếu"],
  "blue",
);
box(
  420,
  390,
  310,
  100,
  ["Tính hạn / Worker", "Km hoặc thời gian", "Khóa chu kỳ chống nhắc trùng"],
  "green",
);
box(
  790,
  390,
  280,
  100,
  ["maintenance_reminders", "pending → published", "Cố vấn/admin công bố"],
  "green",
);
line([
  [360, 440],
  [420, 440],
]);
line([
  [575, 240],
  [575, 390],
]);
line([
  [930, 240],
  [930, 300],
  [675, 300],
  [675, 390],
]);
line([
  [730, 440],
  [790, 440],
]);
box(790, 580, 280, 75, ["Khách xem nhắc của xe mình", "Chỉ bản đã công bố"], "green");
line([
  [930, 490],
  [930, 580],
]);
text(
  50,
  582,
  [
    "ERD liên quan: vehicle_care.vehicleId là PK/FK vehicles;",
    "records/reminders có vehicleId, reminders có profileId.",
    "Worker không gửi SMS/email/push. Nguồn DEMO chỉ minh họa.",
  ],
  16,
  "start",
);
save("09-maintenance", 1120, 720);

begin(
  "10 · Bản đồ màn hình chính",
  "Phác thảo cấu trúc từ giao diện hiện có; không phải ảnh chụp nghiệm thu hay thiết kế app native.",
);
const screens = [
  [
    40,
    130,
    "Quản trị viên",
    [
      "Menu nhóm | Bảng điều hành",
      "Tiếp nhận · Xưởng · Kho · Tài chính",
      "Nhân sự & tài khoản · Ca/chứng chỉ",
      "Bảo dưỡng · Hộp thư",
    ],
  ],
  [
    595,
    130,
    "Cố vấn dịch vụ",
    [
      "Tiếp nhận & lịch hẹn | Lọc xe",
      "Lượt dịch vụ | Hướng dẫn bước tiếp",
      "Báo giá / Chẩn đoán / QC",
      "Bảo dưỡng · Hộp thư · Lịch cá nhân",
    ],
  ],
  [
    40,
    410,
    "Kỹ thuật viên",
    [
      "Công việc được giao | Lọc trạng thái",
      "Phiếu | Hạng mục / Bằng chứng",
      "Tải ảnh / Nhập mã / Hoàn thành",
      "Tra kho · Bảo dưỡng · Lịch cá nhân",
    ],
  ],
  [
    595,
    410,
    "Kế toán",
    [
      "Phiếu chờ thu | Điều kiện QC",
      "Phương thức / Tham chiếu / Thu tiền",
      "Sổ thu · Đề nghị chi · Báo cáo",
      "Lịch cá nhân",
    ],
  ],
  [
    40,
    690,
    "Khách hàng",
    [
      "Xe của tôi | Tiến độ / Chi phí",
      "Báo giá chờ quyết định",
      "Ảnh / Chứng từ / Bảo dưỡng",
      "Đặt lịch · Nhắn garage",
    ],
  ],
];
screens.forEach(([x, y, title, content]) => {
  box(x, y, 505, 225, [""], "gray");
  box(x + 12, y + 12, 481, 42, [title], "blue");
  text(x + 26, y + 88, content, 17, "start");
});
text(
  610,
  755,
  [
    "Trên điện thoại: menu thu gọn;",
    "biểu mẫu giữ bản nháp khi lỗi.",
    "Cùng API và quyền với bản web.",
    "Không có màn hỏi đáp AI hoặc portal HR.",
  ],
  17,
  "start",
);
save("10-screen-map", 1140, 970);
console.log("Generated 10 report SVG diagrams.");
