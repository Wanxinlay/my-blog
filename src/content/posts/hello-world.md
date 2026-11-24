---
title: "你好，世界：我的第一篇博客"
description: "博客上线的第一篇文章，同时演示这个博客支持的 Markdown 写作格式。"
pubDatetime: 2026-11-24T16:10:00+08:00
tags:
  - 随笔
  - 写作指南
featured: true
draft: false
---

欢迎来到我的博客！这是第一篇文章，用来记录建站这件事，也顺便演示这个博客支持的写作格式。以后写文章，只需要在 `src/content/posts/` 目录下新建一个 `.md` 文件即可。

## 文章头部的元信息

每篇文章开头用一对 `---` 包起来的区域叫 frontmatter，用来声明标题、时间、标签等信息：

```yaml
---
title: "文章标题"
description: "一句话摘要，会显示在列表页和搜索结果里"
pubDatetime: 2026-11-24T16:10:00+08:00
tags:
  - 标签一
  - 标签二
featured: true   # 是否置顶到首页精选
draft: false     # 改为 true 则不会发布
---
```

## 常用 Markdown 语法

**加粗**、*斜体*、`行内代码`、[链接](https://docs.astro.build/zh-cn/)，以及列表：

- 无序列表第一项
- 无序列表第二项
  - 嵌套子项

1. 有序列表第一步
2. 有序列表第二步

## 代码块

支持语法高亮，还能标注文件名：

```js title="hello.js"
function greet(name) {
  return `你好，${name}！`;
}
console.log(greet("世界"));
```

## 表格

| 功能 | 状态 | 说明 |
| ---- | ---- | ---- |
| RSS 订阅 | 已内置 | 访问 `/rss.xml` |
| 站点地图 | 已内置 | 访问 `/sitemap-index.xml` |
| 全文搜索 | 已内置 | 顶部导航「搜索」 |
| 深色模式 | 已内置 | 右上角切换 |

## 提示框

> [!TIP]
> 写作用 `npm run dev` 实时预览，保存后浏览器自动刷新。

> [!WARNING]
> `draft: true` 的文章不会出现在线上，发布前记得改回 `false`。

## 引用

> 种一棵树最好的时间是十年前，其次是现在。

---

接下来我会在这里记录技术学习和生活思考。写作流程很简单：**本地写 Markdown → 提交到 GitHub → 自动部署上线**。