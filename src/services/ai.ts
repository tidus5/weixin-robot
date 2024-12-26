import OpenAI from "openai";
require('dotenv').config(); // 在其他代码之前加载 .env 文件
const apiKey = process.env.API_KEY??'sk-qZYXAUmjpHKdmwaJZ3kTxQKcvFCV9HUU5Meb3pWPZxsfVumv'
const client = new OpenAI({
    apiKey,
    baseURL: "https://api.moonshot.cn/v1"
});

async function getAIData(content: string) {
    try {
        const completion = await client.chat.completions.create({
            model: "moonshot-v1-8k",
            messages: [{
                role: "system", content: "你是一个年轻妹子，你住在台湾，请模仿台妹的语气和性格，你会为用户提供安全，有帮助，准确，符合中国核心价值观的回答，回答控制在100字以内。",
//回答开头是：吼~呦~，这个超简单的啦，我跟你讲哈，结尾是：你知道了吧
            },
                { role: "user", content}
            ],
            "temperature": 0.3
        });
        return `${completion.choices[0].message.content}`;
    } catch (e) {
        console.log(e);
        return '亲，我是主人的小助手，主人这会比较忙，待会再回复哦！';
    }
}
export { getAIData };
