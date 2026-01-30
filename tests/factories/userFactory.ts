import { faker } from '@faker-js/faker';
import { AuthUser, User } from '@/types/todo';

const USER_COLORS = [
  '#0033A0', // Academic Blue
  '#059669', // Green
  '#7c3aed', // Purple
  '#dc2626', // Red
  '#ea580c', // Orange
  '#0891b2', // Cyan
  '#be185d', // Pink
  '#4f46e5', // Indigo
];

/**
 * Create a mock user
 */
export function createMockUser(overrides?: Partial<User>): User {
  return {
    id: faker.string.uuid(),
    name: faker.person.firstName(),
    color: faker.helpers.arrayElement(USER_COLORS),
    created_at: faker.date.past().toISOString(),
    ...overrides,
  };
}

/**
 * Create a mock authenticated user
 */
export function createMockAuthUser(overrides?: Partial<AuthUser>): AuthUser {
  return {
    id: faker.string.uuid(),
    name: faker.person.firstName(),
    color: faker.helpers.arrayElement(USER_COLORS),
    role: 'member',
    created_at: faker.date.past().toISOString(),
    last_login: faker.date.recent().toISOString(),
    streak_count: faker.number.int({ min: 0, max: 30 }),
    ...overrides,
  };
}

/**
 * Create a mock admin user
 */
export function createMockAdminUser(overrides?: Partial<AuthUser>): AuthUser {
  return createMockAuthUser({
    role: 'admin',
    name: 'Derrick',
    ...overrides,
  });
}

/**
 * Create multiple users
 */
export function createMockUserList(count: number = 5): User[] {
  return Array.from({ length: count }, () => createMockUser());
}
