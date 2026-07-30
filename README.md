# 🏠 模型回答裁判器

> 一个仅在本地浏览器中使用的轻量模型评测网页。用户提供原始问题、二元评分标准和多份模型回答，网页调用 DeepSeek API，展示逐项判定、证据、分数及排名。

**当前项目只负责"裁判"，不负责生成题目、评分标准或候选回答。**

---

## ✨ 功能

### 四区布局

| 区域 | 功能 |
|------|------|
| **Zone 1 · 全局控制** | 版本管理（新建/删除/切换）、Excel 导出/导入 |
| **Zone 2 · 评测准备** | 三栏并列输入：原始问题、评分标准、模型回答 |
| **Zone 3 · 评测执行** | 评测未评测记录、重新评测全部、终止评测 |
| **Zone 4 · 评测结果** | 排名汇总、模型标签切换、逐项评分、校验信息 |

### 核心能力

- ✅ 多评测版本创建、切换、命名、删除（删除前二次确认）
- ✅ **新建版本拷贝确认** — 可选择将上一个版本的问题、评分标准和回答拷贝到新版本（评测结果不拷贝）
- ✅ 输入原始问题、评分标准及多份"模型名称 + 模型回答"
- ✅ 每份回答独立调用 DeepSeek API，批量最大并发 99，可手动终止
- ✅ 展示红线、原始分、最终分、得分率、逐项理由和直接证据
- ✅ 对成功的结果按最终分排序；同分并列
- ✅ 六种状态管理：未评测、评测中、成功、请求失败、解析失败、已终止
- ✅ 全部版本导出为单工作表 Excel，导入文件合法行全量替换
- ✅ 公式/宏拒绝、键盘操作、响应式布局（桌面/平板/移动端）

---

## 🚀 快速开始

### 1. 配置 API Key

```bash
cp config.example.js config.js
```

编辑 `config.js`，填入你的 DeepSeek API Key：

```js
window.MODEL_EVALUATION_CONFIG = {
  deepSeekApiKey: "sk-your-key-here",
};
```

> `config.js` 已被 `.gitignore` 排除，不会提交到 Git。

### 2. 打开网页

直接双击 `index.html`，或用任意静态文件服务器打开：

```bash
# 方式一：直接双击 index.html
# 方式二：使用 Python
python3 -m http.server 8000
# 方式三：使用 Node
npx serve .
```

然后访问 `http://localhost:8000` 即可使用。

### 3. 完成一次评测

1. **新建版本** — 点击"➕ 新建版本"，可选择拷贝上一版本数据
2. **填写内容** — 输入原始问题、评分标准、模型名称和回答
3. **开始评测** — 点击"▶ 评测未评测记录"
4. **查看结果** — 排名汇总、逐项评分、校验信息

---

## 📁 项目结构

```
Model Evaluation/
├── index.html                 # 主页面（四区布局）
├── styles.css                 # 圆润现代风格样式
├── app.js                     # 主应用逻辑（~2040 行）
├── src/                       # 领域模块
│   ├── namespace.js           # window.ModelEvaluation 命名空间
│   ├── constants.js           # 状态常量
│   ├── state-store.js         # 版本与记录状态管理
│   ├── evaluation-orchestrator.js  # 并发调度
│   ├── evaluation-result-policy.js # 结果覆盖策略
│   ├── excel-schema.js        # Excel 列定义
│   ├── excel-row-mapper.js    # 行列映射
│   ├── excel-exporter.js      # 导出
│   └── excel-importer.js      # 导入
├── tests/                     # Node 内置测试（7 个文件，45 项）
├── vendor/sheetjs/            # SheetJS CE 0.20.3
├── config.example.js          # 配置模板
├── config.js                  # 本地配置（已 gitignore）
├── docs/                      # 项目文档
└── process-recap/             # 教学复盘页面（独立，不参与运行）
```

---

## 🧱 技术栈

| 层级 | 实现 |
|------|------|
| 页面 | HTML5 |
| 样式 | 原生 CSS（响应式布局） |
| 逻辑 | 原生 JavaScript + DOM API |
| 网络 | 浏览器 `fetch` + `AbortController` |
| API | DeepSeek Chat Completions（模型 `deepseek-v4-flash`） |
| 数据 | 页面内存 + 用户主动 Excel 导入/导出 |
| Excel | 内置 SheetJS CE 0.20.3（Apache-2.0） |
| 测试 | Node 内置测试运行器 |
| 构建 | 零依赖，零构建步骤 |

---

## ⚠️ 安全须知

- **API Key 由浏览器前端读取**。任何能读取本地文件、页面源码或浏览器运行状态的人都可能获取它。
- **仅限个人本地使用**。不要分享、上传或公开部署填写了 Key 的 `config.js`。
- **数据只保存在页面内存和导出的 Excel 中**。刷新或关闭页面后，未导出的数据会消失。
- **Git 历史曾包含真实 API Key**。在公开此仓库前，请确保：
  1. 在 DeepSeek 控制台**撤销或轮换**旧 Key
  2. **清理含 Key 的 Git 历史**，或建立不含旧历史的新仓库
  3. 对发布内容执行凭据扫描
  4. 确认远程仓库可见性

---

## 📄 开源前检查清单

- [ ] 轮换曾提交到 Git 历史的 API Key
- [ ] 清理敏感 Git 历史
- [ ] 扫描全部文件确认无凭据泄露
- [ ] 选择并添加开源许可证
- [ ] 确认远程仓库可见性

---

## 📚 更多文档

- [项目上下文](docs/PROJECT_CONTEXT.md)
- [架构说明](docs/ARCHITECTURE.md)
- [更新记录](docs/CHANGELOG.md)
- [待办事项](docs/TODO.md)
- [路线图](docs/ROADMAP.md)
