// User Roles Constants

const ROLES = {
  ADMIN: 'admin',
  MECHANIC: 'mechanic',
  ACCOUNTANT: 'accountant',
  CUSTOMER: 'customer'
};

const ROLE_PERMISSIONS = {
  [ROLES.ADMIN]: ['all'],
  [ROLES.MECHANIC]: ['view_repairs', 'update_repairs', 'view_inventory', 'complete_tasks'],
  [ROLES.ACCOUNTANT]: ['view_vehicles', 'view_repairs', 'create_invoices', 'process_payments', 'view_reports'],
  [ROLES.CUSTOMER]: ['view_own_vehicles', 'view_own_repairs', 'request_service']
};

module.exports = {
  ROLES,
  ROLE_PERMISSIONS
};
