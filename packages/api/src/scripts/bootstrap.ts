/**
 * @module scripts/bootstrap
 * @description 首次启动 Bootstrap 逻辑（幂等）：
 *              1. 检查 users 表是否为空
 *              2. 若为空 → 创建 SuperAdmin + 默认团队 + seed 权限
 *              3. 若非空 → 仅执行 seed-permissions（确保权限点同步）
 *
 * 环境变量：
 * - BOOTSTRAP_ADMIN_EMAIL（默认 admin@apm.local）
 * - BOOTSTRAP_ADMIN_PASSWORD（默认 AdminPass!2345678）
 * - BOOTSTRAP_TEAM_NAME（默认 apm-default）
 * - BOOTSTRAP_TEAM_DISPLAY_NAME（默认 默认团队）
 */
import bcrypt from 'bcryptjs';
import { db } from '../db.js';
import { users, teams, teamMembers } from '../models/schema.js';
import { seedPermissions } from './seed-permissions.js';

const BCRYPT_COST = 10;

export async function bootstrap(): Promise<void> {
  console.log('🚀 Bootstrap starting...');

  // 始终同步权限点（幂等）
  await seedPermissions();

  // 检查 users 表是否为空
  const existingUsers = await db.select({ id: users.id }).from(users).limit(1);
  if (existingUsers.length > 0) {
    console.log('  ℹ️  Users table not empty, skipping SuperAdmin creation');
    return;
  }

  console.log('  📝 Creating initial SuperAdmin...');

  const email = process.env.BOOTSTRAP_ADMIN_EMAIL || 'admin@apm.local';
  const password = process.env.BOOTSTRAP_ADMIN_PASSWORD || 'AdminPass!2345678';
  const teamName = process.env.BOOTSTRAP_TEAM_NAME || 'apm-default';
  const teamDisplayName = process.env.BOOTSTRAP_TEAM_DISPLAY_NAME || '默认团队';

  // 创建 SuperAdmin
  const passwordHash = await bcrypt.hash(password, BCRYPT_COST);
  const [admin] = await db.insert(users).values({
    email,
    displayName: 'Super Admin',
    passwordHash,
    platformRole: 'super_admin',
    status: 'active',
    mustChangePassword: false,
  }).returning();

  console.log(`  ✅ SuperAdmin created: ${admin.email} (id=${admin.id})`);

  // 创建默认团队
  const [team] = await db.insert(teams).values({
    name: teamName,
    displayName: teamDisplayName,
    description: '系统初始化自动创建的默认团队',
    status: 'active',
  }).returning();

  console.log(`  ✅ Default team created: ${team.name} (id=${team.id})`);

  // 将 SuperAdmin 加入默认团队为 Owner
  await db.insert(teamMembers).values({
    userId: admin.id,
    teamId: team.id,
    teamRole: 'owner',
  });

  console.log('  ✅ SuperAdmin added to default team as Owner');
  console.log('🎉 Bootstrap complete!');
}
