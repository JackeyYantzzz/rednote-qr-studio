# 红薯帖帖（Rednote QR Studio）

一个可运行的 Next.js App Router 系统：顾客扫码后从 Campaign 图片库选图、排序、生成并编辑小红书帖子草稿，再复制、保存或通过 Web Share 分享；管理员可以审核生成记录，将固定品牌账号的帖子放入安全发布队列，由同一台 Windows 电脑上的 Worker 调用 `xiaohongshu-mcp`。

普通用户流程不会收集小红书账号、密码、Cookie 或登录二维码，也不承诺自动填入小红书发布页。正确流程是：

> 生成内容 → 复制文案 → 保存或分享图片 → 打开小红书 → 用户检查并确认发布

## 已实现

- Campaign 创建、编辑、启用/停用、品牌规则、关键词、禁止表达和帖子类型
- Supabase Storage 图片上传，JPEG/PNG/WebP、10MB 上限、文件名清理、文件签名校验
- 图片名称、描述、分类、关键词、排序和启用状态
- Campaign PNG/SVG 二维码、复制链接、本地 URL 警告
- 独立 Fast Publish 模式：管理员预设图片顺序与审核文案，扫码后一键交接
- 普通/快发二维码切换，以及扫码、点击、完成、取消、失败统计
- 移动端图片多选、预览、拖动/箭头排序、推荐组合
- DeepSeek Chat Completions API + JSON Output + Zod 校验 + 生成记录
- 3 个标题、正文、标签、编辑与重新生成
- 分项复制、完整帖子复制、逐张/全部保存、Web Share 和可靠降级
- 管理员生成记录审核、默认仅自己可见的发布任务、公开发布二次确认
- Supabase 原子领取（`FOR UPDATE SKIP LOCKED`）、重复任务保护和有限重试
- Windows Worker 图片域名白名单、MIME/大小校验、临时文件清理、结构化日志、优雅退出
- 官方 MCP TypeScript SDK 的 Streamable HTTP 客户端
- 本地演示模式（没有 Supabase/DeepSeek 密钥也能走完整普通用户流程）

## 项目结构

```text
app/                         Next.js 页面和 Route Handlers
components/                  管理后台与移动端交互组件
lib/                         配置、Schema、Supabase、仓库、AI 和安全工具
supabase/migrations/         PostgreSQL / RLS / Storage / 原子领取函数
worker/                      Windows 固定品牌账号发布 Worker
cloudflare-worker/           Vinext / Sites 运行入口
tests/                       Vitest 单元和安全测试
```

数据库迁移：

- `supabase/migrations/202607310001_initial_schema.sql`
- `supabase/migrations/202607310002_fast_publish_mode.sql`

## 迁移到另一台电脑

仓库使用 pnpm，并通过 `pnpm-lock.yaml` 固定依赖版本。新电脑需要 Git、Node.js 22.13 或更高版本；Windows Worker 仅在 Windows 上运行，网站本身可按下列流程安装。

```powershell
git clone <你的私有仓库地址>
Set-Location rednote-qr-studio
corepack enable
pnpm.cmd install --frozen-lockfile
Copy-Item .env.example .env.local
pnpm.cmd dev
```

请在新电脑上重新填写 `.env.local`；它和 `worker/.env` 都被 Git 忽略，不会随仓库迁移。Supabase、DeepSeek、Sites 及 GitHub 的访问权限也需要在新电脑上单独登录或配置。

## 1. 本地快速启动

要求 Node.js 22.13 或更高版本，并启用 Corepack 管理的 pnpm。

```powershell
corepack enable
pnpm.cmd install --frozen-lockfile
Copy-Item .env.example .env.local
pnpm.cmd dev
```

打开：

- 首页：`http://localhost:3000`
- 演示扫码页：`http://localhost:3000/p/soft-living`
- 演示快发页：`http://localhost:3000/fast/soft-living`
- 管理后台：`http://localhost:3000/admin`

### iPhone / Android 临时 HTTPS 预览

首次安装依赖后，可以直接双击项目根目录的：

```text
start-phone-preview.cmd
```

或在 PowerShell 运行：

```powershell
pnpm.cmd phone
```

脚本会创建一个临时 `https://*.trycloudflare.com` 地址，随后启动本地开发服务器，并在窗口中打印普通模式 `/p/soft-living` 与快发模式 `/fast/soft-living` 地址。二维码也会使用本次临时 HTTPS 地址。

注意：

- 临时地址只用于本地真机测试，每次启动都会变化。
- 手机必须打开脚本打印的 `https://*.trycloudflare.com` 地址，不能打开 `localhost`。
- 窗口关闭或按 `Ctrl+C` 后，临时地址立即失效。
- 临时地址在运行期间可从互联网访问，请勿填写账号、密码、Cookie 或其他敏感信息。
- 如果端口 3000 已被占用，先在旧服务器窗口按 `Ctrl+C`。
- 免费 Quick Tunnel 不提供生产可用性保证，正式二维码必须使用稳定 HTTPS 域名。

开发环境在未配置 Supabase 时自动进入演示模式。也可以在 `.env.local` 明确设置：

```env
DEMO_MODE=true
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

演示数据只在当前开发进程中保存；生产环境必须关闭 `DEMO_MODE` 并配置 Supabase。小型网站可以先用 Supabase Free 验证业务；正式对外营业时建议使用不会因闲置暂停并提供备份的生产方案。

## 2. 环境变量

复制 `.env.example` 后，在 `.env.local` 中填写需要的值。示例文件故意只保留变量名称，不包含默认值或真实凭据。

| 变量 | 用途 |
|---|---|
| `DEEPSEEK_API_KEY`、`DEEPSEEK_MODEL` | 服务端内容生成；模型默认使用 `deepseek-chat` |
| `NEXT_PUBLIC_SUPABASE_URL`、`NEXT_PUBLIC_SUPABASE_ANON_KEY` | 浏览器和服务端访问 Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | 仅服务端使用的 Supabase 管理密钥 |
| `NEXT_PUBLIC_SITE_URL` | 二维码使用的网站基址；本地默认 `http://localhost:3000` |
| `ADMIN_EMAIL` | 允许进入管理后台的邮箱 |
| `DEMO_MODE` | 本地演示开关；生产环境不能启用 |
| `XHS_MCP_URL` | 发布 Worker 的 MCP 地址 |
| `WORKER_POLL_INTERVAL_MS`、`WORKER_MAX_ATTEMPTS` | Worker 轮询和重试设置 |
| `WORKER_TEMP_DIR`、`WORKER_MAX_IMAGE_BYTES` | Worker 临时目录和图片大小上限 |
| `ALLOWED_IMAGE_HOSTS` | Worker 允许下载图片的域名白名单 |

安全要求：

- `DEEPSEEK_API_KEY` 和 `SUPABASE_SERVICE_ROLE_KEY` 只放服务器环境，不能以 `NEXT_PUBLIC_` 开头。
- 正式二维码必须使用稳定的 HTTPS 生产域名，不能使用 localhost 或 Preview URL。
- 不要把 `.env.local`、`worker/.env`、Cookie 或 Token 提交到 Git。

## 3. 适合小型商业网站的 Supabase 配置

本项目继续使用 Supabase 提供数据库、图片存储和管理员登录，避免为了早期小流量业务再维护多套服务。试运营可从 Free 开始，并监控数据库、Storage 与流量额度；正式营业前建议升级到带持续运行和备份的生产方案。不要用 `DEMO_MODE` 承载真实客户数据。

### Supabase 初始化

1. 创建 Supabase 项目。
2. 按文件名顺序运行 `supabase/migrations/` 下的 migration，或使用 Supabase CLI 执行 migration。
3. 在 Supabase Auth 中启用 Email OTP / Magic Link。
4. 用 `ADMIN_EMAIL` 对应邮箱完成一次登录，让 `auth.users` 中出现该用户。
5. 将用户加入管理员表：

```sql
insert into public.admins (user_id)
select id from auth.users
where lower(email) = lower('admin@example.com')
on conflict do nothing;
```

迁移会创建：

- `admins`
- `campaigns`
- `assets`
- `generations`
- `publish_jobs`
- `campaign-assets` Storage bucket
- RLS policy、索引、更新时间触发器
- `claim_publish_job(max_attempts)` 原子领取函数

公共访问只能读取启用的 Campaign 和图片；生成记录与发布任务通过服务端 API 写入，管理操作还会检查 Supabase Auth 邮箱。

## 4. 创建第一个 Campaign

1. 启动网站并访问 `/admin`。
2. 点击“新建 Campaign”。
3. 设置名称、slug、品牌、产品事实、语气、关键词、禁止表达、帖子类型和最多图片数。
4. 保存后上传图片，并为每张图补充描述、分类和关键词。
5. 在 Campaign 详情页确认 `NEXT_PUBLIC_SITE_URL` 不是 localhost。
6. 下载 PNG 或 SVG 二维码。

## 5. 测试普通用户扫码

1. 手机扫描正式二维码，或在本地打开 `/p/soft-living`。
2. 选择多张图片，用拖动或箭头调整顺序。
3. 选择帖子方向和语气，填写少量真实补充信息。
4. 生成后切换/编辑标题、正文和标签。
5. 测试四种复制按钮、逐张保存和全部保存。
6. 点击“分享图片和文案”。支持 `navigator.share` + `navigator.canShare({ files })` 时会尝试分享文件；失败时保留内容、复制完整文案并显示手动发布步骤。
7. 打开小红书，新建笔记，手动确认图片、文字、标签和可见性后发布。

系统不能保证小红书 App 接收 Web Share 的文字与图片，也不能保证自动填入发布页。

### Android 发布方式

1. 使用 Android Chrome 打开 HTTPS 扫码地址，不要在微信、QQ、支付宝等 App 的内置浏览器中发布。
2. 如果页面显示“请先使用 Chrome 打开”，点击“在 Chrome 打开”；若手机拦截跳转，则复制页面链接并粘贴到 Chrome 地址栏。
3. 打开 `/fast/[slug]` 后等待图片准备完成，再点击“分享到小红书”。
4. Android 兼容模式会把图片交给系统分享菜单，同时把标题、正文和标签组成的完整文案复制到剪贴板。
5. 在系统分享菜单选择小红书；进入小红书后如未自动带入文字，长按输入框并粘贴，然后检查图片顺序和内容再发布。

Android 网页无法直接指定或强制启动小红书，也不能替用户点击最终“发布”。如果系统分享菜单中没有小红书，请确认已安装并更新小红书 App，再使用页面中的保存图片和复制文案备用方式。

## 普通用户扫码发布流程

```text
扫码
→ 选择并排序图片
→ 生成和编辑帖子
→ 一键去小红书发布
→ 等待图片准备完成
→ 再次点击打开系统分享菜单
→ 在系统分享菜单中选择小红书
→ 在小红书中检查并发布
```

多图下载会使部分浏览器丢失一次性用户手势，因此页面采用可靠的两阶段交接：第一次点击严格按顺序准备图片，完成后由用户第二次点击打开系统分享菜单。图片不会静默跳过，失败信息会标明具体是第几张。

完整帖子会按以下格式复制到剪贴板：

```text
标题

正文

#标签一 #标签二 #标签三
```

生成完成后的主操作是“一键去小红书发布”。复制分项、保存全部图片、逐张保存、再次分享、小红书官方网站和手动步骤统一收在“发布遇到问题？”折叠区。

开发环境可访问 `/dev/share-test`，查看设备能力并运行图片顺序、MIME、大小、剪贴板、取消分享、微信环境和重复点击等隔离场景。生产环境会返回 404。

## 浏览器能力限制

- Web Share API 由手机浏览器和操作系统控制。
- 网页不能直接指定系统分享目标一定是小红书。
- 网页不能绕过系统分享菜单。
- 网页不能保证小红书一定接收图片和文字。
- 网页不能自动点击小红书的发布按钮。
- 网页无法确认用户最终是否发布成功。
- 微信、QQ、支付宝等内置浏览器可能限制文件或多图分享，页面会建议改用 Safari 或 Chrome。
- 页面不会收集普通用户的小红书账号、密码、Cookie 或登录二维码。
- 页面只记录网页端 `share_started`、`share_files_prepared`、`share_menu_opened`、`share_completed`、`share_cancelled`、`share_failed` 和 `fallback_used` 事件；这些事件不代表小红书发布成功。

## 普通用户分享能力矩阵

| 环境 | 多图分享 | 文案复制 | 文案自动进入小红书 | 直接进入编辑器 | 需要用户操作 |
|---|---|---|---|---|---|
| iPhone Safari | 待真机验证 | 支持 | 待真机验证 | 待真机验证 | 选择小红书并确认 |
| Android Chrome | 网页侧已启用图片文件分享，待真机验证 | 支持 | 不保证，使用剪贴板粘贴 | 取决于小红书分享接收能力 | 选择小红书、粘贴文案并确认 |
| App 内置浏览器 | 可能受限 | 支持 | 不保证 | 不保证 | 点击“在 Chrome 打开” |
| 桌面浏览器 | 取决于系统 | 支持 | 不适用 | 不适用 | 建议手机扫码 |

官方分享能力调研见：

- `docs/xiaohongshu-official-share-sdk.md`
- `docs/native-app-upgrade-plan.md`

## 6. 启动 xiaohongshu-mcp（Windows）

本项目的 Worker 按 `xpzouying/xiaohongshu-mcp` 当前 Streamable HTTP 接口实现。

1. 从项目的 GitHub Releases 下载：
   - `xiaohongshu-login-windows-amd64.exe`
   - `xiaohongshu-mcp-windows-amd64.exe`
2. 把两个文件放在只有当前用户可访问的目录，例如 `%LOCALAPPDATA%\XHS-Publisher\mcp`。
3. 第一次登录：

```powershell
$McpDir = Join-Path $env:LOCALAPPDATA "XHS-Publisher\mcp"
Set-Location -LiteralPath $McpDir
.\xiaohongshu-login-windows-amd64.exe
```

按登录工具打开的界面/二维码，用固定品牌账号的小红书 App 完成扫码登录。首次运行可能下载约 150MB 的浏览器组件。不要在公共扫码页展示这个二维码。

4. 启动 MCP Server：

```powershell
.\xiaohongshu-mcp-windows-amd64.exe
```

调试时可使用：

```powershell
.\xiaohongshu-mcp-windows-amd64.exe -headless=false
```

Server 应仅监听本机或受保护内网，Worker 使用 `http://localhost:18060/mcp`。不要把无认证的 18060 端口暴露到互联网。

可用 MCP Inspector 连接 `http://localhost:18060/mcp`，确认存在：

- `check_login_status`
- `publish_content`

Worker 会在每次发布前检查登录状态。固定账号如果同时在另一个网页端登录，现有 MCP 登录可能失效；手机 App 查看不等于另一个网页端登录。

## 7. 启动 Windows Worker

```powershell
Copy-Item worker\.env.example worker\.env
notepad worker\.env
```

至少填写 `SUPABASE_URL` 和 `SUPABASE_SERVICE_ROLE_KEY`。其余空白项使用代码默认值；`WORKER_TEMP_DIR` 默认位于当前操作系统的临时目录。

启动：

```powershell
powershell -ExecutionPolicy Bypass -File worker\start-worker.ps1
```

单次轮询测试：

```powershell
$env:DOTENV_CONFIG_PATH = "$PWD\worker\.env"
pnpm.cmd run worker:once
```

Worker 只领取 `approved` 或可重试的 `failed` 任务；领取动作会原子更新为 `preparing`。下载图片后更新为 `publishing`，成功后为 `published`，失败后为 `failed`，最多重试 `WORKER_MAX_ATTEMPTS` 次。Worker 不执行由用户输入拼接的 Shell 命令。

## 8. 测试“仅自己可见”自动发布

1. 先用测试品牌账号登录 xiaohongshu-mcp。
2. 在扫码页生成一条内容。
3. 管理员进入“生成记录”，审核并创建任务。
4. 进入“发布任务”，确认可见性为“仅自己可见”，再点击“确认入队”。
5. 启动 MCP Server 和 Worker。
6. 等待状态依次变为 `approved → preparing → publishing → published`。
7. 在小红书固定品牌账号中确认笔记仅自己可见、图片顺序正确、标题不超过 20 字、正文不超过 1000 字。
8. 再单独走一次公开发布测试；公开任务必须在管理员页面二次确认。

## 9. 测试与构建

```powershell
pnpm.cmd run lint
pnpm.cmd run typecheck
pnpm.cmd run test
pnpm.cmd run build
pnpm.cmd start
```

`pnpm.cmd run build` 生成生产构建，`pnpm.cmd start` 启动已构建的生产服务。

测试覆盖 Zod 输入/输出异常、标签和文案组合、Web Share fallback、二维码生成、图片下载域名白名单、MCP 未登录判断、可见性映射、有限重试和 Supabase 原子领取 SQL。

## 第三方平台限制

- 普通网页不能可靠地把图片、标题、正文和标签自动填入小红书 App。
- Web Share 行为取决于手机浏览器、系统分享面板和小红书 App，文字或图片可能不会同时被接收。
- `xiaohongshu-mcp` 是第三方自动化工具，不是小红书官方开放发布 API；页面结构、登录策略、风控或工具参数变化都可能导致发布失败。
- 固定账号可能遇到 Cookie 过期、登录互踢、实名认证、频率限制、内容审核或平台风控。
- 正式公开发布必须由品牌管理员审批，并应遵守小红书规则、广告合规要求和当地法律。
