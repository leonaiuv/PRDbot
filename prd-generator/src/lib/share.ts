import LZString from 'lz-string';
import CryptoJS from 'crypto-js';

export interface ShareData {
  title: string;
  content: string;
  createdAt: number;
  expiresAt?: number;
  isEncrypted?: boolean;
}

// 生成分享链接
export function generateShareLink(
  title: string,
  content: string,
  options?: {
    password?: string;
    expiresIn?: number; // 过期时间（小时）
  }
): string {
  const shareData: ShareData = {
    title,
    content,
    createdAt: Date.now(),
    expiresAt: options?.expiresIn 
      ? Date.now() + options.expiresIn * 60 * 60 * 1000 
      : undefined,
    isEncrypted: !!options?.password,
  };

  let dataToEncode = JSON.stringify(shareData);

  // 如果有密码，加密内容
  if (options?.password) {
    const encrypted = CryptoJS.AES.encrypt(
      shareData.content,
      options.password
    ).toString();
    shareData.content = encrypted;
    dataToEncode = JSON.stringify(shareData);
  }

  // 使用 LZ-String 压缩
  const compressed = LZString.compressToEncodedURIComponent(dataToEncode);

  // 构建分享链接
  const baseUrl = typeof window !== 'undefined' 
    ? `${window.location.origin}/share` 
    : '/share';

  return `${baseUrl}?d=${compressed}`;
}

// 解析分享数据
export function parseShareData(compressedData: string): ShareData | null {
  try {
    const decompressed = LZString.decompressFromEncodedURIComponent(compressedData);
    if (!decompressed) return null;
    
    return JSON.parse(decompressed) as ShareData;
  } catch (error) {
    console.error('Failed to parse share data:', error);
    return null;
  }
}

// 解密内容
export function decryptContent(encryptedContent: string, password: string): string | null {
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedContent, password);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    if (!decrypted) return null;
    return decrypted;
  } catch (error) {
    console.error('Failed to decrypt content:', error);
    return null;
  }
}

// 检查分享是否过期
export function isShareExpired(shareData: ShareData): boolean {
  if (!shareData.expiresAt) return false;
  return Date.now() > shareData.expiresAt;
}

// 格式化过期时间显示
export function formatExpiresAt(expiresAt: number): string {
  const now = Date.now();
  const diff = expiresAt - now;
  
  if (diff <= 0) return '已过期';
  
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  
  if (days > 0) {
    return `${days} 天后过期`;
  } else if (hours > 0) {
    return `${hours} 小时后过期`;
  } else {
    const minutes = Math.floor(diff / (1000 * 60));
    return `${minutes} 分钟后过期`;
  }
}

// 计算分享数据大小
export function getShareDataSize(content: string): number {
  const compressed = LZString.compressToEncodedURIComponent(
    JSON.stringify({ title: '', content, createdAt: 0 })
  );
  return compressed.length;
}

// 检查内容是否适合URL分享（URL长度限制约2000字符）
export function isContentShareable(content: string): { 
  shareable: boolean; 
  size: number; 
  maxSize: number;
  compressionRatio: number;
} {
  const maxSize = 8000; // 保守的URL长度限制
  const size = getShareDataSize(content);
  const originalSize = new TextEncoder().encode(content).length;
  
  return {
    shareable: size < maxSize,
    size,
    maxSize,
    compressionRatio: originalSize / size,
  };
}
