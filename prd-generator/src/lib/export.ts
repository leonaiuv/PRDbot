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

/**
 * 将Markdown转换为HTML（简化版）
 */
function markdownToHtml(markdown: string): string {
  let html = markdown
    // 标题
    .replace(/^### (.*$)/gim, '<h3>$1</h3>')
    .replace(/^## (.*$)/gim, '<h2>$1</h2>')
    .replace(/^# (.*$)/gim, '<h1>$1</h1>')
    // 粗体和斜体
    .replace(/\*\*\*(.*?)\*\*\*/gim, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.*?)\*\*/gim, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/gim, '<em>$1</em>')
    // 代码块
    .replace(/```([\s\S]*?)```/gim, '<pre><code>$1</code></pre>')
    .replace(/`(.*?)`/gim, '<code>$1</code>')
    // 列表
    .replace(/^\s*\-\s+(.*)$/gim, '<li>$1</li>')
    .replace(/^\s*\d+\.\s+(.*)$/gim, '<li>$1</li>')
    // 链接
    .replace(/\[([^\]]+)\]\(([^\)]+)\)/gim, '<a href="$2">$1</a>')
    // 换行
    .replace(/\n\n/gim, '</p><p>')
    .replace(/\n/gim, '<br>');

  // 包裹列表
  html = html.replace(/(<li>.*<\/li>)/gim, (match) => {
    if (!match.startsWith('<ul>')) {
      return `<ul>${match}</ul>`;
    }
    return match;
  });

  return `<p>${html}</p>`;
}

/**
 * 导出PDF（使用浏览器打印功能）
 */
export function exportPDF(content: string, filename: string): void {
  const htmlContent = markdownToHtml(content);
  
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    throw new Error('无法打开打印窗口，请检查浏览器弹窗设置');
  }

  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${filename}</title>
      <style>
        @media print {
          @page {
            margin: 2cm;
          }
        }
        body {
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
          line-height: 1.6;
          color: #333;
          max-width: 800px;
          margin: 0 auto;
          padding: 2rem;
        }
        h1 {
          font-size: 2rem;
          border-bottom: 2px solid #333;
          padding-bottom: 0.5rem;
          margin-top: 2rem;
        }
        h2 {
          font-size: 1.5rem;
          border-bottom: 1px solid #ccc;
          padding-bottom: 0.3rem;
          margin-top: 1.5rem;
        }
        h3 {
          font-size: 1.2rem;
          margin-top: 1.2rem;
        }
        p {
          margin: 1rem 0;
        }
        ul, ol {
          margin: 1rem 0;
          padding-left: 2rem;
        }
        li {
          margin: 0.5rem 0;
        }
        code {
          background: #f4f4f4;
          padding: 0.2rem 0.4rem;
          border-radius: 3px;
          font-family: Consolas, Monaco, "Courier New", monospace;
        }
        pre {
          background: #f4f4f4;
          padding: 1rem;
          border-radius: 5px;
          overflow-x: auto;
        }
        pre code {
          background: none;
          padding: 0;
        }
        table {
          border-collapse: collapse;
          width: 100%;
          margin: 1rem 0;
        }
        th, td {
          border: 1px solid #ddd;
          padding: 0.5rem;
          text-align: left;
        }
        th {
          background: #f4f4f4;
        }
        blockquote {
          border-left: 4px solid #ddd;
          margin: 1rem 0;
          padding-left: 1rem;
          color: #666;
        }
      </style>
    </head>
    <body>
      ${htmlContent}
    </body>
    </html>
  `);
  printWindow.document.close();
  
  // 等待内容加载后打印
  printWindow.onload = () => {
    printWindow.print();
    printWindow.close();
  };
  
  // 备用：如果onload不触发，延时执行
  setTimeout(() => {
    if (!printWindow.closed) {
      printWindow.print();
    }
  }, 500);
}

/**
 * 导出Word文档（使用HTML格式，.doc扩展名）
 */
export function exportWord(content: string, filename: string): void {
  const htmlContent = markdownToHtml(content);
  
  const docContent = `
    <!DOCTYPE html>
    <html xmlns:o="urn:schemas-microsoft-com:office:office"
          xmlns:w="urn:schemas-microsoft-com:office:word"
          xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta charset="utf-8">
      <title>${filename}</title>
      <!--[if gte mso 9]>
      <xml>
        <w:WordDocument>
          <w:View>Print</w:View>
          <w:Zoom>100</w:Zoom>
          <w:DoNotOptimizeForBrowser/>
        </w:WordDocument>
      </xml>
      <![endif]-->
      <style>
        body {
          font-family: "Microsoft YaHei", "微软雅黑", Arial, sans-serif;
          font-size: 12pt;
          line-height: 1.6;
        }
        h1 {
          font-size: 20pt;
          font-weight: bold;
          border-bottom: 2px solid #333;
          padding-bottom: 6pt;
          margin-top: 24pt;
        }
        h2 {
          font-size: 16pt;
          font-weight: bold;
          border-bottom: 1px solid #ccc;
          padding-bottom: 4pt;
          margin-top: 18pt;
        }
        h3 {
          font-size: 14pt;
          font-weight: bold;
          margin-top: 14pt;
        }
        p {
          margin: 10pt 0;
        }
        ul, ol {
          margin: 10pt 0;
          padding-left: 24pt;
        }
        li {
          margin: 6pt 0;
        }
        code {
          font-family: Consolas, "Courier New", monospace;
          background: #f4f4f4;
          padding: 2pt 4pt;
        }
        pre {
          background: #f4f4f4;
          padding: 10pt;
          margin: 10pt 0;
        }
        table {
          border-collapse: collapse;
          width: 100%;
          margin: 10pt 0;
        }
        th, td {
          border: 1px solid #333;
          padding: 6pt;
        }
        th {
          background: #f0f0f0;
          font-weight: bold;
        }
      </style>
    </head>
    <body>
      ${htmlContent}
    </body>
    </html>
  `;

  const blob = new Blob([docContent], {
    type: 'application/msword;charset=utf-8'
  });
  saveAs(blob, `${filename}.doc`);
}

/**
 * 复制到剪贴板
 */
export async function copyToClipboard(text: string): Promise<void> {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // 备用方案
    const textArea = document.createElement('textarea');
    textArea.value = text;
    textArea.style.position = 'fixed';
    textArea.style.left = '-9999px';
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    document.execCommand('copy');
    document.body.removeChild(textArea);
  }
}
