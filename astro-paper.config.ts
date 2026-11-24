import { defineAstroPaperConfig } from "./src/types/config";

export default defineAstroPaperConfig({
  site: {
    // TODO: 首次部署拿到 *.pages.dev 地址后，把这里改成你的真实站点地址
    url: "https://my-blog.pages.dev/",
    title: "Wanxin'Blog",
    description: "wanxin_l 的个人博客：记录技术学习与生活思考。",
    author: "wanxin_l",
    ogImage: "default-og.jpg",
    lang: "zh-CN",
    timezone: "Asia/Shanghai",
    dir: "ltr",
  },
  posts: {
    perPage: 4,
    perIndex: 4,
  },
  features: {
    lightAndDarkMode: true,
    // 动态分享图依赖在线字体且不支持中文，改用 public/default-og.jpg 静态图
    dynamicOgImage: false,
    showArchives: true,
    showBackButton: true,
    // TODO: 推送到 GitHub 后，改为你的仓库编辑地址并启用
    editPost: {
      enabled: false,
      url: "",
    },
    search: "pagefind",
    toc: true,
  },
  // TODO: 按需添加你的社交链接，例如：
  // { name: "github", url: "https://github.com/你的用户名" },
  // { name: "mail", url: "mailto:你的邮箱" },
  socials: [],
  shareLinks: [
    { name: "whatsapp", url: "https://wa.me/?text=" },
    { name: "facebook", url: "https://www.facebook.com/sharer.php?u=" },
    { name: "x",        url: "https://x.com/intent/post?url=" },
    { name: "telegram", url: "https://t.me/share/url?url=" },
    { name: "pinterest", url: "https://pinterest.com/pin/create/button/?url=" },
    { name: "mail",     url: "mailto:?subject=See%20this%20post&body=" },
  ],
});