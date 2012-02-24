var chat = {
  init: function ( options ) {
    this.section = $( 'section#content-wrapper' );
    this.messageList = this.section.find( '#lines1' );
    this.messageList2 = this.section.find( '#lines2' );
    this.userMessage = this.section.find( '#message1' );
    this.userName    = 'guest';
    this.submitter   = this.section.find( '#submit_1' );
    this.sendMessage = this.section.find( '#send-message1' );
    this.iframeArea = this.section.find( '#disparea' );

    if ( options ) {
      this.user_id = options.user_id || 1;
      this.userName = options.userName || 'guest';
      this.user_image = options.user_image || '';
    }

    this._bindSubscribers();
    this._bindEvents();
  },

  _bindEvents: function () {
    var that = this;
    var star_list = this.messageList.find('.star');

    this.messageList.find('.star').live('click', function (event) {
      var star_id = $(this).attr('id');
//      console.log(star_id);

      // サーバーへpush して全クライアントへ配信してもらう
      $.publish('chat:click-star', {
        'userName': that.userName, 'userId': '',
        'click_id': star_id, 'user_id': that.user_id
      });
    });


    this.userMessage.keydown(function (event) {
      var userMessage = $( this ).val()
        , image_src   = $('#user_up_img').attr('src')
        , iframeURL = ''
        ;

      // shiftKey だったら改行
      if (event.shiftKey === true) {
        // new line
      } else {

        if (event.keyCode == 13) {
          if (userMessage || image_src) {
            // image_src が優先
            if (image_src) {
              that._setIframeArea(image_src);
            } else {
              if (isURL(userMessage)) {
                if (getURL(userMessage)) {
    //              $.publish( 'user:iframe-url-sent', { userName: that.userName, iframeURL: getURL(userMessage)} );
                   iframeURL = getURL(userMessage);
                   that._setIframeArea(iframeURL);
                }
              }
            }
    
            // 自分自身(クライアント)へ描画
            var message_time = that._getCurrentTime();
            that._addMessage('', that.userName, that.user_image, userMessage, image_src, message_time);
            // サーバーへpush して全クライアントへ配信してもらう
            $.publish( 'user:message-sent', {
              'user_id': that.user_id, 'userName': that.userName, 'user_image': that.user_image,
              'userMessage': userMessage, 'iframeURL': iframeURL, 'image_src': image_src,
              'message_time': message_time
            });
    
            that._clearInputUserMessage();
    
          // タイピング中というステータスを送信する
          //} else {
    //        $.publish('user:typing', {
    //          'user_id': that.user_id, 'userName': that.userName
    //        });
            return false;
          } else {
            return false;
          }
        }
      }
    });

    this.submitter.click(function (event) {
      var userMessage = that.userMessage.val()
        , image_src   = $('#user_up_img').attr('src')
        , iframeURL = ''
        ;

      if (userMessage || image_src) {

        // image_src が優先
        if (image_src) {
          that._setIframeArea(image_src);
        } else {
          if (isURL(userMessage)) {
            if (getURL(userMessage)) {
//              $.publish( 'user:iframe-url-sent', { userName: that.userName, iframeURL: getURL(userMessage)} );
               iframeURL = getURL(userMessage);
               that._setIframeArea(iframeURL);
            }
          }
        }

        // 自分自身(クライアント)へ描画
        var message_time = that._getCurrentTime();
        that._addMessage('', that.userName, that.user_image, userMessage, image_src, message_time);
        // サーバーへpush して全クライアントへ配信してもらう
        $.publish( 'user:message-sent', {
          'user_id': that.user_id, 'userName': that.userName, 'user_image': that.user_image,
          'userMessage': userMessage, 'iframeURL': iframeURL, 'image_src': image_src,
          'message_time': message_time
        });

        that._clearInputUserMessage();
      }
      return false;
    });
  },

  _bindSubscribers: function () {
    var that = this;

    $.subscribe( 'user:message-received', function ( event, data ) {
      that._addMessage(data.comment_id, data.userName, data.user_image
        , data.userMessage, data.image_src, data.message_time
      );

      // もしiframeURL があったら描画する(image_src が優先)
      if (data.image_src) {
        // 最新のだけ出したいからあえて０番目を指定
        if (data.cnt == 0) {
          that._setIframeArea(data.image_src);
        }
      } else if (isURL(data.iframeURL)) {
        if (getURL(data.iframeURL)) {
          that._setIframeArea(getURL(data.iframeURL));
        }
      }
    });

    $.subscribe( 'user:tweet-received', function ( event, data ) {
      that._addTweet(data.comment_id, data.userName, data.user_image
        , data.userMessage, data.image_src, data.message_time
      );
    });

//    $.subscribe('user:typing', function ( event, data ) {
//      $('#tmp_message_area').text(data.userName+' さんがタイピング中です...');
//      clearTimeout(tmp_timer);
//      tmp_timer = setTimeout(function() { $('#tmp_message_area').empty(); }, 2000);
//    });

  },

  //_addTweet: function ( tweet_id, userName, user_image, userMessage, image_src, message_time) {
  //  var text_node = $('<div id="text_node"></div>');
  //  userMessage = text_node.text(userMessage).html();
  //  // 改行br変換
  //  userMessage = userMessage.replace(/\n/g, '<br />');
  //  //console.log('text_node,message: ');console.log(userMessage);
  //  //console.log('message_time: ');console.log(message_time);


  //  // URL 変換
  //  if (isURL(userMessage)) {
  //    if (getURL(userMessage)) {
  //      userMessage = replaceURL(userMessage);
  //    }
  //  }

  //  var image_node = '';
  //  // メッセージ部分
  //  var voice_node = $('<div class="voice">');
  //  var icon_node  = $('<div class="icon">');
  //  var utc_time   = this._changeTimeStamp(message_time);
  //  var easy_time  = this._changeEasyTimeStamp(message_time);
  //  var time_node  = $('<abbr class="time">').attr('title', utc_time);
  //  var chat_content_node = $('<div class="chat-content">');

  //  var star_node = $('<a href="#" id="'+tweet_id+'" class="star">').text('★');

  //  voice_node.prepend($('<div class="name">').text(userName));
  //  voice_node.append($('<div class="message">').html(userMessage));
  //  voice_node.append(image_node);
  //  voice_node.append(time_node.text(easy_time));
  //  voice_node.append($('<div id="star_'+tweet_id+'">').html(star_node));

  //  chat_content_node.prepend(voice_node);
  //  chat_content_node.prepend(icon_node.html('<img src="'+user_image+'">'));
  //  this.messageList.prepend(chat_content_node);

  //  $('#lines1 abbr.time').timeago();
  //},



  _addMessage: function (comment_id, userName, user_image, userMessage, image_src, message_time) {
    var text_node = $('<div id="text_node"></div>');
    userMessage = text_node.text(userMessage).html();
    // 改行br変換
    userMessage = userMessage.replace(/\n/g, '<br />');
    //console.log('user_image: ');console.log(user_image);
    //console.log('message_time: ');console.log(message_time);


    // URL 変換
    if (isURL(userMessage)) {
      if (getURL(userMessage)) {
        userMessage = replaceURL(userMessage);
      }
    }

    // ユーザーさんが独自にアップした画像があれば
    var tmp_image_src = '';
    var image_node = '';
    if (image_src) {
      tmp_image_src = image_src.replace('.jpg', '');
      image_node = $('<img id="user_img_'+tmp_image_src+'" class="img">');
      image_node.attr('src', image_src);
      //console.log('image_node_html: '+image_node);console.log(image_node);
    }

    // チャットメッセージ部分
    var voice_node = $('<div class="voice">');
    var icon_node  = $('<div class="icon">');
    var utc_time   = this._changeTimeStamp(message_time);
    var easy_time  = this._changeEasyTimeStamp(message_time);
    var time_node  = $('<abbr class="time">').attr('title', utc_time);
    var chat_content_node = $('<div class="chat-content">');

    var star_node = $('<a href="#" id="'+comment_id+'" class="star">').text('★');

//    if (userName == 'me') {
      voice_node.prepend($('<div class="name">').text(userName));
      voice_node.append($('<div class="message">').html(userMessage));
      voice_node.append(image_node);
      voice_node.append(time_node.text(easy_time));
      voice_node.append($('<div id="star_'+comment_id+'">').html(star_node));

      chat_content_node.prepend(voice_node);
      chat_content_node.prepend(icon_node.html('<img src="'+user_image+'">'));
      this.messageList.prepend(chat_content_node);

      this.messageList2.empty();
      this.messageList2.prepend(chat_content_node);

      $('#lines1 abbr.time').timeago();

//    } else {
//      this.messageList.prepend($('<dl>').append($('<dt>').html(userMessage).append(image_node))
//        .append($('<dd>').html('<img src="'+user_image+'">'+userName))
//      );
//      this.messageList2.empty();
//      this.messageList2.prepend($('<dl>').append($('<dt>').html(userMessage).append(image_node))
//        .append($('<dd>').html('<img src="'+user_image+'">'+userName))
//      );
//    }
//    this.messageList.scrollTop( this.messageList.height() );
  },

  _setIframeArea: function (iframeURL) {
    this.iframeArea.empty();


    // youtube 有り
    if (iframeURL.indexOf('youtube.com') !== -1) {
      // 動画ID を抜き出す
      var youtube_vid = iframeURL.match(/[&\?]v=([\d\w]+)/);
      if (youtube_vid[1]) {
        // 初期化
        $('#myytplayer').empty();
        $('#ytapiplayer').empty();
        $('#player-ctrl').empty();
        $('#play_video_id').empty();

        // player-ctrl の部品組立
        var video_start = $('<a href="javascript:void(0);" id="video-start">Start</a>');
        var video_play  = $('<a href="javascript:void(0);" id="video-play">Play</a>');
        var video_pause = $('<a href="javascript:void(0);" id="video-pause">Pause</a>');

        // player-ctrl の親要素
        var player_ctrl = $('<div id="player-ctrl">');
        // 部品をappend していく
        player_ctrl.append(video_start);
        player_ctrl.append(video_play);
        player_ctrl.append(video_pause);

        $('#view_frame').append($('<div id="ytapiplayer">'));
        $('#view_frame').append(player_ctrl);

        var params = { allowScriptAccess: "always", bgcolor: "#cccccc" };
        var atts = { id: "myytplayer" };
        var youtube_api = 'http://gdata.youtube.com/apiplayer';
        //youtube_api += 'key=AI39si7uG-sNXZtXIClnUvP5HArP1LfH60j0EfKc-8pLVRSOauN-NwLbVkxOZ2v3p6v_Cg1_iZf2D2KcM5ih2Gd5VFDH90D7nA';
        youtube_api += '?enablejsapi=1&playerapiid=ytplayer';

        //var youtube_api = 'http://www.youtube.com/v/'+youtube_vid[1]
        //youtube_api += '?enablejsapi=1&playerapiid=ytplayer';
        swfobject.embedSWF(youtube_api, "ytapiplayer", "500", "300", "8", null, null, params, atts);

        // videoid を書きだす
        $('#view_frame').append($('<input type="hidden" id="play_video_id" value="'+youtube_vid[1]+'">'));

        //var iframe_tag = '<iframe width="500" height="300" src="';
        //iframe_tag += 'http://www.youtube.com/embed/'+youtube_vid[1];
        //iframe_tag += '" frameborder="0" allowfullscreen></iframe>';
        //this.iframeArea.prepend(iframe_tag);
      }

    // nicovideo 有り
    } else if (iframeURL.indexOf('nicovideo.jp') !== -1) {
      // 動画ID を抜き出す
      var nico_vid = iframeURL.match(/(sm[0-9]+)/);
      if (nico_vid[1]) {
        var script_tag = document.createElement('script');
        script_tag.type = 'text/javascript';
        script_tag.src  = 'http://ext.nicovideo.jp/thumb_watch/'+nico_vid[1];

        //var iframe_tag = '<script type="text/javascript" src="';
        //var iframe_tag = '<iframe width="500" height="300" src="';
        //iframe_tag += 'http://ext.nicovideo.jp/thumb_watch/'+nico_vid[1]+'?w=500&h=300';
        //iframe_tag += '" frameborder="0" allowfullscreen></iframe>';
//        iframe_tag += '"></script>';
//        iframe_tag += '<noscript><a href="http://www.nicovideo.jp/watch/'+nico_vid[1]+'" target="_blank">';
//        iframe_tag += 'nicovideo で見る</a></noscript>';
        this.iframeArea.prepend(script_tag);
      }

    // 該当なし。その他
    } else {
      this.iframeArea.prepend($('<iframe width="500" height="460">').attr('src', iframeURL));
    }
    //this.iframeArea.attr('src', iframeURL);
  },

  _clearInputUserMessage: function () {
    this.userMessage.val('').focus();
    //this.userMessage.val().replace(/(\r\n|\n)+/g, "");
//    $.trim(this.userMessage.val());

    $('#html_image_preview').remove();
    $('#user_up_img').remove();
    $('#drop_message').show();
    $('#message1').height(50).css({minHeight:50}); // textarea の高さを初期化
  },


  _getCurrentTime: function () {
    var d = new Date();
    var month = d.getUTCMonth();
    month++;
    if (month < 10) {month = "0" + month;}
    var day = d.getUTCDate();
    if (day < 10) {day="0" + day;}
    var year = d.getUTCFullYear();
    var hour = d.getUTCHours();
    if (hour < 10) {hour = "0" + hour;}
    var minute = d.getUTCMinutes();
    if (minute < 10) {minute = "0" + minute;}
    var second = d.getUTCSeconds();
    if (second < 10) {second = "0" + second;}
    var newdate = year+"-"+month+"-"+day+"T"+hour+":"+minute+":"+second+"Z";

    //var date = new Date();
    //var date_txt = date.getFullYear()+"/"+(date.getMonth()+1)+"/"+date.getDate();
    //date_txt += "  "+date.toLocaleTimeString();
    return newdate;
  },

  _changeTimeStamp: function (time_str) {
    if (!time_str) {return false;}
    var year = time_str.substring(0, 4);
    var month = time_str.substring(5, 7);
    //if (month < 10) {month = '0' + month;}
    var day   = time_str.substring(8, 10);
    if (day < 10) {day = '0' + day;}
    var hour  = time_str.substring(11, 13);
    if (hour < 10) {hour = '0' + hour;}
    var minute = time_str.substring(14, 16);
    if (minute < 10) {minute = '0' + minute;}
    var second = time_str.substring(17, 19);
    if (second < 10) {second = '0' + second;}

    var newdate = year+'-'+month+'-'+day+'T'+hour+':'+minute+':'+second+'Z';
    //var d = new Date(Date.UTC(year, month, day, hour, minute, second));
    //var newdate = d.toUTCString();
    //console.log(month);
    return newdate;
  },

  _changeEasyTimeStamp: function (time_str) {
    if (!time_str) {return false;}
    var d = new Date(time_str);
    var date_txt = d.getFullYear()+'-'+(d.getMonth()+1)+'-'+d.getDate();
    date_txt += ' '+d.toLocaleTimeString();

    return date_txt;
  }

};

