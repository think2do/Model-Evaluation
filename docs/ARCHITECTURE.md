# 项目架构

## 1. 总体结构

仓库包含两个彼此独立的纯静态网页：

1. **模型裁判器**：根目录的 `index.html`、`styles.css`、`app.js` 和本地配置。
2. **过程复盘页**：`process-recap/` 下的独立 HTML、CSS 和 JavaScript，用于教学展示。

两者都不需要编译。过程复盘页不是裁判器的运行时依赖。

## 2. 目录结构

```text
Model Evaluation/
├── index.html
├── styles.css
├── app.js
├── config.example.js
├── config.js                 # 本地文件，已被 Git 忽略
├── .gitignore
├── README.md                 # 旧的根目录说明
├── Coding手册/
│   ├── 需求说明.md
│   ├── 技术选型与架构说明.md
│   └── 任务清单.md
├── process-recap/
│   ├── index.html
│   ├── styles.css
│   ├── script.js
│   ├── README.md
│   └── web-coding与AI协作执行清单*.md
└── docs/
    ├── README.md
    ├── PROJECT_CONTEXT.md
    ├── ARCHITECTURE.md
    ├── ROADMAP.md
    ├── CHANGELOG.md
    └── TODO.md
```

## 3. 主应用数据流

```text
用户填写问题、标准、模型名和回答
              │
              ▼
      读取并校验页面输入
              │
              ▼
   为每个候选回答创建独立 Job
              │
              ▼
  并发调用 DeepSeek Chat Completions
              │
              ▼
  分类网络/HTTP/API/响应格式错误
              │
              ▼
       严格解析裁判 JSON
              │
       ┌──────┴──────┐
       ▼             ▼
   有效结果       失败/解析错误
       │             │
       └──────┬──────┘
              ▼
 对有效结果计分排序，失败项后置
              │
              ▼
 渲染排名、模型标签与结果详情
```

## 4. 运行时数据

项目没有持久化表结构。以下对象只存在于浏览器内存中。

### 评测输入

```js
{
  question: String,
  rubric: String,
  candidates: [
    {
      id: String,
      modelName: String,
      answer: String
    }
  ]
}
```

### 评测任务

```js
{
  candidateId: String,
  modelName: String,
  answer: String,
  request: Object
}
```

### 有效裁判结果的核心结构

```js
{
  candidateId: String,
  modelName: String,
  redline: {
    triggered: Boolean,
    details: String,
    appliedRule: String
  },
  items: [
    {
      id: String,
      score: 0 | 1,
      reason: String,
      evidence: String
    }
  ],
  rawScore: Number,
  maxScore: Number,
  finalScore: Number,
  scoreRate: Number,
  verification: {
    itemScoreSum: Number,
    matchesRawScore: true,
    statement: String
  }
}
```

裁判服务的完整响应还会经过额外字段和一致性检查；上面只描述当前渲染与计分依赖的核心字段。

## 5. 模块边界

### 页面层：`index.html`

- 定义问题、评分标准、候选回答和结果区的固定容器。
- 先加载本地 `config.js`，再加载 `app.js`。
- 不包含业务逻辑。

### 样式层：`styles.css`

- 桌面端采用左右双栏输入布局。
- 结果区位于下方。
- 820px 以下转为单栏，480px 以下进一步压缩间距与控件。
- 包含回答标签、结果标签、得分卡片和错误状态样式。

### 应用层：`app.js`

- 单文件承载全部主应用行为。
- 直接操作 DOM，不依赖框架。
- 暴露少量调试入口到 `window`，便于浏览器手动验证。
- 使用 `fetch` 调用外部模型服务。

### 本地配置：`config.example.js` / `config.js`

- 模板文件提供配置对象结构。
- 本地文件保存真实 Key，并由 `.gitignore` 排除。
- 这是配置隔离，不是安全隔离；浏览器仍可访问 Key。

### 教学复盘：`process-recap/`

- 自带页面结构、样式和交互脚本。
- 实现滚动进度、导航高亮、分段切换和复制按钮。
- 内容记录项目准备、评测和 Web Coding 协作过程。

## 6. 外部依赖与边界

唯一运行时外部服务是 DeepSeek API。请求由浏览器直接发出，因此：

- 网络、API 可用性和浏览器跨域策略会影响运行。
- Key 会出现在浏览器请求上下文中。
- 没有后端可以代替客户端隐藏凭据、限流或审计。
- 同时评测多个回答会产生多个并发请求。

支持的浏览器版本、API 费用控制和最大并发数量：**待确认**。

## 7. 失败处理

| 失败位置 | 当前行为 |
| --- | --- |
| 缺少输入或 Key | 阻止提交并显示提示 |
| 请求超时 | 中止请求并记录错误 |
| 网络或可能的跨域错误 | 标记请求失败 |
| HTTP 非成功状态 | 保留状态码及可用错误文本 |
| API 返回错误对象 | 标记 API 错误 |
| 外层响应非 JSON | 标记响应格式错误 |
| 裁判内容为空 | 标记错误 |
| 裁判 JSON 不合规 | 标记 `parse-error`，保留原文 |
| 部分候选失败 | 其他候选仍可完成并展示 |

