---
title: "如何用 AI 助手从零搭建免费个人博客？完整工作流与踩坑复盘"
description: "本站的诞生记录：AI 助手负责环境检查、初始化、配置、排障、构建验证与推送，人只做账号操作和内容决策。Astro + AstroPaper + GitHub + Cloudflare Pages 全免费链路，附七个实测踩坑与免费额度清单。"
pubDatetime: 2026-11-25T12:00:00+08:00
tags:
  - AI 实践
  - 博客搭建
  - 复盘
featured: false
draft: false
---

**先说结论：这个博客从空文件夹到公网上线，全程由我和 AI 助手协作完成——它负责检查环境、初始化项目、改配置、排障、构建验证、推送代码；我只做三类事：账号侧操作、关键选择确认、内容决策。** 技术栈全免费：Astro + AstroPaper 主题 + GitHub 仓库 + Cloudflare Pages 托管。本文是完整工作流的凝练，以及路上踩过的每一个坑。

## 一、技术选型：为什么是这套组合

| 组件 | 选择 | 理由 |
|---|---|---|
| 框架 | Astro | 静态产物极快、原生 Markdown、主题生态好 |
| 主题 | AstroPaper | 极简、SEO 友好，**内置** RSS / 站点地图 / 标签 / 归档 / 全文搜索 / 深色模式 |
| 代码托管 | GitHub（Public 仓库） | 与 Cloudflare 免费集成最顺畅 |
| 托管部署 | Cloudflare Pages | 静态请求与带宽不限量，推送即自动部署 |
| 域名 | 先用免费 `*.pages.dev` | 以后随时可绑自定义域名，不影响内容 |

选型原则只有一条：**长期免费可用，不引入任何付费服务。** 备选 Hugo（构建快但模板上手成本高）、Hexo（中文资料多但现代化程度低）都被放弃。

## 二、七步工作流总览

| 步骤 | 做什么 | 谁主导 |
|---|---|---|
| 1 | 环境与账号确认（Node / npm / git 版本，Cloudflare / GitHub 账号） | AI 检查，人确认 |
| 2 | 初始化项目 + 本地预览 | AI 执行 |
| 3 | 内容结构：站点信息、关于页、示例文章、界面中文化 | AI 执行，人定标题署名 |
| 4 | GitHub 仓库 + SSH 密钥 + 推送 | AI 生成密钥与提交，人建仓库、贴公钥 |
| 5 | Cloudflare Pages 连接仓库、配置构建、首次部署 | 人点控制台，AI 给准确路径与排障 |
| 6 | 优化：SEO / RSS / sitemap（主题内置）+ 访问统计 | AI 验证，人一键开启统计 |
| 7 | 日常工作流：写 Markdown → push → 自动上线 | 人写作，AI 可代劳发布 |

## 三、关键命令（可直接复制）

**初始化：**

```bash
npm create astro@latest -- --template satnaing/astro-paper
cd my-blog
npm install
npm run dev    # 本地预览 http://localhost:4321
```

**Git 与 SSH（国内网络建议直接走 443 备用通道，见坑 7）：**

```bash
git init -b main
ssh-keygen -t ed25519 -f ~/.ssh/id_ed25519_myblog -N ""
# 公钥粘贴到 GitHub → Settings → SSH and GPG keys

# ~/.ssh/config 追加：
# Host github.com
#   HostName ssh.github.com
#   Port 443
#   User git
#   IdentityFile ~/.ssh/id_ed25519_myblog
#   IdentitiesOnly yes

git remote add origin git@github.com:<你的用户名>/my-blog.git
git add . && git commit -m "init" && git push -u origin main
```

**Cloudflare Pages 配置（控制台照抄）：**

- Workers & Pages → Create application → **Pages 标签页**（不是 Workers！见坑 6）→ Connect to Git → 选仓库
- Framework preset：`Astro`；Build command：`npm run build`；Output directory：`dist`
- Save and Deploy → 拿到 `https://<项目名>.pages.dev`

**日常发布（此后每篇文章就这三行）：**

```bash
git add src/content/posts/新文章.md
git commit -m "post: 文章标题"
git push    # 约 1 分钟后自动上线
```

## 四、七个实测踩坑（全部真实发生）

### 坑 1：npm 镜像源瞬时故障，不要盲目重试

首次初始化失败，报错指向镜像源响应异常。正确动作：**先只读核查现场（有无残留文件），再对多个镜像源测速**，选最快且恢复正常的源重试。盲目原样重试只会重复失败。

### 坑 2：Node 版本不满足，机器上可能藏着多个 Node

Astro 7 要求 Node ≥ 22.23.4。默认环境里的 Node 是旧版，但 Homebrew 里早已装了新版——**先查清楚机器上有哪些 Node，用现成的，而不是急着安装升级**。

### 坑 3：谷歌字体国内不可达，会拖垮构建和访问

主题默认从 Google Fonts 拉字体，国内构建直接报 DNS 错误。解法：删掉在线字体配置，主字体改系统字体栈（含苹方 / 微软雅黑）。注意主题可能有多处引用：配置文件、布局里的 `<Font>` 组件、动态 OG 图生成端点，**要一次清干净，否则类型检查会在云端构建时炸**。

### 坑 4：本地 dev 不报错 ≠ 云端构建能过

云端构建命令是 `astro check && astro build && ...`，**多了类型检查这一关**。本地只跑 `npm run dev` 验证是不够的，推送前必须本地完整跑一遍 `npm run build`。本次靠这一步在推送前拦下了 i18n 语言配置不一致导致的 RSS 构建错误（`site.lang` 改了 `zh-CN`，框架 `i18n.locales` 还是 `en`）。

### 坑 5：界面中文化不是改一个 lang 字段

完整中文化需要三处联动：站点配置 `lang`、框架 `i18n.locales`、新增中文语言文件（导航 / 按钮 / 分页 / 404 文案）。主题支持按文件扩展语言，加一个 `zh-CN.ts` 即可。

### 坑 6：Cloudflare 统一入口，极易误建成 Workers

2026 年 Cloudflare 把 Workers 和 Pages 合并进同一个创建入口，默认流程容易建成 **Workers** 项目。症状：构建成功但部署失败，日志出现 `npx wrangler deploy` 和 "Worker Name"。**Pages 项目必须在创建页切到 Pages 标签页再 Connect to Git。** 判别口诀：部署日志走 `wrangler deploy` 就是建错了。

### 坑 7：国内 SSH 推 GitHub，大包会被掐断

小命令（认证测试）正常，一推 155 个文件就 `unexpected disconnect`——这是国内网络对 GitHub 22 端口大流量连接的典型干扰。解法：走 GitHub **官方备用通道 `ssh.github.com:443`**，一次配置永久稳定。保活参数（ServerAliveInterval）救不了这种断法。

**附一条不用管的提示**：GitHub 仓库页的 "Your main branch isn't protected" 是给多人协作仓库准备的建议，个人博客直接 push 的工作流开着保护反而碍事，忽略即可。

## 五、免费额度清单（2026-11 核实）

| 项目 | Cloudflare Pages 免费额度 | 个人博客视角 |
|---|---|---|
| 构建次数 | 500 次/月 | 每天发一篇也用不完 |
| 并发构建 | 1 个 | 连续推送会排队，正常 |
| 单次构建超时 | 20 分钟 | 本站构建约 1 分钟 |
| 站点文件数 | 20,000 个 | 本站目前约百个 |
| 单文件大小 | 25 MiB | 别放超大视频 |
| 静态请求 / 带宽 | 不限量 | 随便用 |

不想触发部署的提交，commit 信息加 `[skip ci]`；草稿设 `draft: true` 不会上线。

## 六、人机分工：这次协作真正值钱的部分

回看全程，分工边界非常清晰：

**AI 做的**：检查环境、测速选源、初始化、改配置、定位每一个报错的根因、本地构建验证、提交推送、线上核验、把流程凝练成你正在读的这篇文章。

**人做的**：注册与登录账号、创建仓库、粘贴公钥、在 Cloudflare 控制台点按钮、决定站名署名、决定每篇文章发不发。

这条边界和我在[知识库实践](/posts/agent-knowledge-base-practice/)里的原则一致：**让 AI 做整理和执行，判断权留在人手里。** 账号与授权类动作必须人来做，这既是安全边界，也是责任边界。

另一个体会来自[那次失败的复盘](/posts/personal-management-system-postmortem/)：**先让链路跑通，再谈完善。** 本次第一个里程碑是"首页能打开"，而不是"配置完美"——字体、中文化、SEO 都是链路通了之后逐项补的。如果一开始就追求全配好，任何一个坑都会卡死整个项目。

## 最后

这套工作流的维护成本接近零：写 Markdown、三行命令、等一分钟。没有服务器要管，没有账单要付，没有证书要续。

如果你也想搭一个，把本文交给你的 AI 助手，让它从第一步开始执行——记得提醒它：**推送前本地完整构建，创建项目时选 Pages 不是 Workers，SSH 直接配 443。** 这三个坑，你可以不踩。