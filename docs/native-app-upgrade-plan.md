# 原生 App 升级预留方案

## 目标

在不推翻当前网站、数据库和管理后台的前提下，未来增加原生移动端，让内容交接更稳定，并在获得小红书平台资格后接入官方分享 SDK。

即使升级为原生 App，用户仍需要在小红书中检查并最终确认发布。

## 目标链路

```text
Campaign 二维码
→ Universal Link / Android App Link
→ 已安装我们的 App：打开原生 Campaign 页面
→ 未安装我们的 App：打开当前网页
→ 原生 App 调用现有 Campaign API 获取 Campaign 和图片
→ 原生 App 调用现有 AI 生成接口
→ 原生 App 调用小红书官方分享 SDK
→ 进入小红书编辑器
→ 用户最终确认发布
```

## 可复用的现有能力

- Supabase 数据库、Storage、Auth 和 RLS。
- Campaign 数据结构与管理后台。
- Campaign 图片库及图片推荐数据。
- Campaign API 和图片安全下载 API。
- OpenAI Responses API 生成接口。
- Zod 输入输出 Schema。
- 用户填写的地点、偏好、语气和补充说明。
- generation 记录。
- 管理员审核与固定品牌账号 MCP 发布流程。
- 完整帖子组合、标签清理和分享事件类型。

普通用户原生分享和管理员 MCP 自动发布仍必须保持为两个独立流程。

## 需要新增

### 应用层

- iOS App。
- Android App。
- React Native 工程，或分别建设 Swift/Kotlin 原生工程。
- Campaign 选图、排序、生成、编辑和发布交接页面。
- 本地安全缓存和弱网恢复。
- 图片下载、格式转换、方向保持和内存控制。

### 链接与回退

- Apple Universal Links。
- Android App Links。
- `apple-app-site-association`。
- `assetlinks.json`。
- 未安装 App 时继续打开 `/p/[slug]` 网页。
- 二维码保持 HTTPS 链接，不直接编码不稳定 Scheme。

### 小红书平台

- 小红书分享开放平台申请。
- 平台审核与合作资格确认。
- AppKey / App ID。
- iOS Bundle ID 配置。
- Android 包名与签名配置。
- 官方 iOS/Android 分享 SDK。
- 分享回调、取消、错误码与版本检测。
- 小红书未安装或版本过低时的降级。

### 发布与合规

- Apple Developer 账号与 App Store 发布。
- Android 应用市场发布。
- 隐私政策和权限用途说明。
- 图片/相册/网络权限适配。
- 第三方 SDK 合规披露。
- 崩溃、性能和分享漏斗监控。

## 推荐技术路线

如果团队已有 React/TypeScript 能力，可优先评估 React Native，把 Campaign、表单、Zod Schema 和 API 类型复用到共享包中。小红书官方 SDK 仍需通过原生模块桥接。

若分享稳定性是最高优先级，Swift + Kotlin 原生实现能更直接地处理图片内存、相册、跨应用回调和平台 SDK，但开发和维护成本更高。

最终选择应在拿到官方 SDK 接入资格与最新文档后决定，避免先为尚未开放的接口重写整个项目。

## 分阶段实施

### 阶段 1：链接和 API 稳定化

- 为 Campaign API 增加正式版本号。
- 明确原生 App 所需的公开字段和图片下载授权。
- 保持二维码为稳定 HTTPS URL。
- 建立 Universal Links / App Links 所需域名文件。

### 阶段 2：原生 Campaign 流程

- 实现选图、排序、AI 生成和编辑。
- 复用当前完整帖子组合规则。
- 复用当前分享事件名称，但增加 `platform` 和 SDK 错误码字段。
- 不接触管理员 MCP Worker。

### 阶段 3：官方 SDK

- 获得 AppKey 和平台审核。
- 分别接入 iOS、Android SDK。
- 验证多图顺序、图片格式、标题/正文限制和用户取消。
- 保留复制文案与保存图片 fallback。

### 阶段 4：发布和真机矩阵

- iPhone 多系统版本。
- 主流 Android 厂商和系统版本。
- 小红书不同版本。
- 未安装、未登录、版本过低、网络失败、资源失败和用户取消。
- App Store / Android 应用市场审核和灰度发布。

## 成功标准

- 已安装 App 的用户可从同一个二维码进入原生 Campaign。
- 未安装 App 的用户继续使用当前网页。
- 图片顺序和用户编辑文案不丢失。
- SDK 失败时仍可保存图片、复制文案和手动发布。
- 只记录“已交接到小红书流程”，除非官方回调明确提供且业务正确理解了最终发布结果。
