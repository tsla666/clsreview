const axios = require('axios');
const { execSync } = require('child_process');
const schedule = require('node-schedule');
const fs = require('fs');
const path = require('path');

/**
 * 判断日期是否为交易日
 * @param {Date} date - 日期对象
 * @returns {boolean} - 是否为交易日
 */
function isTradingDay(date) {
  // 获取星期几（0-6，0是星期日）
  const dayOfWeek = date.getDay();
  // 周末不是交易日
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }
  // 这里可以添加节假日判断逻辑
  // 暂时简单判断，实际应用中需要更完整的节假日数据
  return true;
}

/**
 * 获取最近一个交易日的日期
 * @param {Date} date - 当前日期
 * @returns {Date} - 最近一个交易日的日期
 */
function getLastTradingDay(date) {
  const checkDate = new Date(date);
  // 向前查找最近的交易日
  while (!isTradingDay(checkDate)) {
    checkDate.setDate(checkDate.getDate() - 1);
  }
  return checkDate;
}

/**
 * 使用爬虫获取财联社焦点复盘全文和链接
 * @param {Date} targetDate - 目标日期
 * @returns {Object} - 包含全文和链接的对象
 */
function getFocusReplayFullText(targetDate) {
  try {
    // 格式化日期为YYYY-MM-DD格式
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;
    
    console.log(`正在使用爬虫获取${dateStr}的财联社焦点复盘全文...`);
    
    // 调用Python爬虫脚本
    const pythonScript = path.join(__dirname, 'spider.py');
    const result = execSync(`python3 "${pythonScript}" --date "${dateStr}"`, { encoding: 'utf8', timeout: 60000 });
    
    // 解析爬虫结果
    const output = result.trim();
    
    // 检查输出是否包含错误信息
    if (output === "未找到焦点复盘内容" || output.includes("爬虫执行出错") || output.includes("请求失败")) {
      console.log('爬虫获取全文失败，返回null');
      return { content: null, link: null };
    }
    
    // 解析内容和链接
    let content = null;
    let link = null;
    
    const contentStartIndex = output.indexOf('CONTENT_START');
    const contentEndIndex = output.indexOf('CONTENT_END');
    if (contentStartIndex !== -1 && contentEndIndex !== -1) {
      content = output.substring(contentStartIndex + 13, contentEndIndex).trim();
    }
    
    const linkStartIndex = output.indexOf('LINK_START');
    const linkEndIndex = output.indexOf('LINK_END');
    if (linkStartIndex !== -1 && linkEndIndex !== -1) {
      link = output.substring(linkStartIndex + 10, linkEndIndex).trim();
    }
    
    console.log('爬虫获取全文成功');
    console.log('爬虫返回内容长度:', content ? content.length : 0);
    console.log('爬虫返回链接:', link);
    return { content, link };
  } catch (error) {
    console.error('爬虫获取全文失败:', error.message);
    return { content: null, link: null };
  }
}

/**
 * 获取财联社焦点复盘内容并分析总结
 */
async function getClsFocusReplay() {
  try {
    console.log('正在获取财联社焦点复盘内容...');
    
    // 验证API密钥是否设置
    if (!process.env.DEEPSEEK_API_KEY) {
      console.error('错误: DEEPSEEK_API_KEY 环境变量未设置');
      throw new Error('DEEPSEEK_API_KEY 环境变量未设置');
    }
    
    // 获取当前日期
    const today = new Date();
    // 确定要搜索的日期（最近一个交易日）
    const targetDate = isTradingDay(today) ? today : getLastTradingDay(today);
    
    // 格式化日期
    const year = targetDate.getFullYear();
    const month = String(targetDate.getMonth() + 1).padStart(2, '0');
    const day = String(targetDate.getDate()).padStart(2, '0');
    const dateStr = `${year}年${month}月${day}日`;
    const dateFormat = `${year}-${month}-${day}`;
    
    console.log(`获取${dateStr}的财联社焦点复盘内容`);
    
    // 1. 使用爬虫获取全文和链接
    const { content: fullText, link: focusReplayLink } = getFocusReplayFullText(targetDate);
    
    if (!fullText) {
      console.log('爬虫获取全文失败，跳过分析');
      throw new Error('爬虫获取全文失败');
    }
    
    console.log('获取到焦点复盘内容，开始分析总结...');
    console.log('原文长度:', fullText.length);
    
    // 对爬虫获取的内容进行预处理，确保在模型的token限制范围内
    let processedText = fullText;
    if (fullText.length > 3000) {
      console.log('原文长度超过3000字符，进行预处理...');
      // 保留核心内容，去除可能的重复或无关信息
      processedText = fullText.substring(0, 3000);
      console.log('预处理后原文长度:', processedText.length);
    }
    
    // 2. 使用大模型分析总结
    // 优化prompt结构，减少不必要的内容，确保在token限制范围内
    const summaryPrompt = `请根据以下财联社焦点复盘原文，按照要求进行分析总结：\n\n原文：\n${processedText}\n\n输出要求：\n1. 格式：5个章节（市场概览、主线板块、支线板块、情绪指标监测、原文关键信息摘录）\n2. 核心逻辑2-3句话\n3. 使用表情符号和・符号列表\n4. 禁止预测和建议\n5. 禁止简写字段名\n6. 使用简洁的Markdown格式\n\n详细格式：\n一、x月x日核心要点\n【焦点复盘】（后接上标题内容）\n- 大盘与成交：总结三大指数涨跌幅、涨跌家数比、两市成交额及环比增减百分比\n- 主线切换：对比昨日领涨板块，描述资金流向风格转变\n\n二、领涨板块及背后逻辑\n按强度排序列出3-5个核心板块，每个板块包含：\n- 板块名称及涨幅区间\n- 3-5个核心标的（使用・符号列表）\n- 核心逻辑：结合全球科技映射、政策催化、高频数据进行分析\n\n三、领跌板块及逻辑\n简述表现最差的1-2个板块及其回调原因\n\n四、短线情绪周期判定\n- 情绪指标：涨停家数、跌停家数、封板率、连板高度\n- 周期定位：当前处于哪个阶段\n- 综合结论：用一句话总结当前市场由谁主导\n\n五、原文关键信息摘录\n列出3-5条原文中的关键数据和信息\n\n写作风格：\n- 使用专业术语（如G.652.D光纤、HDI板、HBM封装、算力映射、高低切换等）\n- 数据支撑（引用百分比、成交额、量比等数据）\n- 视觉清晰：\n  ・**完全避免使用星号**，不要使用加粗格式\n  ・使用简单的Markdown格式，只使用列表和必要的标题\n  ・保持格式简洁，提高可读性\n  ・不要使用过多的层级和嵌套\n  ・使用自然的文本格式，避免过度格式化`;
    
    console.log('正在调用DeepSeek大模型进行分析总结...');
    console.log('Prompt长度:', summaryPrompt.length);
    
    // 优化API调用参数
    const response = await axios.post(
      process.env.DEEPSEEK_BASE_URL || 'https://api.deepseek.com/v1/chat/completions',
      {
        model: process.env.DEEPSEEK_MODEL || 'deepseek-chat',
        messages: [
          {
            role: 'system',
            content: '你是一个专业的金融市场分析师，能够根据财联社焦点复盘原文进行深度分析和总结，按照指定格式输出专业的市场分析报告。'
          },
          {
            role: 'user',
            content: summaryPrompt
          }
        ],
        temperature: 0.5, // 降低温度以获得更稳定的结果
        max_tokens: 3000, // 增加最大token数，确保有足够空间输出分析结果
        top_p: 0.9, // 添加top_p参数
        frequency_penalty: 0, // 添加频率惩罚
        presence_penalty: 0 // 添加存在惩罚
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.DEEPSEEK_API_KEY}`
        },
        timeout: 120000 // 增加超时时间到120秒
      }
    );
    
    let summaryContent = response.data.choices[0].message.content;
    
    // 在原文关键信息摘录部分的最后添加当天焦点复盘的链接
    if (focusReplayLink) {
      summaryContent += `\n\n当天焦点复盘的链接：${focusReplayLink}`;
    }
    
    console.log('分析总结成功');
    console.log('总结内容:', summaryContent);
    return { content: summaryContent, dateStr: dateStr };
  } catch (error) {
    console.error('调用大模型分析总结失败:', error.message);
    throw error;
  }
}

/**
 * 发送消息到飞书群（支持多个机器人）
 * @param {string} content - 消息内容
 * @param {string} dateStr - 日期字符串
 */
async function sendToFeishu(content, dateStr) {
  try {
    console.log('正在发送消息到飞书群...');
    
    const message = {
      msg_type: 'post',
      content: {
        post: {
          zh_cn: {
            title: `${dateStr}财联社焦点复盘分析`,
            content: [
              [
                {
                  tag: 'text',
                  text: content
                }
              ]
            ]
          }
        }
      }
    };
    
    // 遍历所有飞书机器人webhook地址
    const webhooks = (process.env.FEISHU_WEBHOOKS || '').split(',').filter(Boolean);
    const results = [];
    
    for (const webhook of webhooks) {
      try {
        console.log(`正在发送到飞书机器人: ${webhook.substring(0, 50)}...`);
        const response = await axios.post(webhook, message);
        console.log('发送到飞书群成功:', response.data);
        results.push({ success: true, data: response.data });
      } catch (error) {
        console.error(`发送到飞书群失败 (${webhook.substring(0, 50)}...):`, error.message);
        results.push({ success: false, error: error.message });
      }
    }
    
    return results;
  } catch (error) {
    console.error('发送到飞书群失败:', error.message);
    throw error;
  }
}

/**
 * 主函数 - 财联社焦点复盘分析
 */
async function main() {
  try {
    // 1. 获取财联社焦点复盘内容
    const result = await getClsFocusReplay();
    const clsContent = result.content;
    const dateStr = result.dateStr;
    console.log('获取财联社焦点复盘内容成功');
    
    // 2. 发送到飞书群
    await sendToFeishu(clsContent, dateStr);
    console.log('系统运行完成');
  } catch (error) {
    console.error('系统运行失败:', error.message);
  }
}

/**
 * 早上推送函数 - Stan决策辅助
 */
async function sendMorningMessage() {
  try {
    console.log('正在发送早上推送消息...');
    
    // 获取当天日期
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateStr = `${year}年${month}月${day}日`;
    
    // 生成早上推送内容 - 只包含Stan决策辅助原文
    const morningContent = `Stan 决策辅助：每日"三个终极自问"\n\n在完成 Catfish 所有复盘分析后，必须强制通过这三个关卡，否则不准执行计划：\n\n1. 【反身性校验】\n"如果分析出的'受力逻辑'（如国产替代、能级跃迁）是正确的，为什么目前的'价格行为'表现得像个输家？"\n\n应用： 如果模型评分很高但股价连跌三天。\nStan 决策： 承认模型可能"领先"于市场，但身体要先撤出。不要用金钱去赌模型比市场更聪明。\n\n2. 【零基仓位压测】\n"假设我今天没有任何持仓（空仓），面对现在的价格和消息，我会一次性买入目前这么重的仓位吗？"\n\n应用： 针对你的持仓科技股。\nStan 决策： 如果答案是"不会，我可能只敢买 2 成试探"，那么你多出来的 5 成就是**"非计划性头寸"**，必须在明早 9:30 立刻抹掉\n\n3. 【资本守卫熔断】\n"我现在持有的仓位，是否正在损耗我下一次'扣动重仓扳机'的本金和心态？"\n应用： 评估你的焦虑感。\nStan 决策： 如果目前的波动让你无法冷静思考、开始报复性加仓，说明你已经失去了"职业猎人"的身份。减仓到你不再焦虑为止，哪怕逻辑依然看好。`;
    
    // 发送到飞书群
    await sendToFeishu(morningContent, dateStr);
    console.log('早上推送消息发送成功');
  } catch (error) {
    console.error('早上推送消息发送失败:', error.message);
  }
}

// 设置定时任务
function setupSchedule() {
  console.log('正在设置定时任务...');
  
  // 每天下午6点15分执行财联社焦点复盘分析
  const job1 = schedule.scheduleJob('15 18 * * *', async function() {
    console.log('定时任务触发，开始执行财联社焦点复盘分析...');
    await main();
  });
  console.log('定时任务1设置成功，将在每天下午6:15执行');
  console.log('下次执行时间:', job1.nextInvocation());
  
  // 每天早上7点执行Stan决策辅助推送
  const job2 = schedule.scheduleJob('0 7 * * *', async function() {
    console.log('定时任务触发，开始发送Stan决策辅助消息...');
    await sendMorningMessage();
  });
  console.log('定时任务2设置成功，将在每天早上7:00执行');
  console.log('下次执行时间:', job2.nextInvocation());
}

// 运行主函数
main();

// 设置定时任务
setupSchedule();
