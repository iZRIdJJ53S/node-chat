/**
 * --------------------------------------------------------
 * Module dependencies.
 * --------------------------------------------------------
 */

var express = require('express') // フレームワーク(cakePHP 的な感じ)
  , stylus  = require('stylus')  // CSSフレームワーク
  , nib     = require('nib')     // coffeescript ライブラリ？よく分からん
  , sio     = require('socket.io') // WebSockets realtime
  , log4js  = require('log4js')    // ロギング
  , util    = require('util')      // デバッグ等に便利な
  , fs      = require('fs')        // ファイル操作
  , exec    = require('child_process').exec // シェルコマンドを叩く為に必要
  , formidable = require('formidable') // ファイルアップロード
  , everyauth  = require('everyauth')  // 認証
  , httpProxy  = require('http-proxy') // プロキシサーバー
  , conf       = require('./conf')     // 認証等の設定情報
  , validator  = require('validator').check // validator
  , sanitize   = require('validator').sanitize // sanitize
  ;

// ----------------------------------------------
// 定数設定
// ----------------------------------------------
var FLG_SUPPORTER_COMP_STAT = 1; // 完了/サクセスしたもの
var FLG_SUPPORTER_WANT_STAT = 2; // 現在開催中のもの
var FLG_SUPPORTER_FAIL_STAT = 3; // 失敗/挫折したもの



// ----------------------------------------------
// ロギング関連初期設定
// ----------------------------------------------
log4js.addAppender(log4js.consoleAppender());
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
  , TABLE_CLICK_LOGS  = 'click_logs'
  , TABLE_COMMENT_STREAMS = 'comment_streams'
  , TABLE_DECLARATIONS    = 'declarations'
  , TABLE_SUPPORTERS      = 'supporters'
  , TABLE_DOT1_COMMENTS   = 'dot1_comments'
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
function oauthAddUser (source, accessToken, accessSecret, sourceUser) {
  var user
    , tmp_user_id;

  // non-password-based
  user = usersById[++nextUserId] = {id: nextUserId};
  user[source] = sourceUser;

  // パラメータチェック
  var name = sourceUser.screen_name
    , sex  = 1
    , age  = 1
    , visible = 1
    , image   = sourceUser.profile_image_url
    , description = sourceUser.description
    , url         = sourceUser.url
    ;
  name = (name) ? name : '';
  sex  = (sex)  ? sex  : 1;
  age  = (age)  ? age  : 1;
  visible = (visible) ? visible : 1;
  image   = (image)   ? image   : '';
  description = (description) ? description : '';
  url         = (url)         ? url         : '';

  // DB に値があるかチェック
  client.query(
    'SELECT id FROM '+TABLE_USERS+' WHERE name = ? AND oauth_service = ?',
    [name, source],
    function(err, results, fields) {
      if (err) {throw err;}
      //logger.debug('----- oauth-sql:results ');logger.debug(results);
      if (!results[0]) {
        //logger.debug('----- oauth-sql-mode:insert ');
        // DB に無し。INSERT
        client.query(
          'INSERT INTO '+TABLE_USERS+
          ' SET created_at = NOW(), name = ?, oauth_id = ?,'+
          ' oauth_secret_id = ?, oauth_service = ?, sex = ?, age = ?, visible = ?,'+
          ' image = ?, description = ?, url = ?',
          [name, accessToken, accessSecret, source, sex, age, visible, image,
           description, url
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
          ' SET sex = ?, age = ?, image = ?, description = ?, url = ?'+
          ' WHERE name = ? AND oauth_service = ?',
          [sex, age, image, description, url, name, source],
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
  //  [name, source],
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
      sess.auth.name = twitUser.screen_name;
      sess.auth.image = twitUser.profile_image_url;
      sess.auth.service = 'twitter';

      //if (!usersByTwitId[twitUser.id]) {
      //  usersByTwitId[twitUser.id] = oauthAddUser('twitter', accessToken, accessSecret, twitUser);
      //}

      //logger.debug('---------- usersByTwit ');logger.debug(usersByTwitId[twitUser.id]);
      return usersByTwitId[twitUser.id] ||
        (usersByTwitId[twitUser.id] = oauthAddUser('twitter', accessToken, accessSecret, twitUser));
    })
    .redirectPath('/');

/**
 * --------------------------------------------------------
 * http proxy Server
 * --------------------------------------------------------
 */
var proxy_options = {
  router: {
    'rank-life.com': '127.0.0.1:8080' // apache
   ,'www.rank-life.com': '127.0.0.1:8080' // apache
   ,'live.rank-life.com': '127.0.0.1:8081' // node.js
   ,'sh.rank-life.com': '127.0.0.1:8082' // node.js
  }
};
var httpProxyServer = httpProxy.createServer(proxy_options);
httpProxyServer.listen(80);


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
  // CSSテンプレート
  app.use(stylus.middleware({ src: __dirname + '/public', compile: compile }));
  app.use(express.static(__dirname + '/public')); // 静的ファイルパス

  app.use(express.cookieParser()); // クッキー操作
  app.use(express.session({ secret: 'team0110' }));
  app.use(express.bodyParser()); // POSTメソッド操作
//  app.use(app.router); // app.get の優先順位を決めれる
  app.use(everyauth.middleware()); // 認証ミドルウェア
  app.set('views', __dirname+'/views'); // テンプレートパス
  app.set('view engine', 'jade'); // テンプレートエンジンの指定

  function compile (str, path) {
    return stylus(str)
      .set('filename', path)
      .use(nib());
  };
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

// ----------------------------------------------
// トップページ
// ----------------------------------------------
app.get('/', function (req, res) {
  logger.info('app.get: /');
  //logger.info('---------- req.session: ----- ');logger.info(req.session);
  //res.render('home', { layout: false });

  if (req.session && req.session.auth) {
    client.query(
      'SELECT id, sex, age, mail_addr'+
      ' FROM '+TABLE_USERS+
      ' WHERE name = ? AND oauth_service = ?',
      [req.session.auth.name, req.session.auth.service],
      function(err, results, fields) {
        if (err) {throw err;}
        if (results) {
          req.session.auth.user_id = results[0].id;
          // mail_addr のチェック。無ければ初回設定ページへリダイレクト
          if (!results[0].mail_addr) {
            res.redirect('/regist');
            return;
          } else {
            res.redirect('/dec');
            return;
          }
        }
      }
    );

  } else {

    // 最新の宣言リストを取得
    client.query(
      'SELECT d.id, d.created_at, d.title, d.description, d.user_id'+
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
        if (results.length === 0) {
          res.send('declaration error: no result');
          return;
        } else {
          var dec_top_data = {};
          var dec_list = [];

          var max_dec_num = results.length;
          for (var i = 0; i < max_dec_num; i++) {
            if (i === 0) {
              dec_top_data = results[0];
            } else {
              var tmp_cnt = i - 1;
              dec_list[tmp_cnt] = results[i];
            }
          };

          res.render('top', { 'layout': false,
            'dec_top_data': dec_top_data
           ,'declaration_list': dec_list
           //,'user_name': req.session.auth.name
           //,'user_image': req.session.auth.image
           //,'user_id': req.session.auth.user_id
          });
          return;

        }
      }
    );
  }


});


// ----------------------------------------------
// dotoneとは？(what)
// ----------------------------------------------
app.get('/what', function (req, res) {

    client.query(
      'SELECT d.id, d.created_at, d.title, d.description, d.user_id'+
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

          res.render('what', { 'layout': false,
            'declaration_list': results
           //,'user_name': req.session.auth.name
           //,'user_image': req.session.auth.image
           //,'user_id': req.session.auth.user_id
          });
          return;

        }
      }
    );

});


// ----------------------------------------------
// 宣言一覧(declaration)
// ----------------------------------------------
app.get('/dec', function (req, res) {
  logger.info('app.get: /dec');
  //logger.info('---------- req.session: ----- ');logger.info(req.session);
  //res.render('home', { layout: false });

  //if (req.session && req.session.auth) {
    // 最新の宣言リストを取得
    client.query(
      'SELECT d.id, d.created_at, d.title, d.description, d.user_id'+
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

          res.render('declaration', { 'layout': false,
            'declaration_list': results
           //,'user_name': req.session.auth.name
           //,'user_image': req.session.auth.image
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

  //if (req.session && req.session.auth) {
    // 最新の宣言リストを取得
    client.query(
      'SELECT d.id, d.created_at, d.title, d.description, d.user_id'+
      '  , d.target_num, d.deadline, d.status, d.image'+
      '  , COUNT( spt.declaration_id ) AS supporter_num'+
      '  , (COUNT(spt.declaration_id) / d.target_num) * 100 AS ratio'+
      ' FROM '+TABLE_DECLARATIONS+' AS d'+
      ' INNER JOIN '+TABLE_SUPPORTERS+' AS spt ON d.id = spt.declaration_id'+
      ' WHERE status = ?'+
      ' GROUP BY d.id'+
      ' ORDER BY d.created_at DESC'+
      ' LIMIT 10',
      [FLG_SUPPORTER_COMP_STAT],
      function(err, results, fields) {
        if (err) {throw err;}
        if (results.length == 0) {
          res.send('declaration error: no result');
          return;
        } else {

          res.render('dec_success', { 'layout': false,
            'declaration_list': results
           //,'user_name': req.session.auth.name
           //,'user_image': req.session.auth.image
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




// --------------------------------------------------------
// regist_declarations(宣言登録)
// --------------------------------------------------------
app.get('/regist-declaration', function (req, res) {

  if (!req.session || !req.session.auth) {
    // ログインしていないので、リダイレクト
    res.redirect('/');
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
        res.render('regist', { 'layout': false,
          'user_data': results
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

  if (!req.session || !req.session.auth) {
    // ログインしていないので、リダイレクト
    res.redirect('/');
    return;
  }

  //res.render('mypage', { 'layout': false
  //  ,'user_name': req.session.auth.name
  //  ,'user_image': req.session.auth.image
  //  ,'user_id': req.session.auth.user_id
  //});
  //return;

  var dec_list = [];
  var spt_comp_list = []; // 完了
  var spt_want_list = []; // 募集中
  var spt_fail_list = []; // 挫折

  // 自分が宣言しているリストを取得
  client.query(
    'SELECT d.id, d.created_at, d.title, d.description, d.status, d.image'+
    ' FROM '+TABLE_DECLARATIONS+' AS d'+
    ' WHERE user_id = ?'+
    ' ORDER BY created_at DESC'+
    ' LIMIT 3',
    [req.session.auth.user_id],
    function(err, results, fields) {
      if (err) {throw err;}
      if (results.length === 0) {
        dec_list = [];
      } else {
        dec_list = results;
      }

      // 自分がサポーターになっているリストを取得
      client.query(
        'SELECT s.declaration_id, s.user_id AS supporter_id'+
        '  , d.created_at, d.title, d.description, d.user_id AS owner_id'+
        '  , d.target_num, d.deadline, d.status AS stat, d.image'+
        ' FROM '+TABLE_SUPPORTERS+' AS s'+
        ' INNER JOIN '+TABLE_DECLARATIONS+' AS d ON s.declaration_id = d.id'+
        ' WHERE s.user_id = ?',
        [req.session.auth.user_id],
        function(err2, results2) {
          if (err2) {throw err2;}
          if (results2.length === 0) {
            spt_comp_list = [];
            spt_want_list = [];
            spt_fail_list = [];

            res.render('mypage', {'layout': false
              , 'user_name': req.session.auth.name
              , 'user_image': req.session.auth.image
              , 'user_id': req.session.auth.user_id
              , 'dec_list': dec_list
              , 'spt_comp_list': spt_comp_list
              , 'spt_want_list': spt_want_list
              , 'spt_fail_list': spt_fail_list
            });
          } else {
            var tmp_cnt;
            var counter = {};
            var max_length = results2.length;
            for (var i = 0; i < max_length; i++) {
              var stat = results2[i].stat;
              if (counter[stat]) {
                tmp_cnt = counter[stat];
                counter[stat]++;
              } else {
                tmp_cnt = 0;
                counter[stat] = 1;
              }

              switch (stat) {
                case FLG_SUPPORTER_COMP_STAT:
                  spt_comp_list[tmp_cnt] = results2[i];
                  break;
                case FLG_SUPPORTER_WANT_STAT:
                  spt_want_list[tmp_cnt] = results2[i];
                  break;
                case FLG_SUPPORTER_FAIL_STAT:
                  spt_fail_list[tmp_cnt] = results2[i];
                  break;
                default:
                  break;
              }
            }

            res.render('mypage', {'layout': false
              , 'user_name': req.session.auth.name
              , 'user_image': req.session.auth.image
              , 'user_id': req.session.auth.user_id
              , 'dec_list': dec_list
              , 'spt_comp_list': spt_comp_list
              , 'spt_want_list': spt_want_list
              , 'spt_fail_list': spt_fail_list
            });

          }

        }
      );
    }
  );
});


// --------------------------------------------------------
// one_time_regist
// --------------------------------------------------------
app.get('/regist', function (req, res) {

  if (!req.session || !req.session.auth) {
    // ログインしていないので、リダイレクト
    res.redirect('/');
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
        res.render('regist', { 'layout': false,
          'user_data': results
        });
        return;
      }
    }
  );
});



// --------------------------------------------------------
// 宣言するのフォーム
// --------------------------------------------------------
app.get('/create_dec', function (req, res) {

  if (!req.session || !req.session.auth) {
    // ログインしていないので、リダイレクト
    res.redirect('/');
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
        res.render('create_dec', { 'layout': false,
          'user_data': results
        });
        return;
      }
    }
  );
});





// --------------------------------------------------------
// dec detail (宣言詳細)
// --------------------------------------------------------
app.get('/dec/:id', function (req, res) {
  // ID が正しいかチェックする
  // 正しくなければ、一覧へリダイレクトする
  var dec_id = (req.params.id) ? req.params.id : '';

  // 正しいかDB に確認
  client.query(
    'SELECT d.id, d.created_at, d.title, d.description, d.detail, d.user_id'+
    '  , d.target_num, d.deadline, d.status, d.image'+
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
      if (err) {throw err;}
      if (results.length === 0) {
        res.send('dec_id error: no result');
        return;
      } else {
        res.render('declaration_detail', { 'layout': false,
          'dec_detail': results[0]
        });
        return;
      }
    }
  );

});

// --------------------------------------------------------
// chat_room
// --------------------------------------------------------
app.get('/ch/:id', function (req, res) {
  // ID が正しいかチェックする
  var dec_id = (req.params.id) ? req.params.id : '';

  var user_name = ''
    , user_image = ''
    , user_id = '' 
    , is_owner = false
    , is_supporter = false // サポーターかどうか？。チャットをさせるかどうかの判断で使う
    ;
  if (req.session && req.session.auth) {
    user_id = req.session.auth.user_id;
    user_name = req.session.auth.name;
    user_image = req.session.auth.image;
  } else {
    // ログインしていない
    res.redirect('/');
    return;
  }

  // パラメータが正しいかDB に聞いてみる
  client.query(
    'SELECT id, title AS name, image, description, user_id AS owner_id'+
    ' FROM '+TABLE_DECLARATIONS+' WHERE id = ?',
    [dec_id],
    function(err, results, fields) {
      if (err) {throw err;}
      if (results.length == 0) {
        res.send('id error: no result');
        return;
      } else {
        if (results[0].image == '') {
          // デフォルトの背景画像
          results[0].image = '/img/shiba.jpg';
        }

        // 宣言者かどうかチェック
        if (results[0].owner_id == user_id) {
          is_owner = true;
        }

        // サポーターかどうかチェック
        client.query(
          'SELECT id FROM '+TABLE_SUPPORTERS+
          ' WHERE declaration_id = ? AND user_id = ?',
          [dec_id, user_id],
          function(err2, results2) {
            if (err2) {throw err2;}
            if (results2.length === 0) {
              // サポーターじゃない
            } else {
              // サポーターです
              is_supporter = true;
            }
            res.render('chat', { 'layout': false,
              'house_id': results[0].id, 'house_name': results[0].name, 'url_id': dec_id,
              'house_image': results[0].image, 'house_desc': results[0].description,
              'user_name': user_name, 'user_image': user_image,
              'user_id': user_id,
              'is_owner': is_owner, 'is_supporter': is_supporter
            });
            return;
          }

        );
      }
    }
  );

});




// --------------------------------------------------------
// house_room
// --------------------------------------------------------
app.get('/h/:id', function (req, res) {
  // ID が正しいかチェックする
  // 正しくなければ、topへリダイレクトする
  var url_id = (req.params.id) ? req.params.id : '';
  //logger.debug('----- app.get/h/:id,url_id_typeof: ');logger.debug(typeof url_id);
  //logger.debug('----- app.get/h/:id,url_id: ');logger.debug(url_id);

  if (!req.session || !req.session.auth) {
    // ログインしていないので、リダイレクト
    res.redirect('/');
    return;
  }
  //logger.debug('----- app.get/h/:id,req.session.auth: ');logger.debug(req.session.auth);

  if (url_id == '') {
    res.send('id error: id null');
    return;
    //res.redirect('/');
  } else if (url_id == '[object Object]') {
    return;
//    res.render('home', { 'layout': false, 'house_id': '', 'url_id': '' });
  } else {
    // URLパラメータが正しいかDB に聞いてみる
    client.query(
      'SELECT id, name, image, description FROM '+TABLE_HOUSES+' WHERE url_id = ?',
      [url_id],
      function(err, results, fields) {
        if (err) {throw err;}
        //logger.debug('----- app.get/h/:id,results: ');logger.debug(results);
        if (results.length == 0) {
          res.send('id error: no result');
          return;
        } else {
          if (results[0].image == '') {
            // デフォルトの背景画像
            results[0].image = '/img/shiba.jpg';
          }
          res.render('home', { 'layout': false,
            'house_id': results[0].id, 'house_name': results[0].name, 'url_id': url_id,
            'house_image': results[0].image, 'house_desc': results[0].description,
            'user_name': req.session.auth.name, 'user_image': req.session.auth.image,
            'user_id': req.session.auth.user_id
          });
          return;
        }
      }
    );
  }

});


/**
 * --------------------------------------------------------
 * POST: house 作成
 * --------------------------------------------------------
 */
app.post('/create-house', function (req, res) {
  // ログインチェック
  if (!req.session || !req.session.auth) {
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
  if (!req.session || !req.session.auth) {
    res.redirect('/');
    return;
  }

  // リクエストチェック
  logger.debug('----- app.post/firstset: ');logger.info(req.body);
  var sex = 0;
  var age = 0;
  var mail_addr = '';

  //// sex
  //try {
  //} catch (e) {
  //  console.log(e.message); //Invalid
  //}

  //// age
  //try {
  //} catch (e) {
  //  console.log(e.message); //Invalid
  //}

  // email
  try {
    validator(req.body.sex).is(/^(1|2)$/);
    validator(req.body.age).is(/^[1-8]$/);
    validator(req.body.mail_addr).len(6, 64).isEmail();
  } catch (e) {
    console.log(e.message); //Invalid
    res.redirect('/regist');
    return;
  }

  sex = req.body.sex;
  age = req.body.age;
  mail_addr = req.body.mail_addr;

  client.query(
    'UPDATE '+TABLE_USERS+' SET'+
    '  sex = ?, age = ?, mail_addr = ?'+
    ' WHERE id = ?',
    [sex, age, mail_addr, req.session.auth.user_id],
    function(err) {
      if (err) {throw err;}
      res.redirect('/');
      return;
    }
  );

});

/**
 * --------------------------------------------------------
 * POST: 宣言するの設定
 * --------------------------------------------------------
 */
app.post('/regist_dec', function (req, res) {
  // ログインチェック
  if (!req.session || !req.session.auth) {
    res.redirect('/');
    return;
  }

  // リクエストチェック
  logger.debug('----- app.post/regist_dec: ');logger.info(req.body);
  var title = '';
  var description = '';
  var detail = '';
  var target_num = 0;
  var deadline = '';
  var user_id = req.session.auth.user_id;

  // validate
  try {
    validator(req.body.title).notEmpty().len(1, 250);
    validator(req.body.description).notEmpty();
    validator(req.body.detail).notEmpty();
    validator(req.body.target_num).isInt();
    validator(req.body.deadline).isDate();
  } catch (e) {
    console.log(e.message); //Invalid
    res.redirect('/create_dec');
    return;
  }

  title = req.body.title;
  description = req.body.description;
  detail = req.body.detail;
  target_num = req.body.target_num;
  deadline = req.body.deadline;

  client.query(
    'INSERT INTO '+TABLE_DECLARATIONS+' ('+
    '  created_at, title, description, detail, user_id, target_num, deadline'+
    '  , status, image'+
    ') VALUES ('+
    '  NOW(), ?, ?, ?, ?, ?, ?, ?, ?'+
    ')',
    [title, description, detail, user_id, target_num, deadline
      , 2, ''
    ],
    function(err) {
      if (err) {throw err;}
      res.redirect('/mypage');
      return;
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
  if (!req.session || !req.session.auth) {
    res.json({ text: 'ログインして下さい' }, 200);
    return;
  }

  // リクエストチェック
  // id
  console.log(req.body.id);
  try {
    validator(req.body.id).isInt();
  } catch (e) {
    console.log(e.message); //Invalid
    res.json({text: '不正なIDです'}, 200);
    return;
  }

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
          '  declaration_id , user_id'+
          ') VALUES ('+
          '?, ?'+
          ')',
          [req.body.id, req.session.auth.user_id],
          function(err) {
            if (err) {throw err;}
            res.json({text: '参加しました', cnt_up: true}, 200);
            return;
          }
        );

      } else {
        res.json({text: '既に参加済みです'}, 200);
        return;
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
  if (!req.session || !req.session.auth) {
    res.json({ text: 'ログインして下さい' }, 200);
    return;
  }

  // リクエストチェック
  // id
  try {
    validator(req.body.id).isInt();
  } catch (e) {
    console.log(e.message); //Invalid
    res.json({text: '不正なIDです'}, 200);
    return;
  }

  // シェルコマンド実行
  var child = exec('perl /home/hara/hitorigoto_setting/pre_data/getData.pl '+req.body.id,
    function(err, stdout, stderr) {
      if (err === null) {
        res.json({text: '送信成功しました'}, 200);
        return;
      } else {
        res.json({text: 'error!! 送信失敗しました'}, 200);
        return;
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

  form.uploadDir = '/var/www/vhosts/www41160u.sakura.ne.jp/node-chat/public/uploads';

  form
    .on('field', function(field, value) {
//      logger.debug('field----------------');logger.debug(field, value);
      fields.push([field, value]);
    })
    .on('file', function(field, file) {
//      logger.debug('file-----------------');logger.debug(field, file);
      fs.rename(file.path, file.path+'.jpg');
      files.push([field, file]);
    })
    .on('end', function() {
      //logger.debug('---> upload done');
      //logger.debug('received files-----');logger.debug(util.inspect(files, true, null));
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

app.listen(8081, function () {
//app.listen(8080, function () {
  var addr = app.address();
  logger.info('   app listening on http://' + addr.address + ':' + addr.port);
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
        'SELECT id, created_at, user_name, body, image, profile_image_url'
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
              send_data[i] = {'comment_id': tmp_data.tweet_id_str,
                'message_time': tmp_data.created_at, 'userMessage': tmp_data.body,
                //'message_time': date_txt, 'userMessage': tmp_data.body,
                'image_src': tmp_data.image, 'userName': tmp_data.user_name,
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
     * チャットメッセージのやり取り
     * ----------------------------------------------------
     */
    socket.on('chat message',
    function (user_id, userName, user_image, message, iframeURL, image_src, message_time) {
      //logger.info('chat message received: ok');
      socket.get('house_data', function(err, house_data) {
        //logger.info('house_data: '+house_data);

        // house_data を分解
        var resArray = house_data.split('___');
        //logger.info('url_id: '+resArray[0]);
        //logger.info('house_id: '+resArray[1]);
        //logger.info('frameURL: '+iframeURL);
        socket.broadcast.to(resArray[0]).emit('chat message', {
          'comment_id': '', 'userName': userName, 'user_image': user_image,
          'userMessage': message, 'iframeURL': iframeURL, 'image_src': image_src,
          'message_time': message_time
        });

        if (!image_src) {image_src = '';}
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
          ', user_id, user_id_str, user_name, body, image, max_id_str'+
          ', profile_image_url, profile_image_url_https'+
          ', source, to_user, to_user_id, to_user_id_str, to_user_name'+
          ', type'+
          ') VALUES ('+
          '  NOW(), ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?'+
          ')',
          [resArray[1], user_id, '', userName, message, image_src, ''
            , user_image, '', '', '', '', '', '', ''
          ],
          function(err, results) {
            if (err) {
              throw err;
            } else {
              return;
            }
          }
        );
      })

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
     * star が押された場合
     * ----------------------------------------------------
     */
    socket.on('click-star', function (userName, userId, click_id, user_id) {
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
//        socket.broadcast.to(resArray[0]).emit('click-star', {
//          'userName': userName, 'userId': userId, 'click_id': click_id
//        });

        client.query(
          'INSERT INTO '+TABLE_CLICK_LOGS+' (created_at, house_id,'
          +' user_id, body'
          +') VALUES (NOW(), ?, ?, ?)',
          [resArray[1], user_id, click_id],
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


