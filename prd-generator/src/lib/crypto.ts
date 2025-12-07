import CryptoJS from 'crypto-js';

// 加密版本标识，用于兼容旧版本数据
const CRYPTO_VERSION = 'v2';
const ENCRYPTION_PREFIX = `PRD_${CRYPTO_VERSION}_`;

// 加密参数
const PBKDF2_ITERATIONS = 10000;
const KEY_SIZE = 256 / 32; // 256 bits
const IV_SIZE = 128 / 8; // 128 bits for IV

/**
 * 生成设备指纹
 * 结合多个浏览器特征生成相对稳定的标识
 */
function getDeviceFingerprint(): string {
  if (typeof window === 'undefined') {
    return 'server-side-fallback-key-2024';
  }
  
  // 使用更稳定的特征（避免时区、语言等易变化的特征）
  const stableFeatures = [
    navigator.userAgent,
    screen.width.toString(),
    screen.height.toString(),
    screen.colorDepth.toString(),
    navigator.hardwareConcurrency?.toString() || '0',
    navigator.platform || '',
  ].join('|');
  
  return stableFeatures;
}

/**
 * 使用 PBKDF2 派生密钥
 * @param passphrase 原始密码/指纹
 * @param salt 盐值
 */
function deriveKey(passphrase: string, salt: string): CryptoJS.lib.WordArray {
  return CryptoJS.PBKDF2(passphrase, salt, {
    keySize: KEY_SIZE,
    iterations: PBKDF2_ITERATIONS,
  });
}

/**
 * 生成随机盐值
 */
function generateSalt(): string {
  return CryptoJS.lib.WordArray.random(16).toString();
}

/**
 * 生成随机 IV
 */
function generateIV(): CryptoJS.lib.WordArray {
  return CryptoJS.lib.WordArray.random(IV_SIZE);
}

/**
 * 加密数据结构
 */
interface EncryptedData {
  v: string;     // 版本
  s: string;     // 盐值 (base64)
  iv: string;    // IV (base64)
  ct: string;    // 密文 (base64)
  hmac: string;  // HMAC 签名 (base64)
}

/**
 * 计算 HMAC 签名用于完整性校验
 */
function computeHMAC(data: string, key: CryptoJS.lib.WordArray): string {
  return CryptoJS.HmacSHA256(data, key).toString();
}

/**
 * 加密敏感数据（增强版）
 * 使用 AES-CBC + PBKDF2 + HMAC
 * @param plainText 明文数据
 * @returns 加密后的JSON字符串（带前缀）
 */
export function encrypt(plainText: string): string {
  if (!plainText) return '';
  
  try {
    const fingerprint = getDeviceFingerprint();
    const salt = generateSalt();
    const iv = generateIV();
    
    // 派生加密密钥和 HMAC 密钥
    const encKey = deriveKey(fingerprint, salt);
    const hmacKey = deriveKey(fingerprint + '_hmac', salt);
    
    // AES 加密
    const encrypted = CryptoJS.AES.encrypt(plainText, encKey, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    
    const cipherText = encrypted.ciphertext.toString(CryptoJS.enc.Base64);
    
    // 计算 HMAC（包含 salt + iv + ciphertext）
    const hmacData = salt + iv.toString() + cipherText;
    const hmac = computeHMAC(hmacData, hmacKey);
    
    // 组装加密数据
    const encryptedData: EncryptedData = {
      v: CRYPTO_VERSION,
      s: salt,
      iv: iv.toString(CryptoJS.enc.Base64),
      ct: cipherText,
      hmac: hmac,
    };
    
    return ENCRYPTION_PREFIX + btoa(JSON.stringify(encryptedData));
  } catch (error) {
    console.error('Encryption failed:', error);
    return '';
  }
}

/**
 * 解密敏感数据（增强版）
 * @param cipherText 密文数据
 * @returns 解密后的明文
 */
export function decrypt(cipherText: string): string {
  if (!cipherText) return '';
  
  try {
    // 检查是否是新版加密格式
    if (cipherText.startsWith(ENCRYPTION_PREFIX)) {
      return decryptV2(cipherText);
    }
    
    // 兼容旧版加密格式（U2FsdGVkX1 前缀）
    if (cipherText.startsWith('U2FsdGVkX1')) {
      return decryptLegacy(cipherText);
    }
    
    // 可能是未加密的明文
    return cipherText;
  } catch (error) {
    console.error('Decryption failed:', error);
    return '';
  }
}

/**
 * 新版解密（v2）
 */
function decryptV2(cipherText: string): string {
  try {
    const dataStr = atob(cipherText.substring(ENCRYPTION_PREFIX.length));
    const data: EncryptedData = JSON.parse(dataStr);
    
    if (data.v !== CRYPTO_VERSION) {
      throw new Error('Unsupported encryption version');
    }
    
    const fingerprint = getDeviceFingerprint();
    const encKey = deriveKey(fingerprint, data.s);
    const hmacKey = deriveKey(fingerprint + '_hmac', data.s);
    
    // 验证 HMAC
    const hmacData = data.s + CryptoJS.enc.Base64.parse(data.iv).toString() + data.ct;
    const expectedHmac = computeHMAC(hmacData, hmacKey);
    
    if (data.hmac !== expectedHmac) {
      console.error('HMAC verification failed - data may be tampered');
      return '';
    }
    
    // 解密
    const iv = CryptoJS.enc.Base64.parse(data.iv);
    const cipherParams = CryptoJS.lib.CipherParams.create({
      ciphertext: CryptoJS.enc.Base64.parse(data.ct),
    });
    
    const decrypted = CryptoJS.AES.decrypt(cipherParams, encKey, {
      iv: iv,
      mode: CryptoJS.mode.CBC,
      padding: CryptoJS.pad.Pkcs7,
    });
    
    return decrypted.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('V2 decryption failed:', error);
    return '';
  }
}

/**
 * 旧版解密兼容
 */
function decryptLegacy(cipherText: string): string {
  try {
    const fingerprint = getDeviceFingerprint();
    const key = CryptoJS.SHA256(
      fingerprint + '|prd-generator-v1-secure-salt'
    ).toString();
    
    const bytes = CryptoJS.AES.decrypt(cipherText, key);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (error) {
    console.error('Legacy decryption failed:', error);
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
      const decryptedKey = decrypt(encryptedKey);
      // 只有成功解密才加入结果
      if (decryptedKey) {
        decrypted[provider] = decryptedKey;
      }
    }
  }
  return decrypted;
}

/**
 * 检查字符串是否已加密
 * 支持新版和旧版格式
 */
export function isEncrypted(text: string): boolean {
  if (!text) return false;
  // 新版加密格式
  if (text.startsWith(ENCRYPTION_PREFIX)) return true;
  // 旧版 CryptoJS 加密格式
  if (text.startsWith('U2FsdGVkX1')) return true;
  return false;
}
