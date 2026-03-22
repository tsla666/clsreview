import requests
from bs4 import BeautifulSoup
from urllib.parse import urljoin
import time
import argparse

def get_focus_replay_by_date(target_date):
    """根据指定日期获取焦点复盘全文和链接"""
    list_url = "https://www.cls.cn/subject/1135"
    
    # 模拟浏览器的Headers
    headers = {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
        "Accept-Language": "zh-CN,zh;q=0.8,en-US;q=0.5,en;q=0.3",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1"
    }
    
    try:
        # 1. 获取列表页
        response = requests.get(list_url, headers=headers, timeout=30)
        print(f"列表页状态码: {response.status_code}")
        
        if response.status_code != 200:
            print(f"列表页请求失败: {response.status_code}")
            return None, None
        
        # 解析列表页
        soup = BeautifulSoup(response.text, "html.parser")
        
        # 2. 查找所有包含日期的元素
        print(f"\n正在查找包含日期的元素...")
        # 构建日期模式，例如 "2026-03-15"
        date_pattern = target_date
        date_elements = soup.find_all(string=lambda text: text and date_pattern in text)
        print(f"找到{len(date_elements)}个日期元素")
        
        # 3. 查找每个日期元素附近的焦点复盘链接
        for date_element in date_elements:
            date_text = date_element.strip()
            print(f"\n找到日期: {date_text}")
            
            # 查找附近的焦点复盘链接
            # 查找父级元素
            parent = date_element.parent
            while parent:
                # 查找父级中的a标签
                links = parent.find_all('a', string=lambda text: text and "焦点复盘" in text)
                if links:
                    for link in links:
                        target_url = urljoin(list_url, link["href"])
                        print(f"找到链接: {target_url}")
                        
                        # 检查日期是否匹配
                        if target_date in date_text:
                            print(f"找到{target_date}的焦点复盘链接: {target_url}")
                            
                            # 访问详情页获取全文
                            print(f"\n正在访问详情页获取全文...")
                            detail_response = requests.get(target_url, headers=headers, timeout=30)
                            print(f"详情页状态码: {detail_response.status_code}")
                            
                            if detail_response.status_code != 200:
                                print(f"详情页请求失败: {detail_response.status_code}")
                                continue
                            
                            # 解析详情页
                            detail_soup = BeautifulSoup(detail_response.text, "html.parser")
                            
                            # 提取正文内容
                            content = detail_soup.get_text(strip=True)
                            if content:
                                print(f"\n{target_date}财联社焦点复盘全文获取成功")
                                print(f"内容长度: {len(content)}")
                                print(f"焦点复盘链接: {target_url}")
                                return content, target_url
                            else:
                                print("未找到正文内容")
                parent = parent.parent
        
        print(f"未找到{target_date}的焦点复盘链接")
        return None, None
    except Exception as e:
        print(f"爬虫执行出错: {str(e)}")
        return None, None

if __name__ == "__main__":
    # 解析命令行参数
    parser = argparse.ArgumentParser(description='获取财联社焦点复盘全文')
    parser.add_argument('--date', type=str, required=True, help='目标日期，格式：YYYY-MM-DD')
    args = parser.parse_args()
    
    target = args.date
    content, link = get_focus_replay_by_date(target)
    if content and link:
        # 输出内容和链接，用特殊分隔符分开
        print(f"CONTENT_START\n{content}\nCONTENT_END\nLINK_START\n{link}\nLINK_END")
    elif content:
        # 只有内容，没有链接
        print(f"CONTENT_START\n{content}\nCONTENT_END")
    else:
        print("未找到焦点复盘内容")