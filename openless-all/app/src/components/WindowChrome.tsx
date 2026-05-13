import { type CSSProperties, type ReactNode } from 'react';

export type OS = 'mac' | 'win' | 'linux';

export function detectOS(): OS {
  if (typeof navigator === 'undefined') return 'mac';
  const uaDataPlatform = (
    navigator as Navigator & { userAgentData?: { platform?: string } }
  ).userAgentData?.platform ?? '';
  const hints = `${navigator.userAgent || ''} ${navigator.platform || ''} ${uaDataPlatform}`;
  if (/Mac|iPhone|iPad|iPod/.test(hints)) return 'mac';
  if (/Windows|Win32|Win64/.test(hints)) return 'win';
  if (/Linux|X11|Wayland/.test(hints)) return 'linux';
  return 'mac';
}

const MAC_TITLEBAR_HEIGHT = 28;
const MAC_SYSTEM_CONTROLS_RESERVED_WIDTH = 76;
const WIN_CONSOLE_RADIUS = 10;

interface WindowChromeProps {
  os?: OS;
  title?: string;
  children: ReactNode;
  height?: number | string;
}

export function WindowChrome({
  os = 'mac',
  children,
  height = 800,
}: WindowChromeProps) {
  // Windows 下交还原生外壳（decorations:true）：外层不画圆角 / 边框 / 阴影 / 标题栏，
  // 避免与原生窗口的角和关闭按钮重叠。内层卡片保留 10px 圆角，跟整体设计对齐。
  const shellRadius = os === 'mac' ? 0 : os === 'win' ? 0 : 14;
  const consoleRadius = os === 'mac' ? 20 : os === 'win' ? WIN_CONSOLE_RADIUS : 14;
  const titlebarHeight = os === 'mac' ? MAC_TITLEBAR_HEIGHT : 0;

  // 两个平台用同一份半透明玻璃 background + backdropFilter，让 sidebar 透明地坐在
  // 磨砂底板上时有可见的玻璃感。
  // Windows: Tauri transparent:true + lib.rs apply_mica 提供 Win11 Mica 透出来；
  // macOS: NSVisualEffectView 提供材质。
  // alpha 0.92：和原生 Win11 caption（lib.rs 设为 rgb(245,245,247)）色差最小，玻璃感仍可见。
  const background = `
    radial-gradient(120% 80% at 0% 0%, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 60%),
    radial-gradient(100% 70% at 100% 100%, rgba(37,99,235,0.07) 0%, rgba(37,99,235,0) 55%),
    linear-gradient(180deg, rgba(245,245,247,0.92) 0%, rgba(232,232,236,0.92) 100%)
  `;

  return (
    <div
      style={{
        '--ol-window-shell-radius': `${shellRadius}px`,
        '--ol-window-console-radius': `${consoleRadius}px`,
        '--ol-window-titlebar-height': `${titlebarHeight}px`,
        width: '100%',
        height,
        position: 'relative',
        borderRadius: 'var(--ol-window-shell-radius)',
        boxShadow: os === 'win' ? 'none' : 'var(--ol-shadow-xl)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        border: os === 'win' ? 'none' : os === 'mac' ? 'none' : '0.5px solid rgba(0,0,0,.10)',
        background,
        backdropFilter: 'blur(var(--ol-glass-blur-strong)) saturate(190%)',
        WebkitBackdropFilter: 'blur(var(--ol-glass-blur-strong)) saturate(190%)',
        animation: os === 'win' ? undefined : 'ol-window-enter 0.42s var(--ol-motion-spring) both',
        transition: 'box-shadow 0.28s var(--ol-motion-soft), border-color 0.28s var(--ol-motion-soft), backdrop-filter 0.28s var(--ol-motion-soft)',
        willChange: 'opacity, transform, filter',
      } as CSSProperties}
    >
      {os === 'mac' && (
        <div
          data-tauri-drag-region
          style={{
            position: 'absolute',
            top: 0,
            left: MAC_SYSTEM_CONTROLS_RESERVED_WIDTH,
            right: 0,
            height: MAC_TITLEBAR_HEIGHT,
            zIndex: 50,
          }}
        />
      )}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', position: 'relative' }}>
        {children}
      </div>
    </div>
  );
}
