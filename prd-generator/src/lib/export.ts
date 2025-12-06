import { saveAs } from 'file-saver';

/**
 * 导出Markdown文件
 */
export function exportMarkdown(content: string, filename: string): void {
  const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
  saveAs(blob, `${filename}.md`);
}

/**
 * 导出JSON文件
 */
export function exportJSON(data: object, filename: string): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json;charset=utf-8' });
  saveAs(blob, `${filename}.json`);
}
