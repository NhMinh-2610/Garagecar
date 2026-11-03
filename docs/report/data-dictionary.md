# Từ điển dữ liệu từ mã nguồn

Sinh bằng `python scripts/export-code-reference.py`; chỉ đọc metadata SQLAlchemy, không đọc dữ liệu hay mật khẩu. Các cột camelCase được giữ nguyên.

PK: khóa chính; FK: khóa ngoại; UNIQUE: duy nhất. Ràng buộc tổng hợp được liệt kê dưới mỗi bảng. Điều kiện nghiệp vụ còn được kiểm tra trong router/service; nullable không thay thế quy tắc nhập liệu.

## `bookings`

| Cột             | Kiểu       | Cho phép NULL | Khóa |
| --------------- | ---------- | ------------- | ---- |
| `id`            | `INTEGER`  | Không         | PK   |
| `customerName`  | `VARCHAR`  | Không         | —    |
| `phone`         | `VARCHAR`  | Không         | —    |
| `service`       | `VARCHAR`  | Không         | —    |
| `note`          | `VARCHAR`  | Không         | —    |
| `preferredDate` | `DATE`     | Không         | —    |
| `status`        | `VARCHAR`  | Không         | —    |
| `createdAt`     | `DATETIME` | Không         | —    |

## `brands`

| Cột    | Kiểu      | Cho phép NULL | Khóa   |
| ------ | --------- | ------------- | ------ |
| `id`   | `INTEGER` | Không         | PK     |
| `name` | `VARCHAR` | Không         | UNIQUE |

## `employee_profiles`

| Cột          | Kiểu            | Cho phép NULL | Khóa                |
| ------------ | --------------- | ------------- | ------------------- |
| `userId`     | `INTEGER`       | Không         | PK; FK → `users.id` |
| `phone`      | `VARCHAR(30)`   | Không         | —                   |
| `department` | `VARCHAR(100)`  | Không         | —                   |
| `jobTitle`   | `VARCHAR(100)`  | Không         | —                   |
| `startDate`  | `DATE`          | Không         | —                   |
| `note`       | `VARCHAR(2000)` | Không         | —                   |
| `updatedBy`  | `INTEGER`       | Không         | FK → `users.id`     |
| `updatedAt`  | `DATETIME`      | Có            | —                   |

## `expenses`

| Cột              | Kiểu             | Cho phép NULL | Khóa            |
| ---------------- | ---------------- | ------------- | --------------- |
| `id`             | `INTEGER`        | Không         | PK              |
| `category`       | `VARCHAR(40)`    | Không         | —               |
| `payee`          | `VARCHAR(200)`   | Không         | —               |
| `documentNumber` | `VARCHAR(100)`   | Không         | UNIQUE          |
| `amount`         | `NUMERIC(14, 2)` | Không         | —               |
| `note`           | `VARCHAR(2000)`  | Không         | —               |
| `status`         | `VARCHAR(20)`    | Không         | —               |
| `createdBy`      | `INTEGER`        | Không         | FK → `users.id` |
| `approvedBy`     | `INTEGER`        | Có            | FK → `users.id` |
| `approvedAt`     | `DATETIME`       | Có            | —               |
| `paidBy`         | `INTEGER`        | Có            | FK → `users.id` |
| `paidAt`         | `DATETIME`       | Có            | —               |
| `method`         | `VARCHAR(20)`    | Có            | —               |
| `reference`      | `VARCHAR(100)`   | Có            | —               |
| `createdAt`      | `DATETIME`       | Có            | —               |

- Duy nhất: `documentNumber`.
- Điều kiện DB: `amount > 0`.

## `inventories`

| Cột            | Kiểu             | Cho phép NULL | Khóa   |
| -------------- | ---------------- | ------------- | ------ |
| `id`           | `INTEGER`        | Không         | PK     |
| `name`         | `VARCHAR`        | Không         | —      |
| `sku`          | `VARCHAR(100)`   | Có            | UNIQUE |
| `barcode`      | `VARCHAR(100)`   | Có            | UNIQUE |
| `manufacturer` | `VARCHAR(200)`   | Không         | —      |
| `fitments`     | `JSON`           | Không         | —      |
| `highVoltage`  | `BOOLEAN`        | Không         | —      |
| `quantity`     | `INTEGER`        | Không         | —      |
| `unitPrice`    | `NUMERIC(14, 2)` | Không         | —      |
| `createdAt`    | `DATETIME`       | Có            | —      |
| `updatedAt`    | `DATETIME`       | Có            | —      |

- Duy nhất: `barcode`.
- Duy nhất: `sku`.

## `inventory_movements`

| Cột              | Kiểu       | Cho phép NULL | Khóa                  |
| ---------------- | ---------- | ------------- | --------------------- |
| `id`             | `INTEGER`  | Không         | PK                    |
| `inventoryId`    | `INTEGER`  | Không         | FK → `inventories.id` |
| `quantityChange` | `INTEGER`  | Không         | —                     |
| `balanceAfter`   | `INTEGER`  | Không         | —                     |
| `reason`         | `VARCHAR`  | Không         | —                     |
| `reference`      | `VARCHAR`  | Có            | —                     |
| `createdAt`      | `DATETIME` | Không         | —                     |

## `leave_requests`

| Cột            | Kiểu            | Cho phép NULL | Khóa            |
| -------------- | --------------- | ------------- | --------------- |
| `id`           | `INTEGER`       | Không         | PK              |
| `userId`       | `INTEGER`       | Không         | FK → `users.id` |
| `fromDate`     | `DATE`          | Không         | —               |
| `toDate`       | `DATE`          | Không         | —               |
| `reason`       | `VARCHAR(2000)` | Không         | —               |
| `status`       | `VARCHAR(20)`   | Không         | —               |
| `decidedBy`    | `INTEGER`       | Có            | FK → `users.id` |
| `decisionNote` | `VARCHAR(2000)` | Có            | —               |
| `decidedAt`    | `DATETIME`      | Có            | —               |
| `createdAt`    | `DATETIME`      | Có            | —               |

## `login_attempts`

| Cột            | Kiểu           | Cho phép NULL | Khóa |
| -------------- | -------------- | ------------- | ---- |
| `id`           | `INTEGER`      | Không         | PK   |
| `identifier`   | `VARCHAR(255)` | Không         | —    |
| `success`      | `BOOLEAN`      | Không         | —    |
| `attempted_at` | `DATETIME`     | Không         | —    |

## `maintenance_profiles`

| Cột          | Kiểu            | Cho phép NULL | Khóa            |
| ------------ | --------------- | ------------- | --------------- |
| `id`         | `INTEGER`       | Không         | PK              |
| `title`      | `VARCHAR(255)`  | Không         | —               |
| `scope`      | `JSON`          | Không         | —               |
| `rules`      | `JSON`          | Không         | —               |
| `sourceUrl`  | `VARCHAR(2000)` | Không         | —               |
| `sourcePage` | `VARCHAR(255)`  | Không         | —               |
| `version`    | `VARCHAR(100)`  | Không         | —               |
| `status`     | `VARCHAR(20)`   | Không         | —               |
| `approvedBy` | `INTEGER`       | Có            | FK → `users.id` |
| `approvedAt` | `DATETIME`      | Có            | —               |
| `createdAt`  | `DATETIME`      | Có            | —               |

## `maintenance_records`

| Cột           | Kiểu            | Cho phép NULL | Khóa                     |
| ------------- | --------------- | ------------- | ------------------------ |
| `id`          | `INTEGER`       | Không         | PK                       |
| `vehicleId`   | `INTEGER`       | Không         | FK → `vehicles.id`       |
| `component`   | `VARCHAR(80)`   | Không         | —                        |
| `action`      | `VARCHAR(20)`   | Không         | —                        |
| `performedOn` | `DATE`          | Không         | —                        |
| `odometer`    | `INTEGER`       | Không         | —                        |
| `ticketId`    | `INTEGER`       | Có            | FK → `repair_tickets.id` |
| `note`        | `VARCHAR(2000)` | Không         | —                        |
| `createdBy`   | `INTEGER`       | Không         | FK → `users.id`          |
| `createdAt`   | `DATETIME`      | Có            | —                        |

- Duy nhất: `vehicleId`, `component`, `action`, `performedOn`, `odometer`.

## `maintenance_reminders`

| Cột           | Kiểu           | Cho phép NULL | Khóa                           |
| ------------- | -------------- | ------------- | ------------------------------ |
| `id`          | `INTEGER`      | Không         | PK                             |
| `vehicleId`   | `INTEGER`      | Không         | FK → `vehicles.id`             |
| `profileId`   | `INTEGER`      | Không         | FK → `maintenance_profiles.id` |
| `ruleKey`     | `VARCHAR(100)` | Không         | —                              |
| `cycleKey`    | `VARCHAR(100)` | Không         | —                              |
| `summary`     | `JSON`         | Không         | —                              |
| `status`      | `VARCHAR(20)`  | Không         | —                              |
| `publishedBy` | `INTEGER`      | Có            | FK → `users.id`                |
| `publishedAt` | `DATETIME`     | Có            | —                              |
| `createdAt`   | `DATETIME`     | Có            | —                              |

- Duy nhất: `vehicleId`, `profileId`, `ruleKey`, `cycleKey`.

## `mechanics`

| Cột         | Kiểu       | Cho phép NULL | Khóa                    |
| ----------- | ---------- | ------------- | ----------------------- |
| `id`        | `INTEGER`  | Không         | PK                      |
| `userId`    | `INTEGER`  | Có            | UNIQUE; FK → `users.id` |
| `fullName`  | `VARCHAR`  | Không         | —                       |
| `phone`     | `VARCHAR`  | Có            | —                       |
| `specialty` | `VARCHAR`  | Có            | —                       |
| `status`    | `VARCHAR`  | Không         | —                       |
| `createdAt` | `DATETIME` | Có            | —                       |
| `updatedAt` | `DATETIME` | Có            | —                       |

- Duy nhất: `userId`.

## `payment_receipts`

| Cột          | Kiểu             | Cho phép NULL | Khóa                             |
| ------------ | ---------------- | ------------- | -------------------------------- |
| `id`         | `INTEGER`        | Không         | PK                               |
| `ticketId`   | `INTEGER`        | Không         | UNIQUE; FK → `repair_tickets.id` |
| `amount`     | `NUMERIC(14, 2)` | Không         | —                                |
| `method`     | `VARCHAR(20)`    | Không         | —                                |
| `reference`  | `VARCHAR(100)`   | Không         | —                                |
| `receivedBy` | `INTEGER`        | Không         | FK → `users.id`                  |
| `createdAt`  | `DATETIME`       | Có            | —                                |

- Duy nhất: `ticketId`.

## `repair_evidence`

| Cột            | Kiểu            | Cho phép NULL | Khóa                   |
| -------------- | --------------- | ------------- | ---------------------- |
| `id`           | `INTEGER`       | Không         | PK                     |
| `itemId`       | `INTEGER`       | Không         | FK → `repair_items.id` |
| `round`        | `INTEGER`       | Không         | —                      |
| `kind`         | `VARCHAR(20)`   | Không         | —                      |
| `productCode`  | `VARCHAR(100)`  | Có            | —                      |
| `expectedCode` | `VARCHAR(100)`  | Có            | —                      |
| `lotNumber`    | `VARCHAR(100)`  | Có            | —                      |
| `note`         | `VARCHAR(2000)` | Không         | —                      |
| `image`        | `BLOB`          | Không         | —                      |
| `sha256`       | `VARCHAR(64)`   | Không         | —                      |
| `createdBy`    | `INTEGER`       | Không         | FK → `users.id`        |
| `createdAt`    | `DATETIME`      | Có            | —                      |

## `repair_items`

| Cột              | Kiểu             | Cho phép NULL | Khóa                     |
| ---------------- | ---------------- | ------------- | ------------------------ |
| `id`             | `INTEGER`        | Không         | PK                       |
| `inventoryId`    | `INTEGER`        | Có            | FK → `inventories.id`    |
| `repairTicketId` | `INTEGER`        | Không         | FK → `repair_tickets.id` |
| `taskName`       | `VARCHAR`        | Không         | —                        |
| `partName`       | `VARCHAR`        | Có            | —                        |
| `quantity`       | `INTEGER`        | Không         | —                        |
| `partPrice`      | `NUMERIC(14, 2)` | Không         | —                        |
| `laborPrice`     | `NUMERIC(14, 2)` | Không         | —                        |
| `totalPrice`     | `NUMERIC(14, 2)` | Không         | —                        |
| `isCompleted`    | `BOOLEAN`        | Không         | —                        |
| `evidenceRound`  | `INTEGER`        | Không         | —                        |
| `partCode`       | `VARCHAR(100)`   | Có            | —                        |
| `completedAt`    | `DATETIME`       | Có            | —                        |
| `createdAt`      | `DATETIME`       | Có            | —                        |
| `updatedAt`      | `DATETIME`       | Có            | —                        |

## `repair_tickets`

| Cột              | Kiểu             | Cho phép NULL | Khóa                             |
| ---------------- | ---------------- | ------------- | -------------------------------- |
| `id`             | `INTEGER`        | Không         | PK                               |
| `mechanicId`     | `INTEGER`        | Có            | FK → `mechanics.id`              |
| `serviceVisitId` | `INTEGER`        | Có            | UNIQUE; FK → `service_visits.id` |
| `vehicleId`      | `INTEGER`        | Không         | FK → `vehicles.id`               |
| `totalAmount`    | `NUMERIC(14, 2)` | Không         | —                                |
| `mechanicName`   | `VARCHAR`        | Có            | —                                |
| `status`         | `VARCHAR`        | Không         | —                                |
| `startedAt`      | `DATETIME`       | Có            | —                                |
| `completedAt`    | `DATETIME`       | Có            | —                                |
| `paidAt`         | `DATETIME`       | Có            | —                                |
| `createdAt`      | `DATETIME`       | Có            | —                                |
| `updatedAt`      | `DATETIME`       | Có            | —                                |

- Duy nhất: `serviceVisitId`.

## `service_followups`

| Cột             | Kiểu            | Cho phép NULL | Khóa                     |
| --------------- | --------------- | ------------- | ------------------------ |
| `id`            | `INTEGER`       | Không         | PK                       |
| `visitId`       | `INTEGER`       | Không         | FK → `service_visits.id` |
| `outcome`       | `VARCHAR(30)`   | Không         | —                        |
| `rating`        | `INTEGER`       | Có            | —                        |
| `note`          | `VARCHAR(2000)` | Không         | —                        |
| `nextContactOn` | `DATE`          | Có            | —                        |
| `createdBy`     | `INTEGER`       | Không         | FK → `users.id`          |
| `createdAt`     | `DATETIME`      | Có            | —                        |

## `service_quotes`

| Cột            | Kiểu             | Cho phép NULL | Khóa                     |
| -------------- | ---------------- | ------------- | ------------------------ |
| `id`           | `INTEGER`        | Không         | PK                       |
| `visitId`      | `INTEGER`        | Không         | FK → `service_visits.id` |
| `revision`     | `INTEGER`        | Không         | —                        |
| `stage`        | `VARCHAR(20)`    | Không         | —                        |
| `items`        | `JSON`           | Không         | —                        |
| `totalAmount`  | `NUMERIC(14, 2)` | Không         | —                        |
| `status`       | `VARCHAR(20)`    | Không         | —                        |
| `decidedBy`    | `INTEGER`        | Có            | FK → `users.id`          |
| `decisionNote` | `VARCHAR(2000)`  | Có            | —                        |
| `decidedAt`    | `DATETIME`       | Có            | —                        |
| `createdAt`    | `DATETIME`       | Có            | —                        |

- Duy nhất: `visitId`, `revision`.

## `service_visits`

| Cột                 | Kiểu            | Cho phép NULL | Khóa                |
| ------------------- | --------------- | ------------- | ------------------- |
| `id`                | `INTEGER`       | Không         | PK                  |
| `vehicleId`         | `INTEGER`       | Không         | FK → `vehicles.id`  |
| `advisorId`         | `INTEGER`       | Không         | FK → `users.id`     |
| `mechanicId`        | `INTEGER`       | Có            | FK → `mechanics.id` |
| `concern`           | `VARCHAR(2000)` | Không         | —                   |
| `initialInspection` | `VARCHAR(4000)` | Không         | —                   |
| `diagnosis`         | `VARCHAR(4000)` | Có            | —                   |
| `status`            | `VARCHAR(30)`   | Không         | —                   |
| `qc`                | `JSON`          | Có            | —                   |
| `qcBy`              | `INTEGER`       | Có            | FK → `users.id`     |
| `qcAt`              | `DATETIME`      | Có            | —                   |
| `createdAt`         | `DATETIME`      | Có            | —                   |

## `staff_certificates`

| Cột                 | Kiểu            | Cho phép NULL | Khóa            |
| ------------------- | --------------- | ------------- | --------------- |
| `id`                | `INTEGER`       | Không         | PK              |
| `userId`            | `INTEGER`       | Không         | FK → `users.id` |
| `kind`              | `VARCHAR(30)`   | Không         | —               |
| `issuer`            | `VARCHAR(200)`  | Không         | —               |
| `certificateNumber` | `VARCHAR(100)`  | Không         | —               |
| `validFrom`         | `DATE`          | Không         | —               |
| `validUntil`        | `DATE`          | Không         | —               |
| `verifiedBy`        | `INTEGER`       | Không         | FK → `users.id` |
| `status`            | `VARCHAR(20)`   | Không         | —               |
| `revokedBy`         | `INTEGER`       | Có            | FK → `users.id` |
| `revokedAt`         | `DATETIME`      | Có            | —               |
| `revokeReason`      | `VARCHAR(2000)` | Có            | —               |
| `createdAt`         | `DATETIME`      | Có            | —               |

- Duy nhất: `userId`, `issuer`, `certificateNumber`.

## `staff_shifts`

| Cột         | Kiểu            | Cho phép NULL | Khóa            |
| ----------- | --------------- | ------------- | --------------- |
| `id`        | `INTEGER`       | Không         | PK              |
| `userId`    | `INTEGER`       | Không         | FK → `users.id` |
| `startsAt`  | `DATETIME`      | Không         | —               |
| `endsAt`    | `DATETIME`      | Không         | —               |
| `bay`       | `VARCHAR(100)`  | Không         | —               |
| `note`      | `VARCHAR(2000)` | Không         | —               |
| `createdBy` | `INTEGER`       | Không         | FK → `users.id` |
| `status`    | `VARCHAR(20)`   | Không         | —               |
| `createdAt` | `DATETIME`      | Có            | —               |

- Điều kiện DB: `"endsAt" > "startsAt"`.

## `support_conversations`

| Cột          | Kiểu          | Cho phép NULL | Khóa               |
| ------------ | ------------- | ------------- | ------------------ |
| `id`         | `INTEGER`     | Không         | PK                 |
| `customerId` | `INTEGER`     | Không         | FK → `users.id`    |
| `vehicleId`  | `INTEGER`     | Có            | FK → `vehicles.id` |
| `advisorId`  | `INTEGER`     | Có            | FK → `users.id`    |
| `status`     | `VARCHAR(20)` | Không         | —                  |
| `createdAt`  | `DATETIME`    | Không         | —                  |
| `updatedAt`  | `DATETIME`    | Không         | —                  |

- Điều kiện DB: `status IN ('open', 'closed')`.

## `support_messages`

| Cột               | Kiểu            | Cho phép NULL | Khóa                            |
| ----------------- | --------------- | ------------- | ------------------------------- |
| `id`              | `INTEGER`       | Không         | PK                              |
| `conversationId`  | `INTEGER`       | Không         | FK → `support_conversations.id` |
| `senderId`        | `INTEGER`       | Không         | FK → `users.id`                 |
| `senderName`      | `VARCHAR(255)`  | Không         | —                               |
| `senderRole`      | `VARCHAR(20)`   | Không         | —                               |
| `content`         | `VARCHAR(4000)` | Không         | —                               |
| `clientMessageId` | `VARCHAR(36)`   | Không         | —                               |
| `createdAt`       | `DATETIME`      | Không         | —                               |

- Điều kiện DB: `length(trim(content)) > 0`.
- Duy nhất: `conversationId`, `senderId`, `clientMessageId`.

## `support_reads`

| Cột                 | Kiểu       | Cho phép NULL | Khóa                                |
| ------------------- | ---------- | ------------- | ----------------------------------- |
| `conversationId`    | `INTEGER`  | Không         | PK; FK → `support_conversations.id` |
| `userId`            | `INTEGER`  | Không         | PK; FK → `users.id`                 |
| `lastReadMessageId` | `INTEGER`  | Không         | —                                   |
| `updatedAt`         | `DATETIME` | Không         | —                                   |

## `system_parameters`

| Cột     | Kiểu      | Cho phép NULL | Khóa   |
| ------- | --------- | ------------- | ------ |
| `id`    | `INTEGER` | Không         | PK     |
| `key`   | `VARCHAR` | Không         | UNIQUE |
| `value` | `VARCHAR` | Không         | —      |

## `users`

| Cột                   | Kiểu       | Cho phép NULL | Khóa   |
| --------------------- | ---------- | ------------- | ------ |
| `id`                  | `INTEGER`  | Không         | PK     |
| `username`            | `VARCHAR`  | Không         | UNIQUE |
| `email`               | `VARCHAR`  | Không         | UNIQUE |
| `password`            | `VARCHAR`  | Không         | —      |
| `fullName`            | `VARCHAR`  | Không         | —      |
| `role`                | `VARCHAR`  | Không         | —      |
| `isActive`            | `BOOLEAN`  | Không         | —      |
| `sessionVersion`      | `INTEGER`  | Không         | —      |
| `disabledPermissions` | `JSON`     | Không         | —      |
| `lastLoginAt`         | `DATETIME` | Có            | —      |
| `createdAt`           | `DATETIME` | Có            | —      |
| `updatedAt`           | `DATETIME` | Có            | —      |

## `vehicle_care`

| Cột            | Kiểu           | Cho phép NULL | Khóa                           |
| -------------- | -------------- | ------------- | ------------------------------ |
| `vehicleId`    | `INTEGER`      | Không         | PK; FK → `vehicles.id`         |
| `profileId`    | `INTEGER`      | Có            | FK → `maintenance_profiles.id` |
| `vin`          | `VARCHAR(17)`  | Có            | UNIQUE                         |
| `modelYear`    | `INTEGER`      | Không         | —                              |
| `engine`       | `VARCHAR(100)` | Không         | —                              |
| `gearbox`      | `VARCHAR(100)` | Không         | —                              |
| `market`       | `VARCHAR(20)`  | Không         | —                              |
| `usage`        | `VARCHAR(20)`  | Không         | —                              |
| `firstUseDate` | `DATE`         | Không         | —                              |
| `odometer`     | `INTEGER`      | Không         | —                              |
| `observedOn`   | `DATE`         | Không         | —                              |
| `updatedBy`    | `INTEGER`      | Không         | FK → `users.id`                |

- Duy nhất: `vin`.
- Điều kiện DB: `odometer >= 0`.

## `vehicles`

| Cột            | Kiểu       | Cho phép NULL | Khóa            |
| -------------- | ---------- | ------------- | --------------- |
| `id`           | `INTEGER`  | Không         | PK              |
| `customerId`   | `INTEGER`  | Có            | FK → `users.id` |
| `licensePlate` | `VARCHAR`  | Không         | UNIQUE          |
| `customerName` | `VARCHAR`  | Không         | —               |
| `phone`        | `VARCHAR`  | Không         | —               |
| `address`      | `VARCHAR`  | Có            | —               |
| `carBrand`     | `VARCHAR`  | Không         | —               |
| `carModel`     | `VARCHAR`  | Có            | —               |
| `status`       | `VARCHAR`  | Không         | —               |
| `receivedDate` | `DATETIME` | Có            | —               |
| `createdAt`    | `DATETIME` | Có            | —               |
| `updatedAt`    | `DATETIME` | Có            | —               |

## `wages`

| Cột     | Kiểu             | Cho phép NULL | Khóa   |
| ------- | ---------------- | ------------- | ------ |
| `id`    | `INTEGER`        | Không         | PK     |
| `name`  | `VARCHAR`        | Không         | UNIQUE |
| `price` | `NUMERIC(14, 2)` | Không         | —      |

## Bảng kỹ thuật ngoài ORM

`alembic_version` lưu revision. Migration `008_merge_hr_role` tạo `legacy_hr_role_migration`: `userId` (PK/FK users), `wasActive` (boolean), `disabledPermissions` (JSON), `migratedAt` (timestamp). Bảng này giữ trạng thái tài khoản HR trước chuyển đổi; không phải vai trò hoặc phân hệ mới.
