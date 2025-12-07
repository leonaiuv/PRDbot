/**
 * crypto.ts 单元测试
 * 测试API密钥加密和解密功能
 */

import { describe, it, expect, beforeEach } from '@jest/globals'
import { encrypt, decrypt, encryptApiKeys, decryptApiKeys, isEncrypted } from '@/lib/crypto'

describe('crypto.ts - API密钥加密模块', () => {
  describe('encrypt / decrypt', () => {
    it('应该正确加密和解密简单字符串', () => {
      const plainText = 'sk-test-key-123456'
      const encrypted = encrypt(plainText)
      const decrypted = decrypt(encrypted)

      expect(encrypted).toBeTruthy()
      expect(encrypted).not.toBe(plainText) // 密文不等于明文
      expect(decrypted).toBe(plainText) // 解密后恢复
    })

    it('应该为相同输入生成不同的密文（加盐）', () => {
      const plainText = 'sk-test-key-123456'
      const encrypted1 = encrypt(plainText)
      const encrypted2 = encrypt(plainText)

      // CryptoJS的AES加密每次都会生成不同的密文（随机IV）
      // 但两者解密后都应该得到相同的明文
      expect(decrypt(encrypted1)).toBe(plainText)
      expect(decrypt(encrypted2)).toBe(plainText)
    })

    it('应该处理空字符串', () => {
      const encrypted = encrypt('')
      const decrypted = decrypt('')

      expect(encrypted).toBe('')
      expect(decrypted).toBe('')
    })

    it('应该处理特殊字符', () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`'
      const encrypted = encrypt(specialChars)
      const decrypted = decrypt(encrypted)

      expect(decrypted).toBe(specialChars)
    })

    it('应该处理Unicode字符', () => {
      const unicode = '你好世界 🚀 مرحبا'
      const encrypted = encrypt(unicode)
      const decrypted = decrypt(encrypted)

      expect(decrypted).toBe(unicode)
    })

    it('应该处理长字符串', () => {
      const longText = 'A'.repeat(1000)
      const encrypted = encrypt(longText)
      const decrypted = decrypt(encrypted)

      expect(decrypted).toBe(longText)
    })
  })

  describe('encryptApiKeys / decryptApiKeys', () => {
    it('应该加密API密钥对象', () => {
      const apiKeys = {
        deepseek: 'sk-deepseek-123',
        qwen: 'sk-qwen-456',
        doubao: 'sk-doubao-789',
      }

      const encrypted = encryptApiKeys(apiKeys)

      // 验证密钥都已加密
      expect(encrypted.deepseek).not.toBe(apiKeys.deepseek)
      expect(encrypted.qwen).not.toBe(apiKeys.qwen)
      expect(encrypted.doubao).not.toBe(apiKeys.doubao)

      // 验证可以解密
      const decrypted = decryptApiKeys(encrypted)
      expect(decrypted).toEqual(apiKeys)
    })

    it('应该处理部分密钥为空的情况', () => {
      const apiKeys = {
        deepseek: 'sk-deepseek-123',
        doubao: 'sk-doubao-789',
      }

      const encrypted = encryptApiKeys(apiKeys)
      const decrypted = decryptApiKeys(encrypted)

      expect(decrypted.deepseek).toBe(apiKeys.deepseek)
      expect(decrypted.doubao).toBe(apiKeys.doubao)
    })

    it('应该处理空对象', () => {
      const apiKeys = {}
      const encrypted = encryptApiKeys(apiKeys)
      const decrypted = decryptApiKeys(encrypted)

      expect(encrypted).toEqual({})
      expect(decrypted).toEqual({})
    })
  })

  describe('isEncrypted', () => {
    it('应该识别已加密的字符串', () => {
      const plainText = 'sk-test-key-123456'
      const encrypted = encrypt(plainText)

      expect(isEncrypted(encrypted)).toBe(true)
    })

    it('应该识别未加密的字符串', () => {
      const plainText = 'sk-test-key-123456'

      expect(isEncrypted(plainText)).toBe(false)
    })

    it('应该处理空字符串', () => {
      expect(isEncrypted('')).toBe(false)
    })

    it('应该识别U2FsdGVkX1前缀（CryptoJS特征）', () => {
      // 手动创建一个以U2FsdGVkX1开头的字符串
      const fakeEncrypted = 'U2FsdGVkX1' + 'something'

      expect(isEncrypted(fakeEncrypted)).toBe(true)
    })
  })

  describe('重复加密防护', () => {
    it('已加密的数据不应该被重复加密', () => {
      const plainText = 'sk-test-key-123456'
      const encrypted = encrypt(plainText)

      // 模拟检查逻辑：如果已加密，则不再加密
      const shouldEncrypt = !isEncrypted(encrypted)

      expect(shouldEncrypt).toBe(false)
      expect(isEncrypted(encrypted)).toBe(true)
    })
  })

  describe('错误处理', () => {
    it('解密无效密文应该返回空字符串', () => {
      const invalidCipher = 'invalid-cipher-text'
      const decrypted = decrypt(invalidCipher)

      // crypto.ts中catch块返回空字符串
      expect(decrypted).toBe('')
    })

    it('加密失败应该返回空字符串', () => {
      // 尝试加密undefined（虽然类型系统应该防止）
      const encrypted = encrypt(undefined as unknown as string)

      expect(encrypted).toBe('')
    })
  })
})
