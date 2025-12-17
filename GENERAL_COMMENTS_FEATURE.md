# General Comments 功能实现文档

## 概述

本功能在 Outline Review 和 Content Review 页面中添加了 "General Comments" 功能，允许客户对整篇文章进行评价，而不需要针对特定段落或章节。这些评论会同步到 Supabase 数据库，以便 Agency 端也可以查看。

## 功能特性

1. **Outline Review**: 在右侧边栏底部添加了 General Comments 输入框
2. **Content Review**: 在右侧边栏底部添加了 General Comments 输入框
3. **数据持久化**: General Comments 会保存到以下位置：
   - Draft 保存时保存到 `review_drafts.general_comments`
   - 最终提交时保存到 `articles.client_comments.generalComments`
4. **草稿恢复**: 从草稿恢复时会自动加载之前保存的 General Comments

## 修改的文件

### 1. 前端组件

#### `components/OutlineReview.tsx`
- 添加 `existingGeneralComments` prop 用于从草稿恢复
- 更新 `onSaveDraft` 签名以传递 `generalComments`
- 初始化 `generalComments` state 时使用 `existingGeneralComments`
- UI 已存在（line 665-676），无需修改

#### `components/ContentReview.tsx`
- 添加 `existingGeneralComments` prop 用于从草稿恢复
- 更新 `onSaveDraft` 签名以传递 `generalComments`
- 初始化 `generalComments` state 时使用 `existingGeneralComments`
- UI 已存在（line 646-657），无需修改

### 2. 应用程序逻辑

#### `App.tsx`
- 添加 `existingGeneralComments` state 来存储从草稿加载的 general comments
- 更新 `handleOutlineSubmit` 接收 `generalComments` 参数并传递给 `submitOutlineReview`
- 更新 `handleContentSubmit` 接收 `generalComments` 参数并传递给 `submitContentReview`
- 更新 `handleOutlineSaveDraft` 接收并传递 `generalComments` 到 `saveDraft`
- 更新 `handleContentSaveDraft` 接收并传递 `generalComments` 到 `saveDraft`
- 在加载草稿时提取 `draft.generalComments` 并设置到 state
- 将 `existingGeneralComments` 传递给 `OutlineReview` 和 `ContentReview` 组件

### 3. 服务层

#### `services/articleService.ts`
- `submitOutlineReview` 和 `submitContentReview` 已经支持 `generalComments` 参数
- General comments 保存在 `client_comments.generalComments` 字段中
- **无需修改** - 已经正确实现

#### `services/draftService.ts`
- 更新 `saveDraft` 函数添加 `generalComments` 参数
- 保存 general comments 到 `review_drafts.general_comments` 字段
- 更新 `loadDraft` 函数从数据库加载 `general_comments` 并包含在返回的 draft 对象中

### 4. 类型定义

#### `types.ts`
- 更新 `ReviewDraft` 接口添加 `generalComments?: string` 字段

### 5. 数据库

#### `database_migration_general_comments.sql` (新文件)
- 添加 `general_comments TEXT` 列到 `review_drafts` 表
- 向后兼容 - 现有记录的此字段为 NULL，应用程序将其处理为空字符串

## 数据库迁移

### 在 Supabase 中执行以下 SQL

```sql
-- 添加 general_comments 列到 review_drafts 表
ALTER TABLE review_drafts 
ADD COLUMN IF NOT EXISTS general_comments TEXT;

-- 添加列说明
COMMENT ON COLUMN review_drafts.general_comments IS 'General feedback comments on the entire article (not tied to specific sections/blocks)';
```

**注意**: 运行此迁移脚本是使功能完全工作的必要步骤。

## 数据流

### 1. 保存草稿流程
```
用户输入 General Comments 
→ 组件 state (generalComments)
→ handleSaveDraft 调用
→ saveDraft(articleId, email, type, edits, comments, {}, generalComments)
→ Supabase: review_drafts.general_comments
```

### 2. 加载草稿流程
```
loadDraft(articleId, email, type)
→ Supabase: review_drafts.general_comments
→ draft.generalComments
→ setExistingGeneralComments(draft.generalComments || '')
→ 传递给组件 existingGeneralComments prop
→ 组件初始化 state
```

### 3. 提交审核流程
```
用户提交审核
→ handleOutlineSubmit / handleContentSubmit (接收 generalComments)
→ submitOutlineReview / submitContentReview (传递 generalComments)
→ Supabase: articles.client_comments.generalComments
```

## Agency 端查看方式

Agency 端可以通过以下方式查看 General Comments：

1. **最终提交的评论**: 在 `articles.client_comments.generalComments` 字段中
2. **草稿中的评论**: 在 `review_drafts.general_comments` 字段中

示例查询：
```sql
-- 查看已提交的 general comments
SELECT 
  id, 
  title, 
  client_comments->'generalComments' as general_comments
FROM articles 
WHERE client_comments IS NOT NULL;

-- 查看草稿中的 general comments
SELECT 
  article_id, 
  contact_email, 
  review_type, 
  general_comments
FROM review_drafts 
WHERE general_comments IS NOT NULL;
```

## 测试检查清单

- [ ] 在 Supabase 中运行数据库迁移脚本
- [ ] 在 Outline Review 页面输入 General Comments
- [ ] 点击 "Save Draft" 验证保存成功
- [ ] 刷新页面验证 General Comments 被恢复
- [ ] 提交 Outline Review，验证 General Comments 保存到 `articles.client_comments`
- [ ] 在 Content Review 页面重复上述步骤
- [ ] 在 Agency 端验证可以看到 General Comments

## 兼容性

- **向后兼容**: 旧的草稿不会有 `general_comments` 字段，应用程序将其处理为空字符串
- **数据库兼容**: 使用 `ADD COLUMN IF NOT EXISTS` 确保迁移脚本可以安全地多次运行
- **UI 兼容**: General Comments 输入框已经存在于 UI 中，只是现在功能完整了

## 注意事项

1. 必须先在 Supabase 中运行数据库迁移脚本
2. General Comments 是可选的 - 用户可以不填写
3. General Comments 会随着草稿自动保存（每 30 秒）
4. General Comments 在只读模式下不显示输入框


