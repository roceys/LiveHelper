(function (){
    'use strict'
    $.ajaxSetup({timeout: 10000});
    let $p = function (jqobj) {
        return new Promise(function (resolve, reject) {
            jqobj.promise().then(resolve, reject);
        });
    }
    let getCookie = function (opt) {
        return new Promise(function (resolve, reject) {
            chrome.cookies.getAll(opt, resolve);
        });
    }
    let decodeHTMLEntry = function(s) {
        let r = ''
        try {
         r = $.parseHTML(s)[0].textContent
        } catch (e) {}
        return r
    }
    function siteFactory(id, name, homepage, url, type, data, f, isLogin) {
        return {
            getFollowList: function () {
                //config.read(prefer full)
                if (this.getFullFollowList) {
                    return this.getFullFollowList();
                } else {
                    return this.getDefaultFollowList();
                }
            },
            id: id,
            name: name,
            homepage: homepage,
            getFullFollowList: false,
            getDefaultFollowList: function () {
                return $p($.ajax({
                    //timeout: 5000,
                    url: url,
                    type: type,
                    data: typeof data === 'function' ? data() : data
                }))
                .then(result=>{
                    try {
                        result = f(result);
                        return result;
                    } catch (e) {
                        console.log('In default get follow list'+e)
                        console.error(e.stack)
                        throw(e);
                    }
                });
            }
        }
    }
    var douyu = siteFactory('douyu', '斗鱼', 'https://www.douyu.com',
        'https://www.douyu.com/member/cp/get_follow_list',
        'POST', {}, 
        result => {
            result = JSON.parse(result);
            result = result.room_list;
            result = result.map( (i) => ({
                    id: i.room_id,
                    title: i.room_name,
                    beginTime: i.show_time*1000,
                    nick: i.nickname,
                    online: i.online,
                    img: i.room_src,
                    url: 'https://www.douyu.com' + i.url
                })
            );
            return result;
        }
    );
    var panda = siteFactory('panda', '熊猫', 'https://www.panda.tv',
        'https://www.panda.tv/ajax_get_follow_rooms',
        'GET', {stamp: Math.random()}, 
        result => {
            result = result.data.items.filter( i => i.status == 2);
            result = result.map( (i) => ({
                    id: i.id,
                    title: i.name,
                    beginTime: i.start_time*1000,
                    nick: i.userinfo.nickName,
                    online: i.person_num,
                    img: i.pictures.img,
                    url: 'https://www.panda.tv/room/' + i.id
                })
            );
            return result;
        }
    );
    var zhanqi = siteFactory('zhanqi', '战旗', 'https://www.zhanqi.tv',
        'https://www.zhanqi.tv/api/user/follow.listsbypage?page=1&nums=100',
        'POST', {stamp: Math.random()}, 
        result => {
            result = result.data.list;
            result = result.filter( i => i.status == 4);
            result = result.map( (i) => ({
                    id: i.roomId,
                    title: i.title,
                    beginTime: false, //https://www.zhanqi.tv/api/static/live.roomid/42082.json 
                    nick: i.nickname,
                    online: i.online,
                    img: i.bpic,
                    url: 'https://www.zhanqi.tv' + i.roomUrl
                })
            );
            return result;
        }
    );
    var huya = siteFactory('huya', '虎牙', 'https://www.huya.com',
        'https://www.huya.com/udb_web/checkLogin.php',
        'GET', () => ({stamp: Math.random()}),
        result => {
            result = JSON.parse(result);
            if (!result.isLogined) {
                return Promise.reject('Not Login');
            }
            const uid = result.uid;
            return $.get(`https://fw.huya.com/dispatch?do=subscribeList&uid=${uid}&page=1&pageSize=20&_=${(new Date).getTime()}`).then(result => {
                result = result.result.list;
                result = result.filter( i => i.isLive);
                result = result.map( (i) => ({
                        id: i.profileRoom,
                        title: $('<span>'+i.intro+'</span>').text(),
                        beginTime: i.startTime * 1000,
                        nick: i.nick,
                        online: i.totalCount,
                        img: i.screenshot,
                        url: 'https://www.huya.com/' + i.profileRoom
                    })
                );
                return result;
            })
        }
    );

    var yy = siteFactory('yy', 'YY', 'http://www.yy.com',
        'http://www.yy.com/yyweb/user/queryLivePreview.json',
        'GET', {},
        result => {
            result = result.data.att;
            return result.map(i => ({
                id: i.anchorId,
                title: i.title,
                beginTime: i.liveTime,
                nick: i.anchorInfo.nick,
                online: i.users,
                img: i.anchorInfo.hdLogo,
                url: 'http://www.yy.com' + i.liveUrl
            }));
        }
    )

    var bili = siteFactory('bilibili', '哔哩哔哩', 'https://live.bilibili.com',
        'https://api.live.bilibili.com/feed/v1/feed/getList',
        'GET', {
            page: 1,
            page_size: 100
        }, 
        result => {
            result = result.data.rooms;
            return result.map(i => ({
                id: i.roomid,
                title: i.title,
                beginTime: i.liveTime * 1000,
                nick: i.nickname,
                online: i.online,
                img: i.keyframe,
                url: i.link
            }));
        }
    );
    
    var quanmin = siteFactory('quanmin', '全民', 'https://www.quanmin.tv',
        'https://www.quanmin.tv/api/v1',
        'POST', {m:'user.getfollowlist', p:{page: 0, size: 50}},
        result => {
            // result = JSON.parse(result);
            result = result.data.items;
            result = result.filter(i => i.is_playing);
            result = result.map( i => ({
                    id: i.uid,
                    title: i.title,
                    beginTime: new Date(i.play_at).getTime(),
                    nick: i.nick,
                    online: i.view,
                    img: i.thumb,
                    url: 'https://www.quanmin.tv/v/' + i.uid
            }));
            return result;
        }
    );
    
    let parseHTML = (html, promiseFactory) => {
        let $iframe = $('<iframe></iframe>');
        let dom = $.parseHTML(html, $iframe.document);
        return Promise.resolve()
            .then(() => promiseFactory(dom))
            .then( (list) => {
                $iframe.remove();
                return list;
            }, (e) => {
                console.log('parseHTML err:'+e);
                $iframe.remove();
            });
    };
    
    var niconico = siteFactory('niconico', 'ニコニコ', 'http://live.nicovideo.jp',
        'http://live.nicovideo.jp/my',
        'GET', {},
        html => {
            let getInfoFromItem = (item) => {
                let re = /watch\/([^?]+).*$/;
                item = $(item);
                let url = item.children('a').attr('href');
                if (!re.test(url)) {
                    return;
                }
                let roomid = re.exec(url)[1];
                let startTime = item.find('p[class="start_time"]').text();
                startTime = startTime.replace(/(開始)|(Starts:)/, '').trim();
                startTime = new Date(startTime);
                startTime.setYear((new Date).getFullYear());
                return {
                    id: roomid,
                    title: item.children('a').attr('title'),
                    beginTime: startTime.getTime(),
                    nick: item.find('p:not([class])').attr('title'),
                    online: false,
                    img: item.find('img').attr('src'),
                    url: url
                };
            };
            return parseHTML(html, (dom) => new Promise(function (resolve, reject) {
                let itemArray = $.makeArray($(dom).find('#Favorite_list .liveItem_ch'));
                itemArray = itemArray.map(getInfoFromItem);
                resolve(itemArray.filter(i => i));
            }))
        }
    );
    
    var twitch = siteFactory('twitch', 'twitch', 'https://www.twitch.tv',
        'https://api.twitch.tv/api/viewer/info.json',
        'GET', {on_site: 1},
        result => {}
    );
    twitch.getDefaultFollowList = function () {
        const clientID = 'jzkbprff40iqj646a697cyrvl0zt2m6'
        let getOAuthToken = () => getCookie({url: 'https://www.twitch.tv', name: 'api_token'})
            .then(apiToken => {
                if (apiToken.length == 0) {
                    throw 'twitch api token not found';
                }
                apiToken = apiToken[0].value;
                // console.log('api token '+apiToken);
                let settings = {
                    type: 'GET',
                    url: 'https://api.twitch.tv/api/me',
                    headers: {
                        'X-CSRF-Token': 'null', //TODO
                        'Client-ID': clientID,
                        'Twitch-Api-Token': apiToken
                    }
                };
                return settings;
            })
            .then(settings => $p($.ajax(settings)))
            .then(json => {
                if (!json.hasOwnProperty('chat_oauth_token')) {
                    reject('no oauth token.');
                    return;
                }
                //console.log('oauth token: '+json.chat_oauth_token);
                return json.chat_oauth_token;
            });
        
        let getFollowedStreamJSON = oauthToken => $p($.ajax(
            {
                type: 'GET',
                url: 'https://api.twitch.tv/kraken/streams/followed?limit=24&offset=0&stream_type=live',
                headers: {
                    'Client-ID': clientID,
                    'Authorization': 'OAuth '+oauthToken
                }
            }
        ));
        return getOAuthToken()
            .then(getFollowedStreamJSON)
            .then(result => {
                result = result.streams;
                //console.log(result)
                return result.map(i => ({
                    id: i.channel._id,
                    title: i.channel.status,
                    beginTime: new Date(i.created_at).getTime(),
                    nick: i.channel.display_name,
                    online: i.viewers,
                    img: i.preview.medium,
                    url: i.channel.url
                }));
            })
    };
  
  var huomao = siteFactory('huomao', '火猫', 'https://www.huomao.com',
        'https://www.huomao.com/subscribe/getUsersSubscribe',
        'GET', {},
        result => {
            result = result.data.usersSubChannels;
            result = result.filter(i => i.is_live == '1');
            result = result.map(i => ({
                id: i.id,
                title: i.channel,
                beginTime: false,
                nick: i.username,
                online: i.views,
                img: i.image,
                url: 'https://www.huomao.com/' + i.room_number
            }))
            return result;
        }
    );
    
    var longzhu = siteFactory('longzhu', '龙珠', 'http://longzhu.com/',
        'http://userapi.plu.cn/subinfo/mysubscribe',
        'GET', {stamp: Math.random(), pageIndex: 0, pageSize: 10},
        result => {
            result = result.items;
            result = result.filter(i => i.feed);
            result = result.map(i => ({
                id: i.room.roomId,
                title: i.feed.title,
                beginTime: new Date(i.feed.time).getTime(),
                nick: i.room.name,
                online: false,
                img: 'http://img.plures.net/live/screenshots/'+i.room.roomId+'/0.jpg',
                url: 'http://star.longzhu.com'+i.feed.url
            }));
            return result;
        });

    var necc = siteFactory('necc', '网易CC', 'http://cc.163.com/',
        'http://cc.163.com/user/follow/?format=json&page=1&size=20',
        'GET', {},
        result => {
            result = result.follow_list;
			//网易CC在浏览器冷启动后的第一次后台调用中由于跳转速度较慢，因此会出现获取到的result为跳转页面，出现过滤错误为正常现象
			result = result.filter(i => i.is_live == '1');
            result = result.map(i => ({
                id: i.ccid,
                title: i.gamename,
                beginTime: false,
                nick: i.nickname,
                online: i.webcc_visitor,
                img: i.purl,
                url: `http://cc.163.com/${i.ccid}`,
                forceRatio: true
            }))
            return result
        });
    var egameqq = siteFactory('egameqq', '企鹅电竞', 'https://egame.qq.com/',
        'https://egame.qq.com/followlist',
        'GET', {},
        html => {
            const getOnline = (text) => {
                let ret = /([0-9\.]+?)(万)?人气/.exec(text)
                if (ret) {
                    let online = parseFloat(ret[1])
                    if (ret[2] === '万') {
                        online *= 10000
                    }
                    return online
                }
                return 0
            }
            return parseHTML(html, (dom) => new Promise(function (resolve, reject) {
                let itemArray = $.makeArray($(dom).find('#online-container .gui-list-unit'));
                itemArray = itemArray.map(item => {
                    item = $(item)
                    let id = item.attr('data-anchor')
                    return {
                        id: id,
                        title: item.find('.glc-info > h4').text(),
                        beginTime: false,
                        nick: item.find('.glc-info > p > span:last').text(),
                        online: getOnline(item.find('.glc-number').text()),
                        img: item.find('.glc-img > img').attr('src'),
                        url: 'https://egame.qq.com/live?anchorid=' + id
                    }
                });
                resolve(itemArray.filter(i => i));
            }))
        })
    
    douyu.getFullFollowList = () => {
        let getInfoFromItem = function (item) {
            item = $(item);
            if (item.find('i.icon_live').length == 0)
                return null;
            let beginTime = item.find('span.glyphicon01_playtime').text().trim();
            let timeRE = /(\d+)分钟/;
            if (!timeRE.test(beginTime)) {
                beginTime = false;
            } else {
                beginTime = parseInt(timeRE.exec(beginTime)[1]);
                beginTime = (new Date).getTime() - beginTime * 1000 * 60;
            }
            
            let roomid = item.find('div>div>a').attr('href').replace('/', '');
            return {
                id: roomid,
                title: item.find('h1').text().trim(),
                beginTime: beginTime,
                nick: item.find('span.username').text().trim(),
                online: parseInt(item.find('span.glyphicon01_hot').text().trim()),
                img: item.find('img').data('original'),
                url: 'https://www.douyu.com/' + roomid
            };
        };
        return $p($.get('https://www.douyu.com/room/follow'))
            .then(text => parseHTML(text, dom => {
                let followedList = $(dom).find('.attention > ul');
                if (followedList.length == 0) {
                    throw new Error('douyu not login');
                    return;
                }
                let itemArray = $.makeArray(followedList.children());
                itemArray = itemArray.map(getInfoFromItem);
                return itemArray.filter(i => i);
            }));
    };
    
    window.fetchers = [douyu, panda, zhanqi, huya, bili, quanmin, niconico, twitch, huomao, longzhu, necc, egameqq, yy];
    window.enabledFetchers = () => {
        var list = fetchers.filter( (i) => config.enabled[i.id] );
        function moveToTop (list, id) {
            var idx = false;
            for (var i=0; i<list.length; i++) {
                if (list[i].id == id) {
                    idx = i;
                    break;
                }
            }
            if (idx != false) {
                list.unshift(list.splice(idx, 1)[0]);
            }
        }
        try {
            var idList = JSON.parse(localStorage.idList);
            idList.reverse().forEach(function (id) {
                moveToTop(list, id);
            });
        } catch(e) {}
        return list;
    };
})();