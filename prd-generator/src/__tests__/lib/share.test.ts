import { generateShareLink, parseShareData, decryptContent, isShareExpired, isContentShareable } from '@/lib/share';

describe('Share Library', () => {
  describe('generateShareLink', () => {
    it('should generate a valid share link without password', () => {
      const link = generateShareLink('Test Title', 'Test Content');
      expect(link).toContain('/share?d=');
    });

    it('should generate a share link with password protection', () => {
      const link = generateShareLink('Test Title', 'Test Content', {
        password: 'secret123',
      });
      expect(link).toContain('/share?d=');
    });

    it('should generate a share link with expiration', () => {
      const link = generateShareLink('Test Title', 'Test Content', {
        expiresIn: 24, // 24 hours
      });
      expect(link).toContain('/share?d=');
    });

    it('should generate a share link with both password and expiration', () => {
      const link = generateShareLink('Test Title', 'Test Content', {
        password: 'secret123',
        expiresIn: 48,
      });
      expect(link).toContain('/share?d=');
    });
  });

  describe('parseShareData', () => {
    it('should parse data from a generated share link', () => {
      const link = generateShareLink('Test Title', 'Test Content');
      const compressedData = link.split('?d=')[1];
      const data = parseShareData(compressedData);
      
      expect(data).not.toBeNull();
      expect(data?.title).toBe('Test Title');
      expect(data?.content).toBe('Test Content');
      expect(data?.isEncrypted).toBe(false);
    });

    it('should return null for invalid compressed data', () => {
      const data = parseShareData('invalid-data');
      expect(data).toBeNull();
    });

    it('should return null for empty data', () => {
      const data = parseShareData('');
      expect(data).toBeNull();
    });

    it('should reject tampered data', () => {
      const link = generateShareLink('Test Title', 'Test Content');
      const compressedData = link.split('?d=')[1];
      
      // Tamper with the data by modifying a character
      const tamperedData = compressedData.slice(0, -5) + 'XXXXX';
      const data = parseShareData(tamperedData);
      
      // Should either return null or fail signature verification
      // (depending on whether decompression succeeds)
      if (data !== null) {
        // If decompression succeeded but data is v2, signature should fail
        expect(data).toBeNull();
      }
    });
  });

  describe('decryptContent', () => {
    it('should decrypt content encrypted with correct password', () => {
      const originalContent = 'Secret PRD Content';
      const password = 'mypassword';
      
      const link = generateShareLink('Test', originalContent, { password });
      const compressedData = link.split('?d=')[1];
      const data = parseShareData(compressedData);
      
      expect(data).not.toBeNull();
      expect(data?.isEncrypted).toBe(true);
      
      const decrypted = decryptContent(data!.content, password);
      expect(decrypted).toBe(originalContent);
    });

    it('should return null for wrong password', () => {
      const link = generateShareLink('Test', 'Secret Content', { password: 'correct' });
      const compressedData = link.split('?d=')[1];
      const data = parseShareData(compressedData);
      
      const decrypted = decryptContent(data!.content, 'wrong');
      expect(decrypted).toBeNull();
    });

    it('should return null for empty encrypted content', () => {
      const decrypted = decryptContent('', 'password');
      expect(decrypted).toBeNull();
    });
  });

  describe('isShareExpired', () => {
    it('should return false when no expiration is set', () => {
      const data = {
        title: 'Test',
        content: 'Content',
        createdAt: Date.now(),
      };
      expect(isShareExpired(data)).toBe(false);
    });

    it('should return false when not expired', () => {
      const data = {
        title: 'Test',
        content: 'Content',
        createdAt: Date.now(),
        expiresAt: Date.now() + 3600000, // 1 hour from now
      };
      expect(isShareExpired(data)).toBe(false);
    });

    it('should return true when expired', () => {
      const data = {
        title: 'Test',
        content: 'Content',
        createdAt: Date.now() - 7200000, // 2 hours ago
        expiresAt: Date.now() - 3600000, // 1 hour ago
      };
      expect(isShareExpired(data)).toBe(true);
    });
  });

  describe('isContentShareable', () => {
    it('should return shareable for small content', () => {
      const result = isContentShareable('Small content');
      expect(result.shareable).toBe(true);
      expect(result.size).toBeLessThan(result.maxSize);
    });

    it('should handle large content gracefully', () => {
      const largeContent = 'X'.repeat(100000); // 100KB
      const result = isContentShareable(largeContent);
      // Just check the function doesn't throw
      expect(typeof result.shareable).toBe('boolean');
      expect(typeof result.compressionRatio).toBe('number');
    });

    it('should calculate compression ratio', () => {
      const content = 'This is repeated content. '.repeat(100);
      const result = isContentShareable(content);
      expect(result.compressionRatio).toBeGreaterThan(1); // Should compress
    });
  });

  describe('Edge Cases', () => {
    it('should handle unicode content', () => {
      const unicodeContent = '这是中文内容 🚀 \u{1F4BB}';
      const link = generateShareLink('Unicode Test', unicodeContent);
      const compressedData = link.split('?d=')[1];
      const data = parseShareData(compressedData);
      
      expect(data?.content).toBe(unicodeContent);
    });

    it('should handle special characters in password', () => {
      const content = 'Test content';
      const password = 'p@$$w0rd!#$%^&*()';
      
      const link = generateShareLink('Test', content, { password });
      const compressedData = link.split('?d=')[1];
      const data = parseShareData(compressedData);
      
      const decrypted = decryptContent(data!.content, password);
      expect(decrypted).toBe(content);
    });

    it('should handle very long title', () => {
      const longTitle = 'A'.repeat(1000);
      const link = generateShareLink(longTitle, 'Content');
      const compressedData = link.split('?d=')[1];
      const data = parseShareData(compressedData);
      
      expect(data?.title).toBe(longTitle);
    });
  });
});
