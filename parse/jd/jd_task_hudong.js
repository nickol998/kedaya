const Template = require('../../template');

class Main extends Template {
    constructor() {
        super()
        this.title = "京东互动整合"
        this.cron = "12 6,20 * * *"
        // this.help = 2
        this.task = 'local'
        this.verify = 1
        this.thread = 3
    }

    async prepare() {
        this.code = [
            "https://prodev.m.jd.com/mall/active/31GFSKyRbD3ehsHih2rQKArxfb8c/index.html",
            "https://prodev.m.jd.com/mall/active/2T8MxyGmn4CQtGJ1asZybjMvakmR/index.html"
        ]
        let custom = this.getValue('custom')
        if (custom.length) {
            this.code = []
            for (let i of custom) {
                this.code.push(i)
            }
        }
        let urls = []
        for (let i of this.code) {
            let url = i.substring(0, 4) == 'http' ? i : `https://prodev.m.jd.com/mall/active/${i}/index.html`
            if (!urls.includes(url)) {
                urls.push(url)
            }
        }
        if (urls.length) {
            for (let url of urls) {
                let html = await this.curl({
                        url,
                        ua: "Mozilla/5.0 (iPhone; CPU iPhone OS 15_1_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.1 Mobile/15E148 Safari/604.1"
                    }
                )
                let encryptProjectId = this.match(/\\"encryptProjectId\\":\\"(\w+)\\"/, html)
                if (encryptProjectId) {
                    let appid = this.match(/appid\s*:\s*"(\w+)"/, html) || 'babelh5'
                    if (encryptProjectId) {
                        this.shareCode.push({encryptProjectId, appid})
                    }
                }
                else if (this.match(/businessh5\/([^\/]+)/, html)) {
                    let js = this.matchAll(/src="(.*?\.js)"/g, html).filter(d => d.includes('app.'))
                    if (js) {
                        let jsContent = await this.curl({
                                'url': `https:${js[0]}`,
                            }
                        )
                        let source = this.match(/ActivitySource\s*:\s*"(\w+)"/, jsContent)
                        let functionId = this.match(/functionId\s*:\s*"(\w+)"/, jsContent)
                        if (source && functionId) {
                            let s = await this.curl({
                                    'url': `https://api.m.jd.com/?appid=ProductZ4Brand&functionId=${functionId}&t=${this.timestamp}&body={"source":"${source}"}`,
                                }
                            )
                            if (this.haskey(s, 'data.result.activityBaseInfo')) {
                                this.shareCode.push({
                                    encryptProjectId: s.data.result.activityBaseInfo.encryptProjectId,
                                    appid: 'ProductZ4Brand',
                                    activityId: s.data.result.activityBaseInfo.activityId
                                })
                            }
                        }
                    }
                }
            }
        }
    }

    async main(p) {
        switch (p.inviter.appid) {
            case "ProductZ4Brand":
                await this.tewuz(p)
                break
            default:
                await this.hudongz(p)
                break
        }
    }

    async hudongz(p) {
        let cookie = p.cookie;
        let encryptProjectId = p.inviter.encryptProjectId
        let appid = p.inviter.appid
        let l = await this.curl({
                'url': `https://api.m.jd.com/client.action?functionId=queryInteractiveInfo`,
                'form': `appid=${appid}&body={"encryptProjectId":"${encryptProjectId}","ext":{"rewardEncryptAssignmentId":null,"needNum":50},"sourceCode":"aceaceqingzhan"}&sign=11&t=1646206781226`,
                cookie
            }
        )
        let lotteryId
        for (let i of this.haskey(l, 'assignmentList')) {
            if (i.completionFlag) {
                console.log(`任务已经完成: ${i.assignmentName}`)
            }
            else {
                let extraType = i.ext.extraType
                if (this.haskey(i, `ext.${i.ext.extraType}`)) {
                    let extra = i.ext[extraType]
                    for (let j of extra) {
                        let s = await this.curl({
                                'url': `https://api.m.jd.com/client.action?functionId=doInteractiveAssignment`,
                                'form': `appid=${appid}&body={"encryptProjectId":"${encryptProjectId}","encryptAssignmentId":"${i.encryptAssignmentId}","itemId":"${j.advId || j.itemId}","sourceCode":"aceaceqingzhan"}&sign=11&t=${this.timestamp}`,
                                cookie
                            }
                        )
                        console.log(i.assignmentName, s.msg)
                    }
                }
                else {
                    if (i.assignmentName == '积分抽奖赢好礼') {
                        lotteryId = i.encryptAssignmentId
                    }
                }
            }
        }
        let gifts = []
        if (lotteryId) {
            for (let i = 0; i<30; i++) {
                let r = await this.curl({
                        'url': `https://api.m.jd.com/client.action?functionId=doInteractiveAssignment`,
                        'form': `appid=${appid}&body={"encryptProjectId":"${encryptProjectId}","encryptAssignmentId":"${lotteryId}","completionFlag":true,"ext":{"exchangeNum":1},"sourceCode":"aceaceqingzhan"}&sign=11&t=1646207845798`,
                        cookie
                    }
                )
                if (!r) {
                    break
                }
                else if (['风险等级未通过', "未登录", '兑换积分不足'].includes(r.msg)) {
                    console.log(r.msg)
                    break
                }
                if (this.haskey(r, 'rewardsInfo.successRewards')) {
                    for (let g in r.rewardsInfo.successRewards) {
                        let data = r.rewardsInfo.successRewards[g]
                        console.log(data)
                        for (let k of data) {
                            gifts.push(k.rewardName)
                        }
                    }
                }
                else {
                    console.log(`什么也没有抽到`)
                }
            }
            if (gifts.length) {
                this.notices(gifts.join("\n"), p.user)
            }
        }
    }

    async tewuz(p) {
        let cookie = p.cookie;
        let list = await this.curl({
                'url': `https://api.m.jd.com/?uuid=&client=wh5&appid=ProductZ4Brand&functionId=superBrandTaskList&t=1649852207375&body={"source":"star_gift","activityId":1010001}`,
                cookie
            }
        )
        let lotteryId
        let gifts = []
        let encryptProjectId = p.inviter.encryptProjectId
        let appid = p.inviter.appid
        for (let i of this.haskey(list, 'data.result.taskList')) {
            if (i.completionFlag) {
                console.log(`任务已经完成: ${i.assignmentName}`)
            }
            else {
                let extraType = i.ext.extraType
                if (this.haskey(i, `ext.${i.ext.extraType}`)) {
                    let extra = i.ext[extraType]
                    for (let j of extra) {
                        let s = await this.curl({
                                url: `https://api.m.jd.com/?uuid=&client=wh5&appid=ProductZ4Brand&functionId=superBrandDoTask&t=${this.timestamp}&body={"source":"star_gift","activityId":${p.inviter.activityId},"encryptProjectId":"${p.inviter.encryptProjectId}","encryptAssignmentId":"${i.encryptAssignmentId}","assignmentType":1,"itemId":"${j.advId || j.itemId}","actionType":1}`,
                                cookie
                            }
                        )
                        if (i.ext.waitDuration) {
                            console.log(`等待: ${i.ext.waitDuration}s`)
                            await this.wait(i.ext.waitDuration * 1000)
                            s = await this.curl({
                                    url: `https://api.m.jd.com/?uuid=&client=wh5&appid=ProductZ4Brand&functionId=superBrandDoTask&t=${this.timestamp}&body={"source":"star_gift","activityId":${p.inviter.activityId},"encryptProjectId":"${p.inviter.encryptProjectId}","encryptAssignmentId":"${i.encryptAssignmentId}","assignmentType":1,"itemId":"${j.advId || j.itemId}","actionType":0}`,
                                    cookie
                                }
                            )
                            console.log(s)
                        }
                        else {
                            console.log(i.assignmentName, this.haskey(s, 'data.bizMsg'))
                        }
                    }
                }
                else {
                    if (i.assignmentName.includes("抽奖")) {
                        lotteryId = i.encryptAssignmentId
                    }
                }
            }
        }
        if (lotteryId) {
            let r = await this.curl({
                    'url': `https://api.m.jd.com/?uuid=&client=wh5&appid=ProductZ4Brand&functionId=superBrandTaskLottery&t=${this.timestamp}&body={"source":"star_gift","activityId":${p.inviter.activityId},"encryptProjectId":"${p.inviter.encryptProjectId}"}`,
                    cookie
                }
            )
            if (this.haskey(r, 'data.result.rewards')) {
                for (let g in r.data.result.rewards) {
                    let data = r.data.result.rewards[g]
                    console.log(data)
                    gifts.push(data.beanNum)
                }
            }
            else {
                console.log(`什么也没有抽到`)
            }
        }
        if (gifts.length) {
            this.notices(gifts.join("\n"), p.user)
        }
    }
}

module.exports = Main;
