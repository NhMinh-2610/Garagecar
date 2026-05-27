require("dotenv").config();
const bcrypt = require("bcryptjs");
const { sequelize } = require("../config/database");
const {
  User,
  Vehicle,
  Inventory,
  Mechanic,
  RepairTicket,
  RepairItem,
} = require("../models");

const seedDatabase = async () => {
  try {
    console.log("🌱 Starting database seed...");

    // Sync database (force: true will recreate tables)
    await sequelize.sync({ force: true });
    console.log("✓ Database tables created");

    // ===== CREATE TEST USERS FOR ALL ROLES =====
    const hashedPassword = await bcrypt.hash("123456", 10);
    
    const adminUser = await User.create({
      username: "admin",
      email: "admin@autopro.com",
      password: hashedPassword,
      fullName: "Quản Trị Viên",
      role: "admin",
    });
    console.log("✓ Admin user created (admin@autopro.com / 123456)");

    const mechanicUser = await User.create({
      username: "mechanic",
      email: "mechanic@autopro.com",
      password: hashedPassword,
      fullName: "Nguyễn Văn Thợ",
      role: "mechanic",
    });
    console.log("✓ Mechanic user created (mechanic@autopro.com / 123456)");

    const accountantUser = await User.create({
      username: "accountant",
      email: "accountant@autopro.com",
      password: hashedPassword,
      fullName: "Trần Thị Toán",
      role: "accountant",
    });
    console.log("✓ Accountant user created (accountant@autopro.com / 123456)");

    const customerUser = await User.create({
      username: "customer",
      email: "customer@autopro.com",
      password: hashedPassword,
      fullName: "Nguyễn Văn A",
      role: "customer",
    });
    console.log("✓ Customer user created (customer@autopro.com / 123456)");

    // Create additional customer for testing
    const customer2 = await User.create({
      username: "customer2",
      email: "customer2@autopro.com",
      password: hashedPassword,
      fullName: "Trần Thị B",
      role: "customer",
    });

    // ===== CREATE MECHANICS =====
    const mechanics = await Mechanic.bulkCreate([
      { fullName: "Nguyễn Văn Thợ", phone: "0901234567", specialty: "Động cơ" },
      { fullName: "Trần Minh Tâm", phone: "0902345678", specialty: "Điện" },
      { fullName: "Lê Hoàng Nam", phone: "0903456789", specialty: "Gầm bệ" },
    ]);
    console.log("✓ Created sample mechanics");

    // ===== CREATE INVENTORY =====
    await Inventory.bulkCreate([
      { name: "Nhớt Castrol 5W-40", quantity: 50, unitPrice: 450000 },
      { name: "Lọc nhớt", quantity: 100, unitPrice: 150000 },
      { name: "Lọc gió", quantity: 80, unitPrice: 200000 },
      { name: "Bóng đèn H4", quantity: 40, unitPrice: 50000 },
      { name: "Bình ắc quy 12V", quantity: 20, unitPrice: 1200000 },
      { name: "Má phanh trước", quantity: 30, unitPrice: 350000 },
      { name: "Dầu phanh DOT 4", quantity: 25, unitPrice: 180000 },
    ]);
    console.log("✓ Created inventory items");

    // ===== CREATE VEHICLES (LINKED TO CUSTOMERS) =====
    const vehicles = await Vehicle.bulkCreate([
      {
        licensePlate: "51H-12345",
        customerName: "Nguyễn Văn A", // Matches customerUser.fullName
        phone: "0909123456",
        address: "Quận 1, TP.HCM",
        carBrand: "Toyota",
        carModel: "Vios",
        status: "waiting",
      },
      {
        licensePlate: "51H-99999",
        customerName: "Nguyễn Văn A", // Same customer, second car
        phone: "0909123456",
        address: "Quận 1, TP.HCM",
        carBrand: "Honda",
        carModel: "City",
        status: "completed",
      },
      {
        licensePlate: "51G-888.88",
        customerName: "Trần Thị B", // Matches customer2.fullName
        phone: "0909888777",
        address: "Quận 3, TP.HCM",
        carBrand: "Mercedes",
        carModel: "C300",
        status: "repairing",
      },
      {
        licensePlate: "29A-555.55",
        customerName: "Lê Văn C", // No user account (walk-in customer)
        phone: "0912345678",
        address: "Hà Nội",
        carBrand: "Ford",
        carModel: "Ranger",
        status: "completed",
      },
    ]);
    console.log("✓ Created sample vehicles");

    // ===== CREATE REPAIR TICKETS =====
    
    // Ticket 1: In Progress (for Mechanic Portal demo)
    const ticket1 = await RepairTicket.create({
      vehicleId: vehicles[0].id,
      mechanicName: mechanicUser.fullName, // Assigned to Nguyễn Văn Thợ
      status: "working",
      totalAmount: 500000,
      startedAt: new Date(),
    });

    await RepairItem.bulkCreate([
      {
        repairTicketId: ticket1.id,
        taskName: "Thay nhớt động cơ",
        partName: "Nhớt Castrol 5W-40",
        laborPrice: 100000,
        partPrice: 400000,
        totalPrice: 500000,
        quantity: 1,
        isCompleted: false,
      },
      {
        repairTicketId: ticket1.id,
        taskName: "Kiểm tra phanh",
        partName: "Không",
        laborPrice: 150000,
        partPrice: 0,
        totalPrice: 150000,
        quantity: 1,
        isCompleted: false,
      },
    ]);

    // Ticket 2: Completed (6 months ago - for maintenance alert demo)
    const sixMonthsAgo = new Date();
    sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);
    
    const ticket2 = await RepairTicket.create({
      vehicleId: vehicles[1].id,
      mechanicName: mechanics[1].fullName,
      status: "completed",
      totalAmount: 800000,
      startedAt: sixMonthsAgo,
      completedAt: sixMonthsAgo,
    });

    await RepairItem.create({
      repairTicketId: ticket2.id,
      taskName: "Bảo dưỡng định kỳ",
      partName: "Nhớt + Lọc",
      laborPrice: 200000,
      partPrice: 600000,
      totalPrice: 800000,
      quantity: 1,
      isCompleted: true,
      completedAt: sixMonthsAgo,
    });

    // Ticket 3: Recently Completed (for Accountant Portal - pending payment)
    const ticket3 = await RepairTicket.create({
      vehicleId: vehicles[2].id,
      mechanicName: mechanics[1].fullName,
      status: "completed",
      totalAmount: 1200000,
      startedAt: new Date(Date.now() - 86400000), // 1 day ago
      completedAt: new Date(),
    });

    await RepairItem.create({
      repairTicketId: ticket3.id,
      taskName: "Sơn dặm cản trước",
      partName: "Sơn",
      laborPrice: 800000,
      partPrice: 400000,
      totalPrice: 1200000,
      quantity: 1,
      isCompleted: true,
      completedAt: new Date(),
    });

    // Ticket 4: Paid (for history)
    const ticket4 = await RepairTicket.create({
      vehicleId: vehicles[3].id,
      mechanicName: mechanics[2].fullName,
      status: "paid",
      totalAmount: 2500000,
      startedAt: new Date(Date.now() - 172800000), // 2 days ago
      completedAt: new Date(Date.now() - 86400000),
      paidAt: new Date(),
    });

    await RepairItem.create({
      repairTicketId: ticket4.id,
      taskName: "Thay bình ắc quy",
      partName: "Bình ắc quy 12V",
      laborPrice: 300000,
      partPrice: 1200000,
      totalPrice: 1500000,
      quantity: 1,
      isCompleted: true,
      completedAt: new Date(Date.now() - 86400000),
    });

    console.log("✓ Created sample repair tickets with items");

    console.log("\n✅ Database seeded successfully!");
    console.log("\n📋 Test Accounts:");
    console.log("   👑 Admin:      admin@autopro.com / 123456");
    console.log("   🔧 Mechanic:   mechanic@autopro.com / 123456");
    console.log("   💰 Accountant: accountant@autopro.com / 123456");
    console.log("   🚗 Customer:   customer@autopro.com / 123456");
    console.log("\n🚀 Start server with: cd be && npm start");

    process.exit(0);
  } catch (error) {
    console.error("✗ Seed failed:", error);
    process.exit(1);
  }
};

seedDatabase();
