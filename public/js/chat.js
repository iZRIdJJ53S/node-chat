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


//    this.userMessage.keydown(function (event) {
//      var userMessage = $( this ).val()
//        , image_src   = $('#user_up_img').attr('src')
//        , iframeURL = ''
//        ;
//
//      if ((event.keyCode == 13 ) && (userMessage || image_src)) {
//
//        // image_src が優先
//        if (image_src) {
//          that._setIframeArea(image_src);
//        } else {
//          if (isURL(userMessage)) {
//            if (getURL(userMessage)) {
////              $.publish( 'user:iframe-url-sent', { userName: that.userName, iframeURL: getURL(userMessage)} );
//               iframeURL = getURL(userMessage);
//               that._setIframeArea(iframeURL);
//            }
//          }
//        }
//
//        // 自分自身(クライアント)へ描画
//        var message_time = that._getCurrentTime();
//        that._addMessage(that.userName, that.user_image, userMessage, image_src, message_time);
//        // サーバーへpush して全クライアントへ配信してもらう
//        $.publish( 'user:message-sent', {
//          'user_id': that.user_id, 'userName': that.userName, 'user_image': that.user_image,
//          'userMessage': userMessage, 'iframeURL': iframeURL, 'image_src': image_src,
//          'message_time': message_time
//        });
//
//        that._clearInputUserMessage();
//
//      // タイピング中というステータスを送信する
//      } else {
////        $.publish('user:typing', {
////          'user_id': that.user_id, 'userName': that.userName
////        });
//      }
//    });

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
        that._addMessage(that.userName, that.user_image, userMessage, image_src, message_time);
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
      that._addMessage( data.userName, data.user_image, data.userMessage, data.image_src, data.message_time);

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

  _addTweet: function ( tweet_id, userName, user_image, userMessage, image_src, message_time) {
    var text_node = $('<div id="text_node"></div>');
    userMessage = text_node.text(userMessage).html();
    // 改行br変換
    userMessage = userMessage.replace(/\n/g, '<br />');
    //console.log('text_node,message: ');console.log(userMessage);
    //console.log('message_time: ');console.log(message_time);


    // URL 変換
    if (isURL(userMessage)) {
      if (getURL(userMessage)) {
        userMessage = replaceURL(userMessage);
      }
    }

    var image_node = '';
    // メッセージ部分
    var voice_node = $('<div class="voice">');
    var icon_node  = $('<div class="icon">');
    var chat_content_node = $('<div class="chat-content">');

    var star_node = $('<a href="#" id="'+tweet_id+'" class="star">').text('★');

    voice_node.prepend($('<div class="name">').text(userName));
    voice_node.append($('<div class="message">').html(userMessage));
    voice_node.append(image_node);
    voice_node.append($('<div class="time">').text(message_time));
    voice_node.append($('<div id="star_'+tweet_id+'">').html(star_node));

    chat_content_node.prepend(voice_node);
    chat_content_node.prepend(icon_node.html('<img src="'+user_image+'">'));
    this.messageList.prepend(chat_content_node);

  },



  _addMessage: function ( userName, user_image, userMessage, image_src, message_time) {
    var text_node = $('<div id="text_node"></div>');
    userMessage = text_node.text(userMessage).html();
    // 改行br変換
    userMessage = userMessage.replace(/\n/g, '<br />');
    //console.log('text_node,message: ');console.log(userMessage);
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
      console.log('image_node_html: '+image_node);console.log(image_node);
    }

    // チャットメッセージ部分
    var voice_node = $('<div class="voice">');
    var icon_node  = $('<div class="icon">');
    var chat_content_node = $('<div class="chat-content">');

//    if (userName == 'me') {
      voice_node.prepend($('<div class="name">').text(userName));
      voice_node.append($('<div class="message">').html(userMessage));
      voice_node.append(image_node);
      voice_node.append($('<div class="time">').text(message_time));

      chat_content_node.prepend(voice_node);
      chat_content_node.prepend(icon_node.html('<img src="'+user_image+'">'));
      this.messageList.prepend(chat_content_node);

      this.messageList2.empty();
      this.messageList2.prepend(chat_content_node);
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
    // youtube 無し
    if (iframeURL.indexOf('youtube.com') == -1) {
      this.iframeArea.prepend($('<iframe width="500" height="460">').attr('src', iframeURL));

    // youtube 有り
    } else {
      // 動画ID を抜き出す
      var youtube_vid = iframeURL.match(/[&\?]v=([\d\w]+)/);
      if (youtube_vid[1]) {
        var iframe_tag = '<iframe width="500" height="300" src="';
        iframe_tag += 'http://www.youtube.com/embed/'+youtube_vid[1];
        iframe_tag += '" frameborder="0" allowfullscreen></iframe>';
        this.iframeArea.prepend(iframe_tag);
      }
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
  },


  _getCurrentTime: function () {
    var date = new Date();
    var date_txt = date.getFullYear()+"/"+(date.getMonth()+1)+"/"+date.getDate();
    date_txt += "  "+date.toLocaleTimeString();
    //date_txt += "  "+date.getHours()+":"+date.getMinutes();
    return date_txt;
  }
};
