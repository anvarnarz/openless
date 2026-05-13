# Issue #420 调研笔记：Wayland 下全局快捷键不可用

> 状态：调研稿（未实施任何代码改动）
> 范围：仅评估方案；落地方案以第 7 节为推荐基线。
> 日期：2026-05-13

---

## 1. 问题与现状

OpenLess Linux 端的全局热键监听走 `rdev::listen`，实现在 `openless-all/app/src-tauri/src/hotkey.rs:1183-1530`。代码在启动时检查 `XDG_SESSION_TYPE`，命中 `wayland` 直接 `Err("wayland_unsupported", "Wayland 暂不支持全局热键，请切到 X11 session 后再试")`（`hotkey.rs:1204-1208`）。

Issue #420 用户 aeoform 与另一位评论者在 Debian Wayland 上看到这条错误，明确建议：

> "建议补充对应的脚本或者命令让用户去系统设置中配置快捷键即可"

也就是：**不要求 OpenLess 自己抓全局按键**，**让桌面环境的快捷键设置去调用 OpenLess 的命令**。这是一个常见的 Linux 端规避模式，已经被同领域产品（Murmure 等）当成默认实践，详见第 3.2 节与 [Murmure docs](https://docs.murmure.app/configure-shortcuts-on-linux/)。

仓库现有支点：
- `tauri-plugin-single-instance = "2"` 已在 `Cargo.toml:24` 启用，并在 `lib.rs:73` 注册了回调（目前仅用于聚焦主窗口）。
- 可用 IPC 命令：`start_dictation` / `stop_dictation` / `cancel_dictation`（`commands.rs:1099-1110`），QA panel 控制（`commands.rs:1324-1330`），以及完整 hotkey 配置 surface。

---

## 2. 为什么 Wayland 不允许传统全局热键

X11 的设计里任何客户端都能 grab 整个键盘或注册全局快捷键 — 这同时让 X11 成了「天然的键盘记录器平台」。Wayland 协议在 2008 年重新设计时把这条路直接关掉：**键盘事件只在 surface 获得焦点时才送达对应客户端**。

权威表述出自 Wayland Book seat/keyboard 章节："the server sends `wl_keyboard.enter` when a surface receives keyboard focus, and `wl_keyboard.leave` when it's lost" — 协议层面没有任何「未聚焦也能读键」的接口（[wayland-book.com](https://wayland-book.com/seat/keyboard.html)）。

`pynput` / `rdev` / 任何依赖 X11 keyboard grab 的库在 Wayland 上「故意」失效，原因即此（[Wayland Fragmentation](https://www.semicomplete.com/blog/xdotool-and-exploring-wayland-fragmentation/)、[Vocalinux issue #80](https://github.com/jatinkrmalik/vocalinux/issues/80)）。

只要应用要在「自己窗口没聚焦」时收到按键，就必须走以下「半民间」方案之一：

| 方案 | 取舍 |
|------|------|
| **evdev/uinput** 直接读 `/dev/input/event*` | 绕过 Wayland 协议，X11/Wayland/TTY 都能用；**需要把用户加入 `input` group 或 setuid**，安全模型差 |
| **libei + xdg-desktop-portal RemoteDesktop** | 用户每次启动都要授权；文档稀少；只在做合成器自动化时合理 |
| **xdg-desktop-portal GlobalShortcuts** | 走门户协商；标准化但合成器实现不齐（见 3.1） |
| **合成器私有协议** | 如 `hyprland-global-shortcuts-v1`；只在单一合成器有效 |

来源：[Wayland Fragmentation: xdotool adventure](https://www.semicomplete.com/blog/xdotool-and-exploring-wayland-fragmentation/)、[Wayland - keyboard-shortcuts-inhibit-unstable-v1](https://wayland.app/protocols/keyboard-shortcuts-inhibit-unstable-v1)。

---

## 3. 可选方案（含适配范围、成熟度、维护代价）

### 3.1 xdg-desktop-portal GlobalShortcuts

**协议**：`org.freedesktop.portal.GlobalShortcuts`（[规范](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.GlobalShortcuts.html)）。

应用调用 `CreateSession → BindShortcuts`，门户弹出一个对话框让用户**给每个 shortcut 选实际按键**。之后通过 `Activated` / `Deactivated` 信号通知应用。`ConfigureShortcuts` 方法在 v2 加入，允许应用打开门户的修改 UI。

合成器实现状态（截至 2026-05）：

| 合成器 | 状态 | 备注 |
|--------|------|------|
| **KDE Plasma 6** | 已稳定 | xdg-desktop-portal-kde 自 MR !80 起原生支持，2024-2025 持续迭代（[!368 改进流程](https://invent.kde.org/plasma/xdg-desktop-portal-kde/-/merge_requests/368)、[!449 记住拒绝项](https://invent.kde.org/plasma/xdg-desktop-portal-kde/-/merge_requests/449)） |
| **GNOME (Mutter)** | **尚未原生落地** | issue [GNOME/xdg-desktop-portal-gnome#47](https://gitlab.gnome.org/GNOME/xdg-desktop-portal-gnome/-/issues/47) 仍开放；Murmure 文档明确写「Mutter's XDG GlobalShortcuts portal is unreliable (latency, dropped events)，GNOME 默认走 CLI 模式」（[Murmure docs](https://docs.murmure.app/configure-shortcuts-on-linux/)） |
| **Hyprland** | 已支持 | 通过 `xdg-desktop-portal-hyprland`；同时还有合成器私有的 [`hyprland-global-shortcuts-v1`](https://wayland.app/protocols/hyprland-global-shortcuts-v1) |
| **sway / wlroots** | 已支持 | 通过 `xdg-desktop-portal-wlr` |
| **COSMIC** | 部分 | 实现质量随版本变化，未独立验证 |

**关键缺陷**（多个合成器共有）：
- 用户感受到的「再设置一次」：应用只能给 *preferred trigger*，最终键位由门户对话框决定。Hyprland 上甚至要求用户手改 config 文件 — 等于「应用申请，用户在 hyprland.conf 里实际绑」（[dec05eba.com 分析](https://dec05eba.com/2024/03/29/wayland-global-hotkeys-shortcut-is-mostly-useless/)）。
- **GNOME 是最大盲区**。Issue #420 用户用的就是 Debian — Debian 默认 GNOME。在 GNOME 上跑 GlobalShortcuts 等于压根不能用。
- 没有 push-to-talk：门户在 key-press 上触发事件，但是否传 release 事件、是否 dedupe，依赖合成器（OpenLess 当前依赖 hotkey 的 edge 来做 Toggle，需要稳定的成对事件）。

**维护代价**：新增 `ashpd` crate + DBus 异步流（参见 3.2 例外、4 节示例）。每个发行版/合成器组合都得人肉测一遍，bug 报告会按合成器分裂。

**结论**：现阶段加进来对 GNOME 用户毫无帮助，且会引入合成器分裂的支持负担。

### 3.2 CLI + single-instance 转发（推荐）

把 OpenLess 二进制本身做成可被外部调起的「无 GUI 触发器」：

```
桌面环境快捷键 → 启动 openless --toggle-dictation
                ↓
                tauri-plugin-single-instance 拦截
                ↓
                已运行的 OpenLess 主实例从回调拿到 argv
                ↓
                解析 --toggle-dictation → 调用 coordinator.start/stop_dictation
```

适配范围：**所有 Linux 桌面环境**（GNOME / KDE / Hyprland / sway / Cosmic / XFCE / i3 / ...），因为它只依赖「桌面环境能绑定一个 shell 命令」这个最低公共能力。X11 / Wayland 都通杀。

成熟度：极高。这是 Linux 桌面集成的最普世做法（OBS、Mumble、1Password、Albert 等都同时支持），也是 Murmure 在 GNOME 上的默认模式（[Murmure docs](https://docs.murmure.app/configure-shortcuts-on-linux/)）。`tauri-plugin-single-instance` 2.x 已经在仓库里，回调拿 argv 是其官方设计（[官方文档](https://v2.tauri.app/plugin/single-instance/)）。

维护代价：低。代码改动集中在三处：
1. `main.rs` 早期解析一次 argv（在 Tauri Builder 之前不退出，只记下 intent）；
2. `lib.rs:73` 的 single-instance 回调里识别 argv 并发往 coordinator；
3. README / Settings 页加一段文档教用户怎么绑桌面快捷键。

唯一已知限制：**桌面 OS 级快捷键大多只在 key-press 触发**（按键即 fire，不传 key-release）。这天然兼容 Toggle 模式，但不支持「按住说话 / 松开收尾」的 push-to-talk。OpenLess 默认就是 Toggle（`CLAUDE.md` 写明：「Hotkey is toggle-only, not press-and-hold」），所以不冲突。这一限制在 Murmure 文档里也明确写出：「Push-to-talk limitation — OS shortcuts only fire on key press」。

### 3.3 evdev/uinput 直接读

绕过 Wayland，直接打开 `/dev/input/event*` 读 scancode。

适配范围：所有 Linux（包括 TTY）。
权限要求：用户必须在 `input` group，或二进制 setuid。**两条都是发行版会警告的安全降级**。
成熟度：技术上稳定（`evdev-shortcut` crate 存在），但用户经验差：要手动 `usermod -aG input $USER` 然后注销重登 — 普通用户不会做。
不推荐用于面向消费者的 OpenLess。

来源：[evremap (Wez)](https://github.com/wez/evremap)、[evdev_shortcut crate](https://docs.rs/evdev-shortcut/latest/evdev_shortcut/)。

### 3.4 libei

libei + RemoteDesktop portal 是新一代「让应用模拟键盘鼠标」的官方路径，但目前主要用例是远程桌面 / 自动化测试。每次启动都要 portal 弹授权框，且 GNOME 实现仍在迭代。文档稀少。

不推荐用作快捷键触发路径。来源：[Sending keystrokes to Wayland — Medium](https://medium.com/@python-javascript-php-html-css/sending-keyboard-strokes-to-wayland-linux-windows-solutions-and-challenges-9319cf424d06)。

---

## 4. tauri-plugin-single-instance 2.x 最小示例

当前发布版本：**2.4.2**（2026-05-02）。仓库已锁 `tauri-plugin-single-instance = "2"`（[crates.io](https://crates.io/crates/tauri-plugin-single-instance)）。

回调签名：`Fn(&AppHandle, Vec<String>, String) + Send + Sync + 'static` — 三个参数是 `app handle / argv / cwd`。来源：[Tauri 官方文档](https://v2.tauri.app/plugin/single-instance/)。

OpenLess 现有调用点（`lib.rs:73-78`）目前忽略 `argv` / `cwd`：

```rust
.plugin(tauri_plugin_single_instance::init(|app, _argv, _cwd| {
    log::info!("[single-instance] another instance launched, focusing existing main window");
    show_main_window(app);
}))
```

改造后形态（示意，不在本调研里实施）：

```rust
.plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
    if let Some(intent) = parse_cli_intent(&argv) {
        let coord: tauri::State<Arc<Coordinator>> = app.state();
        dispatch_intent(coord.inner().clone(), intent);
        return; // 不抢焦点
    }
    show_main_window(app); // 无 intent → 退回原来的「聚焦主窗口」
}))
```

注意点：
- 回调在 Tauri 主线程上执行，长任务必须 spawn 到 tokio runtime；OpenLess 的 coordinator 接口本来就异步。
- 第二实例的进程**已经退出**，所以「不抢焦点」就是真不弹窗 — 体验上跟原生快捷键一致。
- single-instance 插件必须**第一个**注册（早于 `tauri_plugin_shell` 等），这是官方文档强调的注意点。OpenLess 目前已经满足。

---

## 5. CLI 参数解析建议

**结论：用 `std::env::args()` 手写极简解析，不引入 clap。**

理由：
- OpenLess 是 GUI app，CLI 入口只是「触发器」，参数集小（toggle-dictation / toggle-qa / cancel / show），没有子命令树。
- 引入 `clap` 会让二进制体积涨一截（~200 KB），还要处理 `--help` 输出（GUI 程序输出帮助文本到 stderr，用户基本看不到，价值有限）。
- 关键风险：**CLI 解析不能让 OpenLess panic 退出**。如果用户拖文件到 .desktop launcher 或者发行版包装传了奇怪参数，GUI 必须照常起来。`clap` 默认 `unwrap_or_else(|e| e.exit())` 会让进程退出，必须改成 `try_parse` + 静默忽略错误 — 那不如直接手写。

最小手写示意：

```rust
// main.rs：在 Tauri Builder 之前
#[derive(Clone, Copy)]
pub enum CliIntent {
    ToggleDictation,
    ToggleQa,
    Cancel,
    Show,
}

fn parse_cli_intent<S: AsRef<str>>(args: &[S]) -> Option<CliIntent> {
    // 跳过 argv[0]，逐项匹配；多余/未知参数静默忽略，绝不 panic
    for arg in args.iter().skip(1) {
        match arg.as_ref() {
            "--toggle-dictation" => return Some(CliIntent::ToggleDictation),
            "--toggle-qa"        => return Some(CliIntent::ToggleQa),
            "--cancel"           => return Some(CliIntent::Cancel),
            "--show"             => return Some(CliIntent::Show),
            _ => {}
        }
    }
    None
}
```

把同样的 helper 在 `lib.rs:73` 的回调里复用 — 第一次进程启动（首实例）和 single-instance 转发走同一条解析路径。

`std::env::args()` 是 Rust 标准库，不引外部依赖。来源：[Rust by Example - std::env::args](https://doc.rust-lang.org/std/env/fn.args.html)、[Tauri CLI plugin（参考路径，本次不使用）](https://v2.tauri.app/plugin/cli/)。

---

## 6. 桌面环境配置自定义快捷键的步骤

OpenLess 在 Linux 安装后默认在 `$PATH` 里（或在 `.desktop` 旁边的 bin 目录）。下面假定二进制叫 `openless`。如果安装在非 PATH 路径（如 AppImage），文档里应同时写绝对路径。

### 6.1 GNOME (Wayland)

**GUI 路径**（[GNOME 官方帮助](https://help.gnome.org/gnome-help/keyboard-shortcuts-set.html)）：

1. Settings → Keyboard
2. Keyboard Shortcuts → View and Customize Shortcuts
3. Custom Shortcuts → Add Shortcut（+ 按钮）
4. Name: `OpenLess Dictate`
5. Command: `openless --toggle-dictation`
6. 点击 "Add Shortcut..."，按下想绑的键（如 `Super+Y`）
7. 点 Add 保存

**CLI / 脚本化**（[Programster's Blog](https://blog.programster.org/using-the-cli-to-set-custom-keyboard-shortcuts)、[Ubuntu Wiki - Keybindings](https://wiki.ubuntu.com/Keybindings)）。注意 schema 是单数 `custom-keybinding`（不带 s），relocatable schema 需要带路径访问：

```bash
KEYBIND_PATH="/org/gnome/settings-daemon/plugins/media-keys/custom-keybindings/openless0/"
gsettings set org.gnome.settings-daemon.plugins.media-keys custom-keybindings \
  "['$KEYBIND_PATH']"
gsettings set "org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:$KEYBIND_PATH" \
  name 'OpenLess Dictate'
gsettings set "org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:$KEYBIND_PATH" \
  command 'openless --toggle-dictation'
gsettings set "org.gnome.settings-daemon.plugins.media-keys.custom-keybinding:$KEYBIND_PATH" \
  binding '<Super>y'
```

### 6.2 KDE Plasma 6 (Wayland)

**GUI 路径**（[KDE Discuss - Custom Shortcuts](https://discuss.kde.org/t/adding-shortcuts-to-systemsettings/15276)）：

1. System Settings → Keyboard → Shortcuts
2. "+ Add New" → Command/URL
3. Trigger: 录想绑的键
4. Action: `openless --toggle-dictation`
5. Apply

**CLI / 脚本化**（[commandmasters.com](https://commandmasters.com/commands/kwriteconfig5-linux/)、[KDE Discuss - kglobalaccel](https://discuss.kde.org/t/plasma-6-method-to-refresh-kglobalaccel-shortcuts/17995)）：

Plasma 6 把 shortcut 存在 `~/.config/kglobalshortcutsrc`，工具改名为 `kwriteconfig6`。完整的 custom-shortcut 脚本化在 KDE 上比 GNOME 复杂（涉及 D-Bus 注册 + kglobalaccel 重载）：

```bash
# 写入声明
kwriteconfig6 --file kglobalshortcutsrc \
  --group 'openless.desktop' --key '_k_friendly_name' 'OpenLess'
kwriteconfig6 --file kglobalshortcutsrc \
  --group 'openless.desktop' --key 'dictate' 'Meta+Y,none,Toggle Dictation'

# 让 kglobalaccel 重载（必需，否则要重登）
qdbus org.kde.kglobalaccel /kglobalaccel reloadConfig
```

> 实践建议：KDE 上推荐**直接引导用户走 GUI**，因为 kglobalshortcutsrc 的 group 命名必须匹配 `.desktop` 文件 + 需要 service 注册，脚本化容易出错。

### 6.3 Hyprland

**GUI 路径**：无。Hyprland 配置就是文本文件，没有图形化绑定。

**配置文件**（[Hyprland Wiki - Binds](https://wiki.hypr.land/Configuring/Basics/Binds/)、[ArchWiki - Hyprland](https://wiki.archlinux.org/title/Hyprland)）：

文件位置 `~/.config/hypr/hyprland.conf`。Hyprland 0.54 及更早用传统 hyprlang 语法：

```
bind = SUPER, Y, exec, openless --toggle-dictation
bind = SUPER SHIFT, Y, exec, openless --toggle-qa
```

Hyprland 0.55+ 推荐用 Lua（hyprlang 已 deprecated）：

```lua
hl.bind({"SUPER"}, "y", "exec", "openless --toggle-dictation")
```

reload：`hyprctl reload`（或重启 hyprland）。

### 6.4 sway

**GUI 路径**：无（同 Hyprland，纯文本配置）。

**配置文件**（[sway(5) - ArchWiki](https://man.archlinux.org/man/sway.5)、[swaywm/sway Wiki - Shortcut handling](https://github.com/swaywm/sway/wiki/Shortcut-handling)）：

文件位置 `~/.config/sway/config`。语法：

```
bindsym $mod+y exec openless --toggle-dictation
bindsym $mod+Shift+y exec openless --toggle-qa
```

reload：`swaymsg reload`。

---

## 7. 推荐的最小修复方案（落地到 OpenLess）

### 7.1 本期实现（Beta 1.3.x）：CLI + single-instance 转发

理由：
1. **覆盖范围最大**：所有桌面环境直接可用，包括 Issue #420 用户的 Debian + GNOME（GNOME 是 portal 路线的最大盲区）。
2. **改动量最小**：复用现有 `tauri-plugin-single-instance` 与 `coordinator::Coordinator` 公共接口，零新依赖。
3. **与 toggle-only 设计契合**：OpenLess 现在就是 toggle-only（`CLAUDE.md` 已明确），不存在 push-to-talk 限制冲突。
4. **故障面小**：CLI 解析 → IPC 命令链路是同步可测的，没有 D-Bus / 合成器版本依赖。
5. **行业先例**：Murmure（同类产品）在 GNOME 上默认就用这条路径。

### 7.2 改动清单（**不在本调研中实施，仅作落地参考**）

| 文件 | 改动 | 行数估计 |
|------|------|---------|
| `openless-all/app/src-tauri/src/cli.rs`（新） | `CliIntent` 枚举 + `parse_cli_intent` 函数 + 单元测试 | ~60 |
| `openless-all/app/src-tauri/src/lib.rs:73` | single-instance 回调里解析 argv，调度 intent | ~15 |
| `openless-all/app/src-tauri/src/lib.rs`（main 函数早期） | 首次启动也跑一遍 `parse_cli_intent`，记下首意图，coordinator 准备好后再触发；或简单约定「首次启动忽略 CLI intent，只起 GUI」 | ~5 |
| `openless-all/app/src-tauri/src/hotkey.rs:1204-1208` | 移除「wayland 报错」分支；改成 **info 级日志** + 不安装 rdev 监听（X11 仍走 rdev，Wayland 静默退出 listener） | ~10 |
| `openless-all/app/src/i18n/{zh-CN,en}.ts` | 新增 "Linux Wayland 下推荐通过桌面快捷键调用 `openless --toggle-dictation`" 引导文案 | ~10 |
| `README.md` / `README.zh.md` / `USAGE.md` | 把第 6 节四个 DE 的配置示例写进去 | ~50 |

### 7.3 CLI 参数命名

按题面建议保留：

```
openless --toggle-dictation    # 等价于按一次主热键
openless --toggle-qa           # 等价于按一次 QA 热键
openless --cancel              # 等价于 Esc
openless --show                # 唤起主窗口（已有 single-instance 行为）
```

约定：所有 flag 在 Wayland 上是「唯一进入点」；X11 上仍然支持原 rdev 热键，CLI 是补充而非替代（用户可以同时用）。

### 7.4 Wayland 检测下的行为变化

`hotkey.rs:1204-1208` 当前的 `wayland_unsupported` 错误**不应再向上传**。改为：

- 检测到 Wayland → 不安装 rdev listener，记一行 INFO log；
- 前端在 Settings → 热键页显示一行提示（i18n）：「检测到 Wayland session。请在系统设置中将 `openless --toggle-dictation` 绑到一个快捷键。点这里查看说明 →」；
- 链接打开 README 中对应章节，按 DE 列出 6.1-6.4 的步骤。

这样既消除了 Issue #420 的报错，又主动告诉用户下一步该做什么，符合用户原始建议「补充对应脚本或命令让用户去系统设置中配置」。

### 7.5 后续路径（**留给单独 issue，本期不做**）

- **xdg-desktop-portal GlobalShortcuts 集成**：等 GNOME 落地 issue [#47](https://gitlab.gnome.org/GNOME/xdg-desktop-portal/issues/47) 后再评估。届时 KDE + Hyprland + sway + GNOME 都成熟，可作为 CLI 路径的「升级版」（应用内绑定，无需用户去 DE 设置）。引入 `ashpd` crate（参考 4 节代码骨架与 [ashpd demo](https://github.com/bilelmoussaoui/ashpd/blob/master/demo/client/src/portals/desktop/global_shortcuts.rs)）。
  - 现在不做的另一个理由：CLI 方案不会被 portal 方案取代 — 两者可共存。Portal 方案先在 KDE 上灰度也来得及。
- **`hyprland-global-shortcuts-v1` 原生协议**：单合成器优化，优先级最低。
- **Push-to-talk 模式**：如果未来想支持「按住录音」，OS 级快捷键路径会卡住（DE 只发 key-press），到那时再评估 portal / libei。

---

## 8. 参考资料

**Wayland 协议与安全模型**
- [The Wayland Protocol — seat/keyboard](https://wayland-book.com/seat/keyboard.html)
- [Wayland - keyboard-shortcuts-inhibit-unstable-v1](https://wayland.app/protocols/keyboard-shortcuts-inhibit-unstable-v1)
- [Exploring the Fragmentation of Wayland (semicomplete.com)](https://www.semicomplete.com/blog/xdotool-and-exploring-wayland-fragmentation/)
- [Sending Keyboard Strokes to Wayland (Medium)](https://medium.com/@python-javascript-php-html-css/sending-keyboard-strokes-to-wayland-linux-windows-solutions-and-challenges-9319cf424d06)
- [tauri-apps/global-hotkey issue #28 — Wayland support](https://github.com/tauri-apps/global-hotkey/issues/28)
- [dec05eba.com — Wayland global hotkeys is mostly useless](https://dec05eba.com/2024/03/29/wayland-global-hotkeys-shortcut-is-mostly-useless/)

**xdg-desktop-portal GlobalShortcuts**
- [GlobalShortcuts 规范（flatpak.github.io）](https://flatpak.github.io/xdg-desktop-portal/docs/doc-org.freedesktop.portal.GlobalShortcuts.html)
- [KDE Portal MR !80 — Implementation of GlobalShortcuts](https://invent.kde.org/plasma/xdg-desktop-portal-kde/-/merge_requests/80)
- [KDE Portal MR !368 — Improve workflow](https://invent.kde.org/plasma/xdg-desktop-portal-kde/-/merge_requests/368)
- [KDE Portal MR !449 — Remember denied shortcuts](https://invent.kde.org/plasma/xdg-desktop-portal-kde/-/merge_requests/449)
- [GNOME xdg-desktop-portal-gnome issue #47 — GlobalShortcuts feature request](https://gitlab.gnome.org/GNOME/xdg-desktop-portal-gnome/-/issues/47)
- [GNOME Discourse — Feature request: GlobalShortcuts portal](https://discourse.gnome.org/t/feature-request-globalshortcuts-portal/15343)

**ashpd（Rust 门户客户端）**
- [ashpd crate (docs.rs)](https://docs.rs/ashpd/latest/ashpd/)
- [ashpd repo — global_shortcuts.rs (client/src)](https://github.com/bilelmoussaoui/ashpd/blob/master/client/src/desktop/global_shortcuts.rs)
- [ashpd repo — demo global_shortcuts.rs (端到端示例)](https://github.com/bilelmoussaoui/ashpd/blob/master/demo/client/src/portals/desktop/global_shortcuts.rs)
- [ASHPD Demo on Flathub](https://flathub.org/en/apps/com.belmoussaoui.ashpd.demo)

**Tauri single-instance**
- [tauri-plugin-single-instance — 官方文档](https://v2.tauri.app/plugin/single-instance/)
- [tauri-plugin-single-instance — crates.io（最新 2.4.2，2026-05-02）](https://crates.io/crates/tauri-plugin-single-instance)
- [tauri-plugin-single-instance — docs.rs/latest](https://docs.rs/crate/tauri-plugin-single-instance/latest)
- [Tauri v2 — Calling Rust from Frontend](https://v2.tauri.app/develop/calling-rust/)

**桌面环境快捷键配置**
- [GNOME 帮助 — Set keyboard shortcuts](https://help.gnome.org/gnome-help/keyboard-shortcuts-set.html)
- [Programster — Using the CLI to Set Custom Keyboard Shortcuts](https://blog.programster.org/using-the-cli-to-set-custom-keyboard-shortcuts)
- [Ubuntu Wiki — Keybindings](https://wiki.ubuntu.com/Keybindings)
- [KDE Discuss — Adding shortcuts to Systemsettings](https://discuss.kde.org/t/adding-shortcuts-to-systemsettings/15276)
- [KDE Discuss — kglobalaccel reload (Plasma 6)](https://discuss.kde.org/t/plasma-6-method-to-refresh-kglobalaccel-shortcuts/17995)
- [commandmasters — kwriteconfig5 / kwriteconfig6](https://commandmasters.com/commands/kwriteconfig5-linux/)
- [Hyprland Wiki — Configuring/Basics/Binds](https://wiki.hypr.land/Configuring/Basics/Binds/)
- [ArchWiki — Hyprland](https://wiki.archlinux.org/title/Hyprland)
- [Hyprland Global Shortcuts protocol v1](https://wayland.app/protocols/hyprland-global-shortcuts-v1)
- [sway(5) — ArchWiki man page](https://man.archlinux.org/man/sway.5)
- [swaywm/sway Wiki — Shortcut handling](https://github.com/swaywm/sway/wiki/Shortcut-handling)
- [Mark Stosberg — Sway keybindings tips](https://mark.stosberg.com/sway-keybindings/)

**同类产品参考（Murmure — 同样是 STT 应用）**
- [Murmure docs — Configure shortcuts on Linux](https://docs.murmure.app/configure-shortcuts-on-linux/)
- [Murmure repo — Kieirra/murmure](https://github.com/Kieirra/murmure)

**evdev / 替代方案**
- [evdev_shortcut crate](https://docs.rs/evdev-shortcut/latest/evdev_shortcut/)
- [wez/evremap — Linux/Wayland keyboard remapper](https://github.com/wez/evremap)
- [xwaykeyz — X11 + Wayland keymapper](https://github.com/RedBearAK/xwaykeyz)
- [Vocalinux issue #80 — Wayland support via evdev](https://github.com/jatinkrmalik/vocalinux/issues/80)

**OpenLess 仓库锚点**
- 当前实现：`openless-all/app/src-tauri/src/hotkey.rs:1183-1530`（Wayland 报错在 `:1204-1208`）
- single-instance 回调：`openless-all/app/src-tauri/src/lib.rs:73-78`
- IPC commands：`openless-all/app/src-tauri/src/commands.rs:1099-1110`（dictation）、`:1324-1330`（QA panel）
- Cargo deps：`openless-all/app/src-tauri/Cargo.toml:24`（`tauri-plugin-single-instance = "2"`）
