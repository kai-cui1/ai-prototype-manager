/**
 * F-M6-04: CLI 重置密码入口脚本。
 * 用法: pnpm --filter @apm/api reset-admin-password <email> <newPassword>
 * （需先激活环境: source environments/set-env.sh dev1）
 *
 * B-M6-04c: 控制台只输出成功/失败，不输出密码。
 */
import { resetPassword } from './reset-password.js';

const [email, newPassword] = process.argv.slice(2);

if (!email || !newPassword) {
  console.error(
    '用法: pnpm --filter @apm/api reset-admin-password <email> <newPassword>\n' +
    '注意: 密码含空格或特殊字符时请用引号包裹，如: reset-admin-password admin@test.com "E2eNew Pass!2345"',
  );
  process.exit(1);
}

resetPassword(email, newPassword)
  .then(() => {
    console.log(`✅ 密码重置成功: ${email.toLowerCase()}（下次登录需强制改密，所有 PAT 已作废）`);
    process.exit(0);
  })
  .catch((e: Error) => {
    console.error(`❌ 密码重置失败: ${e.message}`);
    process.exit(1);
  });
