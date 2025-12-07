import LZString from 'lz-string';
import CryptoJS from 'crypto-js';

// 分享链接版本
const SHARE_VERSION = 'v2';

// HMAC 签名密钥（用于防篡改）
const HMAC_SECRET = 'prd-share-integrity-2024';

export interface ShareData {
  title: string;
  content: string;
  createdAt: number;
  expiresAt?: number;
  isEncrypted?: boolean;
}

interface ShareDataV2 extends ShareData {
  v: string;      // 版本
  sig: string;    // HMAC 签名
}

/**
 * 计算数据的 HMAC 签名
 */
function computeSignature(data: Omit<ShareDataV2, 'sig'>): string {
  const signData = JSON.stringify({
    title: data.title,
    content: data.content,
    createdAt: data.createdAt,
    expiresAt: data.expiresAt,
    isEncrypted: data.isEncrypted,
    v: data.v,
  });
  return CryptoJS.HmacSHA256(signData, HMAC_SECRET).toString();
}

/**
 * 验证签名
 */
function verifySignature(data: ShareDataV2): boolean {
  const expectedSig = computeSignature(data);
  return data.sig === expectedSig;
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
  const shareData: ShareDataV2 = {
    v: SHARE_VERSION,
    title,
    content,
    createdAt: Date.now(),
    expiresAt: options?.expiresIn 
      ? Date.now() + options.expiresIn * 60 * 60 * 1000 
      : undefined,
    isEncrypted: !!options?.password,
    sig: '', // 占位，稍后计算
  };

  // 如果有密码，使用 AES-GCM 加密内容
  if (options?.password) {
    // 生成随机 IV
    const iv = CryptoJS.lib.WordArray.random(12);
    // 使用 PBKDF2 派生密钥
    const key = CryptoJS.PBKDF2(options.password, 'prd-share-salt', {
      keySize: 256 / 32,
      iterations: 1000,
    });
    
    const encrypted = CryptoJS.AES.encrypt(content, key, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    
    // 存储 IV + 密文
    shareData.content = iv.toString() + ':' + encrypted.ciphertext.toString(CryptoJS.enc.Base64);
  }

  // 计算签名
  shareData.sig = computeSignature(shareData);

  const dataToEncode = JSON.stringify(shareData);

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
    
    const parsed = JSON.parse(decompressed);
    
    // 检查是否是新版格式
    if (parsed.v === SHARE_VERSION && parsed.sig) {
      // 验证签名
      if (!verifySignature(parsed as ShareDataV2)) {
        console.error('Share data signature verification failed');
        return null;
      }
    }
    
    return parsed as ShareData;
  } catch (error) {
    console.error('Failed to parse share data:', error);
    return null;
  }
}

// 解密内容
export function decryptContent(encryptedContent: string, password: string): string | null {
  try {
    // 检查是否是新版加密格式（IV:ciphertext）
    if (encryptedContent.includes(':')) {
      const [ivHex, cipherBase64] = encryptedContent.split(':');
      const iv = CryptoJS.enc.Hex.parse(ivHex);
      const key = CryptoJS.PBKDF2(password, 'prd-share-salt', {
        keySize: 256 / 32,
        iterations: 1000,
      });
      
      const cipherParams = CryptoJS.lib.CipherParams.create({
        ciphertext: CryptoJS.enc.Base64.parse(cipherBase64),
      });
      
      const decrypted = CryptoJS.AES.decrypt(cipherParams, key, {
        iv: iv,
        mode: CryptoJS.mode.CBC,
        padding: CryptoJS.pad.Pkcs7,
      });
      
      const result = decrypted.toString(CryptoJS.enc.Utf8);
      return result || null;
    }
    
    // 兼容旧版加密格式
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
