/**
 * 运行 bootstrap 的入口脚本。
 * 用法: npx tsx src/scripts/run-bootstrap.ts
 */
import { bootstrap } from './bootstrap.js';

bootstrap()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error('Bootstrap failed:', e);
    process.exit(1);
  });
