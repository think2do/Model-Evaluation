# Model Evaluation

一个本地运行的轻量模型回答裁判器。用户手动填写问题、评分标准和一个或多个模型回答，页面调用 DeepSeek API 分别评测每个回答，并展示逐项得分、红线检查、总分、得分率和排名。

当前项目只负责“裁判”，不负责生成题目、评分标准或候选回答。

## 运行要求

- 现代桌面浏览器
- 可访问 DeepSeek API 的网络环境
- 一个可用的 DeepSeek API Key

项目没有 npm 依赖、构建步骤、后端服务或数据库。Excel 功能使用仓库内固定版本的 SheetJS CE。

## 安装与启动

1. 获取项目代码。
2. 在项目根目录复制配置模板：

   ```bash
   cp config.example.js config.js
   ```

3. 编辑 `config.js`，填入本地 API Key：

   ```js
   window.MODEL_EVALUATION_CONFIG = {
     deepSeekApiKey: "你的 API Key",
   };
   ```

4. 用浏览器打开根目录的 `index.html`。

也可以使用任意静态文件服务器托管项目目录，但当前项目不要求安装或使用特定服务器。

## 使用方式

1. 填写问题与评分标准。
2. 添加一个或多个候选回答，并填写模型名称。
3. 选择单条、当前版本或多版本评测入口。
4. 在结果区通过模型标签切换查看详情，并参考排名汇总。
5. 需要保存或恢复全部页面数据时，导出或导入单工作表 Excel。

每个候选回答会发起一次独立 API 请求，批量最大并发数为 99。输入和结果只保存在当前页面内存中；Excel 是用户主动保存和恢复完整数据的方式。

## 项目组成

- `index.html`：裁判器页面结构。
- `styles.css`：裁判器样式与响应式布局。
- `app.js`：页面控制、请求构造、API 调用、严格解析、排名和结果渲染。
- `src/`：版本状态、并发评测、覆盖策略和 Excel 导入导出模块。
- `tests/`：无需额外依赖的 Node 自动化测试。
- `vendor/sheetjs/`：SheetJS CE 0.20.3、Apache-2.0 `LICENSE` 和 `NOTICE.md`。
- `config.example.js`：本地配置模板。
- `Coding手册/`：需求、技术选型和任务拆分等早期设计资料。
- `process-recap/`：独立的项目过程复盘教学页面，不参与裁判器运行。
- `docs/`：当前项目文档。

## 安全提醒

这是纯前端项目。API Key 虽然保存在被 Git 忽略的 `config.js` 中，但仍会暴露给本机浏览器页面及能够访问该页面的人，只适合个人本地使用。

仓库历史中曾提交过真实 API Key。开源或继续公开分发前，必须先废止并轮换旧 Key，同时清理 Git 历史或建立不含敏感历史的新仓库。远程仓库当前是否公开：**待确认**。

## 更多文档

- [项目上下文](PROJECT_CONTEXT.md)
- [架构说明](ARCHITECTURE.md)
- [路线图](ROADMAP.md)
- [更新记录](CHANGELOG.md)
- [待办事项](TODO.md)
