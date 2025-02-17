const Template = require('../../template');

class Main extends Template {
    constructor() {
        super()
        this.title = "京东telegram监听"
        // this.cron = "12 0,13 * * *"
        // this.help = 2
        this.task = 'test'
        this.jump = 1
        this.import = ['node-telegram-bot-api', 'jdUrl']
    }

    async prepare() {
        this.locationId = {}
        this.ban = 0
        for (let i of this.getValue('custom')) {
            let k = this.match(/(\w+)\s*=\s*([^\s]+)/, i)
            if (k.length) {
                if (k[1].includes(',')) {
                    this.dict[k[0]] = k[1].split(',').map(d => d.trim())
                }
                else {
                    this.dict[k[0]] = k[1]
                }
            }
        }
        this.assert(this.dict.token, "请先添加机器人TOKEN")
        this.TelegramBot = this.modules['node-telegram-bot-api']
        if (this['QITOQITO_MAP']) {
            let change = {}
            for (let k of this['QITOQITO_MAP'].replace(/\&/g, "\|").split("|")) {
                let a = k.split("=")
                for (let i of a[0].split(',')) {
                    change[i] = {
                        map: a[1],
                        type: a[1].split("_")[0]
                    }
                }
            }
            this.dict.map = change
        }
        let request = {}
        if (this.proxy) {
            if (this.proxy.toLowerCase().includes("socks")) {
                var SocksProxyAgent = require('socks-proxy-agent');
                var agent = new SocksProxyAgent(this.proxy.toLowerCase());
                request.agent = agent
            }
            else {
                request.proxy = this.proxy
            }
        }
        this.bot = new this.TelegramBot(this.dict.token, {
            polling: true, request,
        });
        await this.tg()
    }

    async tg() {
        let isActive = 0
        this.bot.on('text', async (msg) => {
            // console.log(msg)
            let timestamp = parseInt(new Date().getTime() / 1000)
            let chat = msg.chat
            let from = msg.from
            let messageId = msg.message_id
            let chatId = chat.id
            let text = msg.text
            let group = ['group', 'supergroup'].includes(msg.chat.type)
            let id = from.id
            let admin = this.dict.root.includes(id.toString())
            let ban = 0  // 禁言
            let groupTask = 0 // 是否允许群组成员运行
            var reText
            if (this.haskey(msg, 'reply_to_message')) {
                reText = msg.reply_to_message.text
            }
            // 群组禁言设置
            if (group) {
                this.dict[chatId] = this.dict[chatId] || {}
                console.log(this.dict[chatId])
                if (this.dict[chatId].ban && timestamp<this.dict[chatId].ban) {
                    ban = 1
                    console.log(`禁言中: ${this.dict[chatId].ban - timestamp}秒后解封`)
                }
            }
            if (this.match(/^ban \d+$/, text) && admin && group) {
                let banTime = this.match(/\d+/, text)
                console.log(`禁言了,之后的信息不做处理`)
                this.sendMessage(chat.id, `我先去小黑屋${banTime}秒,等我回来`, '', 16666);
                this.dict[chatId].ban = timestamp + parseInt(banTime)
            }
            else if (this.match(/^unban$/, text) && admin && group) {
                let st = this.dict[chatId].ban ? "我从小黑屋回来了哦" : "我没在小黑屋哦"
                this.dict[chatId].ban = 0
                ban = 0
                this.sendMessage(chat.id, st, '', 16666);
            }
            if (!ban) {
                if (this.match(new RegExp(`(^${this.dict.custom.join("|")})`), text) && !this.match(/task\s*\w+/, text)) {
                    let command = this.match(new RegExp(`(^${this.dict.custom.join("|")})`), text)
                    text = `task jd_task_${command} -custom ${reText || text.replace(command, '')}`
                }
                else if (this.match(new RegExp(`(^${this.dict.scripts.join("|")}$)`), text) && !this.match(/task\s*\w+/, text)) {
                    let command = this.match(new RegExp(`(^${this.dict.scripts.join("|")})`), text)
                    text = `task jd_task_${command}`
                }
                else if (this.dict.map && this.match(new RegExp(`(^${Object.keys(this.dict.map).join("|")})`), text) && !this.match(/task\s*\w+/, text)) {
                    let command = this.match(new RegExp(`(^${Object.keys(this.dict.map).join("|")})`), text)
                    text = `task ${this.dict.map[command].map} -custom ${reText || text.replace(command, '')}`
                }
                else if (this.match(/^ini\s*-\w+/, text)) {
                    text = text.replace("ini", 'task jd_task_ini')
                }
                let filename = this.match(/task\s*(\w+)\s*/, text)

                if (filename && admin) {
                    console.log(filename)
                    try {
                        let split = text.split(filename)
                        let params = {}
                        if (split.length == 2) {
                            params = this.query(split[1].replace(/\s*-(\w+)\s+/g, `&$1=`), '&', 1)
                        }
                        if (filename == 'config') {
                            filename = "cp_task_config"
                        }
                        let type = filename.split('_')[0]
                        switch (type) {
                            case "js":
                            case "jx":
                            case "jr":
                            case 'jw':
                                type = 'jd'
                                break
                        }
                        if (type == 'jd') {
                            params.filename = filename
                        }
                        let yaya = require(`${this.dirname}/parse/${type}/${filename}`)
                        let kedaya = new yaya()
                        let echo = `执行命令: ${kedaya.title}\n执行脚本: ${filename}\n执行参数: ${split[1]}`
                        this.sendMessage(chatId, echo, '', 16666)
                        await kedaya.init(params)
                    } catch (e) {
                    }
                }
            }
        })
    }

    async sendMessage(id, echo, params = {}, timeout = 0) {
        if (this.dict.except && this.dict.except.includes(id.toString())) {
            console.log("id在排除名单里面,不发送消息")
            return
        }
        this.bot.sendMessage(id, echo, params || {}).then(async (res) => {
            if (timeout) {
                await this.wait(16666)
                console.log(`删除消息: ${echo}`)
                this.bot.deleteMessage(res.chat.id, res.message_id)
            }
        });
    }
}

module.exports = Main;
