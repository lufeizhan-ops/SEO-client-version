# 修订历史和编辑同步修复文档

## 问题总结

### 问题 1：客户的编辑修改没有同步到 Agency 端
**现象**：客户在 Content Review 中做出修改（edits）并提出 revision，但 Agency 端在 Feedback 标签页看不到这些修改。

**根本原因**：
- 客户的编辑通过 `submitEditSuggestions` 正确保存到 `client_edits` 表
- 但在调用 `submitContentReview` / `submitOutlineReview` 时，只保存了 comments 到 `articles.client_comments`
- **`client_edits` 表中的数据没有被包含在提交的 `client_comments` 中**
- Agency 端只查看 `articles.client_comments`，无法看到存储在单独表中的 edits

### 问题 2：第一轮评论历史丢失
**现象**：客户第一轮提出的 comment 在第二轮审核时看不到历史记录。

**根本原因**：
- 每次调用 `submitContentReview` / `submitOutlineReview` 时，直接覆盖 `client_comments` 字段
- 之前的评论被完全替换，没有保存历史记录

## 解决方案

### 1. 数据库结构更新

#### 新增字段
```sql
-- 添加修订历史字段（JSONB 数组）
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS revision_history JSONB DEFAULT '[]'::jsonb;

-- 添加修订轮次字段
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS revision_round INTEGER DEFAULT 1;
```

#### 字段说明
- **`revision_history`**: JSONB 数组，存储所有历史 `client_comments`
- **`revision_round`**: 整数，当前修订轮次（1 = 首次审核，2 = 第一次修订，以此类推）

### 2. 代码修改详解

#### `submitOutlineReview` 函数改进

**修改前**：
```typescript
// 直接覆盖 client_comments
const { error } = await supabase
  .from('articles')
  .update({
    client_comments: clientComments,
    status: newStatus
  })
  .eq('id', articleId);
```

**修改后**：
```typescript
// 1. 先读取现有数据
const { data: existingArticle } = await supabase
  .from('articles')
  .select('client_comments, revision_history, revision_round')
  .eq('id', articleId)
  .single();

// 2. 获取所有待处理的编辑建议
const { data: clientEdits } = await supabase
  .from('client_edits')
  .select('*')
  .eq('article_id', articleId)
  .eq('edit_type', 'outline')
  .eq('status', 'pending');

// 3. 构建修订历史
const revisionHistory = existingArticle?.revision_history || [];
const currentRound = (existingArticle?.revision_round || 0) + 1;

// 4. 将旧评论存入历史
if (existingArticle?.client_comments) {
  revisionHistory.push({
    round: currentRound - 1,
    ...existingArticle.client_comments,
    archived_at: new Date().toISOString()
  });
}

// 5. 新评论包含编辑建议
const clientComments = {
  action: approved ? 'approved' : 'revision_requested',
  reviewer: 'client',
  timestamp: new Date().toISOString(),
  revision_round: currentRound,
  sectionComments: comments,
  generalComments: generalComments || null,
  edits: clientEdits || [] // ✅ 关键：包含所有编辑建议！
};

// 6. 更新数据库，保存历史和新评论
const { error } = await supabase
  .from('articles')
  .update({
    client_comments: clientComments,
    revision_history: revisionHistory,
    revision_round: currentRound,
    status: newStatus
  })
  .eq('id', articleId);
```

#### `submitContentReview` 函数改进

采用与 `submitOutlineReview` 相同的逻辑，但针对 `content` 类型的编辑。

### 3. 数据结构示例

#### `client_comments` 结构（当前审核）
```json
{
  "action": "revision_requested",
  "reviewer": "client",
  "timestamp": "2025-12-17T12:30:00Z",
  "revision_round": 2,
  "contentComments": [
    {
      "targetId": "block-1",
      "text": "这段内容需要更详细"
    }
  ],
  "generalComments": "整体方向不错，需要补充一些案例",
  "edits": [
    {
      "id": "uuid-1",
      "article_id": "article-uuid",
      "contact_email": "client@example.com",
      "contact_name": "客户名称",
      "edit_type": "content",
      "target_id": "block-1",
      "action_type": "modify",
      "original_content": {"id": "block-1", "type": "header", "content": "旧标题"},
      "suggested_content": {"id": "block-1", "type": "header", "content": "新标题"},
      "status": "pending",
      "created_at": "2025-12-17T12:25:00Z"
    }
  ]
}
```

#### `revision_history` 结构（历史审核）
```json
[
  {
    "round": 1,
    "action": "revision_requested",
    "reviewer": "client",
    "timestamp": "2025-12-15T10:00:00Z",
    "archived_at": "2025-12-17T12:30:00Z",
    "contentComments": [
      {
        "targetId": "block-1",
        "text": "第一轮的评论"
      }
    ],
    "generalComments": "第一轮的整体反馈",
    "edits": [...]
  }
]
```

## 如何解决两个问题

### 问题 1 解决方案：编辑同步
✅ **在提交审核时，自动查询 `client_edits` 表并将所有待处理的编辑包含在 `client_comments.edits` 数组中**

**工作流程**：
1. 客户在 ContentReview/OutlineReview 中进行编辑
2. 编辑保存到 `client_edits` 表（状态为 `pending`）
3. 客户提交审核时，系统自动查询该文章的所有 pending edits
4. 将 edits 数组包含在 `client_comments` 中提交
5. **Agency 端现在可以从 `client_comments.edits` 中看到所有编辑建议**

### 问题 2 解决方案：评论历史
✅ **在提交新审核前，将旧的 `client_comments` 移动到 `revision_history` 数组中**

**工作流程**：
1. 客户提交第一轮审核 → 保存到 `client_comments`，`revision_round = 1`
2. Agency 修订后，文章状态变为 `AWAITING_REVIEW_DRAFT`（第二轮）
3. 客户提交第二轮审核时：
   - 系统读取现有的 `client_comments`（第一轮）
   - 将第一轮评论追加到 `revision_history` 数组，标记 `round: 1`
   - 保存新的第二轮评论到 `client_comments`，`revision_round = 2`
4. **Agency 端可以从 `revision_history` 中查看所有历史评论**

## Agency 端如何使用这些数据

### 查看当前审核反馈
```typescript
// 从 articles.client_comments 获取最新反馈
const latestFeedback = article.client_comments;
const revisionRound = latestFeedback.revision_round; // 例如：2

// 显示评论
const comments = latestFeedback.contentComments || latestFeedback.sectionComments;

// 显示编辑建议（解决问题1）
const edits = latestFeedback.edits; // 所有客户的编辑修改都在这里！
```

### 查看历史评论（解决问题2）
```typescript
// 从 articles.revision_history 获取历史
const history = article.revision_history;

// 显示所有轮次
history.forEach((round) => {
  console.log(`第 ${round.round} 轮 (${round.timestamp}):`);
  console.log('评论:', round.contentComments || round.sectionComments);
  console.log('编辑:', round.edits);
  console.log('整体反馈:', round.generalComments);
});
```

### UI 展示建议

#### Feedback 标签页
```
┌─────────────────────────────────────────┐
│  Feedback (Round 2) - 第二轮审核        │
├─────────────────────────────────────────┤
│  📝 Comments (3)                        │
│  ├─ "标题需要修改" - 客户                │
│  ├─ "内容不够详细" - 客户               │
│  └─ ...                                  │
│                                          │
│  ✏️  Edits (2) - 编辑建议 ⚠️ 新增功能    │
│  ├─ [Modify] 标题: "旧" → "新"          │
│  └─ [Delete] 删除第三段                  │
│                                          │
│  💬 General Comments                    │
│  └─ "整体方向不错..."                    │
│                                          │
│  📚 History (1 previous round)          │
│  └─ 查看第 1 轮反馈 ↓                    │
└─────────────────────────────────────────┘
```

## 数据库迁移步骤

### 在 Supabase 中执行

```sql
-- 1. 添加新字段
ALTER TABLE articles 
ADD COLUMN IF NOT EXISTS revision_history JSONB DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS revision_round INTEGER DEFAULT 1;

-- 2. 添加注释
COMMENT ON COLUMN articles.revision_history IS 'Array of all previous client review submissions (client_comments history)';
COMMENT ON COLUMN articles.revision_round IS 'Current revision round number (1 = first review, 2 = first revision, etc.)';

-- 3. 验证
SELECT id, revision_round, revision_history FROM articles LIMIT 5;
```

## 测试验证

### 测试场景 1：编辑同步
1. ✅ 客户在 Content Review 中修改标题
2. ✅ 点击 "Save Draft" 保存草稿
3. ✅ 提交 "Request Changes"
4. ✅ 在 Supabase 中检查 `articles.client_comments.edits` 数组
5. ✅ 在 Agency 端 Feedback 标签页应该能看到编辑建议

### 测试场景 2：评论历史
1. ✅ 客户第一轮提交评论（包含 comments 和 edits）
2. ✅ Agency 修订后重新提交草稿
3. ✅ 客户第二轮提交评论
4. ✅ 在 Supabase 中检查 `articles.revision_history[0]` 包含第一轮数据
5. ✅ 在 Supabase 中检查 `articles.client_comments` 包含第二轮数据
6. ✅ `articles.revision_round` 应该为 2
7. ✅ Agency 端应该能看到历史和当前评论

## 兼容性说明

### 向后兼容
- ✅ 现有文章的 `revision_history` 默认为空数组 `[]`
- ✅ 现有文章的 `revision_round` 默认为 `1`
- ✅ 旧的 `client_comments` 结构仍然有效
- ✅ 如果没有历史，`revision_history` 为空数组，不影响显示

### 数据迁移
不需要迁移现有数据，因为：
- 新字段有默认值
- 旧文章会在下次审核时自动开始使用新结构
- 第一轮审核的文章 `revision_round = 1`，`revision_history = []`

## 总结

### 问题 1 修复：✅ 编辑同步到 Agency 端
- 在提交时查询 `client_edits` 表
- 将所有 pending edits 包含在 `client_comments.edits` 中
- Agency 端从 `client_comments.edits` 读取并显示

### 问题 2 修复：✅ 评论历史保留
- 添加 `revision_history` JSONB 数组字段
- 每次提交前将旧评论存入历史
- 添加 `revision_round` 标记轮次
- Agency 端可以查看完整的审核历史

### 优势
1. **完整的审核记录**：所有评论、编辑、反馈都被保存
2. **轮次追踪**：清楚地知道当前是第几轮审核
3. **向后兼容**：不影响现有功能和数据
4. **易于查询**：Agency 端可以方便地展示历史


