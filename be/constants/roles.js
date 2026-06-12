// User Roles Constants

const ROLES = {
  ADMIN: 'admin',
  MECHANIC: 'mechanic',
  ACCOUNTANT: 'accountant',
  CUSTOMER: 'customer'
};

const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: ['all'],
  [ROLES.MECHANIC]: [
    'view_assigned_repairs',
    'update_repair_items',
    'complete_repairs',
    'view_inventory'
  ],
  [ROLES.ACCOUNTANT]: [
    'view_vehicles',
    'view_repairs',
    'create_invoices',
    'process_payments',
    'view_reports'
  ],
  [ROLES.CUSTOMER]: [
    'view_own_vehicles',
    'view_own_repairs'
  ]
};

// Roles that can be created by admin via register-staff
const STAFF_ROLES = [ROLES.ADMIN, ROLES.MECHANIC];

module.exports = {
  ROLES,
  ROLE_PERMISSIONS,
  STAFF_ROLES
};
