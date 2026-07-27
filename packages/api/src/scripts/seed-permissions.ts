/**
 * @module scripts/seed-permissions
 * @description 将权限点常量 + 默认角色映射同步到 DB（幂等：upsert 语义）。
 *              在 bootstrap 或手动 `pnpm db:seed` 时调用。
 */
import { db } from '../db.js';
import { permissions, rolePermissions } from '../models/schema.js';
import { PERMISSION_META_LIST, DEFAULT_ROLE_PERMISSIONS } from '@apm/shared';
import { eq, and } from 'drizzle-orm';

export async function seedPermissions(): Promise<void> {
  console.log('🔑 Seeding permissions...');

  // 1. Upsert 权限点
  for (const meta of PERMISSION_META_LIST) {
    const [existing] = await db.select().from(permissions).where(eq(permissions.key, meta.key)).limit(1);
    if (existing) {
      await db.update(permissions)
        .set({
          resource: meta.resource,
          action: meta.action,
          displayName: meta.displayName,
          description: meta.description,
          category: meta.category,
        })
        .where(eq(permissions.key, meta.key));
    } else {
      await db.insert(permissions).values({
        key: meta.key,
        resource: meta.resource,
        action: meta.action,
        displayName: meta.displayName,
        description: meta.description,
        category: meta.category,
      });
    }
  }
  console.log(`  ✅ ${PERMISSION_META_LIST.length} permissions synced`);

  // 2. Upsert 默认角色-权限映射（仅插入不存在的）
  let insertedCount = 0;
  for (const role of DEFAULT_ROLE_PERMISSIONS) {
    for (const permKey of role.permissions) {
      const [existing] = await db.select().from(rolePermissions)
        .where(and(
          eq(rolePermissions.roleType, role.roleType),
          eq(rolePermissions.roleValue, role.roleValue),
          eq(rolePermissions.permissionKey, permKey),
        ))
        .limit(1);

      if (!existing) {
        await db.insert(rolePermissions).values({
          roleType: role.roleType,
          roleValue: role.roleValue,
          permissionKey: permKey,
        });
        insertedCount++;
      }
    }
  }
  console.log(`  ✅ ${insertedCount} new role-permission mappings added`);
}
