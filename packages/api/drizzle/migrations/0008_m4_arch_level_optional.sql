-- Migration: M4 业务架构 level 字段改为可选
-- 决策来源: docs/04-tech-design/modules/business-architecture/business-architecture-tech-design.md §2
-- 原因: M4 PRD 明确不限制层级深度，level 字段从必填枚举改为可选的自由文本标注

ALTER TABLE "business_architectures" ALTER COLUMN "level" DROP NOT NULL;
