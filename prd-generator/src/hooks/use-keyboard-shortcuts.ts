'use client';

import { useEffect, useCallback } from 'react';

export interface KeyboardShortcut {
  key: string;
  ctrl?: boolean;
  meta?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  action: () => void;
}

interface UseKeyboardShortcutsOptions {
  shortcuts: KeyboardShortcut[];
  enabled?: boolean;
}

export function useKeyboardShortcuts({ shortcuts, enabled = true }: UseKeyboardShortcutsOptions) {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return;

    // 忽略输入框内的快捷键（除了特定组合）
    const target = event.target as HTMLElement;
    const isInputElement = 
      target.tagName === 'INPUT' || 
      target.tagName === 'TEXTAREA' || 
      target.isContentEditable;

    for (const shortcut of shortcuts) {
      const ctrlOrMeta = shortcut.ctrl || shortcut.meta;
      const isCtrlPressed = event.ctrlKey || event.metaKey;
      
      const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
      const modifiersMatch = 
        (ctrlOrMeta ? isCtrlPressed : !isCtrlPressed) &&
        (shortcut.shift ? event.shiftKey : !event.shiftKey) &&
        (shortcut.alt ? event.altKey : !event.altKey);

      if (keyMatches && modifiersMatch) {
        // 如果是输入元素，只有带修饰键的快捷键才生效
        if (isInputElement && !ctrlOrMeta && !shortcut.alt) {
          continue;
        }

        event.preventDefault();
        event.stopPropagation();
        shortcut.action();
        return;
      }
    }
  }, [shortcuts, enabled]);

  useEffect(() => {
    if (enabled) {
      window.addEventListener('keydown', handleKeyDown);
      return () => window.removeEventListener('keydown', handleKeyDown);
    }
  }, [enabled, handleKeyDown]);
}

// 快捷键帮助面板数据
export const SHORTCUT_CATEGORIES = [
  {
    name: '通用',
    shortcuts: [
      { keys: ['Ctrl', 'S'], description: '保存' },
      { keys: ['Ctrl', 'E'], description: '导出' },
      { keys: ['Escape'], description: '取消/关闭' },
    ],
  },
  {
    name: '对话',
    shortcuts: [
      { keys: ['Ctrl', 'Enter'], description: '发送消息' },
      { keys: ['Shift', 'Enter'], description: '换行' },
    ],
  },
  {
    name: '编辑',
    shortcuts: [
      { keys: ['Ctrl', 'Z'], description: '撤销' },
      { keys: ['Ctrl', 'Shift', 'Z'], description: '重做' },
    ],
  },
  {
    name: '导航',
    shortcuts: [
      { keys: ['Ctrl', '/'], description: '显示快捷键帮助' },
      { keys: ['Ctrl', ','], description: '打开设置' },
    ],
  },
];
