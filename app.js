/**
 * --------------------------------------------------------
 * Module dependencies.
 * --------------------------------------------------------
 */

var express = require('express') // フレームワーク(cakePHP 的な感じ)
  , stylus  = require('stylus')  // CSSフレームワーク
  , ejs     = require('ejs')     // テンプレートエンジン
  , nib     = require('nib')     // coffeescript ライブラリ？よく分からん
  , sio     = require('socket.io') // WebSockets realtime
//  , redis     = require('redis') // redis
//  , RedisStore = require('connect-redis')(express)
  , log4js  = require('log4js')    // ロギング
  , util    = require('util')      // デバッグ等に便利な
  , nodehttp = require('http')      // http
  , OAuth    = require('oauth').OAuth  // twitter投稿などに使用する
  , crypto   = require('crypto')       // 暗号化関連
  , fs       = require('fs')           // ファイル操作
  , nodeurl  = require('url')          // URL操作
  , nodepath = require('path')        // ファイルのパス操作
  , emailjs  = require('emailjs/email') // メール操作
  , exec     = require('child_process').exec // シェルコマンドを叩く為に必要
  , formidable = require('formidable') // ファイルアップロード
  , everyauth  = require('everyauth')  // 認証
  , httpProxy  = require('http-proxy') // プロキシサーバー
  , conf       = require('./conf')     // 認証等の設定情報
  , check  = require('validator').check // validator
  , sanitize   = require('validator').sanitize // sanitize
  , async      = require('async') // フロー制御(同期処理させたい場合に)
  ;

// ----------------------------------------------
// 定数設定
// ----------------------------------------------
var FLG_SUPPORTER_COMP_STAT = 1; // 完了/サクセスしたもの
var FLG_SUPPORTER_WANT_STAT = 2; // 現在開催中のもの
var FLG_SUPPORTER_FAIL_STAT = 3; // 失敗/挫折したもの
var DOMEIN = "http://syaberi-house.com"; //ドメイン



// ----------------------------------------------
// oauth関連初期設定
// ----------------------------------------------
oa_obj = new OAuth('https://twitter.com/oauth/request_token'
  , 'https://twitter.com/oauth/access_token'
  , conf.twit.consumerKey
  , conf.twit.consumerSecret
  , '1.0A', '/oauth/callback', 'HMAC-SHA1'
);


function get_md5_hex(src) {
    var md5 = crypto.createHash('md5');
    md5.update(src, 'utf8');
    return md5.digest('hex');
}



// ----------------------------------------------
// emailjs関連初期設定
// ----------------------------------------------
var email_server  = emailjs.server.connect({
   user: conf.gmail.user
 , password: conf.gmail.password
 , host:    'smtp.gmail.com'
 , ssl:     true
});

function __sendEmail(text_msg, conf, mailto, subject) {

	  email_server.send(
	    {  text: text_msg
	     , from: conf.gmail.from
	     , to:   mailto
	     , subject: subject
	    },
	    function(err, message) {
	      if (err) {
	        logger.error(err);
	      }
	      if (message) {
	        logger.info(message)
	      }
	    }
	  );

}


// ----------------------------------------------
// ロギング関連初期設定
// ----------------------------------------------
//log4js.addAppender(log4js.consoleAppender());
// 2MB でローテーションする設定
var rotate_size = 2000000;
log4js.addAppender(log4js.fileAppender('logs/node-chat.log'), '[sys]', rotate_size);
var logger = log4js.getLogger('[sys]');
//logger.debug('Got cheese.');
//logger.info('test logger');
//logger.fatal('Cheese was breeding ground for listeria.');
//logger.warn('Cheese is quite smelly.');
//logger.error('Cheese is too ripe!');

// ----------------------------------------------
// mysql 関連初期設定
// ----------------------------------------------
var client = require('mysql').createClient({
  host: conf.mysql.host,
  user: conf.mysql.user,
  password: conf.mysql.password,
  database: conf.mysql.database
});

// データベースのテーブル名を設定
var TABLE_AUDIENCES = 'audiences'
  , TABLE_HOUSES    = 'houses'
  , TABLE_USERS     = 'users'
  , TABLE_CATEGORIES = 'categories'
  , TABLE_RULES      = 'rules'
  , TABLE_COMMENTS   = 'comments'
  , TABLE_OFFCOMMENTS = 'offcomments'
  , TABLE_STREAM_LOGS = 'stream_logs'
  , TABLE_COMMENT_STREAMS = 'comment_streams'
  , TABLE_DECLARATIONS    = 'declarations'
  , TABLE_DECLARATIONS_CH    = 'declarations_ch'
  , TABLE_SUPPORTERS      = 'supporters'
  , TABLE_DOT1_COMMENTS   = 'dot1_comments'
  , TABLE_USER_OSHIRASE_CONTENTS = 'user_oshirase_contents'
  , TABLE_USER_OSHIRASE_RELATION = 'user_oshirase_relation'
  ;


// ----------------------------------------------
// ユーティリティ 関連初期設定
// ----------------------------------------------
function changeArray2Text(array_data) {
  var res_text = array_data.join(',');
  return res_text;
}

function changeText2Array(text_data) {
  var res_array = text_data.split(',');
  return res_array;
}

function __isAuthLogin(req) {
  if (!req.session || !req.session.auth) {
    // ログインしていない
//      logger.debug('---------- req.session1: ------------- ');logger.debug(req);
//      logger.debug('---------- req.session.auth1: ------------- ');logger.debug(req.auth);
    return false;
  } else {
	if(!req.session.auth.user_id){
//		logger.debug('---------- req.session2: ------------- ');logger.debug(req);
//		logger.debug('---------- req.session.auth2: ------------- ');logger.debug(req.session.auth);
	    	return false;
    	} else {
//		logger.debug('---------- req.session3: ------------- ');logger.debug(req);
//		logger.debug('---------- req.session.auth3: ------------- ');logger.debug(req.session.auth);
	    	return true;
  	}
   }
}

// CSRF対策用キー発行
function __getOnetimeToken(user_id) {
  if (user_id) {
    var seed_key = conf.csrf.onetimeKey + user_id;
    var onetime_token = get_md5_hex(seed_key);
    return onetime_token;
  } else {
    return '';
  }

}

// CSRF対策用キーチェック
function __checkOnetimeToken(user_data, server_data) {
  if (user_data && server_data) {
    if (user_data == server_data) {
      return true;
    }
  }

  return false;
}


// sleep
function __sleep(time) {
  var d1 = new Date().getTime();
  var d2 = new Date().getTime();
  while (d2 < d1 + time) {
    d2 = new Date().getTime();
  }
  return;
}



// ----------------------------------------------
// 認証関連初期設定
// ----------------------------------------------
everyauth.debug = true; // デバッグするかどうか？
// 認証関連の初期設定
var usersById = {}
  , nextUserId = 0
  , usersByFbId = {}
  , usersByTwitId = {}
  ;

// 認証時にDB やsession にユーザーを追加する処理
function oauthAddUser (service, accessToken, accessSecret, sourceUser) {
  var user
    , tmp_user_id;

  // non-password-based
  user = usersById[++nextUserId] = {id: nextUserId};
  user[service] = sourceUser;

  // パラメータチェック
  var name = sourceUser.screen_name
    , sex  = 1
    , age  = 1
    , visible = 1
    , image   = sourceUser.profile_image_url
    , description = sourceUser.description
    , url         = sourceUser.url
    , oauth_service_id = sourceUser.id
    ;
  name = (name) ? name : '';
  sex  = (sex)  ? sex  : 1;
  age  = (age)  ? age  : 1;
  visible = (visible) ? visible : 1;
  image   = (image)   ? image   : '';
  description = (description) ? description : '';
  url         = (url)         ? url         : '';
  oauth_service_id = (oauth_service_id) ? oauth_service_id : '';

  // DB に値があるかチェック
  client.query(
    'SELECT id FROM '+TABLE_USERS+
    ' WHERE oauth_service_id = ? AND oauth_service = ?',
    [oauth_service_id, service],
    function(err, results, fields) {
      if (err) {throw err;}
      //logger.debug('----- oauth-sql:results ');logger.debug(results);
      if (!results[0]) {
        //logger.debug('----- oauth-sql-mode:insert ');
        // DB に無し。INSERT
        client.query(
          'INSERT INTO '+TABLE_USERS+
          ' SET created_at = NOW(), name = ?, oauth_id = ?,'+
          ' oauth_secret_id = ?, oauth_service = ?, oauth_service_id = ?,'+
          ' sex = ?, age = ?, visible = ?,'+
          ' image = ?, description = ?, url = ?',
          [name, accessToken, accessSecret, service, oauth_service_id,
           sex, age, visible, image, description, url
          ],
          function(err) {
            if (err) {throw err;}
          }
        );
      } else {
        //logger.debug('----- oauth-sql-mode:update ');
        // DB に有り。UPDATE
        client.query(
          'UPDATE '+TABLE_USERS+
          ' SET name = ?, image = ?, description = ?, url = ?'+
          ' WHERE oauth_service_id = ? AND oauth_service = ?',
          [name, image, description, url, oauth_service_id, service],
          function(err) {
            if (err) {throw err;}
          }
        );
      }
    }
  );



  // session にuser_id を保存。他ページでも使用する為
  //client.query(
  //  'SELECT id FROM '+TABLE_USERS+' WHERE name = ? AND oauth_service = ?',
  //  [name, service],
  //  function(err, results) {
  //    if (err) {throw err;}
  //    if (results[0]) {
  //      user.user_id = results[0].id;
  //    }
  //    logger.debug('----- users_db_id: ');logger.debug(user);
  //    return user;
  //  }
  //);

  return user;
}

// 認証されてるユーザー検索処理
everyauth.everymodule
  .findUserById( function (id, callback) {
    callback(null, usersById[id]);
  });


// ログアウト時の処理を上書きする場合
//everyauth.everymodule
//  .handleLogout( function (req, res) {
//    // Put you extra logic here
//
//    // The logout method is added for you by everyauth, too
//    req.logout();
//
//    // And/or put your extra logic here
//
//    res.writeHead(303, { 'Location': this.logoutRedirectPath() });
//    res.end();
//});


/**
 * --------------------------------------------------------
 * Facebook OAuth
 * --------------------------------------------------------
 */
everyauth
  .facebook
    .appId(conf.fb.appId)
    .appSecret(conf.fb.appSecret)
    .findOrCreateUser( function (session, accessToken, accessExtra, fbUser) {
      return usersByFbId[fbUser.id] ||
        (usersByFbId[fbUser.id] = oauthAddUser('facebook', accessToken, accessExtra, fbUser));
    })
    .redirectPath('/');


/**
 * --------------------------------------------------------
 * Twitter OAuth
 * --------------------------------------------------------
 */
everyauth
  .twitter
    .consumerKey(conf.twit.consumerKey) // Twitterのアプリ登録で得られるconsumer kye.
    .consumerSecret(conf.twit.consumerSecret) // 〃 consumer secret.
    .findOrCreateUser( function (sess, accessToken, accessSecret, twitUser) {
      // 認証が成功した場合の処理
      // sess はreq.session と同じ。
      // なのでここにデータを追加すると他ページでも参照出来る仕組み


      //logger.debug('---------- twitterSession: ------------- ');logger.debug(sess);
      //logger.debug('---------- twitterSessionAuth: --------- ');logger.debug(sess.auth.twitter);
      //logger.debug('---------- twitterAccessToken: --------- ');logger.debug(accessToken);
      //logger.debug('---------- twitterUserData: ------------ ');logger.debug(twitUser);

      // セッションにログイン状態を格納
      sess.auth.oauth_service_id = twitUser.id; // twitter が管理しているユニークなID
      sess.auth.user_name = twitUser.screen_name;
      sess.auth.user_image = twitUser.profile_image_url;
      sess.auth.accessToken = accessToken;
      sess.auth.accessSecret = accessSecret;
      sess.auth.service = 'twitter';

      //if (!usersByTwitId[twitUser.id]) {
      //  usersByTwitId[twitUser.id] = oauthAddUser('twitter', accessToken, accessSecret, twitUser);
      //}

      //logger.debug('---------- usersByTwit ');logger.debug(usersByTwitId[twitUser.id]);
      return usersByTwitId[twitUser.id] ||
        (usersByTwitId[twitUser.id] = oauthAddUser('twitter', accessToken, accessSecret, twitUser));
    })
    .redirectPath('/auth/complete');

/**
 * --------------------------------------------------------
 * http proxy Server
 * --------------------------------------------------------
 */
var proxy_options = {
  router: {
    'http.syaberi-house.com': '127.0.0.1:8080' // apache
   //,'www.syaberi-house.com': '127.0.0.1:8081' // node.js
   ,'syaberi-house.com': '127.0.0.1:8081' // node.js
   //,'rank-life.com': '127.0.0.1:8081' // node.js
   //,'sh.syaberi-house.com': '127.0.0.1:8082' // node.js
  }
};
var httpProxyServer = httpProxy.createServer(
  proxy_options
//  , function (req, res, next) {
//      // リクエストヘッダから認証情報を取得する
//      var authHeader = req.headers['authorization'] || '';
//      // エンコードされている認証トークンを取得する
//      var token = authHeader.split(/\s+/).pop() || '';
//      // トークンをbase64デコードする
//      var auth = new Buffer(token, 'base64').toString();
//
//      // デコードした文字列を「:」で分割して、ユーザ名とパスワードを取得する
//      var parts = auth.split(/:/);
//      var username = parts[0];
//      var password = parts[1];
//
//console.log(username);
//      // ユーザ名とパスワードが一致しない場合は、401を返却する
//      if (conf.basicAuth.user !== username || conf.basicAuth.password !== password) {
//          res.writeHead(401, {
//              'www-Authenticate': 'Basic realm="Authentication required"'
//          });
//          res.end();
//      }
//      next();
//    }
);
//httpProxyServer.listen(80);
//httpProxyServer.listen(8125);


/**
 * --------------------------------------------------------
 * App Create Server
 * --------------------------------------------------------
 */
var app = express.createServer();

/**
 * --------------------------------------------------------
 * App configuration.
 * --------------------------------------------------------
 */

app.configure(function () {
  app.use(express.static(__dirname + '/public')); // 静的ファイルパス

  // basic認証
//  app.use(express.basicAuth(conf.basicAuth.user, conf.basicAuth.password));

  app.use(express.cookieParser()); // クッキー操作
  app.use(express.session({ secret: 'team0110'})); // ,store: new RedisStore(),cookie: {maxAge: 86400 * 1000}
  app.use(express.bodyParser()); // POSTメソッド操作
//  app.use(app.router); // app.get の優先順位を決めれる
  app.use(everyauth.middleware()); // 認証ミドルウェア
  app.set('view options', { layout: false })
  app.set('views', __dirname+'/views'); // テンプレートパス
  app.set('view engine', 'ejs'); // テンプレートエンジンの指定

});

// develop only.
app.configure('development', function(){
  logger.info('development mode');
  app.use(express.errorHandler({ dumpExceptions: true, showStack: true }));

});

// product only.
app.configure('production', function(){
  logger.info('production mode');
  app.use(express.errorHandler());
});



/**
 * --------------------------------------------------------
 * App routes.
 * --------------------------------------------------------
 */

// IPアドレス制限
//app.get('*', function(req, res, next) {
//
//  var remote_ip = req.headers["x-forwarded-for"];
//
//  if (remote_ip.match(/^202\.229\.44\.[0-9]+$/) // nttr_ip
//      || remote_ip.match(/^202\.217\.72\.[0-9]+$/) // nttr_ip_tamachi
//      || remote_ip.match(/^110\.74\.103\.[0-9]+$/) // saito_ip
//      || remote_ip.match(/^222\.158\.[0-9]+\.[0-9]+$/) // saito_ip
//      || remote_ip.match(/^106\.190\.[0-9]+\.[0-9]+$/) // kmura_ip
//      || remote_ip.match(/^114\.179\.73\.50$/) // aruku.inc
//      || remote_ip.match(/^64\.39\.96\.[0-9]+$/) // QualysGuard
//      || remote_ip.match(/^62\.210\.136\.[0-9]+$/) // QualysGuard
//      || remote_ip.match(/^167\.216\.252\.[0-9]+$/) // QualysGuard
//    ) {
//    // 通過
//  } else {
//    // 拒否
//    res.send('Sorry, access deny', 403);
//    return;
//  }
//
////  // リクエストヘッダから認証情報を取得する
////  var authHeader = req.headers['authorization'] || '';
////  // エンコードされている認証トークンを取得する
////  var token = authHeader.split(/\s+/).pop() || '';
////  // トークンをbase64デコードする
////  var auth = new Buffer(token, 'base64').toString();
////
////  // デコードした文字列を「:」で分割して、ユーザ名とパスワードを取得する
////  var parts = auth.split(/:/);
////  var username = parts[0];
////  var password = parts[1];
////
////  // ユーザ名とパスワードが一致しない場合は、401を返却する
////  console.log(req.params);
////  if (conf.basicAuth.user !== username || conf.basicAuth.password !== password) {
////      res.writeHead(401, {
////          'www-Authenticate': 'Basic realm="Authentication required"'
////      });
////      res.end();
////  }
//
//  next();
//});

// ----------------------------------------------
// auth 認証が完了したら来る処理
// ----------------------------------------------
app.get('/auth/complete', function(req, res) {


  if (req.session && req.session.auth) {
    // OK
  } else {
    // NG
    res.redirect('/');
    return;
  }

  // user_id, メルアド情報を取得(あれば)
  client.query(
    'SELECT id, mail_addr'+
    ' FROM '+TABLE_USERS+
    ' WHERE oauth_service_id = ? AND oauth_service = ?',
    [req.session.auth.oauth_service_id, req.session.auth.service],
    function(err, results) {
      if (err) {throw err;}
      if (results[0]) {
        req.session.auth.user_id = results[0].id;

        if (results[0].mail_addr) {
          req.session.auth.mail_addr = results[0].mail_addr;
        } else {
          // メルアドを登録するフォームへ
          res.redirect('/firstset');
          return;
        }
      }

      //if (req.headers.referer) {
      //  res.redirect(req.headers.referer);
      //} else {
      //res.redirect('/mypage');
        res.redirect('/');
      //}
      return;

    }
  );

});






// ----------------------------------------------
// トップページ
// ----------------------------------------------
app.get('/', function (req, res) {
	logger.info('app.get: /');

	//ログインフラグ
	var is_auth_login = true; if (!__isAuthLogin(req)) { is_auth_login = false; }else{ res.redirect('/mypage');return; }


	var onetime_token = '';
	if (req.session && req.session.auth) {
		onetime_token = __getOnetimeToken(req.session.auth.user_id);
	}
	client.query(
		'SELECT d.id, d.created_at, d.title, d.detail, d.user_id'+
		'  , d.target_num, d.deadline, d.status, d.image'+
		'  , COUNT( spt.declaration_id ) AS supporter_num'+
		'  , (COUNT(spt.declaration_id) / d.target_num) * 100 AS ratio'+
		'  , u.name AS user_name, u.image AS user_image'+
		' FROM '+TABLE_DECLARATIONS+' AS d'+
		' LEFT JOIN '+TABLE_SUPPORTERS+' AS spt ON d.id = spt.declaration_id'+
		' LEFT JOIN '+TABLE_USERS+' AS u ON d.user_id = u.id'+
		' WHERE d.status = ?'+
		' GROUP BY d.id'+
		' ORDER BY d.created_at DESC'+
		' LIMIT 10',
		[FLG_SUPPORTER_WANT_STAT],
		function(err, results, fields) {
			if (err) {throw err;}
			if (results.length === 0) {
				res.render('index', {
					'title': ''
					, 'dec_list': []
					, 'onetime_token': onetime_token 
					, 'is_auth_login': is_auth_login
			});
			return;
		}
		else
		{
			var dec_list = [];
//			var max_dec_num = results.length;
//			for (var i = 0; i < max_dec_num; i++) {	//live
//				dec_list[i] = results[i];
//				if(house.manager.rooms['/dec/' + results[i].id]){
//					dec_list[i].live = true;
//				}else{
//					dec_list[i].live = false;
//				}
				var max_dec_num = results.length;
				// 条件を連結する
				var room_live_queryValue = '';
				for( var mm = 0; mm < max_dec_num; mm++ )
				{
					if( mm + 1 == max_dec_num )
					{
						// 最終処理
						room_live_queryValue += results[mm].id;
					}
					else
					{
						room_live_queryValue += results[mm].id + ',';
					}
				}
				if( room_live_queryValue == '' )
				{
					room_live_queryValue = '\'\'';
				}

				// 部屋をそれぞれ取得する(コミュニティのIDつき)
				client.query(
					'SELECT d.id AS dec_id, chat.*'+
					' FROM '+TABLE_DECLARATIONS+' AS d'+
					' LEFT JOIN '+TABLE_DECLARATIONS_CH+' AS chat ON d.id = chat.dec_relation_id'+
					' WHERE chat.status = 2 AND d.id IN ('+room_live_queryValue+') ORDER BY d.created_at DESC',
					function(room_err, room_results) {
						if (room_err) {throw room_err;}
						if (room_results.length === 0)
						{
							// コミュニティに関連付くチャットが無いのでライブ処理は行わない
						}
						else
						{
							for(var i = 0; i < max_dec_num; i++)
							{
								dec_list[i] = results[i];
								// 部屋の数だけ回す
								for(var j = 0; j < room_results.length; j++)
								{
									if( room_results[j].dec_id == results[i].id )
									{
										// ここの判定処理を考える
										console.log( j + ":" + house.manager.rooms['/houses/' + room_results[j].id] );
										// idが一致したら、ライブ判定をする
										if(house.manager.rooms['/houses/' + room_results[j].id] != undefined )
										{
											dec_list[i].live = true;
											break;
										}
										else
										{
											dec_list[i].live = false;
										}
									}
								}
							}
			res.render('index',{'locals':
				{'title': 'SHABERI-HOUSE index'
					, 'dec_list': dec_list
					, 'onetime_token': onetime_token
					, 'is_auth_login': is_auth_login
				}
			});
			return;
						}
				});
			}
		});
});






// ----------------------------------------------
// (about)
// ----------------------------------------------
app.get('/about', function (req, res) {

    client.query(
      'SELECT d.id, d.created_at, d.title, d.user_id'+
      '  , d.target_num, d.deadline, d.status, d.image'+
      '  , COUNT( spt.declaration_id ) AS supporter_num'+
      '  , (COUNT(spt.declaration_id) / d.target_num) * 100 AS ratio'+
      ' FROM '+TABLE_DECLARATIONS+' AS d'+
      ' LEFT JOIN '+TABLE_SUPPORTERS+' AS spt ON d.id = spt.declaration_id'+
      ' WHERE status = ?'+
      ' GROUP BY d.id'+
      ' ORDER BY d.created_at DESC'+
      ' LIMIT 10',
      [FLG_SUPPORTER_WANT_STAT],
      function(err, results, fields) {
        if (err) {throw err;}
        if (results.length == 0) {
          res.send('declaration error: no result');
          return;
        } else {

          res.render('about', {
              'declaration_list': results
            , 'meta_title': 'シャベリハウスについて｜'
           //,'user_name': req.session.auth.user_name
           //,'user_image': req.session.auth.user_image
           //,'user_id': req.session.auth.user_id
          });
          return;

        }
      }
    );

});



app.get('/terms', function (req, res) {
	
	//ログインフラグ
	var is_auth_login = true; if (!__isAuthLogin(req)) { is_auth_login = false; }

  res.render('terms', {
    'meta_title': '利用規約｜',
    'is_auth_login': is_auth_login
  });
  return;
});



// ----------------------------------------------
// (facebook oauth)
// ----------------------------------------------

app.get('/oauth/facebook', function (req, res) {
  res.render('facebook', {
    'meta_title': 'facebook｜'
  });
  return;
});


/**
 * --------------------------------------------------------
 * POST: facebook oauth 作成
 * --------------------------------------------------------
 */
app.post('/oauth/facebook-login', function (req, res) {

  var me_id = req.body.me_id
    , me_email = req.body.me_email
    , me_name = req.body.me_name
    , me_image = req.body.me_image
    , me_bio = req.body.me_bio
    , me_sex = req.body.me_sex
    , friend_list = req.body.friend_list
    , accessToken = req.body.accessToken
    , oauth_service_name = 'facebook'
    , mail_chk = ''
    ;

    me_id = (me_id) ? me_id : '';
    me_email = (me_email) ? me_email : '';
    me_name = (me_name) ? me_name : '';
    me_image = (me_image) ? me_image : '';
    me_bio = (me_bio) ? me_bio : '';
    me_sex = (me_sex) ? me_sex : 0;
    friend_list = (friend_list) ? friend_list : '';

  //logger.debug(req.body.me_name);

  // DB に値があるかチェック
  client.query(
    'SELECT id FROM '+TABLE_USERS+
    ' WHERE oauth_service_id = ? AND oauth_service = ?',
    [me_id,oauth_service_name],
    function(err, results, fields) {
      if (err) {throw err;}
      //logger.debug('----- oauth-sql:results ');
      if (!results[0]) {
        //logger.debug('----- oauth-sql-mode:insert ');
        // DB に無し。INSERT
        client.query(
          'INSERT INTO '+TABLE_USERS+' ('+
          ' created_at, name, oauth_service, oauth_service_id,'+
          ' sex, image, description, friend_list'+
          ') VALUES ( NOW() , ? , ? , ? , ? , ? , ? , ? )',
          [me_name, oauth_service_name, me_id, me_sex, me_image, me_bio, friend_list],
          function(err,res) {
             if (err) {throw err;}
          }
        );
      } else {
        //logger.debug('----- oauth-sql-mode:update ');
	//logger.debug(results);
        //logger.info(req.body.friend_list);
	// DB に有り。UPDATE
        client.query(
          'UPDATE '+TABLE_USERS+
          ' SET updated_at = NOW(), name = ?, image = ?, description = ?, friend_list = ?'+
	  ' WHERE oauth_service_id = ? AND oauth_service = ?',
	  [me_name,me_image,me_bio,friend_list,me_id,oauth_service_name],
          function(err) {
            if (err) {throw err;}
          }
        );
      }

	// セッションの配列を確認
	if(req.session && req.session.auth){
		//sessionのチェック
	} else {
		req.session.auth = {};
		//authの生成
	}
	
	// セッションにログイン状態を格納
	req.session.auth.oauth_service_id = me_id; // facebook が管理しているユニークなID
	req.session.auth.user_name = me_name;
	req.session.auth.user_image = me_image;
	req.session.auth.accessToken = accessToken;
	req.session.auth.service = 'facebook';


	  // user_id, メルアド情報を取得(あれば)
	  client.query(
	    'SELECT id, mail_addr FROM '+TABLE_USERS+' WHERE oauth_service_id = ? AND oauth_service = ?',
	    [me_id,oauth_service_name],
	    function(err, results, fields) {

	      if (err) {throw err;}
	      if (results[0]) {
		//logger.debug("user_id=="+results[0].id);
	        req.session.auth.user_id = results[0].id;

	        if (results[0].mail_addr) {
		//logger.debug("mail=="+results[0].mail_addr);
	          req.session.auth.mail_addr = results[0].mail_addr;
	          mail_chk = "1";
		} else {
	          // メルアドを登録するフォームへ
	          //res.redirect('/firstset');
	          //return;
	          mail_chk = '0'
	        }
	      }

		res.render('facebook-login', {
		'me_email': me_email,'mail_flag': mail_chk
		});
		return;

	   }
	);

    }
  );


});

/**
 * --------------------------------------------------------
 * GET: facebook 友達取得
 * --------------------------------------------------------
 */
app.get('/facebook-get-friends', function (req, res) {

  // ログインしてるかどうか？
  if (!__isAuthLogin(req)) {
    // ログインしていない
		//logger.debug("false1");
    res.json({login_flg: false}, 200);
  } else {
    client.query(
      'SELECT id, friend_list FROM '+TABLE_USERS+' WHERE id = ? AND oauth_service = "facebook"',
      [req.session.auth.user_id],
         function(err, results, fields) {
		//logger.debug("userid=="+req.session.auth.user_id);
		//logger.debug("res=="+results[0]);
	      if (err) {throw err;}
	      if (results[0]) {
		//logger.debug(results[0].friend_list);
		res.json(results[0].friend_list, 200);

	      } else {
		//logger.debug("false2");
	        res.json({login_flg: false}, 200);
	        return;
	      }
         }
     );
  }
  return;
});

// ----------------------------------------------
// sessionを渡す
// ----------------------------------------------

app.get('/get-session', function (req, res) {

  // ログインしてるかどうか？
  if (!__isAuthLogin(req)) {
    // ログインしていない
//    logger.debug("false1");
    res.json({login_flg: false}, 200);
  } else {
    //logger.info('get-session');
    //logger.debug(req.session.auth);
    if(req.session.auth.service == "facebook"){
       res.json(req.session.auth, 200);
    } else {
	//logger.debug('---------- flag1 ------');
	//logger.debug(req.session);
       res.json({
		service : 'twitter',
		user_name : req.session.auth.user_name,
		oauth_service_id : req.session.auth.oauth_service_id,
		accessToken  :'',
	}, 200);
    }
  }
  return;
});


// ----------------------------------------------
// 一覧(declaration)
// ----------------------------------------------
app.get('/dec', function (req, res) {
  logger.info('app.get: /dec');
  //logger.info('---------- req.session: ----- ');logger.info(req.session);
  //res.render('home', { layout: false });

  //if (req.session && req.session.auth) {
    // 最新の宣言リストを取得
    client.query(
      'SELECT d.id, d.created_at, d.title, d.user_id'+
      '  , d.target_num, d.deadline, d.status, d.image'+
      '  , COUNT( spt.declaration_id ) AS supporter_num'+
      '  , (COUNT(spt.declaration_id) / d.target_num) * 100 AS ratio'+
      '  , u.name AS user_name, u.image AS user_image'+
      ' FROM '+TABLE_DECLARATIONS+' AS d'+
      ' LEFT JOIN '+TABLE_SUPPORTERS+' AS spt ON d.id = spt.declaration_id'+
      ' LEFT JOIN '+TABLE_USERS+' AS u ON d.user_id = u.id'+
      ' WHERE d.status = ?'+
      //' WHERE d.status = ? AND d.created_at > NOW()'+
      ' GROUP BY d.id'+
      ' ORDER BY d.created_at DESC'+
      ' LIMIT 10',
      [FLG_SUPPORTER_WANT_STAT],
      function(err, results, fields) {
        if (err) {throw err;}
        if (results.length == 0) {
          res.render('dec-list', {
              'dec_list': []
            , 'meta_title': 'チャット部屋一覧｜' 
          });
          return;
        } else {

          res.render('dec-list', {
              'dec_list': results
            , 'meta_title': 'チャット部屋一覧｜'
           //,'user_name': req.session.auth.user_name
           //,'user_image': req.session.auth.user_image
           //,'user_id': req.session.auth.user_id
          });
          return;

        }
      }
    );


  //} else {
  //  res.render('index', { 'layout': false});
  //  return;
  //}


});


// ----------------------------------------------
// サクセス一覧(success)
// ----------------------------------------------
app.get('/suc', function (req, res) {
  logger.info('app.get: /suc');
  //logger.info('---------- req.session: ----- ');logger.info(req.session);
  //res.render('home', { layout: false });


	//ログインフラグ
	var is_auth_login = true ; if (!__isAuthLogin(req)) { is_auth_login = false; }


  //if (req.session && req.session.auth) {
    // 最新の宣言リストを取得
    client.query(
      'SELECT d.id, d.created_at, d.title, d.user_id'+
      '  , d.target_num, d.deadline, d.status, d.image'+
      '  , COUNT( spt.declaration_id ) AS supporter_num'+
      '  , (COUNT(spt.declaration_id) / d.target_num) * 100 AS ratio'+
      ' FROM '+TABLE_DECLARATIONS_CH+' AS d'+
      ' INNER JOIN '+TABLE_SUPPORTERS+' AS spt ON d.id = spt.declaration_id'+
      ' WHERE status = ?'+
      ' GROUP BY d.id'+
      ' ORDER BY d.created_at DESC'+
      ' LIMIT 10',
      [FLG_SUPPORTER_COMP_STAT],
      function(err, results, fields) {
        if (err) {throw err;}
        if (results.length == 0) {
          res.render('suc-list', {
              'suc_list': []
            , 'meta_title': 'まとめログ一覧｜'
	    , 'is_auth_login': is_auth_login
          });
          return;
        } else {

          res.render('suc-list', {
              'suc_list': results
            , 'meta_title': 'まとめログ一覧｜'
	    , 'is_auth_login': is_auth_login
           //,'user_name': req.session.auth.user_name
           //,'user_image': req.session.auth.user_image
           //,'user_id': req.session.auth.user_id
          });
          return;

        }
      }
    );


  //} else {
  //  res.render('index', { 'layout': false});
  //  return;
  //}


});

// ----------------------------------------------
// ログ詳細
// ----------------------------------------------
app.get('/suc/:id', function (req, res) {

	//ログインフラグ
	var is_auth_login = true; if (!__isAuthLogin(req)) { is_auth_login = false; };
  // ID が正しいかチェックする
  var suc_id = (req.params.id) ? req.params.id : '';

  // 正しいかDB に確認
  client.query(
    'SELECT d.id, d.created_at, d.title, d.detail, d.user_id'+
    '  , d.target_num, d.deadline, d.status, d.image'+
    '  , COUNT( s.declaration_id ) AS supporter_num'+
    '  , (COUNT(s.declaration_id) / d.target_num) *100 AS ratio'+
    '  , u.name AS user_name, u.image AS user_image'+
    ' FROM '+TABLE_DECLARATIONS_CH+' AS d'+
    ' LEFT JOIN '+TABLE_SUPPORTERS+' AS s ON d.id = s.declaration_id'+
    ' LEFT JOIN '+TABLE_USERS+' AS u ON d.user_id = u.id'+
    ' WHERE d.id = ?'+
    ' GROUP BY d.id'+
    ' LIMIT 1',
    [suc_id],
    function(err, dec_results, fields) {
      if (err) {throw err;}
      if (dec_results.length === 0) {
        res.send('suc_id error: no result'+' このURLのブログページは削除されました');
        return;
      } else {
        var detail_txt = dec_results[0].detail;
        detail_txt = detail_txt.replace(/\n/g, '<br />');
        dec_results[0].detail = detail_txt;

          // 最新のコメント50件分を取得
		  client.query(
		    //'SELECT cmt.id, cmt.created_at, cmt.body, cmt.image AS cmt_image, usr.name, usr.image AS usr_image'
		    //+' FROM '+TABLE_COMMENTS+' AS cmt'
		    //+' LEFT JOIN '+TABLE_USERS+' AS usr ON cmt.user_id=usr.id'
		    //+' WHERE cmt.house_id = ?'
		    //+' ORDER BY cmt.created_at DESC LIMIT 10',
		    'SELECT id, created_at, user_name, body, image'
            +'    , ext_image_path, ext_image_domain, profile_image_url'
		    +'    , type'
		    +' FROM '+TABLE_DOT1_COMMENTS
		    +' WHERE dec_id = ?'
		    +' ORDER BY created_at DESC',
		    [suc_id],
		    function(err, results, fields) {
		      if (err) {throw err;}
		      if (!results[0]) {
		        // DB に無し。
                res.render('suc-detail', {
                    'suc_detail': dec_results[0]
                  , 'send_data' : []
                  , 'meta_title': dec_results[0].title+'｜'
		  , 'is_auth_login': is_auth_login
                });
                return;

		      } else {
		        // DB に有り。
		        var max_result = results.length
		          , send_data = [];
		        //logger.debug('最新のコメント10件-----');logger.debug(results);
		        for (var i = 0; i < max_result; i++) {
		          var tmp_data = results[i];
		          // データを溜め込んでいく
		          send_data[i] = {'id': tmp_data.id, 'comment_id': tmp_data.tweet_id_str,
		            'message_time': tmp_data.created_at, 'userMessage': tmp_data.body,
		            //'message_time': date_txt, 'userMessage': tmp_data.body,
		            'image_src': tmp_data.image, 'userName': tmp_data.user_name,
                    'ext_image_path': tmp_data.ext_image_path, 'ext_image_domain': tmp_data.ext_image_domain,
		            'user_image': tmp_data.profile_image_url, 'iframeURL': '',
		            'source': tmp_data.source, 'type': tmp_data.type
		          };
		
                  // 部屋終了日時
                  if (i == 0) {
                    dec_results[0].end_date = tmp_data.created_at;
                  }

                  // 部屋開始日時
                  if (i == (max_result - 1)) {
                    dec_results[0].start_date = tmp_data.created_at;
                  }

		        }
		
		        // クライアント(自分だけ)へデータを送る
                res.render('suc-detail', {
				'suc_detail': dec_results[0],
				'send_data' : send_data, 
				'meta_title': dec_results[0].title+'｜',
				'is_auth_login': is_auth_login
		        });
		        return;

		      }
		     }
		   );
      }
    }
  );

});

// --------------------------------------------------------
// regist_dec(登録)
// --------------------------------------------------------
//app.get('/regist-dec', function (req, res) {
//
//  if (!__isAuthLogin(req)) {
//    // ログインしていないので、リダイレクト
//    res.redirect('/');
//    return;
//  }
//
//  // パラメータが正しいかDB に聞いてみる
//  client.query(
//    'SELECT id, name, sex, age, mail_addr FROM '+TABLE_USERS+' WHERE id = ?',
//    [req.session.auth.user_id],
//    function(err, results, fields) {
//      if (err) {throw err;}
//      if (results.length === 0) {
//        res.send('user_id error: no result');
//        return;
//      } else {
//        res.render('regist-dec', {
//          'user_data': results
//        });
//        return;
//      }
//    }
//  );
//});

// --------------------------------------------------------
// firstset
// --------------------------------------------------------
app.get('/firstset', function (req, res) {





	//ログインフラグ
	var is_auth_login = true;

	if (!__isAuthLogin(req)) {
		// ログインしていないので、リダイレクト
		res.redirect('/');
		is_auth_login = false;
		return;
	}


  logger.debug('----- app.session: ');logger.info(req.session);

  // onetime_token 取得
  var onetime_token = __getOnetimeToken(req.session.auth.user_id);

  // パラメータが正しいかDB に聞いてみる
  client.query(
    'SELECT id, name, sex, age, mail_addr FROM '+TABLE_USERS+' WHERE id = ?',
    [req.session.auth.user_id],
    function(err, results, fields) {
      if (err) {throw err;}
      if (results.length === 0) {
        res.send('user_id error: no result');
        return;
      } else {
        res.render('firstset', {
            'user_data': results
          , 'onetime_token': onetime_token
          , 'meta_title': '新規登録｜'
,'is_auth_login': is_auth_login
        });
        return;
      }
    }
  );
});



// --------------------------------------------------------
// mypage
// --------------------------------------------------------
app.get('/mypage', function (req, res) {


	//ログインフラグ
	var is_auth_login = true;

	if (!__isAuthLogin(req)) {
		// ログインしていないので、リダイレクト
		res.redirect('/');
		is_auth_login = false;
		return;
	}

  // onetime_token 取得
  var onetime_token = __getOnetimeToken(req.session.auth.user_id);

  var dec_list_owner = [];
  var user_results = [];
  var fr_sup_list =[];
  var spt_comp_list = []; // 完了
  var spt_want_list = []; // 募集中
  var spt_fail_list = []; // 挫折

  // 自分が宣言しているリストを取得
  client.query(

  	  'SELECT d.id AS id, sup.id AS sup_id, sup.declaration_id AS sup_dec_id, sup.user_id AS sup_user_id, d.created_at, d.title, d.user_id ' +
  	  ' ,COUNT( spt.declaration_id ) AS supporter_num ' +
  	  ' ,d.target_num, d.deadline, d.status, d.image ' +
  	  ' ,u.name AS user_name, u.image AS user_image ' +
  	  ' FROM ' +TABLE_SUPPORTERS+' AS sup ' +
  	  ' LEFT JOIN ' +TABLE_DECLARATIONS + ' AS d ON sup.declaration_id = d.id ' +
  	  ' LEFT JOIN ' +TABLE_SUPPORTERS+ ' AS spt ON d.id = spt.declaration_id ' +
  	  ' LEFT JOIN ' +TABLE_USERS+ ' AS u ON d.user_id = u.id ' +
	' WHERE sup.user_id = ?'+
	' GROUP BY sup_id'+
	' ORDER BY sup.created_at DESC'+
	' LIMIT 20',

//    'SELECT d.id, d.created_at, d.title, d.user_id'+
//    '  , d.target_num, d.deadline, d.status, d.image'+
//    '  , COUNT( spt.declaration_id ) AS supporter_num'+
//    '  , (COUNT(spt.declaration_id) / d.target_num) * 100 AS ratio'+
//    '  , u.name AS user_name, u.image AS user_image'+
//    ' FROM '+TABLE_DECLARATIONS+' AS d'+
//    ' LEFT JOIN '+TABLE_SUPPORTERS+' AS spt ON d.id = spt.declaration_id'+
//    ' LEFT JOIN '+TABLE_USERS+' AS u ON d.user_id = u.id'+
//    ' WHERE d.user_id = ?'+
//    //' WHERE d.user_id = ? AND d.status = ?'+
//    ' GROUP BY d.id'+
//    ' ORDER BY d.created_at DESC'+
//    ' LIMIT 10',
    [req.session.auth.user_id],
    function(err_owner, results_owner, fields_owner) {
      if (err_owner) {throw err_owner;}
      if (results_owner.length === 0) {
        dec_list_owner = [];
      } else {
        dec_list_owner = results_owner;
        
		var queryValue = ''
		for( var jj = 0; jj < results_owner.length; jj++ )
		{
			if( jj + 1 == results_owner.length )
			{
				// 最終処理
				queryValue += dec_list_owner[jj].id;
			}
			else
			{
				queryValue += dec_list_owner[jj].id + ',';
			}
		}

		// ここでコミュニティに関連付くユーザをすべてもってくる
		client.query(
			'SELECT sup.declaration_id AS sup_dec_id, sup.user_id AS sup_user_id,' +
			' u.name AS name, u.image AS image' +
			' FROM ' + TABLE_SUPPORTERS + ' AS sup, ' + TABLE_USERS + ' AS u WHERE sup.declaration_id in(' + queryValue + ')' +
			' AND sup.user_id = u.id'+
			' ORDER BY sup.declaration_id DESC, sup.id DESC',
			function(user_err, user_results_images)
			{
				if(user_err){throw user_err;}
				if(user_results_images.length === 0)
				{
				}
				else
				{
					user_results = user_results_images;
				}
			});
      }



	var dec_list = [];
	var dec_list_live = [];
	var ans = 0;
	if (req.session && req.session.auth)
	{
		onetime_token = __getOnetimeToken(req.session.auth.user_id);
	}
	// 最新のリストを取得

	var fr_list = [];
	var fr_queryValue = '';
	client.query(
		'SELECT friend_list FROM users WHERE id = ?',
		[req.session.auth.user_id],
		function(fr_err, fr_results)
		{
			if (fr_err) {throw fr_err;}
			if (fr_results.length === 0)
			{
			}
			else
			{
				// fr_list の内容はparseした内容にする
				if( fr_results[0].friend_list != '' )
				{
					fr_list = JSON.parse(fr_results[0].friend_list);
					fr_list = JSON.parse(JSON.stringify(fr_list.data));
					for( var kk = 0; kk < fr_list.length; kk++ )
					{
						if( kk + 1 == fr_list.length )
						{
							// 最終処理
							fr_queryValue += fr_list[kk].id;
						}
						else
						{
							fr_queryValue += fr_list[kk].id + ',';
						}
					}
				}
				if( fr_queryValue == '' )
				{
					fr_queryValue = '\'\'';
				}

				// ユーザIDの一覧を取得
				var oauth_service_queryValue = '';
				client.query(
					'SELECT id FROM users WHERE oauth_service_id IN ( '+fr_queryValue+' )',
					function(oauth_service_err, oauth_service_results)
					{
						if (oauth_service_err) {throw oauth_service_err;}
						if (oauth_service_results.length === 0)
						{
							// 友人がシャベリに参加していないもしくは存在しない
							client.query(
								'SELECT d.id, d.created_at, d.title, d.detail, d.user_id, d.target_num, d.deadline, d.status, d.image, COUNT( spt.declaration_id ) AS supporter_num'+
								'  , (COUNT(spt.declaration_id) / d.target_num) * 100 AS ratio , u.name AS user_name, u.image AS user_image FROM '+TABLE_DECLARATIONS+' AS d'+
								' LEFT JOIN '+TABLE_SUPPORTERS+' AS spt ON d.id = spt.declaration_id LEFT JOIN '+TABLE_USERS+' AS u ON d.user_id = u.id'+
								' WHERE d.status = ? GROUP BY d.id ORDER BY d.created_at DESC LIMIT 10',
								[FLG_SUPPORTER_WANT_STAT],
								function(err, results, fields)
								{
									if (err) {throw err;}
									if (results.length === 0)
									{
										res.render('mypage',
										{
											'dec_list_owner': dec_list_owner
											,'dec_list': dec_list
											, 'onetime_token': onetime_token
											, 'meta_title': 'マイページ｜'
											, 'is_auth_login': is_auth_login
											,'user_dec_list':user_results
											,'fr_sup_list':fr_sup_list
										});
										return;
									}
									else
									{
										var max_dec_num = results.length;
										// 条件を連結する
										var room_live_queryValue = '';
										for( var mm = 0; mm < max_dec_num; mm++ )
										{
											if( mm + 1 == max_dec_num )
											{
												// 最終処理
												room_live_queryValue += results[mm].id;
											}
											else
											{
												room_live_queryValue += results[mm].id + ',';
											}
										}
										if( room_live_queryValue == '' )
										{
											room_live_queryValue = '\'\'';
										}

										// 部屋をそれぞれ取得する(コミュニティのIDつき)
										client.query(
											'SELECT d.id AS dec_id, chat.*'+
											' FROM '+TABLE_DECLARATIONS+' AS d'+
											' LEFT JOIN '+TABLE_DECLARATIONS_CH+' AS chat ON d.id = chat.dec_relation_id'+
											' WHERE chat.status = 2 AND d.id IN ('+room_live_queryValue+') ORDER BY d.created_at DESC',
											function(room_err, room_results)
											{
												if (room_err) {throw room_err;}
												if (room_results.length === 0)
												{
													// コミュニティに関連付くチャットが無いのでライブ処理は行わない
												}
												else
												{
													for(var i = 0; i < max_dec_num; i++)
													{
														dec_list[i] = results[i];
														// 部屋の数だけ回す
														for(var j = 0; j < room_results.length; j++)
														{
															if( room_results[j].dec_id == results[i].id )
															{
																// ここの判定処理を考える
																console.log( j + ":" + house.manager.rooms['/houses/' + room_results[j].id] );
																// idが一致したら、ライブ判定をする
																if(house.manager.rooms['/houses/' + room_results[j].id] != undefined )
																{
																	dec_list[i].live = true;
																	break;
																}
																else
																{
																	dec_list[i].live = false;
																}
															}
														}
													}

													res.render('mypage',
													{
														'dec_list_owner': dec_list_owner
														,'dec_list': dec_list
														, 'onetime_token': onetime_token
														, 'meta_title': 'マイページ｜'
														, 'is_auth_login': is_auth_login
														,'user_dec_list':user_results
														,'fr_sup_list':fr_sup_list
													});
													return;
												}
											}
										);
									}
								}
							);
						}
						else
						{
							for( var ll = 0; ll < oauth_service_results.length; ll++ )
							{
								if( ll + 1 == oauth_service_results.length )
								{
									// 最終処理
									oauth_service_queryValue += oauth_service_results[ll].id;
								}
								else
								{
									oauth_service_queryValue += oauth_service_results[ll].id + ',';
								}
							}
							if( oauth_service_queryValue == '' )
							{
								oauth_service_queryValue = '\'\'';
							}

							// 友人が参加した順にする
							client.query(
								'SELECT d.id AS id, d.title AS title, d.image AS image, sup.id AS sup_id, sup.declaration_id AS sup_dec_id, sup.user_id AS sup_user_id, d.created_at, d.user_id ' +
								' ,COUNT( spt.declaration_id ) AS supporter_num ' +
								' ,d.target_num, d.deadline, d.status ' +
								' ,u.name AS user_name, u.image AS user_image ' +
								' FROM ' +TABLE_SUPPORTERS+' AS sup ' +
								' LEFT JOIN ' +TABLE_DECLARATIONS + ' AS d ON sup.declaration_id = d.id ' +
								' LEFT JOIN ' +TABLE_SUPPORTERS+ ' AS spt ON d.id = spt.declaration_id ' +
								' LEFT JOIN ' +TABLE_USERS+ ' AS u ON sup.user_id = u.id ' +
								' WHERE sup.user_id in( ' + oauth_service_queryValue + ' )'+
								' GROUP BY sup_id'+
								' ORDER BY sup.created_at DESC'+
								' LIMIT 5',
								function(fr_sup_err, fr_sup_results)
								{
									if (fr_sup_err) {throw fr_sup_err;}
									if (fr_sup_results.length === 0)
									{

									}
									else
									{
										
										fr_sup_list = fr_sup_results;
									}

									client.query(
										'SELECT d.id, d.created_at, d.title, d.detail, d.user_id, d.target_num, d.deadline, d.status, d.image, COUNT( spt.declaration_id ) AS supporter_num'+
										'  , (COUNT(spt.declaration_id) / d.target_num) * 100 AS ratio , u.name AS user_name, u.image AS user_image FROM '+TABLE_DECLARATIONS+' AS d'+
										' LEFT JOIN '+TABLE_SUPPORTERS+' AS spt ON d.id = spt.declaration_id LEFT JOIN '+TABLE_USERS+' AS u ON d.user_id = u.id'+
										' WHERE d.status = ? GROUP BY d.id ORDER BY d.created_at DESC LIMIT 10',
										[FLG_SUPPORTER_WANT_STAT],
										function(err, results, fields)
										{
											if (err) {throw err;}
											if (results.length === 0)
											{
												res.render('mypage',
												{
													'dec_list_owner': dec_list_owner
													,'dec_list': dec_list
													, 'onetime_token': onetime_token
													, 'meta_title': 'マイページ｜'
													, 'is_auth_login': is_auth_login
													,'user_dec_list':user_results
													,'fr_sup_list':fr_sup_list
												});
												return;
											}
											else
											{
												var max_dec_num = results.length;
												// 条件を連結する
												var room_live_queryValue = '';
												for( var mm = 0; mm < max_dec_num; mm++ )
												{
													if( mm + 1 == max_dec_num )
													{
														// 最終処理
														room_live_queryValue += results[mm].id;
													}
													else
													{
														room_live_queryValue += results[mm].id + ',';
													}
												}
												if( room_live_queryValue == '' )
												{
													room_live_queryValue = '\'\'';
												}
												// 部屋をそれぞれ取得する(コミュニティのIDつき)
												client.query(
													'SELECT d.id AS dec_id, chat.*'+
													' FROM '+TABLE_DECLARATIONS+' AS d'+
													' LEFT JOIN '+TABLE_DECLARATIONS_CH+' AS chat ON d.id = chat.dec_relation_id'+
													' WHERE chat.status = 2 AND d.id IN ('+room_live_queryValue+') ORDER BY d.created_at DESC',
													function(room_err, room_results)
													{
														if (room_err) {throw room_err;}
														if (room_results.length === 0)
														{
															// コミュニティに関連付くチャットが無いのでライブ処理は行わない
														}
														else
														{
															for(var i = 0; i < max_dec_num; i++)
															{
																dec_list[i] = results[i];
																// 部屋の数だけ回す
																for(var j = 0; j < room_results.length; j++)
																{
																	if( room_results[j].dec_id == results[i].id )
																	{
																		// ここの判定処理を考える
																		console.log( j + ":" + house.manager.rooms['/houses/' + room_results[j].id] );
																		// idが一致したら、ライブ判定をする
																		if(house.manager.rooms['/houses/' + room_results[j].id] != undefined )
																		{
																			dec_list[i].live = true;
																			break;
																		}
																		else
																		{
																			dec_list[i].live = false;
																		}
																	}
																}
															}

															res.render('mypage',
															{
																'dec_list_owner': dec_list_owner
																,'dec_list': dec_list
																, 'onetime_token': onetime_token
																, 'meta_title': 'マイページ｜'
																, 'is_auth_login': is_auth_login
																,'user_dec_list':user_results
																,'fr_sup_list':fr_sup_list
															});
															return;
														}
													}
												);
											}
										}
									);
								}
							);
						}
					}
				);
			}
		}
	);

	});
});



// --------------------------------------------------------
// イベント作成のフォーム
// --------------------------------------------------------
app.get('/create-dec', function (req, res) {

	//ログインフラグ
	var is_auth_login = true;

	if (!__isAuthLogin(req)) {
		// ログインしていないので、リダイレクト
		res.redirect('/');
		is_auth_login = false;
		return;
	}

  // パラメータが正しいかDB に聞いてみる
  client.query(
    'SELECT id, name, sex, age, mail_addr FROM '+TABLE_USERS+' WHERE id = ?',
    [req.session.auth.user_id],
    function(err, results, fields) {
      if (err) {throw err;}
      if (results.length === 0) {
        res.send('user_id error: no result');
        return;
      } else {
        res.render('create-dec', {
            'user_data': results
          , 'meta_title': 'チャット部屋作成｜'
	  , 'is_auth_login': is_auth_login
        });
        return;
      }
    }
  );
});

// --------------------------------------------------------
// mypage settingのフォーム
// --------------------------------------------------------
app.get('/my-setting', function (req, res) {

	//ログインフラグ
	var is_auth_login = true;

	if (!__isAuthLogin(req)) {
		// ログインしていないので、リダイレクト
		res.redirect('/');
		is_auth_login = false;
		return;
	}

  // onetime_token 取得
  var onetime_token = __getOnetimeToken(req.session.auth.user_id);

  // パラメータが正しいかDB に聞いてみる
  client.query(
    'SELECT id, name, mail_addr FROM '+TABLE_USERS+' WHERE id = ?',
    [req.session.auth.user_id],
    function(err, results, fields) {
      if (err) {throw err;}
      if (results.length === 0) {
        res.send('user_id error: no result');
        return;
      } else {
        res.render('my-setting', {
            'user_data': results
          , 'onetime_token': onetime_token
          , 'meta_title': 'プロフィール設定｜'
	  , 'is_auth_login': is_auth_login
        });
        return;
      }
    }
  );
});



// --------------------------------------------------------
// コミュニティ検索のフォーム
// --------------------------------------------------------
app.get('/search', function (req, res) {

	//ログインフラグ
	var is_auth_login = true; if (!__isAuthLogin(req)) { is_auth_login = false; }

	var next_num = 0;	if(req.query.next_num){ next_num = req.query.next_num };
	var ajax_flag=false;    if(req.query.ajax_flag){ ajax_flag = true };

	//logger.info("req.query.search_str = "+req.query.search_str+"      next_num = "+next_num+"       ajax_flag = "+ajax_flag);
	

	var onetime_token = '';
	if (req.session && req.session.auth) {
		onetime_token = __getOnetimeToken(req.session.auth.user_id);
	}

	var where="";
	if(req.query.search_str&&req.query.search_str!="undefined"){
		where=' WHERE d.title like "%'+req.query.search_str+'%" OR d.detail like "%'+req.query.search_str+'%"';
	}

	client.query(
		'SELECT d.id, d.created_at, d.title, d.detail, d.user_id, d.word_tag'+
		'  , d.target_num, d.deadline, d.status, d.image'+
		'  , COUNT( spt.declaration_id ) AS supporter_num'+
		'  , (COUNT(spt.declaration_id) / d.target_num) * 100 AS ratio'+
		'  , u.name AS user_name, u.image AS user_image'+
		' FROM '+TABLE_DECLARATIONS+' AS d'+
		' LEFT JOIN '+TABLE_SUPPORTERS+' AS spt ON d.id = spt.declaration_id'+
		' LEFT JOIN '+TABLE_USERS+' AS u ON d.user_id = u.id'+
		where+
		' GROUP BY d.id'+
		' ORDER BY d.created_at DESC'+
		' LIMIT '+next_num+',11',
//		[FLG_SUPPORTER_WANT_STAT],
		function(err, results, fields) {
		//logger.info(results);
			if (err) {throw err;}
			if (results.length === 0) {
				res.render('search', {
					'title': ''
					, 'dec_list': []
					, 'onetime_token': onetime_token
					, 'is_auth_login': is_auth_login 
			});
			return;
		} else {
			

	
			var dec_list = [];
			var max_dec_num = results.length;
			for (var i = 0; i < max_dec_num; i++) {
				//results[i].title = results[i].title.slice(0,13);
				//results[i].detail = results[i].detail.slice(0,36);
				results[0].search_str = req.query.search_str;
				dec_list[i] = results[i];
			};
			
			
			
			if(ajax_flag == false){

				//デフォルト
				res.render('search', {'locals':
					{'title': 'SHABERI-HOUSE index'
						, 'dec_list': dec_list
						, 'onetime_token': onetime_token
						, 'is_auth_login': is_auth_login
					}
				});
				return;
			}else{
				//ajaxでSHOW MORE CONTENTSを押したとき
				
				res.json({ event_data: dec_list}, 200);
				return;
				
			}
			
		}
	});
});


/**
 * --------------------------------------------------------
 * サポーターリストを取得するAPI
 * --------------------------------------------------------
 */
app.get('/get-supporters', function (req, res) {
//logger.info(res);
  // リクエストチェック
  // id
  try {
    check(req.query.id).isInt();
    check(req.query.limit).isInt();
    req.query.id = parseInt(req.query.id);
    req.query.limit = parseInt(req.query.limit);

    if (req.query.limit > 100) {
      req.query.limit = 20;
    }
  } catch (e) {
    logger.error(e.message); //Invalid
    res.json({text: '不正なリクエストです'}, 400);// Bad Request
    return;
  }


  // データ取得
  client.query(
    'SELECT u.id, u.name, u.image'+
    ' FROM '+TABLE_SUPPORTERS+' AS s'+
    ' INNER JOIN '+TABLE_USERS+' AS u ON s.user_id = u.id'+
    ' WHERE s.declaration_id = ?'+
    ' ORDER BY s.id DESC'+
    ' LIMIT ?',
    [req.query.id, req.query.limit],
    function(err, results) {
      if (err) {throw err;}
      var sup_list = [];
      if (results.length === 0) {
        res.json({supporter_data: sup_list, text: 'no result'}, 200);
        return;
      } else {

        var max_sup_num = results.length;
        for (var i = 0; i < max_sup_num; i++) {
		sup_list[i] = results[i];
		sup_list[i].c_id=req.query.id;
		// xss 対策
		sup_list[i].name = sanitize(sup_list[i].name).xss();
		sup_list[i].image = sanitize(sup_list[i].image).xss();
        };

        if (!__isAuthLogin(req))
        {
          res.json({supporter_data: sup_list, supporter_login:false, supporter_image:'', supporter_name:''}, 200);
        }
        else
        {
          res.json({supporter_data: sup_list, supporter_login:true, supporter_image:req.session.auth.user_image, supporter_name:req.session.auth.user_name}, 200);
        }
        return;
      }

    }
  );

});

/**
 * --------------------------------------------------------
 * ログインしてるかどうか判断するAPI
 * --------------------------------------------------------
 */
app.get('/get-is-login', function (req, res) {

  // ログインしてるかどうか？
  if (!__isAuthLogin(req)) {
    // ログインしていない
    res.json({login_flg: false}, 200);
  } else {
    res.json(
      {  login_flg: true
       , user_id: req.session.auth.user_id
       , user_image: req.session.auth.user_image
       , user_name: req.session.auth.user_name
      }, 200
    );
  }
  return;
});


/**
 * --------------------------------------------------------
 * オーナーかどうか判断するAPI
 * --------------------------------------------------------
 */
app.get('/get-is-owner', function (req, res) {

  // ログインしてるかどうか？
  if (!__isAuthLogin(req)) {
    // ログインしていない
    res.json({text: 'ログインが必要です'}, 401);
    return;
  }


  // リクエストチェック
  try {
    check(req.query.dec_id).isInt();
    req.query.dec_id = parseInt(req.query.dec_id);

  } catch (e) {
    logger.error(e.message); //Invalid
    res.json({text: '不正なリクエストです'}, 400);// Bad Request
    return;
  }

  // データ取得
  client.query(
    'SELECT id'+
    ' FROM '+TABLE_DECLARATIONS+
    ' WHERE id = ? AND user_id = ?'+
    ' LIMIT 1',
    [req.query.dec_id, req.session.auth.user_id],
    function(err, results) {
      if (err) {throw err;}
      if (results.length === 0) {
        res.json({res_flg: false}, 200);
      } else {
        res.json({res_flg: true}, 200);
      }
      return;
    }
  );

});



/**
 * --------------------------------------------------------
 * サポーターかどうか判断するAPI
 * --------------------------------------------------------
 */
app.get('/get-is-supporters', function (req, res) {

  // ログインしてるかどうか？
  if (!__isAuthLogin(req)) {
    // ログインしていない
    res.json({text: 'ログインが必要です'}, 401);
    return;
  }


  // リクエストチェック
  try {
    check(req.query.dec_id).isInt();
    req.query.dec_id = parseInt(req.query.dec_id);

  } catch (e) {
    logger.error(e.message); //Invalid
    res.json({text: '不正なリクエストです'}, 400);// Bad Request
    return;
  }


  // データ取得
  client.query(
    'SELECT s.id, u.image as image'+
    ' FROM '+TABLE_SUPPORTERS+' AS s, '+TABLE_USERS+' AS u'+
    ' WHERE s.declaration_id = ? AND s.user_id = ? AND s.user_id = u.id'+
    ' LIMIT 1',
    [req.query.dec_id, req.session.auth.user_id],
    function(err, results) {
      if (err) {throw err;}
      if (results.length === 0) {
        res.json({res_flg: false}, 200);
      } else {
        res.json({res_flg: true, res_image:results[0].image}, 200);
      }
      return;
    }
  );

});


/**
 * --------------------------------------------------------
 * イベントリストを取得するAPI
 * --------------------------------------------------------
 */
app.get('/get-events', function (req, res) {

  // リクエストチェック
  // id
  var last_id
    , limit
    , dec_status
    ;
  try {
    check(req.query.last_id).isInt();
    check(req.query.limit).isInt();
    check(req.query.dec_status).isInt();

    last_id = parseInt(req.query.last_id);
    limit = parseInt(req.query.limit);
    dec_status = parseInt(req.query.dec_status);

    if (req.query.limit > 30) {
      req.query.limit = 10;
    }
  } catch (e) {
    logger.error(e.message); //Invalid
    res.json({text: '不正なリクエストです'}, 400);// Bad Request
    return;
  }


  // 条件に合うリストを取得
  client.query(
    'SELECT d.id, d.created_at, d.title, d.user_id , d.detail'+
    '  , d.target_num, d.deadline, d.status, d.image'+
    '  , COUNT( spt.declaration_id ) AS supporter_num'+
    '  , (COUNT(spt.declaration_id) / d.target_num) * 100 AS ratio'+
    '  , u.name AS user_name, u.image AS user_image'+
    ' FROM '+TABLE_DECLARATIONS+' AS d'+
    ' LEFT JOIN '+TABLE_SUPPORTERS+' AS spt ON d.id = spt.declaration_id'+
    ' LEFT JOIN '+TABLE_USERS+' AS u ON d.user_id = u.id'+
    ' WHERE d.status = ? AND d.id < ?'+
    ' GROUP BY d.id'+
    ' ORDER BY d.id DESC'+
    ' LIMIT ?',
    [dec_status, last_id, limit],
    function(err, results, fields) {
      if (err) {throw err;}
      var dec_list = [];
      if (results.length === 0) {
        res.json({event_data: dec_list, text: 'no result'}, 200);
        return;
      } else {

        var max_dec_num = results.length;

		var room_live_queryValue = '';
		for( var mm = 0; mm < max_dec_num; mm++ )
		{
			if( mm + 1 == max_dec_num )
			{
				// 最終処理
				room_live_queryValue += results[mm].id;
			}
			else
			{
				room_live_queryValue += results[mm].id + ',';
			}
		}
		if( room_live_queryValue == '' )
		{
			room_live_queryValue = '\'\'';
		}
		// 部屋をそれぞれ取得する(コミュニティのIDつき)
		client.query(
			'SELECT d.id AS dec_id, chat.*'+
			' FROM '+TABLE_DECLARATIONS+' AS d'+
			' LEFT JOIN '+TABLE_DECLARATIONS_CH+' AS chat ON d.id = chat.dec_relation_id'+
			' WHERE chat.status = 2 AND d.id IN ('+room_live_queryValue+') ORDER BY d.created_at DESC',
			function(room_err, room_results) {
				if (room_err) {throw room_err;}
				if (room_results.length === 0)
				{
					// コミュニティに関連付くチャットが無いのでライブ処理は行わない
				}
				else
				{
					for(var i = 0; i < max_dec_num; i++)
					{
						dec_list[i] = results[i];
						// xss 対策
						dec_list[i].title = sanitize(dec_list[i].title).xss();
						dec_list[i].image = sanitize(dec_list[i].image).xss();
						dec_list[i].user_name = sanitize(dec_list[i].user_name).xss();
						dec_list[i].user_image = sanitize(dec_list[i].user_image).xss();
						// 部屋の数だけ回す
						for(var j = 0; j < room_results.length; j++)
						{
							if( room_results[j].dec_id == results[i].id )
							{
								// ここの判定処理を考える
								console.log( j + ":" + house.manager.rooms['/houses/' + room_results[j].id] );
								// idが一致したら、ライブ判定をする
								if(house.manager.rooms['/houses/' + room_results[j].id] != undefined )
								{
									dec_list[i].live = true;
									break;
								}
								else
								{
									dec_list[i].live = false;
								}
							}
						}
					}
				res.json({event_data: dec_list}, 200);
				return;
				}
			}
		);

      }
    }
  );

});



// --------------------------------------------------------
// dec detail (宣言詳細)
// --------------------------------------------------------
app.get('/dec/:id', function (req, res) {

	//ログインフラグ
	var is_auth_login = true; if (!__isAuthLogin(req)) { is_auth_login = false; }

	// ID が正しいかチェックする
	// 正しくなければ、一覧へリダイレクトする
	var dec_id = (req.params.id) ? req.params.id : '';
	var suc_obj = {};
	var blog_obj = {};
	var owner_id = '';
	var onetime_token = '';
	if (req.session && req.session.auth) {
		owner_id = req.session.auth.user_id;
		onetime_token = __getOnetimeToken(req.session.auth.user_id);
	}
	
	// チャットのリストを取得
	client.query('SELECT * FROM '+TABLE_DECLARATIONS_CH+' WHERE dec_relation_id = ' + dec_id +' AND status = 2 ORDER BY id DESC', function (err, results) {
	suc_obj = results;
	});
	// ブログのリストを取得
	client.query('SELECT * FROM '+TABLE_DECLARATIONS_CH+' WHERE dec_relation_id = ' + dec_id +' AND status = 1 ORDER BY id DESC', function (b_err, b_results) {
	blog_obj = b_results;
	});
	
	// 正しいかDB に確認
	client.query(
		'SELECT d.id, d.created_at, d.title, d.detail, d.user_id'+
		'  , d.target_num, d.deadline, d.status, d.image AS image'+
		'  , COUNT( s.declaration_id ) AS supporter_num'+
		'  , (COUNT(s.declaration_id) / d.target_num) *100 AS ratio'+
		'  , u.name AS user_name, u.image AS user_image'+
		' FROM '+TABLE_DECLARATIONS+' AS d'+
		' LEFT JOIN '+TABLE_SUPPORTERS+' AS s ON d.id = s.declaration_id'+
		' LEFT JOIN '+TABLE_USERS+' AS u ON d.user_id = u.id'+
		' WHERE d.id = ?'+
		' GROUP BY d.id'+
		' LIMIT 1',
		[dec_id],
		function(err, results, fields) {
		
		logger.debug(house.manager.rooms);
		
			if (err) {throw err;}
			if (results.length === 0) {
				res.send('dec_id error: no result'+' このURLのコミュニティは削除されました');
				return;
			} else {
				var detail_txt = results[0].detail;
				detail_txt = detail_txt.replace(/\n/g, '<br />');
				results[0].detail = detail_txt;
				
				for(var i=0;i<suc_obj.length;i++){	//live
					if(house.manager.rooms['/houses/' + suc_obj[i].id] != undefined){
						var suvv = house.manager.rooms['/houses/' + suc_obj[i].id].length;
						suc_obj[i].live = suvv;
					}else{
						suc_obj[i].live = 0;
					}
				}
				
				res.render('dec-detail', {'dec_detail': results[0], 'onetime_token': onetime_token, 'meta_title': results[0].title+'｜', 'suc_obj': suc_obj,'blog_obj': blog_obj, 'dec_image':'/data/' + dec_id + '/images/' + results[0].image, 'is_auth_login': is_auth_login, 'owner_id': owner_id});
				return;
			}
		}
	);
	
	
	
});



// --------------------------------------------------------
// chat_room
// --------------------------------------------------------
app.get('/ch/:id', function (req, res) {

	//ログインフラグ
	var is_auth_login = true; if (!__isAuthLogin(req)) { is_auth_login = false; }

  // ID が正しいかチェックする
  var ch_id = (req.params.id) ? req.params.id : '';

  var user_name = ''
    , user_image = ''
    , user_id = '' 
    , is_owner = false
    , dec_image = ''
    , is_supporter = false // サポーターかどうか？。チャットをさせるかどうかの判断で使う
    , is_mailsend  = true // メール送信機能の表示/非表示判断
    ;
  if (__isAuthLogin(req)) {
    user_id = req.session.auth.user_id;
    user_name = req.session.auth.user_name;
    user_image = req.session.auth.user_image;
  } else {
    // ログインしていない
    //res.redirect('/auth/twitter');
    res.redirect('/');
    return;
  }

  // onetime_token 取得
  var onetime_token = __getOnetimeToken(req.session.auth.user_id);

  // パラメータが正しいかDB に聞いてみる
  client.query(
   // 'SELECT c.id, c.title AS name, c.image AS image, c.detail, c.user_id AS owner_id, c.status'+
    //'  , c.mailsend_status AS mailsend_status, d.id AS dec_id, d.image AS dec_image '+
    //' FROM '+TABLE_DECLARATIONS_CH+' AS c, '+ TABLE_DECLARATIONS + ' AS d WHERE d.id = c.dec_relation_id AND c.id = ?',
    'SELECT c.id, c.title AS name, c.image AS image, c.detail, c.user_id AS owner_id, c.status'+
    '  , c.mailsend_status AS mailsend_status, c.id AS id, c.status AS ch_status,  u.mail_addr AS owner_mail_addr, u.name AS owner_name'+
    ' FROM '+TABLE_DECLARATIONS_CH+' AS c, '+  TABLE_USERS + ' AS u WHERE  c.id = ? AND u.id=c.user_id',
    [ch_id],
    function(err, results, fields) {
      if (err) {throw err;}
      if (results.length == 0) {
        res.send('id error: no result'+' このURLのチャットルームは削除されました');
        return;
      } else {

	//ブログ化していたらブログへリダイレクト
	if(results[0].ch_status == 1){
		res.redirect("/suc/"+results[0].id);
		return;
	}


        if (results[0].image == '') {
          // デフォルトの背景画像
          results[0].image = '/img/shiba.jpg';
        }

        // 宣言者かどうかチェック
        if (results[0].owner_id == user_id) {
          is_owner = true;
        }

        // メール送信機能
        if (results[0].mailsend_status) {
          is_mailsend = false;
        }

        if( results[0].dec_image != '' )
        {
        	dec_image = results[0].dec_image;
        }

        // サポーターかどうかチェック
        client.query(
          'SELECT id FROM '+TABLE_SUPPORTERS+
          ' WHERE declaration_id = ? AND user_id = ?',
          [ch_id, user_id],
          function(err2, results2) {
            if (err2) {throw err2;}
            if (results2.length === 0) {
              // サポーターじゃない
            } else {
              // サポーターです
              is_supporter = true;
            }





		//自分の作成した(オーナーになってる)部屋に誰かが入ってきた時
		if(results[0].owner_name != user_name){	
			
			//logger.debug("results-------------------------------------------------------------------------------------------------------------------");
			//logger.debug(results);

			var oshirase_comment = results[0].owner_name +"さんの作ったチャットルーム「"+results[0].name+"」に "+user_name+" さんが入ってきました。";
			var chat_room_url = "/ch/"+results[0].id;


			client.query(
			'INSERT INTO '+TABLE_USER_OSHIRASE_CONTENTS+' ( created_at, public_flag, comment, url ,regist_user_id) VALUES ( NOW(), 1, ?, ?, ? )',
			[oshirase_comment, chat_room_url, user_id],
			function(err_o1,results_o1) {
			if (err_o1) {throw err_o1;}
			//logger.debug(results_o1);
			
				client.query(
				'SELECT LAST_INSERT_ID() AS last_id FROM '+TABLE_USER_OSHIRASE_CONTENTS,
				function(err_oc2, results_oc2) {
				if (err_oc2) {throw err_oc2;}
				//logger.debug(results_oc2);
				
						client.query(
						'INSERT INTO '+TABLE_USER_OSHIRASE_RELATION+' ( user_id_to, oshirase_id, check_flag, created_at ) VALUES ( ?, ?, 0, NOW() )',
						[results[0].owner_id, results_oc2[0].last_id],
						function(err_oc3,results_oc3) {
						if (err_oc3) {throw err_oc3;}
						//logger.debug(results_oc3);



						var text_msg = ''
						, email_tmpl = fs.readFileSync(__dirname + '/views/email/chat-in.ejs', 'utf8')
						, mailto     = results[0].owner_mail_addr
						, subject    = '自分の作成した(オーナーになってる)部屋に誰かが入ってきた時｜SYABERI-HOUSE'
						;

						text_msg = ejs.render(email_tmpl, {
						chat_owner_name: results[0].owner_name,
						chat_in_user_name: user_name,
						chat_room_title: results[0].name,
						chat_room_detail: results[0].detail,
						chat_room_url: DOMEIN + chat_room_url
						});
						//__sendEmail(text_msg, conf, mailto, subject);

						}
						);

				}
				);

			});


		}////自分の作成した(オーナーになってる)部屋に誰かが入ってきた時

	results[0].detail = results[0].detail.replace(/\n/g,"<br/>");

            res.render('chat', {
              'house_id': results[0].id, 'house_name': results[0].name, 'url_id': ch_id,
              'house_image': results[0].image, 'house_desc': results[0].detail,
              'user_name': user_name, 'user_image': user_image,
              'user_id': user_id, 'house_status': results[0].status,
              'is_owner': is_owner, 'is_supporter': is_supporter,
              'is_mailsend': is_mailsend,
              'meta_title': results[0].name+'｜', 'onetime_token': onetime_token, 'dec_image':'/data/' + results[0].dec_id + '/images/' + dec_image,
              'is_auth_login': is_auth_login
            });
            return;
          }

        );
      }
    }
  );

});


/**
 * --------------------------------------------------------
 * POST: house 作成
 * --------------------------------------------------------
 */
app.post('/create-house', function (req, res) {
  // ログインチェック
  if (!__isAuthLogin(req)) {
    res.redirect('/');
    return;
  }


  // リクエストを取得
  //logger.info('----- app.post/create-house: ');logger.info(req.body);
  var house_name = '';
  if (req.body.house_name) {
    //postデータはreq.body.xxxで受け取る
    house_name = req.body.house_name;
  }

  if (house_name == '') {
    // top にリダイレクト
    res.redirect('/');
    return;
  // DB に登録
  } else {
    client.query(
      'INSERT INTO '+TABLE_HOUSES+' (created_at, name, url_id'+
      ') VALUES (NOW(), ?, ?)',
      [house_name, house_name],
      function(err) {
        if (err) {throw err;}

        client.query(
          'SELECT LAST_INSERT_ID() AS last_id FROM '+TABLE_HOUSES,
          function(err, results) {
            if (err) {throw err;}
            //logger.debug(results);
            //logger.debug(results[0].last_id);
            // house にリダイレクト
            res.redirect('http://rank-life.com/houses/edit/'+results[0].last_id);
            return;
          }
        );
      }
    );

  }
});

/**
 * --------------------------------------------------------
 * POST: 最初の設定
 * --------------------------------------------------------
 */
app.post('/firstset', function (req, res) {
  // ログインチェック
  if (!__isAuthLogin(req)) {
    res.json({ text: 'ログインして下さい' }, 401);
    return;
  }

  // リクエストチェック
  logger.debug('----- app.post/firstset: ');logger.info(req.body);
  var sex = 0
    , age = 0
    , mail_addr = ''
    ;

  var onetime_token = __getOnetimeToken(req.session.auth.user_id);

  // email
  try {
//    check(req.body.sex).is(/^(1|2)$/);
//    check(req.body.age).is(/^[1-8]$/);
    check(req.body.mail_addr).len(6, 64).isEmail();

    // onetime_token のチェック
    if (!__checkOnetimeToken(req.body.onetime_token, onetime_token)) {
      throw 'error!! onetime_token';
    }

  } catch (e) {
    logger.error(e.message); //Invalid
    res.json({text: '不正なリクエストです'}, 400);
    return;
  }

//  sex = req.body.sex;
//  age = req.body.age;
  mail_addr = req.body.mail_addr;

  client.query(
    'UPDATE '+TABLE_USERS+' SET'+
    '  sex = ?, age = ?, mail_addr = ?'+
    ' WHERE id = ?',
    [sex, age, mail_addr, req.session.auth.user_id],
    function(err) {
      if (err) {throw err;}




	var oshirase_comment = "SYABERI-HOUSEへようこそ！";
	var mypage_url = "/mypage";


	client.query(
	'INSERT INTO '+TABLE_USER_OSHIRASE_CONTENTS+' ( created_at, public_flag, comment, url ,regist_user_id) VALUES ( NOW(), 1, ?, ?, ? )',
	[oshirase_comment, mypage_url, req.session.auth.user_id],
	function(err_o1,results_o1) {
		if (err_o1) {throw err_o1;}
		//logger.debug(results_o1);

		client.query(
		'INSERT INTO '+TABLE_USER_OSHIRASE_RELATION+' ( user_id_to, oshirase_id, check_flag, created_at ) VALUES ( ?, ?, 0, NOW() )',
		[req.session.auth.user_id, results_o1.insertId],
		function(err_oc3,results_oc3) {
		if (err_oc3) {throw err_oc3;}
		//logger.debug(results_oc3);

		}
		);
	});



      // session にメルアドを保持しておく
      req.session.auth.mail_addr = mail_addr;

      // 新規の場合、ようこそメール送信
      var text_msg = ''
        , email_tmpl = fs.readFileSync(__dirname + '/views/email/welcome.ejs', 'utf8')
        , mailto     = mail_addr
        , subject    = 'SYABERI-HOUSEへようこそ！'
        ;
      text_msg = ejs.render(email_tmpl, {
        user_name: req.session.auth.user_name
      });
      __sendEmail(text_msg, conf, mailto, subject)

      res.json({flg_firstset: true}, 200);
      return;
    }
  );

});


/**
 * --------------------------------------------------------
 * POST: mypageプロフィール設定変更
 * --------------------------------------------------------
 */
app.post('/profile-change', function (req, res) {
  // ログインチェック
  if (!__isAuthLogin(req)) {
    res.json({ text: 'ログインして下さい' }, 401);
    return;
  }

  // リクエストチェック
  var mail_addr = '';

  var onetime_token = __getOnetimeToken(req.session.auth.user_id);

  // email
  try {
    check(req.body.mail_addr).len(6, 64).isEmail();
    // onetime_token のチェック
    if (!__checkOnetimeToken(req.body.onetime_token, onetime_token)) {
      throw 'error!! onetime_token';
    }
  } catch (e) {
    logger.error(e.message); //Invalid
    res.json({text: '不正なリクエストです'}, 400);
    return;
  }

  mail_addr = req.body.mail_addr;

  client.query(
    'UPDATE '+TABLE_USERS+' SET'+
    '  mail_addr = ?'+
    ' WHERE id = ?',
    [mail_addr, req.session.auth.user_id],
    function(err) {
      if (err) {throw err;}

      // session にメルアドを保持しておく
      req.session.auth.mail_addr = mail_addr;

      // 変更通知のメール送信
//      var text_msg = ''
//        , email_tmpl = fs.readFileSync(__dirname + '/views/email/welcome.ejs', 'utf8')
//        , mailto     = mail_addr
//        , subject    = 'SYABERI-HOUSE 設定変更の完了しました'
//        ;
//      text_msg = ejs.render(email_tmpl, {
//        user_name: req.session.auth.user_name
//      });
//      __sendEmail(text_msg, conf, mailto, subject)

      res.json({flg_profile_change: true}, 200);
      return;
    }
  );

});

/**
 * --------------------------------------------------------
 * GET: お知らせ取得
 * --------------------------------------------------------
 */
app.get('/get-informations', function(req, res){
	// ログインチェック
	if (!__isAuthLogin(req)) {
		// フロント側にて、エリアの非表示を行っています
		res.json({text:"ログインしていません。"}, 401);
		return;
	}

	limit = parseInt(req.query.limit);
	client.query(
		'SELECT u.name AS name, con.comment AS comment, con.url AS url ' +
		' FROM ' + TABLE_USERS + ' As u,' + TABLE_USER_OSHIRASE_RELATION +' AS rel,' + TABLE_USER_OSHIRASE_CONTENTS + ' AS con' +
		' WHERE u.id = rel.user_id_to'+
		' AND rel.oshirase_id = con.id' +
		' AND u.id = ? ORDER BY con.created_at DESC LIMIT ?',
	[req.session.auth.user_id,limit],
	function(err, results)
	{
		if (err) {throw err;}
		if( results.length === 0 )
		{
			// フロント側にて、件数を0にしています
			res.json({text:"件数が0件です。"}, 400);
			return;
		}
		else
		{
			res.json({info_list: results, info_coount:results.length}, 200);
		}
	})
});


/**
 * --------------------------------------------------------
 * POST: イベント作成の設定
 * --------------------------------------------------------
 */
app.post('/create-event', function (req, res) {
	// ログインチェック
	if (!__isAuthLogin(req)) {
		res.json({ text: 'ログインして下さい' }, 401);
		return;
	}

  	// リクエストチェック
	logger.debug('----- app.post/create-event: ');logger.info(req.body);
	
	var title = ''
	, description = ''
	, detail      = ''
	, target_num  = 0
	, deadline    = ''
	, rental_time = ''
	, dec_image   = ''
	, thumb_image = ''
	, word_tag    = ''
	, user_id     = req.session.auth.user_id
	;

  // validate
  try {
    check(req.body.title).notEmpty().len(1, 250);
    //check(req.body.description).notEmpty();
    check(req.body.detail).notEmpty();
    //check(req.body.target_num).isInt();
    //check(req.body.deadline).isDate();
    //check(req.body.rental_time).isDate();
  } catch (e) {
    logger.error(e.message); //Invalid
    res.json({text: '不正なリクエストです'}, 400);
    return;
  }

	title = req.body.title;
	//description = req.body.description;
	detail      = req.body.detail;
	//target_num  = req.body.target_num;
	//deadline    = req.body.deadline;
	//rental_time = req.body.rental_time;
	//dec_image   = req.body.dec_image;


	for( var i = 0; i <= req.body.word_tag_num; i++ ){
		if(req.body["word_tag_"+i]){
			var str = req.body["word_tag_"+i];
			word_tag += str;
			//最後以外はカンマで区切る
			if(i <= req.body.word_tag_num-1){word_tag +=","};
		}
	}
logger.info(word_tag);

  // 背景用
  if( req.files.dec_image == null )
  {
  	// 何もしない
  }
  else
  {
		//ファイル名を取得する
		var uploadDir_two =req.files.dec_image.path.split('/');
		// チェックにひっかからないものに関しては、すべて.jpgでコンバート
		var filename_Return = uploadDir_two[2] + '.jpg';
		dec_image = filename_Return;
	}

  client.query(
    'INSERT INTO '+TABLE_DECLARATIONS+' ('+
    '  created_at, title, description, detail, user_id, target_num, deadline'+
    '  , rental_time, status, image'+
    ') VALUES ('+
    '  NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?'+
    ')',
    [title, description, detail, user_id, target_num, deadline
      , rental_time, FLG_SUPPORTER_WANT_STAT, dec_image
    ],
    function(err, results)
	{
		if (err) {throw err;}
		if( results.length === 0 )
		{
			res.json({text: 'コミュニティの作成を行えませんでした。'}, 400);
			qreturn;
		}
		else
		{
			// 背景用
			if( req.files.dec_image == null )
			{
			// 何もしない
			}
			else
			{
				// ファイル格納場所(背景もサムネも同じ場所にする)
				var new_uploadDir = __dirname+'/public/data/' + results.insertId;

				try{
					// ディレクトリチェック
					fs.statSync( new_uploadDir );
				}catch(e) {
					console.log(new_uploadDir);
					// 作成
					fs.mkdirSync( new_uploadDir, 0777 );
				}

				// 格納場所
				var uploadDir = __dirname+'/public/data/' + results.insertId + '/images';
				try{
					// ディレクトリチェック
					fs.statSync( uploadDir );
				}catch(e) {
					console.log(uploadDir);
					// 作成
					fs.mkdirSync( uploadDir, 0777 );
				}
				var filename_Perse = uploadDir + '/' +dec_image;
				// リネーム
				fs.rename(req.files.dec_image.path, filename_Perse);
			}

			// サムネイル用
			if( req.files.thumb_image == null )
			{
				// 何もしない
				console.log( results.insertId );
				res.redirect('/dec/'+results.insertId);
				return;
			}
			else
			{
				// ファイル格納場所(背景もサムネも同じ場所にする)
				var new_uploadDir = __dirname+'/public/data/' + results.insertId;

				try{
					// ディレクトリチェック
					fs.statSync( new_uploadDir );
				}catch(e) {
					console.log(new_uploadDir);
					// 作成
					fs.mkdirSync( new_uploadDir, 0777 );
				}

				// 格納場所
				var uploadDir = __dirname+'/public/data/' + results.insertId + '/images';
				try{
					// ディレクトリチェック
					fs.statSync( uploadDir );
				}catch(e) {
					console.log(uploadDir);
					// 作成
					fs.mkdirSync( uploadDir, 0777 );
				}
				
				var thumb_uploadDir_two =req.files.thumb_image.path.split('/');
				var thumb_filename_Perse_l = uploadDir + '/thumb_l.jpg';
				var thumb_filename_Perse_m = uploadDir + '/thumb_m.jpg';
				var thumb_filename_Perse_s = uploadDir + '/thumb_s.jpg';
				
				async.series([
				function (callback)
				{
					exec("sudo -s");
					//ファイル名をtmpのままにする
					// 軽い処理から
					var oldFile_s = fs.createReadStream( req.files.thumb_image.path )
					  , newFile_s = fs.createWriteStream( thumb_filename_Perse_s );
					exec( "convert -geometry 215x111 " + req.files.thumb_image.path + " " + newFile_s.path);
//					exec( "mogrify -resize 215x111 -unsharp 2x1.4+0.5+0 " + newFile_s.path);
					oldFile_s.addListener( "data", function(chunk) {
						newFile_s.write(chunk);
					})
					oldFile_s.addListener( "close",function() {
						newFile_s.end();
					});

					callback(null, 1);
				},

				function (callback)
				{
					var oldFile_m = fs.createReadStream( req.files.thumb_image.path )
					  , newFile_m = fs.createWriteStream( thumb_filename_Perse_m );
//					exec( "mogrify -resize 457x247 -unsharp 2x1.4+0.5+0 " + newFile_m.path);
					exec( "convert -geometry 457x247 " + req.files.thumb_image.path + " " + newFile_m.path);
					oldFile_m.addListener( "data", function(chunk) {
						newFile_m.write(chunk);
					})
					oldFile_m.addListener( "close",function() {
						newFile_m.end();
					});

					callback(null, 2);
				},

				function (callback)
				{
					var oldFile_l = fs.createReadStream( req.files.thumb_image.path )
					  , newFile_l = fs.createWriteStream( thumb_filename_Perse_l );
//					exec( "mogrify -resize 950x435 -unsharp 2x1.4+0.5+0 " + newFile_l.path);
					// 大きさを一段階下げる
					exec( "convert -geometry 457x247 " + req.files.thumb_image.path + " " + newFile_l.path);

					oldFile_l.addListener( "data", function(chunk) {
						newFile_l.write(chunk);
					})
					oldFile_l.addListener( "close",function() {
						newFile_l.end();
					});
					callback(null, 3);
				},
				function( callback )
				{
					setTimeout(function()
					{
						res.redirect('/dec/'+results.insertId);
						callback(null, 4);
						return;
					 }, 0);
				}

				],function (err, results2)
				{
					if (err) { throw err; }
				}
				);
			}
		}
	}
);
});

/**
 * --------------------------------------------------------
 * POST: チャット作成の設定
 * --------------------------------------------------------
 */
app.post('/create-chat', function (req, res) {
  // ログインチェック
  if (!__isAuthLogin(req)) {
    res.json({ text: 'ログインして下さい' }, 401);
    return;
  }

  // リクエストチェック
  logger.debug('----- app.post/create-chat: ');logger.info(req.body);
  var title = ''
    , description = ''
    , detail      = ''
    , target_num  = 0
    , deadline    = ''
    , rental_time = ''
    , dec_image   = ''
    , user_id     = req.session.auth.user_id
    , dec_relation_id   = 0
    ;

  // validate
  try {
    check(req.body.title).notEmpty().len(1, 250);
    //check(req.body.description).notEmpty();
    check(req.body.detail).notEmpty();
    //check(req.body.target_num).isInt();
    //check(req.body.deadline).isDate();
    //check(req.body.rental_time).isDate();
  } catch (e) {
    logger.error(e.message); //Invalid
    res.json({text: '不正なリクエストです'}, 400);
    return;
  }

  title = req.body.title;
  //description = req.body.description;
  detail      = req.body.detail;
  //target_num  = req.body.target_num;
  //deadline    = req.body.deadline;
  //rental_time = req.body.rental_time;
  dec_image   = req.body.dec_image;
  dec_relation_id   = req.body.dec_relation_id;

  client.query(
    'INSERT INTO '+TABLE_DECLARATIONS_CH+' ('+
    '  created_at, title, description, detail, user_id, target_num, deadline'+
    '  , rental_time, status, image, dec_relation_id'+
    ') VALUES ('+
    '  NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?'+
    ')',
    [title, description, detail, user_id, target_num, deadline
      , rental_time, FLG_SUPPORTER_WANT_STAT, dec_image, dec_relation_id
    ],
    function(err,results) {
      if (err) {throw err;}
      if (results.length === 0) {
        res.json({text: 'チャットルームの作成を行えませんでした。'}, 400);
        return;
      }
      else
      {





	//フォロー中のコミュニティで、チャット部屋が出来た時
	client.query(
		'SELECT u.mail_addr, u.name, u.id'+
		' FROM '+TABLE_SUPPORTERS+' AS s'+
		' INNER JOIN '+TABLE_USERS+' AS u ON s.user_id = u.id'+
		' WHERE s.declaration_id = ?',
		[dec_relation_id],
		function(err2, results2) {
			if (err2) {throw err2;}
			//logger.debug("results2---------------------------------------------------------------------------------------------------------------------------");
			//logger.debug(results2);

			if (results2.length > 0) {

			
				client.query(
					'SELECT title FROM '+TABLE_DECLARATIONS+' WHERE id = ?',
					[dec_relation_id],
					function(err3, results3) {
					if (err3) {throw err3;}

					//logger.debug(results3[0].title);

					client.query(
						'SELECT name FROM '+TABLE_USERS+' WHERE id = ?',
						[user_id],
						function(err4, results4) {
						if (err4) {throw err4;}

						//logger.debug(results4[0].name);


						var oshirase_comment = "フォローしている「"+results3[0].title+"」コミュニティに新しいチャットルーム「"+title+"」ができました！";
						var community_url = "/dec/" + dec_relation_id;
						var chat_room_url = "/ch/"+ results.insertId;



						client.query(
						'INSERT INTO '+TABLE_USER_OSHIRASE_CONTENTS+' ( created_at, public_flag, comment, url ,regist_user_id) VALUES ( NOW(), 1, ?, ?, ? )',
						[oshirase_comment, chat_room_url, user_id],
						function(err_o1,results_o1) {
						if (err_o1) {throw err_o1;}
						//logger.debug(results_o1);
						
							client.query(
							'SELECT LAST_INSERT_ID() AS last_id FROM '+TABLE_USER_OSHIRASE_CONTENTS,
							function(err_oc2, results_oc2) {
							if (err_oc2) {throw err_oc2;}
							//logger.debug(results_oc2);


									for (var i=0; i < results2.length; i++) {

										//logger.debug("results[0].id="+results[0].id);


										client.query(
										'INSERT INTO '+TABLE_USER_OSHIRASE_RELATION+' ( user_id_to, oshirase_id, check_flag, created_at ) VALUES ( ?, ?, 0, NOW() )',
										[results2[i].id, results_oc2[0].last_id],
										function(err_oc3,results_oc3) {
											if (err_oc3) {throw err_oc3;}
											//logger.debug(results_oc3);


										}
										);


										var text_msg = ''
										, email_tmpl = fs.readFileSync(__dirname + '/views/email/create-chat.ejs', 'utf8')
										, mailto     = results2[i].mail_addr
										, subject    = '「'+results3[0].title+'」コミュニティに新しいチャットルーム「'+title+'」ができました｜SYABERI-HOUSE'
										;
										text_msg = ejs.render(email_tmpl, {
										create_user_name: results4[0].name,
										follow_user_name: results2[i].name,
										community_id: dec_relation_id,
										community_title: results3[0].title,
										community_url: DOMEIN + community_url,
										chat_room_url: DOMEIN + chat_room_url,
										chat_room_title: title,
										chat_room_detail: detail
										});
										__sendEmail(text_msg, conf, mailto, subject);



									}
							


							}
							);

						});




						}
					);
					}
				);

			




				res.json({flg_create: true, chat_create_id:results.insertId}, 200);
				return;

			} else {
				res.json({text: 'no_results'}, 200);
				return;
			}
		}
	);





      }
    }
  );
});

/**
 * --------------------------------------------------------
 * POST: サポーターになる
 * --------------------------------------------------------
 */



app.post('/join-commit', function (req, res) {
  // ログインチェック
  if (!__isAuthLogin(req)) {
    res.json({ text: 'ログインして下さい' }, 401);
    return;
  }

  // リクエストチェック
  // id
  try {
    check(req.body.id).isInt();
    req.body.id = parseInt(req.body.id);
  } catch (e) {
    logger.error(e.message); //Invalid
    res.json({text: '不正なIDです'}, 400);
    return;
  }

  // 無駄な処理だけど、、、事前に情報を取得しておく
  var event_data = {};
  client.query(
    'SELECT d.title, d.detail,'+
    '  u.id AS user_id, u.name AS user_name'+
    ' FROM '+TABLE_DECLARATIONS+' AS d'+
    ' INNER JOIN '+TABLE_USERS+' AS u ON d.user_id = u.id'+
    ' WHERE d.id = ?',
    [req.body.id],
    function(err, results) {
      if (err) {throw err;}
      if (results.length === 0) {
        // nothing
        res.json({text: 'データがありませんでした'}, 400);
        return;
      } else {
        event_data = results[0];
      }
    }
  );

  // すでに参加済みかどうかチェック
  client.query(
    'SELECT id '+
    ' FROM '+TABLE_SUPPORTERS+
    ' WHERE declaration_id = ? AND user_id = ?',
    [req.body.id, req.session.auth.user_id],
    function(err, results) {
      if (err) {throw err;}
      if (results.length === 0) {
        client.query(
          'INSERT INTO '+TABLE_SUPPORTERS+'('+
          '  created_at, declaration_id , user_id'+
          ') VALUES ('+
          '  NOW(), ' + req.body.id + ',' + req.session.auth.user_id + ')',
//          [req.body.id, req.session.auth.user_id],
          function(err) {
            if (err) {throw err;}
            res.json(
              {join_flg: 'ok'
               , user_id: req.session.auth.user_id
               , user_name: req.session.auth.user_name
               , user_image: req.session.auth.user_image
              }
              , 200
            );


            



		logger.debug("results-------------------------------------------------------------------------------------------------------------------");
		logger.debug(results);

		var oshirase_comment = "「"+event_data.title+"」コミュニティをフォローしました。";
		var community_url = "/dec/"+req.body.id;


		client.query(
		'INSERT INTO '+TABLE_USER_OSHIRASE_CONTENTS+' ( created_at, public_flag, comment, url ,regist_user_id) VALUES ( NOW(), 1, ?, ?, ? )',
		[oshirase_comment, community_url, event_data.user_id],
		function(err_o1,results_o1) {
			if (err_o1) {throw err_o1;}
			//logger.debug(results_o1);
	
			client.query(
			'INSERT INTO '+TABLE_USER_OSHIRASE_RELATION+' ( user_id_to, oshirase_id, check_flag, created_at ) VALUES ( ?, ?, 0, NOW() )',
			[req.session.auth.user_id, results_o1.insertId],
			function(err_oc3,results_oc3) {
			if (err_oc3) {throw err_oc3;}
			//logger.debug(results_oc3);

			}
			);
		});



		// コミュニティフォローメール送信
		var text_msg = ''
		, email_tmpl = fs.readFileSync(__dirname + '/views/email/community-follow.ejs', 'utf8')
		, mailto     = req.session.auth.mail_addr
		, subject    = '「'+event_data.title+'」コミュニティをフォローしました。｜SYABERI-HOUSE'
		;
		text_msg = ejs.render(email_tmpl, {
		user_name: req.session.auth.user_name,
		community_url: DOMEIN +community_url,
		community_owner_name: event_data.user_name,
		community_title: event_data.title,
		community_detail:event_data.detail
		});
		__sendEmail(text_msg, conf, mailto, subject);












            return;
          }
        );

      } else {
        res.json({join_flg: 'already_joined'}, 200);
        return;
      }
    }
  );

});








/*
app.post('/join-commit', function (req, res) {
  // ログインチェック
  if (!__isAuthLogin(req)) {
    res.json({ text: 'ログインして下さい' }, 401);
    return;
  }

  // リクエストチェック
  // id
  try {
    check(req.body.id).isInt();
    req.body.id = parseInt(req.body.id);
  } catch (e) {
    logger.error(e.message); //Invalid
    res.json({text: '不正なIDです'}, 400);
    return;
  }

  // 無駄な処理だけど、、、事前に情報を取得しておく
  var event_data = {};
  client.query(
    'SELECT d.title, d.detail,'+
    '  u.id AS user_id, u.name AS user_name'+
    ' FROM '+TABLE_DECLARATIONS+' AS d'+
    ' INNER JOIN '+TABLE_USERS+' AS u ON d.user_id = u.id'+
    ' WHERE d.id = ?',
    [req.body.id],
    function(err, results) {
      if (err) {throw err;}
      if (results.length === 0) {
        // nothing
        res.json({text: 'データがありませんでした'}, 400);
        return;
      } else {
        event_data = results[0];
      }
    }
  );


logger.debug("req.body.id-------------------------------------------------------------------------------------------------------------------");
logger.debug(req.body.id);
logger.debug("req.session.auth.user_id-------------------------------------------------------------------------------------------------------------------");
logger.debug(req.session.auth.user_id);

var flag = false;


  // すでに参加済みかどうかチェック
  client.query(
    'SELECT id '+
    ' FROM '+TABLE_SUPPORTERS+
    ' WHERE declaration_id = ? AND user_id = ?',
    [req.body.id, req.session.auth.user_id],
    function(err, results) {

logger.debug("results-------------------------------------------------------------------------------------------------------------------");
logger.debug(results.id);

      if (err) {throw err;}



      if (results.length === 0) {
	flag = true;

      } else {
        res.json({join_flg: 'already_joined'}, 200);
        return;
      }

if(flag)
{
        client.query(
          'INSERT INTO '+TABLE_SUPPORTERS+'('+
          '  created_at, declaration_id , user_id'+
          ') VALUES ('+
          '  NOW(),?,?'+
          ')',
          [req.body.id, req.session.auth.user_id],
          function(err) {
            if (err) {throw err;}
            res.json(
              {join_flg: 'ok'
               , user_id: req.session.auth.user_id
               , user_name: req.session.auth.user_name
               , user_image: req.session.auth.user_image
              }
              , 200
            );
*******************

		logger.debug("results-------------------------------------------------------------------------------------------------------------------");
		logger.debug(results);

		var oshirase_comment = "「"+event_data.title+"」コミュニティをフォローしました。";
		var community_url = "/dec/"+req.body.id;


		client.query(
		'INSERT INTO '+TABLE_USER_OSHIRASE_CONTENTS+' ( created_at, public_flag, comment, url ,regist_user_id) VALUES ( NOW(), 1, ?, ?, ? )',
		[oshirase_comment, community_url, event_data.user_id],
		function(err_o1,results_o1) {
			if (err_o1) {throw err_o1;}
			//logger.debug(results_o1);
	
			client.query(
			'INSERT INTO '+TABLE_USER_OSHIRASE_RELATION+' ( user_id_to, oshirase_id, check_flag, created_at ) VALUES ( ?, ?, 0, NOW() )',
			[req.session.auth.user_id, results_o1.insertId],
			function(err_oc3,results_oc3) {
			if (err_oc3) {throw err_oc3;}
			//logger.debug(results_oc3);

			}
			);
		});



		// コミュニティフォローメール送信
		var text_msg = ''
		, email_tmpl = fs.readFileSync(__dirname + '/views/email/community-follow.ejs', 'utf8')
		, mailto     = req.session.auth.mail_addr
		, subject    = 'コミュニティフォロー時　「'+event_data.title+'」コミュニティをフォローしました。｜SYABERI-HOUSE'
		;
		text_msg = ejs.render(email_tmpl, {
		user_name: req.session.auth.user_name,
		community_url: DOMEIN+community_url,
		community_owner_name: event_data.user_name,
		community_title: event_data.title,
		community_detail:event_data.detail
		});
		__sendEmail(text_msg, conf, mailto, subject);
****************


		return;
          }
        );


}

    }
  );

});
*/

/**
 * --------------------------------------------------------
 * イベント終了対応(update) 
 * --------------------------------------------------------
 */
app.post('/end-proc', function (req, res) {
  logger.debug('/end-proc'+req);

  // ログインチェック
  if (!__isAuthLogin(req)) {
    res.json({ text: 'ログインして下さい' }, 401);
    return;
  }

  var onetime_token = __getOnetimeToken(req.session.auth.user_id);

  // リクエストチェック
  // id
  try {
    check(req.body.dec_id).isInt();
    check(req.body.owner_id).isInt();

    // onetime_token のチェック
    if (!__checkOnetimeToken(req.body.onetime_token, onetime_token)) {
      throw 'error!! onetime_token';
    }

  } catch (e) {
    logger.error(e.message); //Invalid
    res.json({text: '不正なIDです'}, 400);
    return;
  }

  // ログインID がイベントオーナーかどうかチェック
  client.query(
    'SELECT id, title, dec_relation_id, detail'+
    ' FROM '+TABLE_DECLARATIONS_CH+
    ' WHERE id = ? AND user_id = ?',
    [req.body.dec_id, req.session.auth.user_id],
    function(err, results) {
      if (err) {throw err;}
      if (results.length === 0) {
        res.json({text: 'オーナーではない。不正なリクエストです'}, 400);
        return;
      } else {
        // イベントID・タイトル
        var event_id = results[0].id
          , event_title = results[0].title
          ;

        // イベントのステータスを更新する
        client.query(
          'UPDATE '+TABLE_DECLARATIONS_CH+' SET'+
          '  status = ?'+
          ' WHERE id = ?',
          [FLG_SUPPORTER_COMP_STAT, req.body.dec_id],
          function(err2, results2) {
            if (err2) {throw err2;}



	        // チャットルームの方に遷移するお知らせを削除する
	        client.query(
	          'DELETE FROM '+TABLE_USER_OSHIRASE_CONTENTS+
	          ' WHERE url = "/ch/?"',
	          [ results[0].id ],
	          function(err2, results2) {
	            if (err2) {throw err2;}
	          }
	        );
		//logger.debug("results-------------------------------------------------------------------------------------------------------------------");
		//logger.debug(results);
		//logger.debug("results2-------------------------------------------------------------------------------------------------------------------");
		//logger.debug(results2);



	        // メール送信用リストを取得する
	        client.query(
	          'SELECT u.mail_addr, u.name, u.id'+
	          ' FROM '+TABLE_SUPPORTERS+' AS s'+
	          ' INNER JOIN '+TABLE_USERS+' AS u ON s.user_id = u.id'+
	          ' WHERE s.declaration_id = ?',
	          [results[0].dec_relation_id],
	          function(err3, results3) {
	            if (err3) {throw err3;}
	            if (results3.length > 0) {

			logger.debug(results3);
			
			client.query(
				'SELECT title FROM '+TABLE_DECLARATIONS+' WHERE id = ?',
				[results[0].dec_relation_id],
				function(err4, results4) {
				if (err4) {throw err4;}
				//logger.debug(results4[0].title);



				var oshirase_comment = "フォローしている「"+results4[0].title+"」コミュニティのチャットルーム「"+results[0].title+"」がブログ化されました。";
				var blog_page_url = "/suc/"+results[0].id;
				var community_url = "/dec/"+results[0].dec_relation_id;


				client.query(
				'INSERT INTO '+TABLE_USER_OSHIRASE_CONTENTS+' ( created_at, public_flag, comment, url ,regist_user_id) VALUES ( NOW(), 1, ?, ?, ? )',
				[oshirase_comment, blog_page_url, req.session.auth.user_id],
				function(err_o1,results_o1) {
					if (err_o1) {throw err_o1;}
					logger.debug(results_o1);

					for (var i=0; i < results3.length; i++) {

						logger.debug("results3[i]=============================================================================");
						logger.debug(results3[i]);
						client.query(
						'INSERT INTO '+TABLE_USER_OSHIRASE_RELATION+' ( user_id_to, oshirase_id, check_flag, created_at ) VALUES ( ?, ?, 0, NOW() )',
						[results3[i].id, results_o1.insertId],
						function(err_oc3,results_oc3) {
						if (err_oc3) {throw err_oc3;}
						logger.debug(results_oc3);

						}
						);
					}
				});


				// メール送信
				for (var i=0; i < results3.length; i++) {

					//logger.info("results3[i].mail_addr="+results3[i].mail_addr);

					// 新規チャットルームのお知らせメール送信
					var text_msg = ''
					, email_tmpl = fs.readFileSync(__dirname + '/views/email/create-blog.ejs', 'utf8')
					, mailto     = results3[i].mail_addr
					, subject    = 'フォロー中のコミュニティで、まとめログ出来た時｜SYABERI-HOUSE'
					;
					text_msg = ejs.render(email_tmpl, {
					create_user_name: results3[0].name,
					follow_user_name: results3[i].name,
					community_title: results4[0].title,
					community_url: DOMEIN + community_url,
					blog_page_url: DOMEIN + blog_page_url,
					chat_room_title: results[0].title,
					chat_room_detail: results[0].detail
					});
					__sendEmail(text_msg, conf, mailto, subject);
				}


				res.json({flg_update: 'ok'}, 200);
			        return;


				}
			);



	            } else {
	              res.json({text: 'no_results'}, 200);
	              return;
	            }
	          }
	        );







          }
        );
      }
    }

  );

});





/**
 * --------------------------------------------------------
 * 参加取り消し対応(update)
 * --------------------------------------------------------
 */
app.get('/cancel-join', function (req, res) {
  // ログインチェック
  if (!__isAuthLogin(req)) {
    res.json({ text: 'ログインして下さい' }, 401);
    return;
  }

  // リクエストチェック
  // id
  try {
    check(req.query.dec_id).isInt();
  } catch (e) {
    logger.error(e.message); //Invalid
    res.json({text: '不正なIDです'}, 400);
    return;
  }

  // ログインID 参加済みかどうかチェック
  client.query(
    'SELECT id'+
    ' FROM '+TABLE_SUPPORTERS+
    ' WHERE declaration_id = ? AND user_id = ?',
    [req.query.dec_id, req.session.auth.user_id],
    function(err, results) {
      if (err) {throw err;}
      if (results.length === 0) {
        res.json({text: '不正なリクエストです'}, 400);
        return;
      } else {

        // 削除する
        client.query(
          'DELETE FROM '+TABLE_SUPPORTERS+
          ' WHERE declaration_id = ? AND user_id = ?',
          [req.query.dec_id, req.session.auth.user_id],
          function(err2, results2) {
            if (err2) {throw err2;}
            res.json({flg_cancel_join: 'ok', auth_user_id: req.session.auth.user_id}, 200);
            return;
          }
        );
      }
    }

  );

});

/**
 * --------------------------------------------------------
 * twitter リツイート投稿(post)
 * --------------------------------------------------------
 */


function twitter_update(message,token,secret) {
  oa_obj.post(
    'http://api.twitter.com/1/statuses/update.json',
    token,
    secret,
    { status: message },
    function(err, data) {
      err && console.log(err);
      logger.debug('---------- twitter_update: --------- ');logger.debug(err);
	if (err) {throw err;}
    }
  );
    return true;
}

app.post('/send-twitter', function (req, res) {
	
	var message = req.body.message
	  , token = req.session.auth.accessToken
	  , secret = req.session.auth.accessSecret
	  ;
	var flag = twitter_update(message,token,secret);
      //logger.debug('---------- send_twitter: --------- ');logger.debug(flag);
	if(flag){
		res.json({return:true},200);
	}else{
		res.json({return:false},200);
	}
});

/**
 * --------------------------------------------------------
 * twitter friend情報取得
 * --------------------------------------------------------
 */

app.get('/get-twitter-friends', function (req, res) {
	
  // ログインしてるかどうか？
  if (!__isAuthLogin(req)) {
    // ログインしていない
    //logger.debug("false1");
    res.json({login_flg: false, return: false }, 200);
    return;
  }

　　//初回ログインはoauthで友達情報を取得
    if(req.query.flag != "1"){
      logger.debug('---------- flag-TW------- ');logger.debug(req.query.flag);
	var token = req.session.auth.accessToken
	  , secret = req.session.auth.accessSecret
	  , service_id = req.session.auth.oauth_service_id
	  , cursor = req.query.cursor
	  ;
	  oa_obj.get(
	    'http://api.twitter.com/1/statuses/friends.json?id=' + service_id + '&cursor=' + cursor,
	    token,
	    secret,
	    function(err, data) {
		if (err) {throw err;}
		if(data){
			res.render('get-twitter-friends', {
			'res_json': data
			});
		}else{
			res.json({return:false},200);
		}
	   }
	  );
     } else {

      //logger.debug('---------- flag-DB------- ');logger.debug(req.query.flag);

	  // DB に値があるかチェック
	  client.query(
	    'SELECT id, friend_list FROM '+TABLE_USERS+
	    ' WHERE oauth_service_id = ? AND oauth_service = "twitter"',
	    [req.session.auth.oauth_service_id],
	         function(err, results, fields) {
			//logger.debug("userid=="+req.session.auth.user_id);
			//logger.debug("res=="+results[0]);
		      if (err) {throw err;}
		      if (results[0]) {
			//logger.debug(results[0].friend_list);
			res.json(results[0].friend_list, 200);

		      } else {
			//logger.debug("false2");
		        res.json({return:false}, 200);
		        return;
		      }
	         }
	  );

	  return;

     }
});

/**
 * --------------------------------------------------------
 * twitter friend情報登録
 * --------------------------------------------------------
 */

app.post('/set-twitter-friends', function (req, res) {
	
  // ログインしてるかどうか？
  if (!__isAuthLogin(req)) {
    // ログインしていない
    //logger.debug("false1");
    res.json({login_flg: false, return: false }, 200);
    return;
  } else {
  	  // ツイッターアカウントに改行の含まれるアカウントがいるため、改行を空文字に変換
  	  req.body.friend_list=req.body.friend_list.replace(/\n/g, "");
	        logger.debug('---------- oauth_id ------');
		logger.debug(req.session.auth.oauth_service_id);

	  // DB に値があるかチェック
	  client.query(
	    'SELECT id, friend_list FROM '+TABLE_USERS+
	    ' WHERE oauth_service_id = ? AND oauth_service = "twitter"',
	    [req.session.auth.oauth_service_id],
	    function(err, results, fields) {
	      if (err) {throw err;}

	      if (results[0]) {
	        //logger.debug('---------- json ------');
		//logger.debug(req.session.auth.oauth_service_id);
		//logger.debug(req.body.friend_list);

	        client.query(
	          'UPDATE '+TABLE_USERS+
	          ' SET friend_list = ?'+
		  ' WHERE oauth_service_id = ? AND oauth_service = "twitter"',
		  [ req.body.friend_list , req.session.auth.oauth_service_id ],
	          function(err) {
	            if (err) {throw err;}
	          }
	        );
		    res.json({ return: true }, 200);
		    return;

	      }
	    }
	  );
	return;
  }

});

/**
 * --------------------------------------------------------
 * twitter投稿(post)
 * --------------------------------------------------------
 */
app.post('/post-twitter', function (req, res) {
  // ログインチェック
  if (!__isAuthLogin(req)) {
    res.json({ text: 'ログインして下さい' }, 401);
    return;
  }

  // リクエストチェック
  // id
  try {
    check(req.body.post_txt).len(1, 140);
  } catch (e) {
    logger.error(e.message); //Invalid
    res.json({text: '不正なパラメータです'}, 400);
    return;
  }

  // 本人のoauth情報を取得
  client.query(
    'SELECT id, oauth_id, oauth_secret_id'+
    ' FROM '+TABLE_USERS+
    ' WHERE id = ?',
    [req.session.auth.user_id],
    function(err, results) {
      if (err) {throw err;}
      if (results.length === 0) {
        res.json({text: '本人ではない。不正なリクエストです'}, 400);
        return;
      } else {
        // oauth情報
        var oauth_id = results[0].oauth_id
          , oauth_secret_id = results[0].oauth_secret_id
          ;

        // twitterに投稿する
        //oa_obj.post(
        //  'https://api.twitter.com/1/statuses/update.json'
        //  ,
        //  req.session.oauth.access_token, 
        //  req.session.oauth.access_token_secret,
        //  {"status": text},
        //  function (err, data, response) {
        //    if (err) {
        //      res.send('too bad.' + JSON.stringify(err));
        //    } else {
        //      res.send('posted successfully...!');
        //    }
        //});
      }
    }

  );

});



/**
 * --------------------------------------------------------
 * コメント削除(delete)
 * --------------------------------------------------------
 */
app.post('/delete-comment', function (req, res) {
  // ログインチェック
  if (!__isAuthLogin(req)) {
    res.json({ text: 'ログインして下さい' }, 401);
    return;
  }

  var onetime_token = __getOnetimeToken(req.session.auth.user_id);

  // リクエストチェック
  // id
  try {
    check(req.body.comment_id).isInt();

    // onetime_token のチェック
    if (!__checkOnetimeToken(req.body.onetime_token, onetime_token)) {
      throw 'error!! onetime_token';
    }

  } catch (e) {
    logger.error(e.message); //Invalid
    res.json({text: '不正なIDです'}, 400);
    return;
  }

  // 削除対象コメント が本人かどうかチェック
  client.query(
    'SELECT id'+
    ' FROM '+TABLE_DOT1_COMMENTS+
    ' WHERE id = ? AND user_id = ?',
    [req.body.comment_id, req.session.auth.user_id],
    function(err, results) {
      if (err) {throw err;}
      if (results.length === 0) {
        res.json({text: '本人ではない。不正なリクエストです'}, 400);
        return;
      } else {
        // commentID
        var comment_id = results[0].id;

        // コメントを削除する
        client.query(
          'DELETE FROM '+TABLE_DOT1_COMMENTS+
          ' WHERE id = ?',
          [comment_id],
          function(err2, results2) {
            if (err2) {throw err2;}
            res.json({flg_delete_comment: 'ok'}, 200);
            return;
          }
        );
      }
    }

  );

});


/**
 * --------------------------------------------------------
 * コミュニティ削除(delete)
 * --------------------------------------------------------
 */
app.post('/delete-dec', function (req, res) {
  // ログインチェック
  if (!__isAuthLogin(req)) {
    res.json({ text: 'ログインして下さい' }, 401);
    return;
  }

  var onetime_token = __getOnetimeToken(req.session.auth.user_id);

  // リクエストチェック
  // id
  try {
    check(req.body.dec_id).isInt();

    // onetime_token のチェック
    if (!__checkOnetimeToken(req.body.onetime_token, onetime_token)) {
      throw 'error!! onetime_token';
    }

  } catch (e) {
    logger.error(e.message); //Invalid
    res.json({text: '不正なIDです'}, 400);
    return;
  }

  // 削除対象コミュニティの管理人 が本人かどうかチェック
  client.query(
    'SELECT id, title'+
    ' FROM '+TABLE_DECLARATIONS+
    ' WHERE id = ? AND user_id = ?',
    [req.body.dec_id, req.session.auth.user_id],
    function(err, results) {
      if (err) {throw err;}
      if (results.length === 0) {
        res.json({text: '本人ではない。不正なリクエストです'}, 400);
        return;
      } else {
        // コミュニティID
        var dec_id = results[0].id
          , dec_title = results[0].title
          ;

        // コミュニティを削除する
        client.query(
          'DELETE FROM '+TABLE_DECLARATIONS+
          ' WHERE id = ?',
          [dec_id],
          function(err2, results2) {
            if (err2) {throw err2;}
		res.json({flg_delete_dec: 'ok'}, 200);
            	return;
          }
        );

        // コミュニティに紐付く参加者を削除する
        client.query(
          'DELETE FROM '+TABLE_SUPPORTERS+
          ' WHERE declaration_id = ?',
          [dec_id],
          function(err2, results2) {
            if (err2) {throw err2;}
          }
        );

        // コミュニティに遷移するお知らせを削除する
        client.query(
          'DELETE FROM '+TABLE_USER_OSHIRASE_CONTENTS+
          ' WHERE url = "/dec/?"',
          [dec_id],
          function(err2, results2) {
            if (err2) {throw err2;}
          }
        );


      }
    }

  );

});


/**
 * --------------------------------------------------------
 * チャット部屋削除(delete)
 * --------------------------------------------------------
 */
app.post('/delete-chatroom', function (req, res) {
  // ログインチェック
  if (!__isAuthLogin(req)) {
    res.json({ text: 'ログインして下さい' }, 401);
    return;
  }

  var onetime_token = __getOnetimeToken(req.session.auth.user_id);

  // リクエストチェック
  // id
  try {
    check(req.body.dec_id).isInt();

    // onetime_token のチェック
    if (!__checkOnetimeToken(req.body.onetime_token, onetime_token)) {
      throw 'error!! onetime_token';
    }

  } catch (e) {
    logger.error(e.message); //Invalid
    res.json({text: '不正なIDです'}, 400);
    return;
  }

  // 削除対象部屋の管理人 が本人かどうかチェック
  client.query(
    'SELECT id, title'+
    ' FROM '+TABLE_DECLARATIONS_CH+
    ' WHERE id = ? AND user_id = ?',
    [req.body.dec_id, req.session.auth.user_id],
    function(err, results) {
      if (err) {throw err;}
      if (results.length === 0) {
        res.json({text: '本人ではない。不正なリクエストです'}, 400);
        return;
      } else {
        // チャット部屋ID
        var dec_id = results[0].id
          , dec_title = results[0].title
          ;

        // チャット部屋を削除する
        client.query(
          'DELETE FROM '+TABLE_DECLARATIONS_CH+
          ' WHERE id = ?',
          [dec_id],
          function(err2, results2) {
            if (err2) {throw err2;}
            res.json({flg_delete_chatroom: 'ok'}, 200);
            return;
          }
        );

        // 部屋に紐付くコメントを削除する
        client.query(
          'DELETE FROM '+TABLE_DOT1_COMMENTS+
          ' WHERE dec_id = ?',
          [dec_id],
          function(err2, results2) {
            if (err2) {throw err2;}
          }
        );

        // 部屋に遷移するお知らせを削除する
        client.query(
          'DELETE FROM '+TABLE_USER_OSHIRASE_CONTENTS+
          ' WHERE url = "/ch/?"',
          [dec_id],
          function(err2, results2) {
            if (err2) {throw err2;}
          }
        );

	// ブログに遷移するお知らせを削除する
        client.query(
          'DELETE FROM '+TABLE_USER_OSHIRASE_CONTENTS+
          ' WHERE url = "/suc/?"',
          [dec_id],
          function(err2, results2) {
            if (err2) {throw err2;}
          }
        );


      }
    }

  );

});




/**
 * --------------------------------------------------------
 *  メール送信
 * --------------------------------------------------------
 */
app.post('/sendmail', function (req, res) {
  // ログインチェック
  if (!__isAuthLogin(req)) {
    res.json({ text: 'ログインして下さい' }, 401);
    return;
  }

  // リクエストチェック
  // id
  try {
    check(req.body.dec_id).isInt();
    check(req.body.owner_id).isInt();
  } catch (e) {
    logger.error(e.message); //Invalid
    res.json({text: '不正なIDです'}, 400);
    return;
  }

  // ログインID がイベントオーナーかどうかチェック
  client.query(
    'SELECT id, title, mailsend_status'+
    ' FROM '+TABLE_DECLARATIONS+
    ' WHERE id = ? AND user_id = ?',
    [req.body.dec_id, req.session.auth.user_id],
    function(err, results) {
      if (err) {throw err;}
      if (results.length === 0) {
        res.json({text: 'オーナーではない。不正なリクエストです'}, 400);
        return;
      } else {
        // イベントID・タイトル
        var event_id = results[0].id
          , event_title = results[0].title
          , mailsend_status = results[0].mailsend_status
          ;

        // 送信履歴のチェック
        if (mailsend_status) {
          res.json({text: '既に送信済みです'}, 400);
          return;
        }

        // メール送信用リストを取得する
        client.query(
          'SELECT u.mail_addr, u.name'+
          ' FROM '+TABLE_SUPPORTERS+' AS s'+
          ' INNER JOIN '+TABLE_USERS+' AS u ON s.user_id = u.id'+
          ' WHERE s.declaration_id = ?',
          [req.body.dec_id],
          function(err2, results2) {
            if (err2) {throw err2;}
            if (results2.length > 0) {


              // メール送信
              for (var i=0; i < results2.length; i++) {
                var text_msg = ''
                 , email_tmpl = fs.readFileSync(__dirname + '/views/email/start-event.ejs', 'utf8')
                 , mailto     = results2[i].mail_addr
                 , subject    = '【EVENTスタート】'+event_title+' ｜SYABERI-HOUSE'
                 ;
                text_msg = ejs.render(email_tmpl, {
                   user_name: results2[i].name
                 , event_id: event_id
                 , event_owner_name: req.session.auth.user_name
                 , event_title: event_title
                });
                __sendEmail(text_msg, conf, mailto, subject);
              }

              // メール送信OK
              res.json({flg_sendmail: 'ok'}, 200);

              // status update
              client.query(
                'UPDATE '+TABLE_DECLARATIONS+
                ' SET mailsend_status = ?'+
                ' WHERE id = ?',
                ['1', req.body.dec_id],
                function(err3) {
                  if (err3) {throw err3;}
                }
              );


              return;

            } else {
              res.json({text: 'no_results'}, 200);
              return;
            }
          }
        );
      }
    }

  );

});




/**
 * --------------------------------------------------------
 * POST: アップロード
 * --------------------------------------------------------
 */
app.post('/upload', function (req, res) {
  var form = new formidable.IncomingForm()
    , files = []
    , fields = []
    ;


//////////////////////////////////////////////////////
logger.debug('----- app.post/upload: ');
var  dec_image2 = '';

logger.info(req.body);
logger.info(req.files);

	dec_image2   = req.body.dec_image2;

	//ファイル保存場所
	var uploadDir=__dirname+'/public/uploads';

if(req.files){

	//logger.debug("00--"+uploadDir);
	//logger.debug("11--"+req.files.dec_image2.path);

	var form = new formidable.IncomingForm()
	, files = []
	, fields = []
	;

	//logger.debug("22--"+req.files.dec_image2.name);
	//logger.debug("33--"+files);

	//ファイル名をtmpのままにする
	var uploadDir_two =req.files.dec_image2.path.split('/');
	//logger.debug("44--"+uploadDir_two[2]);
	//logger.debug("55--"+req.files.dec_image2.path, uploadDir + uploadDir_two[2] + '.jpg');
	var filename_Perse = uploadDir + '/' +uploadDir_two[2] + '.jpg';
	var filename_Return = uploadDir_two[2] + '.jpg';

	fs.rename(req.files.dec_image2.path, filename_Perse);

//logger.debug(filename_Perse);
//logger.debug(filename_Return);

	res.json({filename:filename_Return},200)
}
//////////////////////////////////////////////////////


  form.uploadDir = __dirname+'/public/uploads';

  logger.debug('upload--------------------');logger.debug(__dirname+'/public/uploads');
  form
    .on('field', function(field, value) {
      logger.debug('field----------------');logger.debug(field, value);
      fields.push([field, value]);
    })
    .on('file', function(field, file) {
      logger.debug('file-----------------');logger.debug(field, file);
      fs.rename(file.path, file.path+'.jpg');
      files.push([field, file]);
    })
    .on('end', function() {
      logger.debug('---> upload done');
      logger.debug('received files-----');logger.debug(util.inspect(files, true, null));
//      var tmp_arr = files[0];
//      logger.debug(tmp_arr[1].path);
      var tmp_path = files[0][1].path.split('/');
      res.send({'status': 'File was uploaded successfuly!',
        'filename': '/uploads/'+tmp_path[8]+'.jpg'
      });
      //res.end('received files:\n\n '+util.inspect(files));
    });



  form.parse(req, function(err, fields, files) {
    logger.debug('---> form.parse');
//    logger.debug(util.inspect({files: files}));
//    fs.rename(files.pic.path, files.pic.path+'.jpg', function (err) {
//      if (err) {throw err;}
//      var tmp_path = files.pic.path.split('/');logger.debug(tmp_path);
//      res.send({'status': 'File was uploaded successfuly!',
//        'filename': '/uploads/'+tmp_path[8]+'.jpg'
//      });
//    });
    //res.end(sys.inspect({fields: fields, files: files}));
  });
  logger.debug('upload-after-------------------');
  return;
});





// 認証関連
everyauth.helpExpress(app);
everyauth.everymodule.logoutPath('/logout');
everyauth.everymodule.logoutRedirectPath('/');


/**
 * --------------------------------------------------------
 * App listen.
 * --------------------------------------------------------
 */

app.listen( conf.listen.port , function () {
  logger.info('   app listening on http://'+conf.listen.url);
});

/**
 * --------------------------------------------------------
 * 初期データ読み込み
 * --------------------------------------------------------
 */
/*
var houses_list = [];
client.query(
  'SELECT id, name FROM '+TABLE_HOUSES,
  function(err, results, fields) {
    if (err) {
      throw err;
    }
    logger.info(results);
    var max_length = results.length;
    if (max_length > 0) {
      for (var i = 0; i < max_length; i++) {
        houses_list[results[i].name] = results[i].id;
      }
    }
  }
);
*/


/**
 * Socket.IO server (single process only)
 */

var io = sio.listen(app)
  , type_list = {}
  , avatar_list = {}
  , avatar_array = []
  , audience_list = {}
  , audience_array = []
  ;


var house = io
  .of('/houses')
  .on('connection', function (socket) {
    logger.info('house-server: ok');
    /**
     * ----------------------------------------------------
     * house に入室した場合：ユーザー追加処理
     * ----------------------------------------------------
     */
    socket.on('join', function (url_id, house_id, user_id, user_image, sessionid, fn) {

      //logger.debug('----- join client sessionid: ');logger.debug(sessionid);
      // ユーザーを追加
      socket.join(url_id);
      //logger.debug('----- join server sessionid: ');logger.debug(socket.sessionid);
      //logger.debug('----- join socketdata: ');logger.debug(socket.manager.rooms);
      // house 情報をset
      socket.set('house_data', url_id+'___'+house_id);

      // ユーザー・オーディエンスリストを事前取得
      var avatar_members = []
        , audience_members = []
        ;

      socket.get('socket_avatar_list', function(err, socket_avatar_list) {
        if (!err && socket_avatar_list) {
          avatar_array = socket_avatar_list.split(',');
        }
      });
      socket.get('socket_audience_list', function(err, socket_audience_list) {
        if (!err && socket_audience_list) {
          audience_array = socket_audience_list.split(',');
        }
      });


      // オーディエンスか否かチェック
      client.query(
        'SELECT id FROM '+TABLE_HOUSES+' WHERE id = ? AND members LIKE ?',
        [house_id, '%,'+user_id+',%'],
        function(err, results, fields) {
          if (err) {throw err;}
          //logger.debug('----- socket.on(join),results: ');logger.debug(results);
          if (results.length == 0) {
            // オーディエンス true
            if (audience_list[sessionid]) {
              // すでに存在
            } else {
              // 存在しないので追加する
              audience_list[sessionid] = user_image;
              audience_array.push(sessionid);
              type_list[sessionid] = 'audience';
              // オーディエンス情報をセットする
              socket.set('socket_audience_list', audience_array.toString());
            }

          } else {

            // 管理者 true
            if (avatar_list[sessionid]) {
              // すでに存在
            } else {
              // 存在しないので追加する
              avatar_list[sessionid] = user_image;
              avatar_array.push(sessionid);
              type_list[sessionid] = 'avatar';
              // ユーザー情報をセットする
              socket.set('socket_avatar_list', avatar_array.toString());
            }

          }


          // 現在house に入室している全ユーザーを取得
          logger.debug('----- join socket.manager.rooms: ');logger.debug(socket.manager.rooms['/houses/'+url_id]);
          var members = []
            , i_avatar = 0
            , i_audience = 0
            , max_rooms_member = socket.manager.rooms['/houses/'+url_id].length
            ;
          for (var i = 0; i < max_rooms_member; i++){
            var member_id = socket.manager.rooms['/houses/'+url_id][i];

            var disp_type = type_list[member_id];

            // member から画像url を取得する
            if (disp_type == 'avatar') {
              avatar_members[i_avatar] = {'session_id': member_id, 'avatar_img': avatar_list[member_id]};
              i_avatar++;
            } else {
              audience_members[i_audience] = {'session_id': member_id, 'audience_img': audience_list[member_id]};
              i_audience++;
            }
          }


      client.query(
        'SELECT * FROM '+TABLE_DECLARATIONS_CH+' WHERE id = ?',
        [house_id],
        function(err, results, fields) {
          if (err) {throw err;}

socket.manager.rooms['/dec/'+results[0].dec_relation_id] = member_id;	//live

          //logger.debug('----- join members-data: ');logger.debug(avatar_members);
          // 自分自身のみへデータ送る
          socket.to(url_id).emit('user join', {
            'session_id': sessionid, 'avatar_img': user_image, 'avatar_members': avatar_members
          });

          // 自分自身以外の全員へデータ送る
          socket.broadcast.to(url_id).emit('user join', {
            'session_id': sessionid, 'avatar_img': user_image, 'avatar_members': avatar_members
          });

          // 自分自身のみへデータ送る
          socket.to(url_id).emit('audience join', {
            'session_id': sessionid, 'audience_img': user_image, 'audience_members': audience_members
          });
          // 自分自身以外の全員へデータ送る
          socket.broadcast.to(url_id).emit('audience join', {
            'session_id': sessionid, 'audience_img': user_image, 'audience_members': audience_members
          });

logger.debug(socket);
});


          // 現在house に入室しているユーザーを取得
//          var max_avatar_member = avatar_array.length;
//          // avatar の繰り返し
//          for (var member_id in avatar_list) {
//            avatar_members.push({'session_id': member_id, 'avatar_img': avatar_list[member_id]});
//          }
//          logger.debug('avatar_members-------------------');logger.debug(avatar_members);
//          //for (var i = 0; i < max_avatar_member; i++) {
//          //  var member_id = avatar_array[i];
//          //  avatar_members[i] = {'session_id': member_id, 'avatar_img': avatar_list[member_id]};
//          //}
//
//          // 自分自身のみへデータ送る
//          socket.to(url_id).emit('user join', {
//            'session_id': sessionid, 'avatar_img': user_image, 'avatar_members': avatar_members
//          });
//          // 自分自身以外の全員へデータ送る
//          socket.broadcast.to(url_id).emit('user join', {
//            'session_id': sessionid, 'avatar_img': user_image, 'avatar_members': avatar_members
//          });
//
//
//          // 現在house に入室しているオーディエンスを取得
//          var max_audience_member = audience_array.length;
//          // audience の繰り返し
//          for (var i = 0; i < max_audience_member; i++) {
//            var member_id = audience_array[i];
//            audience_members[i] = {'session_id': member_id, 'audience_img': audience_list[member_id]};
//          }
//
//          // 自分自身のみへデータ送る
//          socket.to(url_id).emit('audience join', {
//            'session_id': sessionid, 'audience_img': user_image, 'audience_members': audience_members
//          });
//          // 自分自身以外の全員へデータ送る
//          socket.broadcast.to(url_id).emit('audience join', {
//            'session_id': sessionid, 'audience_img': user_image, 'audience_members': audience_members
//          });
//
//
//          logger.info('join-conn: ok');

        }
      );



      // 最新のコメント50件分を取得
      client.query(
        //'SELECT cmt.id, cmt.created_at, cmt.body, cmt.image AS cmt_image, usr.name, usr.image AS usr_image'
        //+' FROM '+TABLE_COMMENTS+' AS cmt'
        //+' LEFT JOIN '+TABLE_USERS+' AS usr ON cmt.user_id=usr.id'
        //+' WHERE cmt.house_id = ?'
        //+' ORDER BY cmt.created_at DESC LIMIT 10',
        'SELECT id, created_at, user_id, user_name, body, image, profile_image_url'
        +'    , ext_image_path, ext_image_domain'
        +'    , type'
        +' FROM '+TABLE_DOT1_COMMENTS
        +' WHERE dec_id = ?'
        +' ORDER BY created_at DESC LIMIT 50',
        [house_id],
        function(err, results, fields) {
          if (err) {throw err;}
          if (!results[0]) {
            // DB に無し。

          } else {
            // DB に有り。
            var max_result = results.length
              , send_data = [];
            //logger.debug('最新のコメント10件-----');logger.debug(results);
            for (var i = 0; i < max_result; i++) {
              var tmp_data = results[i];
              // データを溜め込んでいく
              send_data[i] = {'comment_id': tmp_data.id,
                'message_time': tmp_data.created_at, 'userMessage': tmp_data.body,
                'user_id': tmp_data.user_id,
                'image_src': tmp_data.image, 'userName': tmp_data.user_name,
                'ext_image_path': tmp_data.ext_image_path, 'ext_image_path': tmp_data.ext_image_domain,
                'user_image': tmp_data.profile_image_url, 'iframeURL': '',
                'source': tmp_data.source, 'type': tmp_data.type
              };

            }


            // クライアント(自分だけ)へデータを送る
            socket.to(url_id).emit('recent-comments', send_data);
          }
        }
      );




      logger.info('join-conn: ok');
    });

	/**
	 * ----------------------------------------------------
	 * ブログ化のお知らせ
	 * ----------------------------------------------------
	 */
	socket.on('blog info', function (data)
	{
		socket.get('house_data', function(err, house_data)
		{
			var resArray = house_data.split('___');
			// 自分以外、全員に配信
			socket.broadcast.to(resArray[0]).emit( 'blog alert', { 'blog_message':"ブログ化されました。ブログページに遷移します。", 'blog_data':data });
		})
		return;
	});

    /**
     * ----------------------------------------------------
     * チャットメッセージのやり取り
     * ----------------------------------------------------
     */
    socket.on('chat message',
    function (user_id, userName, user_image, message, iframeURL, image_src, message_time, fn) {
      //logger.info('chat message received: ok');
      socket.get('house_data', function(err, house_data) {
        //logger.info('house_data: '+house_data);

        // house_data を分解
        var resArray = house_data.split('___');
        //logger.info('url_id: '+resArray[0]);
        //logger.info('house_id: '+resArray[1]);
        //logger.info('frameURL: '+iframeURL);

        var ust_tag = '';
        if (iframeURL.indexOf('ustream.tv') !== -1) {

          // 同期処理
          async.series([
            function(callback){
              var embed_tag = '';
              // VideoIDの取得
              var ustream_vid = iframeURL.match(/\/channel\/([\d\w]+)/);
              if (ustream_vid[1]) {
                var ust_api_url = 'http://api.ustream.tv/json/channel/';
                ust_api_url += ustream_vid[1]+'/getCustomEmbedTag';
                ust_api_url += '?params=autoplay:true;mute:false;height:300;width:500';
                ust_api_url += '&key='+conf.ustream.apiKey;

                //console.log(ust_api_url);

                var res_path = nodeurl.parse(ust_api_url);
                //logger.debug(res_path);
                var client = nodehttp.createClient(
                  res_path.port || 80, res_path.hostname
                );
                var req = client.request('GET'
                  , res_path.path
                );
                req.end();

                req.on('response', function(res) {
                  res.on('data', function(chunk) {
                    //logger.debug(JSON.parse(chunk));
                    if (JSON.parse(chunk)) {
                      embed_tag = JSON.parse(chunk).results;
                    }
                  });
                  res.on('end', function() {
                    callback(null, embed_tag);
                  });
                });
              }

              //callback(null, embed_tag);
            },
//            function(callback){
//              // do some more stuff ...
//              callback(null, 'two');
//            },
          ],
          // optional callback
          function(err, results){
            // results is now equal to ['one', 'two']
            //logger.debug(results);
            ust_tag = results;
          });


        }






        if (!image_src) {image_src = '';}
        var extimg_path = null;
        var extimg_domain = null;
        if (iframeURL) {
          var res_url = nodeurl.parse(iframeURL);
          if (res_url.href) {

            var md5digest = get_md5_hex(res_url.href);
            var ext = nodepath.extname(res_url.href);
            var filename = md5digest+ext;
            var destPath = __dirname+'/public/ext-img/'+filename;
            extimg_path = '/ext-img/'+filename;
            extimg_domain = res_url.hostname;

            exec('wget -O "'+destPath+'" "'+res_url.href+'"',
              function(err, stdout, stderr) {
                if (err) {
                  logger.error('exec error:'+err);
                }
              }
            );

          }
        }

        if (!extimg_path) {
          extimg_path = '';
          extimg_domain = '';
        }
        // オリジナルコメントテーブルに格納 
        //client.query(
        //  'INSERT INTO '+TABLE_COMMENTS+' (created_at, house_id,'+
        //  ' user_id, body, image'+
        //  ') VALUES (NOW(), ?, ?, ?, ?)',
        //  [resArray[1], user_id, message, image_src],
        //  function(err, results) {
        //    if (err) {
        //      throw err;
        //    } else {
        //      return;
        //    }
        //  }
        //);

        // dot1_commentsテーブルにも格納
        // (読みだす時にこのテーブルだけを読みこめばいいように楽する為)
        client.query(
          'INSERT INTO '+TABLE_DOT1_COMMENTS+' (created_at, dec_id'+
          ', user_id, user_id_str, user_name, body, image'+
          ', ext_image_path, ext_image_domain, max_id_str'+
          ', profile_image_url, profile_image_url_https'+
          ', source, to_user, to_user_id, to_user_id_str, to_user_name'+
          ', type'+
          ') VALUES ('+
          '  NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?'+
          ')',
          [resArray[1], user_id, '', userName, message, image_src
            , extimg_path, extimg_domain, ''
            , user_image, '', '', '', '', '', '', ''
          ],
          function(err, results) {
            if (err) {throw err;}

            client.query(
              'SELECT LAST_INSERT_ID() AS last_id FROM '+TABLE_DOT1_COMMENTS,
              function(err2, results2) {
                if (err2) {throw err2;}
                if (results2[0]) {

                  // iframeurl がある場合、あえて遅延させる。外部画像を表示させる為

                  var last_id = results2[0].last_id;
                  // 自分自身だけに配信
                  socket.to(resArray[0]).emit('chat message', {
                    'comment_id': last_id, 'userName': userName, 'user_image': user_image,
                    'userMessage': message, 'iframeURL': iframeURL, 'image_src': image_src,
                    'message_time': message_time, 'is_owner': true,
                    'ext_image_path': extimg_path, 'ext_image_domain': extimg_domain
                  });

                  // 自分以外、全員に配信
                  socket.broadcast.to(resArray[0]).emit('chat message', {
                    'comment_id': last_id, 'userName': userName, 'user_image': user_image,
                    'userMessage': message, 'iframeURL': iframeURL, 'image_src': image_src,
                    'message_time': message_time, 'is_owner': false,
                    'ext_image_path': extimg_path, 'ext_image_domain': extimg_domain
                  });
                }
              }
            );

          }
        );
      })

      return;
      //logger.info('socket.manager.rooms: ');logger.info(socket.manager.rooms);
//      logger.info('socket.manager.roomClients: ');logger.info(socket.manager.roomClients);

    });

    /**
     * ----------------------------------------------------
     * タイピング中の場合
     * ----------------------------------------------------
     */
    socket.on('user-typing', function (user_id, userName) {
      socket.get('house_data', function(err, house_data) {
        if (err) {return;}
        var resArray = [];
        // house_data を分解
        if (house_data) {
          resArray = house_data.split('___');
        } else {
          return;
        }

        // 自分自身以外の全員へデータ送る
        socket.broadcast.to(resArray[0]).emit('user-typing', {
          'user_id': user_id, 'userName': userName
        });
      })
    });

    /**
     * ----------------------------------------------------
     * video-startの場合
     * ----------------------------------------------------
     */
    socket.on('video-start', function (video_id, seek_time) {
      socket.get('house_data', function(err, house_data) {
        if (err) {return;}
        var resArray = [];
        // house_data を分解
        if (house_data) {
          resArray = house_data.split('___');
        } else {
          return;
        }

        // 自分自身以外の全員へデータ送る
        socket.broadcast.to(resArray[0]).emit('video-start', {
          'video_id': video_id, 'seek_time': seek_time, 'flg_owner': false
        });

        // 自分自身だけに送る
        socket.to(resArray[0]).emit('video-start', {
          'video_id': video_id, 'seek_time': seek_time, 'flg_owner': true
        });
      })
    });

    /**
     * ----------------------------------------------------
     * video-playの場合
     * ----------------------------------------------------
     */
    socket.on('video-play', function () {
      socket.get('house_data', function(err, house_data) {
        if (err) {return;}
        var resArray = [];
        // house_data を分解
        if (house_data) {
          resArray = house_data.split('___');
        } else {
          return;
        }

        // 自分自身以外の全員へデータ送る
        socket.broadcast.to(resArray[0]).emit('video-play', {
        });

        // 自分自身だけに送る
        socket.to(resArray[0]).emit('video-play', {
        });

      })
    });

    /**
     * ----------------------------------------------------
     * video-pauseの場合
     * ----------------------------------------------------
     */
    socket.on('video-pause', function () {
      socket.get('house_data', function(err, house_data) {
        if (err) {return;}
        var resArray = [];
        // house_data を分解
        if (house_data) {
          resArray = house_data.split('___');
        } else {
          return;
        }

        // 自分自身以外の全員へデータ送る
        socket.broadcast.to(resArray[0]).emit('video-pause', {
        });

        // 自分自身だけに送る
        socket.to(resArray[0]).emit('video-pause', {
        });
      })
    });

    /**
     * ----------------------------------------------------
     * 感情アイコンがオサれた場合
     * ----------------------------------------------------
     */
    socket.on('click-emotion', function (userName, userId, userMessage, user_id) {
      socket.get('house_data', function(err, house_data) {
        if (err) {return;}
        var resArray = [];
        // house_data を分解
        if (house_data) {
          resArray = house_data.split('___');
        } else {
          return;
        }

        // 自分自身以外の全員へデータ送る
        socket.broadcast.to(resArray[0]).emit('click-emotion', {
          'userName': userName, 'userId': userId, 'userMessage': userMessage
        });

        client.query(
          'INSERT INTO '+TABLE_AUDIENCES+' (created_at, house_id,'
          +' user_id, body'
          +') VALUES (NOW(), ?, ?, ?)',
          [resArray[1], user_id, userMessage],
          function(err, results) {
            if (err) {
              throw err;
            } else {
              return;
            }
          }
        );
      })

    });


    /**
     * ----------------------------------------------------
     * twitter list
     * ----------------------------------------------------
     */
    socket.on('get-twitter-list', function (url_id, house_id) {
      //logger.info('get-twitter-list---------ok');
      // 最新のコメント100件分を取得
      client.query(
        'SELECT id, created_at, user_name, body, tweet_id_str, profile_image_url'
        +' FROM '+TABLE_STREAM_LOGS
        +' WHERE house_id = ?'
        +' ORDER BY created_at DESC LIMIT 100',
        [house_id],
        function(err, results, fields) {
          if (err) {throw err;}
          if (!results[0]) {
            // DB に無し。

          } else {
            // DB に有り。
            var max_result = results.length
              , send_data = [];
            //logger.debug('最新のコメント10件-----');logger.debug(results);
            for (var i = 0; i < max_result; i++) {
              var tmp_data = results[i];
              // 日付を変換する
              //var date = new Date(tmp_data.created_at)
              //  , date_txt = ''
              //  ;

              //date_txt = date.getFullYear()+"-"+(date.getMonth()+1)+"-"+date.getDate();
              //date_txt+= "T"+date.toLocaleTimeString();
              //logger.debug('date_txt---------');logger.debug(date_txt);

              // データを溜め込んでいく
              send_data[i] = {'comment_id': tmp_data.id,
                'message_time': tmp_data.created_at, 'userMessage': tmp_data.body,
                //'message_time': date_txt, 'userMessage': tmp_data.body,
                'image_src': '', 'userName': tmp_data.user_name,
                'user_image': tmp_data.profile_image_url, 'iframeURL': ''
              };

            }


            // クライアント(自分だけ)へデータを送る
            socket.to(url_id).emit('recent-tweet', send_data);
          }
        }
      );
    });


    /**
     * ----------------------------------------------------
     * 接続が切れた場合
     * ----------------------------------------------------
     */
    socket.on('disconnect', function () {
      socket.get('house_data', function(err, house_data) {
        if (err) {return;}
        var resArray = [];
        if (house_data) {
          resArray = house_data.split('___');
        } else {
          return;
        }
        //logger.info('url_id: '+resArray[0]);
        //logger.info('house_id: '+resArray[1]);

        // avatar_list から削除
        delete avatar_list[socket.sessionid];

        // 自分自身以外の全員へデータ送る
        socket.broadcast.to(resArray[0]).emit('user leave', {
          'id': socket.sessionid
        });

        socket.leave(resArray[0]);
      })
    });

});




