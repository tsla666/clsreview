// 系统配置
module.exports = {
  // 飞书机器人webhook地址（支持多个）
  feishuWebhooks: [
    'https://open.feishu.cn/open-apis/bot/v2/hook/814479c4-4f0e-4de0-9877-ebe11feb6e5e',
    'https://open.feishu.cn/open-apis/bot/v2/hook/5d6b277c-c505-4d67-a44b-aa3410a00858'
  ],
  
  
  
  // DeepSeek 大模型配置
  deepseek: {
    apiKey: process.env.DEEPSEEK_API_KEY || 'sk-f98bacda2b444bb2adda5d27b35343b4',
    model: 'deepseek-reasoner',
    baseUrl: 'https://api.deepseek.com/v1/chat/completions'
  },
  
  // 财联社焦点复盘配置
  cls: {
    focusReplayUrl: 'https://www.cls.cn/api/sw?swkey=2b1e0c16637f1c76f8c0d2b0b7f8b5c9'
  }
};