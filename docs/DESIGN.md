# 设计说明

本项目界面参考 **[VoltAgent/awesome-design-md](https://github.com/VoltAgent/awesome-design-md)** 中的 **Clay** 设计分析（`design-md/clay/DESIGN.md`），只借用其公开的设计 token 与排版原则，不复制其图片/字体资产。

## 为什么选 Clay

平台是给 3–10 岁小朋友用的，需要“暖、软、色块大、按钮大”。Clay 的奶油画布 + 高饱和糖果卡片 + 超大圆角 + 圆体标题，正好同时满足童趣和可读性，也不会像通用后台模板那样冷。

## 采用的 token

| 角色 | 值 | 用在哪里 |
| --- | --- | --- |
| Canvas | `#fffaf0` | 全站底色 |
| Surface soft | `#faf5e8` | 家长区、页脚、游戏页信息面板 |
| Surface card | `#f5f0e0` | 标签、统计、次级卡片 |
| Ink | `#0a0a0a` | 标题、主按钮 |
| Body | `#3a3a3a` | 正文 |
| Muted | `#6a6a6a` | 次要文字 |
| Hairline | `#e5e5e5` | 输入框、面板描边 |
| Pink | `#ff4d8b` | 游戏卡片 / 主强调色 |
| Teal | `#1a3a3a` | 深色强调卡片 |
| Lavender | `#b8a4ed` | 游戏卡片 / 家长卡片 |
| Peach | `#ffb084` | 推荐位 / 游戏卡片 |
| Ochre | `#e8b94a` | 标题高亮下划线、插画点缀 |
| Mint | `#a4d4c5` | 家长卡片、山丘 |
| Coral | `#ff6b5a` | 游戏卡片 |

- 圆角：按钮/输入框 12px，内容卡片 16–18px，功能卡 24–26px，插画卡 32px。
- 间距基数为 4px；区块节奏 `clamp()` 控制在 64–104px。
- 字体：拉丁标题使用 Baloo 2（OFL，已内嵌 `web/assets/fonts/`），中文自动回落到 PingFang SC / 微软雅黑 / Noto Sans SC；正文使用系统无衬线字体。

## 组件对应

| Clay 组件 | 本项目实现 |
| --- | --- |
| top-nav | 奶油色 sticky 导航，76px |
| hero 7/5 | 左文案 + 右黏土插画卡 |
| feature-card-* | 家长三卡、游戏卡片、推荐位 |
| category-tab | 分类 chips |
| badge-pill | 适龄 / 分类 / 标签 |
| cta-band-illustrated | 首页推荐位 + 家长区 |
| footer（奶油色 + 山丘） | `hills.svg` 页脚 |

## 有意的调整

- **粉色/珊瑚色卡片上的文字改为深墨色**：#ff4d8b 上的白字对比度约 3.1:1，对儿童和弱视用户偏低；改成近黑墨色后对比度 > 5.5:1，同时保留色块冲击力。
- **没有使用官方的 3D claymation 插画**：那是 Clay 的定制资产。这里用原创 SVG 小怪兽、山丘、贴纸来延续“手工黏土”的气质。
- **Baloo 2 代替 Plain Black**：Plain Black 为商业授权字体；Baloo 2 圆润且可免费自托管。
- 为了儿童可读性，正文比原规范略大（15–17px），触控目标不小于 44px。

## 无障碍

- 所有交互元素保留 `:focus-visible` 轮廓。
- 支持 `prefers-reduced-motion`，关闭漂浮、入场动画。
- 游戏 iframe 有 `title`，卡片链接有 `aria-label`，分区有 `aria-labelledby`。
- 颜色不是唯一信息载体：分类、适龄、推荐都有文字标签。
