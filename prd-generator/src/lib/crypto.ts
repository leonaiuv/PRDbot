import CryptoJS from 'crypto-js';

// 使用设备指纹生成加密密钥
// 这里使用一个固定的盐值 + 浏览器指纹的组合
// 在生产环境中，可以考虑使用更安全的密钥管理方案
const ENCRYPTION_SALT = 'prd-generator-v1-secure-salt';

/**
 * 获取加密密钥
 * 结合固定盐值和一些浏览器特征生成密钥
 */
function getEncryptionKey(): string {
  // 在服务端或无浏览器环境下使用默认密钥
  if (typeof window === 'undefined') {
    return ENCRYPTION_SALT;
  }
  
  // 组合多个浏览器特征作为密钥的一部分
  const fingerprint = [
    navigator.userAgent,
    navigator.language,
    screen.colorDepth,
    new Date().getTimezoneOffset(),
    ENCRYPTION_SALT
  ].join('|');
  
  // 使用 SHA256 生成固定长度的密钥
  return CryptoJS.SHA256(fingerprint).toString();
}

/**
 * 加密敏感数据
 * @param plainText 明文数据
 * @returns 加密后的密文
 */
export function encrypt(plainText: string): string {
  if (!plainText) return '';
  
  try {
    const key = getEncryptionKey();
    const encrypted = CryptoJS.AES.encrypt(plainText, key).toString();
    return encrypted;
  } catch (error) {
    console.error('Encryption failed:', error);
    return '';
  }
}

/**
 * 解密敏感数据
 * @param cipherText 密文数据
 * @returns 解密后的明文
 */
export function decrypt(cipherText: string): string {
  if (!cipherText) return '';
  
  try {
    const key = getEncryptionKey();
    const bytes = CryptoJS.AES.decrypt(cipherText, key);
    const decrypted = bytes.toString(CryptoJS.enc.Utf8);
    return decrypted;
  } catch (error) {
    console.error('Decryption failed:', error);
    return '';
  }
}

/**
 * 加密 API Keys 对象
 * @param apiKeys API Keys 对象
 * @returns 加密后的 API Keys 对象
 */
export function encryptApiKeys(apiKeys: Record<string, string>): Record<string, string> {
  const encrypted: Record<string, string> = {};
  for (const [provider, key] of Object.entries(apiKeys)) {
    if (key) {
      encrypted[provider] = encrypt(key);
    }
  }
  return encrypted;
}

/**
 * 解密 API Keys 对象
 * @param encryptedApiKeys 加密的 API Keys 对象
 * @returns 解密后的 API Keys 对象
 */
export function decryptApiKeys(encryptedApiKeys: Record<string, string>): Record<string, string> {
  const decrypted: Record<string, string> = {};
  for (const [provider, encryptedKey] of Object.entries(encryptedApiKeys)) {
    if (encryptedKey) {
      decrypted[provider] = decrypt(encryptedKey);
    }
  }
  return decrypted;
}

/**
 * 检查字符串是否已加密（简单检测）
 * AES 加密后的字符串通常是 Base64 格式且较长
 */
export function isEncrypted(text: string): boolean {
  if (!text) return false;
  // AES 加密后的字符串特征：Base64 格式，包含 U2FsdGVkX1 前缀（CryptoJS 特征）
  return text.startsWith('U2FsdGVkX1');
}
