/**
 * uuid模块的mock实现
 * 用于测试环境
 */

function generateTestId() {
  return `test-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`
}

module.exports = {
  v4: generateTestId,
}
