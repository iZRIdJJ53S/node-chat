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
  , formidable = require('formidable') // ファイルアップロード
  , everyauth  = require('everyauth')  // 認証
  , httpProxy  = require('http-proxy') // プロキシサーバー
  , conf       = require('./conf')     // 認証等の設定情報
  ;

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
      logger.debug('----- oauth-sql:results ');logger.debug(results);
      if (!results[0]) {
        logger.debug('----- oauth-sql-mode:insert ');
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
        logger.debug('----- oauth-sql-mode:update ');
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
      'SELECT id FROM '+TABLE_USERS+' WHERE name = ? AND oauth_service = ?',
      [req.session.auth.name, req.session.auth.service],
      function(err, results, fields) {
        if (err) {throw err;}
        if (results) {
          req.session.auth.user_id = results[0].id;
        }
      }
    );
  } else {
    res.render('index', { 'layout': false});
    return;
  }

  // 最新のhouseリストを取得
  client.query(
    'SELECT id, name, url_id, image FROM '+TABLE_HOUSES+' ORDER BY created_at DESC LIMIT 10',
    function(err, results, fields) {
      if (err) {throw err;}
      //logger.debug('app.get/,results: ');logger.debug(results);
      if (results.length == 0) {
        res.send('house error: no result');
        return;
      } else {
        var tmp_house_list = [];

        // house に紐付くコメントの最新画像を取得
//        for (var i = 0; i < results.length; i++) {
//          var tmp_house_id = results[i].id
//            , tmp_house_name = results[i].name
//            , tmp_house_url_id = results[i].url_id
//            ;
//          client.query(
//            'SELECT image FROM '+TABLE_COMMENTS
//            +' WHERE house_id = ? AND image != ?'
//            +' ORDER BY created_at DESC LIMIT 1',
//            [tmp_house_id, ''],
//            function(err, tmp_results, tmp_fields) {
//              if (err) {throw err;}
//
//              var tmp_image = '';
//              if (tmp_results[0]) {
//                tmp_image = tmp_results[0].image;
//              }
//
//              tmp_house_list[i] = {'id': tmp_house_id,
//                'name': tmp_house_name, 'url_id': tmp_house_url_id,
//                'image': tmp_image
//              };
//
//            }
//          );
//
//        }

        res.render('index-logedin', { 'layout': false,
          'house_list': results, 'user_name': req.session.auth.name,
          'user_image': req.session.auth.image,
          'user_id': req.session.auth.user_id
        });
        return;


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
  logger.debug('----- app.get/h/:id,url_id_typeof: ');logger.debug(typeof url_id);
  logger.debug('----- app.get/h/:id,url_id: ');logger.debug(url_id);

  if (!req.session || !req.session.auth) {
    // ログインしていないので、リダイレクト
    res.redirect('/');
    return;
  }
  logger.debug('----- app.get/h/:id,req.session.auth: ');logger.debug(req.session.auth);

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
        logger.debug('----- app.get/h/:id,results: ');logger.debug(results);
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


// --------------------------------------------------------
// twitter_house_room
// --------------------------------------------------------
app.get('/tweet/:id', function (req, res) {
  // ID が正しいかチェックする
  // 正しくなければ、topへリダイレクトする
  var url_id = (req.params.id) ? req.params.id : '';

  if (!req.session || !req.session.auth) {
    // ログインしていないので、リダイレクト
    res.redirect('/');
    return;
  }

  if (url_id == '') {
    res.send('id error: id null');
    return;
  } else {
    // URLパラメータが正しいかDB に聞いてみる
    client.query(
      'SELECT id, name, image, description FROM '+TABLE_HOUSES+' WHERE url_id = ?',
      [url_id],
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
          res.render('twitter-home', { 'layout': false,
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
  logger.info('----- app.post/create-house: ');logger.info(req.body);
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
            logger.debug(results);
            logger.debug(results[0].last_id);
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

      logger.debug('----- join client sessionid: ');logger.debug(sessionid);
      // ユーザーを追加
      socket.join(url_id);
      logger.debug('----- join server sessionid: ');logger.debug(socket.sessionid);
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
          logger.debug('----- socket.on(join),results: ');logger.debug(results);
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
            console.log('disp_type-------------');console.log(disp_type);

            // member から画像url を取得する
            if (disp_type == 'avatar') {
              avatar_members[i_avatar] = {'session_id': member_id, 'avatar_img': avatar_list[member_id]};
              i_avatar++;
            } else {
              audience_members[i_audience] = {'session_id': member_id, 'audience_img': audience_list[member_id]};
              i_audience++;
            }
          }


          logger.debug('----- join members-data: ');logger.debug(avatar_members);
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



      // 最新のコメント10件分を取得
      client.query(
        'SELECT cmt.id, cmt.created_at, cmt.body, cmt.image AS cmt_image, usr.name, usr.image AS usr_image'
        +' FROM '+TABLE_COMMENTS+' AS cmt'
        +' LEFT JOIN '+TABLE_USERS+' AS usr ON cmt.user_id=usr.id'
        +' WHERE cmt.house_id = ?'
        +' ORDER BY cmt.created_at DESC LIMIT 10',
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
              var date = new Date(tmp_data.created_at)
                , date_txt = ''
                ;

              date_txt = date.getFullYear()+"-"+(date.getMonth()+1)+"-"+date.getDate();
              date_txt+= "T"+date.toLocaleTimeString();
              //logger.debug('date_txt---------');logger.debug(date_txt);

              // データを溜め込んでいく
              send_data[i] = {'comment_id': tmp_data.id,
                'message_time': date_txt, 'userMessage': tmp_data.body,
                'image_src': tmp_data.cmt_image, 'userName': tmp_data.name,
                'user_image': tmp_data.usr_image, 'iframeURL': ''
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
      logger.info('chat message received: ok');
      socket.get('house_data', function(err, house_data) {
        logger.info('house_data: '+house_data);

        // house_data を分解
        var resArray = house_data.split('___');
        logger.info('url_id: '+resArray[0]);
        logger.info('house_id: '+resArray[1]);
        logger.info('frameURL: '+iframeURL);
        socket.broadcast.to(resArray[0]).emit('chat message', {
          'userName': userName, 'user_image': user_image,
          'userMessage': message, 'iframeURL': iframeURL, 'image_src': image_src,
          'message_time': message_time
        });

        if (!image_src) {image_src = '';}
        // TODO:ユーザー認証が出来たらDB格納用の値を取得する
        client.query(
          'INSERT INTO '+TABLE_COMMENTS+' (created_at, house_id,'+
          ' user_id, body, image'+
          ') VALUES (NOW(), ?, ?, ?, ?)',
          [resArray[1], user_id, message, image_src],
          function(err, results) {
            if (err) {
              throw err;
            } else {
              return;
            }
          }
        );
      })

//      logger.info('socket.manager.rooms: ');logger.info(socket.manager.rooms);
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
      logger.info('get-twitter-list---------ok');
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
              var date = new Date(tmp_data.created_at)
                , date_txt = ''
                ;

              date_txt = date.getFullYear()+"-"+(date.getMonth()+1)+"-"+date.getDate();
              date_txt+= "T"+date.toLocaleTimeString();
              //logger.debug('date_txt---------');logger.debug(date_txt);

              // データを溜め込んでいく
              send_data[i] = {'comment_id': tmp_data.id,
                'message_time': date_txt, 'userMessage': tmp_data.body,
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


