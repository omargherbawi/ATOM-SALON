export interface StaffPermission {
  key: string;
  label: string;
  group: string;
}

export const STAFF_PERMISSIONS: StaffPermission[] = [
  { key: 'appointments.view', label: 'View Appointments', group: 'Appointments' },
  { key: 'appointments.add', label: 'Add Appointments', group: 'Appointments' },
  { key: 'appointments.edit', label: 'Edit Appointments', group: 'Appointments' },
  { key: 'barbers.view', label: 'View Barbers', group: 'Barbers' },
  { key: 'barbers.add', label: 'Add Barbers', group: 'Barbers' },
  { key: 'barbers.edit', label: 'Edit Barbers', group: 'Barbers' },
];

export function hasPermission(
  permissions: string[] | undefined,
  permission: string
): boolean {
  return permissions?.includes(permission) ?? false;
}
