/* house is a wrapper around socket.io */

var house = {
  init: function ( options ) {
    var that = this;
    var url_id = options.url_id;
    var house_id = options.house_id;
    var house_image = options.house_image;
    var user_id     = options.user_id;
    var user_image  = options.user_image;

    that.user_id = user_id;
    if (house_image) {
      //console.log($('body.chat'));
      //$('body.chat').css({background-image: "url("+house_image+")"});
    }

    this.socket = io.connect('/houses');

    this.socket.on( 'connect', function () {
      console.log( '['+url_id+'__'+house_id+'] join house client: ok' );
      that.socket.emit( 'join', url_id, house_id, user_id, user_image, that.socket.socket.sessionid);

      // tweet-list
      //that.socket.emit('get-twitter-list', url_id, house_id);

      that._bindPublishers();
      that._bindSubscribers();
    });
  },

  _bindPublishers: function () {
    var that = this;

	// blog化する
	this.socket.on( 'blog alert', function ( data ) {
		$.publish( 'user:blog-alert', data );
	});

    this.socket.on( 'chat message', function ( message ) {
      // user_image があったらiframeエリアへ描画する為
      // 必要なパラメータセット
      if (message.image_src) {
        message['cnt'] = 0;
      }
      $.publish( 'user:message-received', message );
    });

    // ハウスユーザー
    this.socket.on('user join', function(data) {
      if ( data.session_id == that.socket.socket.sessionid ) {
        data.currentUser = true;
      }

      $.publish( 'user:joined', data);
    });

    this.socket.on( 'user leave', function ( data ) {
      $.publish( 'user:left', data );
      console(data);
      alert(data);
    });

    // オーディエンス
    this.socket.on('audience join', function(data) {
      //console.log('audience join----');console.log(data);
      if ( data.session_id == that.socket.socket.sessionid ) {
        data.currentUserId = data.session_id;
        //data.currentUser = true;
      }

      $.publish( 'audience:joined', data);
    });

    // 最新コメント
    this.socket.on('recent-comments', function(data) {
      // data の配列数をカウント
      var max_loop = data.length;
      if (max_loop == 0) {
        // 何もしない
      } else {
        // あえてのカウントダウン
        // (user:message-received)のDOM 操作が積み上げ型だから
        // 古いデータを先に渡す必要がある為
        for (var i = max_loop-1; i >= 0; i--) {
          var received_data = data[i];
          received_data['cnt'] = i;

          // コメントのオーナー判断
          if (that.user_id == data[i].user_id) {
            received_data['is_owner'] = true;
          } else {
            received_data['is_owner'] = false;
          }

          $.publish( 'user:message-received', received_data);
        }
      }
    });


    // 最新tweet
    this.socket.on('recent-tweet', function(data) {
      // data の配列数をカウント
      var max_loop = data.length;
      if (max_loop == 0) {
        // 何もしない
      } else {
        // あえてのカウントダウン
        // (user:tweet-received)のDOM 操作が積み上げ型だから
        // 古いデータを先に渡す必要がある為
        for (var i = max_loop-1; i >= 0; i--) {
          var received_data = data[i];
          received_data['cnt'] = i;
          $.publish( 'user:tweet-received', received_data);
        }
      }
    });


    // タイピング中を受信したら
//    this.socket.on('user-typing', function(data) {
//      $.publish('user:typing', data);
//    });

    //
    this.socket.on('click-emotion', function(data) {
      $.publish('audience:click-emotion', data);
    });

    this.socket.on('click-star', function(data) {
      $.publish('chat:click-star', data);
    });

    this.socket.on('video-start', function(data) {
      $.publish('video:forward', data);
    });

    this.socket.on('video-play', function(data) {
      $.publish('video:play', data);
    });

    this.socket.on('video-pause', function(data) {
      $.publish('video:pause', data);
    });
  },

  _bindSubscribers: function () {
    var that = this;

    $.subscribe('user:message-sent', function(event, message) {
      //console.log('subscribe-ok: user:message-sent '+ message.userName);
      //console.log('that.socket.socket.sessionid: '+that.socket.socket.sessionid);
      that.socket.emit('chat message',
        message.user_id, message.userName, message.user_image,
        message.userMessage, message.iframeURL, message.image_src,
        message.message_time
      );
    });

    $.subscribe('user:typing', function(event, message) {
      that.socket.emit('user-typing',
        message.user_id, message.userName
      );
    });

    $.subscribe('audi:click-emotion', function(event, message) {
      that.socket.emit('click-emotion',
        message.userName, message.userId, message.userMessage, message.user_id
      );
    });

    $.subscribe('chat:click-star', function(event, message) {
      that.socket.emit('click-star',
        message.userName, message.userId, message.click_id, message.user_id
      );
    });

    $.subscribe('video:start-c2s', function(event, data) {
      that.socket.emit('video-start',
        data.video_id, data.seek_time
      );
    });

    $.subscribe('video:play-c2s', function(event, data) {
      that.socket.emit('video-play');
    });

    $.subscribe('video:pause-c2s', function(event, data) {
      that.socket.emit('video-pause');
    });
  }
};
