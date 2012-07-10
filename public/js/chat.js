var chat = {
  init: function ( options ) {
    this.section = $( 'section' );
    this.messageList = this.section.find( '#lines1' );
    this.messageList2 = this.section.find( '#lines2' );
    this.userMessage = this.section.find( '#message1' );
    this.userName    = 'guest';
    this.submitter   = this.section.find( '#submit_1' );
    this.sendMessage = this.section.find( '#send-message1' );
    this.iframeArea = this.section.find( '#disparea' );
    this.stmp = this.section.find('#emoji_wrapp_in a img');





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


    this.stmp.click(function (event) {
//	alert(location.protocol+"//"+location.host + "/" + $(this).attr("src"));
//    this.submitter.click(function (event) {
      var userMessage = location.protocol+"//"+location.host + "/" + $(this).attr("src")
        , image_src   = ""
        , iframeURL   = ''
        , flg_owner   = true
        ;

	//スタンプ用
	StampHideFlag = 1;

      if (userMessage || image_src) {

        // image_src が優先
        if (image_src) {
//          //that._setIframeArea(image_src, flg_owner);
        } else {
          if (isURL(userMessage)) {
            if (getURL(userMessage)) {
//              $.publish( 'user:iframe-url-sent', { userName: that.userName, iframeURL: getURL(userMessage)} );
               iframeURL = getURL(userMessage);
//               that._setIframeArea(iframeURL, flg_owner);
            }
          }
        }

        // 自分自身(クライアント)へ描画
        var message_time = that._getCurrentTime();
//        that._addMessage('', that.userName, that.user_image, userMessage, image_src, message_time);
        // サーバーへpush して全クライアントへ配信してもらう
//alert(userMessage);
//return false;
        $.publish( 'user:message-sent', {
          'user_id': that.user_id, 'userName': that.userName, 'user_image': that.user_image,
          'userMessage': userMessage, 'iframeURL': iframeURL, 'image_src': image_src,
          'message_time': message_time
        });

	//スクロール
	MovingFlag = 1;
        that._clearInputUserMessage();
      }
      return false;
    });






    this.userMessage.keydown(function (event) {
      var userMessage = $( this ).val()
        , image_src   = $('#user_up_img').attr('src')
        , iframeURL   = ''
        , flg_owner   = true
        ;

      // shiftKey だったら改行
      if (event.shiftKey === true) {
        // new line
      } else {

        if (event.keyCode == 13) {
          if (userMessage || image_src) {
            // image_src が優先
            if (image_src) {
//              that._setIframeArea(image_src, flg_owner);
            } else {
              if (isURL(userMessage)) {
                if (getURL(userMessage)) {
    //              $.publish( 'user:iframe-url-sent', { userName: that.userName, iframeURL: getURL(userMessage)} );
                   iframeURL = getURL(userMessage);
//                   that._setIframeArea(iframeURL, flg_owner);
                }
              }
            }

            // 自分自身(クライアント)へ描画
            var message_time = that._getCurrentTime();
//            that._addMessage('', that.userName, that.user_image, userMessage, image_src, message_time);
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
//        , image_src   = $('#user_up_img').attr('src')
        , image_src   = $('#uploadings_input').val()
        , iframeURL   = ''
        , flg_owner   = true
        ;

///////////////////////////////////
	if(image_src != ''){
		//alert(location.protocol+'//'+location.host+'/uploads/'+$('#realUpfile').val());
		userMessage = location.protocol+'//'+location.host+'/uploads/'+$('#realUpfile').val();
		//input file clear
		image_src = '';
	}

///////////////////////////////////

      if (userMessage || image_src) {

        // image_src が優先
        if (image_src) {
///////////////////////////////////
          //that._setIframeArea(image_src, flg_owner);

          if (isURL(userMessage)) {
            if (getURL(userMessage)) {
//              $.publish( 'user:iframe-url-sent', { userName: that.userName, iframeURL: getURL(userMessage)} );
               iframeURL = getURL(userMessage);
//               that._setIframeArea(iframeURL, flg_owner);
            }
          }
///////////////////////////////////
        } else {
          if (isURL(userMessage)) {
            if (getURL(userMessage)) {
//              $.publish( 'user:iframe-url-sent', { userName: that.userName, iframeURL: getURL(userMessage)} );
               iframeURL = getURL(userMessage);
//               that._setIframeArea(iframeURL, flg_owner);
            }
          }
        }

        // 自分自身(クライアント)へ描画
        var message_time = that._getCurrentTime();
//        that._addMessage('', that.userName, that.user_image, userMessage, image_src, message_time);
        // サーバーへpush して全クライアントへ配信してもらう
//alert(userMessage);
//return false;
        $.publish( 'user:message-sent', {
          'user_id': that.user_id, 'userName': that.userName, 'user_image': that.user_image,
          'userMessage': userMessage, 'iframeURL': iframeURL, 'image_src': image_src,
          'message_time': message_time
        });

	//SNS投稿
	sendComment();

	//スクロール
	MovingFlag = 1;
        that._clearInputUserMessage();
      }
      return false;
    });
  },





  _bindSubscribers: function () {
    var that = this;

	// blog化した後、リダイレクトを行う
    $.subscribe( 'user:blog-alert', function ( event, data ) {
    	$('#comment_wrapp_inputarea').hide();
    	alert(data.blog_message);
    	location.replace( "/suc/" + data.blog_data );
    });

    $.subscribe( 'user:message-received', function ( event, data ) {
      that._addMessage(data.comment_id, data.userName, data.user_image
        , data.userMessage, data.image_src, data.message_time
        , data.is_owner, data.ext_image_path, data.ext_image_domain
      );

      // もしiframeURL があったら描画する(image_src が優先)
      if (data.image_src) {
        // 最新のだけ出したいからあえて０番目を指定
        if (data.cnt == 0) {
          that._setIframeArea(data.image_src, data.is_owner, '', '');
        }

      } else if (data.ext_image_path && data.ext_image_domain) {
        that._setIframeArea(getURL(data.iframeURL), data.is_owner, data.ext_image_path, data.ext_image_domain);

      } else if (isURL(data.iframeURL)) {
        if (getURL(data.iframeURL)) {
          that._setIframeArea(getURL(data.iframeURL), data.is_owner, '', '');
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








  _addMessage: function (comment_id, userName, user_image, userMessage,
      image_src, message_time, is_owner, ext_image_path, ext_image_domain) {
    var text_node = $('<div id="text_node"></div>');
    userMessage = text_node.text(userMessage).html();
    // 改行br変換
    userMessage = userMessage.replace(/\n/g, '<br />');
    //console.log('user_image: ');console.log(user_image);
    //console.log('message_time: ');console.log(message_time);



    // URL 変換
    if (isURL(userMessage)) {
	//画像の場合
	var stamp_flag = 0;
	//if( userMessage.indexOf('.jpg') != -1 || userMessage.indexOf('.jpeg') != -1 || userMessage.indexOf('.JPG') != -1 || userMessage.indexOf('.png') != -1 || userMessage.indexOf('.PNG') != -1 || userMessage.indexOf('.gif') != -1 || userMessage.indexOf('.GIF') != -1 ){

	//スタンプのディレクトリがある場合はスタンプフラグを立てる
	if( userMessage.indexOf('/images/stamp/') != -1 ){
		var stamp_flag = 1;
		//スタンプ用
		StampHideFlag = 1;
	}else if (getURL(userMessage)) {
/////////////////////////////////////////////////投稿画像URLの整形前のデータを変数に格納
		var nama_messe = userMessage;
//////////////////////////////////////////////////////////
		userMessage = replaceURL(userMessage);	//ココで投稿された画像URLをaタグで挟んでる※多分ライブラリ
/////////////////////////////////////////////////投稿内容に画像URLがある場合、画像URLをimgタグで挟む
		if( userMessage.indexOf('<a href=') != -1 && (userMessage.indexOf('.jpg') != -1 || userMessage.indexOf('.jpeg') != -1 || userMessage.indexOf('.JPG') != -1 || userMessage.indexOf('.gif') != -1 || userMessage.indexOf('.GIF') != -1 || userMessage.indexOf('.png') != -1 || userMessage.indexOf('.PNG') != -1) ){
			//alert('整形前'+nama_messe);
			//alert('整形後'+userMessage);

			if( nama_messe.indexOf('<br />') != -1 || (userMessage.indexOf('.jpg') != -1 || userMessage.indexOf('.jpeg') != -1 || userMessage.indexOf('.JPG') != -1 || userMessage.indexOf('.gif') != -1 || userMessage.indexOf('.GIF') != -1 || userMessage.indexOf('.png') != -1 || userMessage.indexOf('.PNG') != -1)){
				//alert(nama_messe);
				var change_messe = nama_messe.split('<br />');
				for(var aa = 0; aa < change_messe.length; aa++){
					if(change_messe[aa].indexOf('.jpg') != -1 || change_messe[aa].indexOf('.jpeg') != -1 || change_messe[aa].indexOf('.JPG') != -1 || change_messe[aa].indexOf('.gif') != -1 || change_messe[aa].indexOf('.GIF') != -1 || change_messe[aa].indexOf('.png') != -1 || change_messe[aa].indexOf('.PNG') != -1){
						userMessage += '<br /><img src="'+change_messe[aa]+'"><br />';
					}
				}
			}
		}
//////////////////////////////////////////////////////////
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
	
	
	
	
	
/* 	
    // チャットメッセージ部分
    var voice_node = $('<div class="thread_article_box magl22 fltl">');
	var voice_node_inner = $('<div class="thread_article_box_wrapp">');
    var icon_node  = $('<div class="thread_article_thumb fltl">');
    var utc_time   = this._changeTimeStamp(message_time);
    var easy_time  = this._changeEasyTimeStamp(message_time);
    var time_node  = $('<abbr class="thread_article_date">').attr('title', utc_time);//var time_node  = $('<abbr class="time">').attr('title', utc_time);
    var chat_content_node = $('<article class="chat-content" id="chat-content-'+comment_id+'">');

//    var star_node = $('<a href="#" id="'+comment_id+'" class="star">').text('★');
    var delete_cmt_node = $('<img src="/images/article_close.gif" width="18" height="18" alt="閉じる" class="thread_article_date" href="#" name="delete_cmt" id="del_cmt_'+comment_id+'">').text('×削除');

//    if (userName == 'me') {
     voice_node_inner.prepend($('<h4>').text(userName));
	  voice_node_inner.append(time_node.text(easy_time));
      voice_node_inner.append($('<div class="thread_article_txt">').html(userMessage));
      voice_node_inner.append(image_node);
      
//      voice_node.append($('<div id="star_'+comment_id+'">').html(star_node));

      if (is_owner) {
        voice_node_inner.append($('<div class="delete_cmt">').html(delete_cmt_node));
      }

      chat_content_node.prepend(voice_node);
	  voice_node.prepend(voice_node_inner);
      chat_content_node.prepend(icon_node.html('<img src="'+user_image+'" width="40" height="40"><div class="thread_article_box_arrowl"></div>'));
*/  


		/*
		<article>
			<div class="thread_article_thumb fltl"><img src="/images/thumb_s3.jpg" width="40" height="40"></div><div class="thread_article_box_arrowl"></div>
			<div class="thread_article_box magl22 fltl">
				<div class="thread_article_box_wrapp"><img src="/images/article_close.gif" width="18" height="18" alt="閉じる" class="thread_article_date">
					<h4>Kunshiro Murayama</h4>
					<div class="thread_article_date">2012/00/00 MON 09:34:07.85</div>
					<div class="thread_article_txt">http://livedoor.blogimg.jp/chihhylove/imgs/4/c/4ca5eeac.jpg<br><img src="/images/community_thumb.jpg"></div>
				</div>
			</div>
		</article>
		*/

//node split
var JointOne = '<article class="chat-content" id="chat-content-';
var JointTwo_l = '<div class="thread_article_thumb fltl"><img src="';
var JointTwo_r = '<div class="thread_article_thumb fltr"><img src="';


	if(stamp_flag == 1){
		if (!is_owner) {
			 chat_content_node = $(JointOne + comment_id+'">').prepend(JointTwo_l + user_image+'" width="40" height="40"></div><div class="thread_article_box_stmp magl22 fltl"><div class="thread_article_box_wrapp_stmp"><h4>'+userName+'</h4><div class="thread_article_txt_stmp"><img src='+userMessage+' width="150" height="auto"></div></div></div>');
		}else{
			 chat_content_node = $(JointOne + comment_id+'">').prepend(JointTwo_r + user_image+'" width="40" height="40"></div><div class="thread_article_box_stmp magr22 fltr"><div class="thread_article_box_wrapp_stmp txtr"><img src="/images/article_close.png" width="18" height="18" alt="閉じる" style="top:20px;" class="thread_article_date" name="delete_cmt" id="del_cmt_'+comment_id+'"><h4>'+userName+'</h4><div class="thread_article_txt_stmp"><img src='+userMessage+' width="150" height="auto"></div></div></div>');
		}
	}else{
		if (!is_owner) {
			 chat_content_node = $(JointOne + comment_id+'">').prepend(JointTwo_l + user_image+'" width="40" height="40"></div><div class="thread_article_box_arrowl"></div><div class="thread_article_box magl22 fltl"><div class="thread_article_box_wrapp"><h4>'+userName+'</h4><div class="thread_article_date">'+this._changeEasyTimeStamp(message_time)+'</div><div class="thread_article_txt">'+userMessage+'</div></div></div>');
		}else{
			 chat_content_node = $(JointOne + comment_id+'">').prepend(JointTwo_r + user_image+'" width="40" height="40"></div><div class="thread_article_box_arrowr"></div><div class="thread_article_box magr22 fltr"><div class="thread_article_box_wrapp"><img src="/images/article_close.png" width="18" height="18" alt="閉じる" class="thread_article_date" name="delete_cmt" id="del_cmt_'+comment_id+'"><h4>'+userName+'</h4><div class="thread_article_date">'+this._changeEasyTimeStamp(message_time)+'</div><div class="thread_article_txt">'+userMessage+'</div></div></div>');
		}
	}
		//this.messageList.prepend(chat_content_node); article上
		this.messageList.append(chat_content_node); //article下
		this.messageList2.empty();
		this.messageList2.html(chat_content_node);
		
		$('#lines1 abbr.time').timeago();
		if(MovingFlag == 1){
			CommentBox_func('chat-content-' + comment_id);
			MovingFlag = 0;
		}
		$('input#uploadings_input').val('');
		$('#realUpfile').val('');
		//$('input.comment_radio').removeAttr('checked');
		$('input.comment_radio').attr('checked',false);
		//添付とコメントを同時に投稿できぬようテキストエリアをdisable化を解除
		$('#message1').removeAttr('disabled');
		//$('#message1').blur();


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

  _setIframeArea: function (iframeURL, flg_owner, ext_image_path, ext_image_domain) {

	if(StampHideFlag != 1){ //スタンプは非表示
	    this.iframeArea.empty();
	} else if (iframeURL.indexOf('youtube.com') !== -1) {
	    this.iframeArea.empty();
	}


    // youtube 有り
    if (iframeURL.indexOf('youtube.com') !== -1) {
      // 動画ID を抜き出す
      var youtube_vid = iframeURL.match(/[&\?]v=([\d\w-]+)/);
      if (youtube_vid[1]) {

        // player-ctrl の部品組立
        var video_start = $('<a href="javascript:void(0);" id="video-start"><img src="/images/common/yt_restart.png"></a>');
        var video_play  = $('<a href="javascript:void(0);" id="video-play"><img src="/images/common/yt_play.png"></a>');
        var video_pause = $('<a href="javascript:void(0);" id="video-pause"><img src="/images/common/yt_pause.png"></a>');

        // player-ctrl の親要素
        var player_ctrl = $('<div id="player-ctrl">');
        // 部品をappend していく
	player_ctrl.append(video_play);
	player_ctrl.append(video_pause);
	player_ctrl.append(video_start);
        //player_ctrl.append($('<span>').text(' | '));
        //player_ctrl.append($('<span>').text(' | '));

        this.iframeArea.append($('<div id="ytapiplayer">'));
        // オーナーのみコントロール権限有り
        if (flg_owner) {
          this.iframeArea.append(player_ctrl);
        }

        var params = { allowScriptAccess: "always", bgcolor: "#cccccc" };
        var atts = { id: "myytplayer" };
        var youtube_api = 'http://gdata.youtube.com/apiplayer?';
        youtube_api += 'key=AI39si7uG-sNXZtXIClnUvP5HArP1LfH60j0EfKc-8pLVRSOauN-NwLbVkxOZ2v3p6v_Cg1_iZf2D2KcM5ih2Gd5VFDH90D7nA';
        youtube_api += '&version=3&enablejsapi=1&playerapiid=ytplayer';

        //var youtube_api = 'http://www.youtube.com/apiplayer?'
        //youtube_api += 'version=3&enablejsapi=1&playerapiid=ytplayer';
        swfobject.embedSWF(youtube_api, "ytapiplayer", "400", "230", "8", null, null, params, atts);

        // videoid を書きだす
        this.iframeArea.append($('<input type="hidden" id="play_video_id" value="'+youtube_vid[1]+'">'));

        var domain_txt = '引用元：<a href="'+iframeURL+'" target="_blank">youtube.com</a>';
        this.iframeArea.append($('<p>').html(domain_txt));

        //var iframe_tag = '<iframe width="500" height="300" src="';
        //iframe_tag += 'http://www.youtube.com/embed/'+youtube_vid[1];
        //iframe_tag += '" frameborder="0" allowfullscreen></iframe>';
        //this.iframeArea.prepend(iframe_tag);
        //
      }

    // 画像あり


	}else if( StampHideFlag !=1 ){

		if (ext_image_path && ext_image_domain ) {
		this.iframeArea.prepend($('<img class="img" style="max-width:430px;">').attr('src', iframeURL));
		//this.iframeArea.prepend($('<img class="img" style="max-width:500px; max-height:300px;">').attr('src', iframeURL));

		// ドメイン取得
		var domain_txt = '引用元：<a href="'+iframeURL+'?wmode=transparent" target="_blank">'+ext_image_domain+'</a>';
		this.iframeArea.append($('<p>').html(domain_txt));
		}





	   // } else if (ext_image_path && ext_image_domain) {
	    //  this.iframeArea.prepend($('<img class="img" style="max-width:430px;">').attr('src', iframeURL));
	      //this.iframeArea.prepend($('<img class="img" style="max-width:500px; max-height:300px;">').attr('src', iframeURL));

	      // ドメイン取得
	    //  var domain_txt = '引用元：<a href="'+iframeURL+'?wmode=transparent" target="_blank">'+ext_image_domain+'</a>';
	    //  this.iframeArea.append($('<p>').html(domain_txt));

    // nicovideo 有り
//    } else if (iframeURL.indexOf('nicovideo.jp') !== -1) {
//      // 動画ID を抜き出す
//      var nico_vid = iframeURL.match(/(sm[0-9]+)/);
//      if (nico_vid[1]) {
//        var script_tag = document.createElement('script');
//        script_tag.type = 'text/javascript';
//        script_tag.src  = 'http://ext.nicovideo.jp/thumb_watch/'+nico_vid[1];
//
//        //var iframe_tag = '<script type="text/javascript" src="';
//        //var iframe_tag = '<iframe width="500" height="300" src="';
//        //iframe_tag += 'http://ext.nicovideo.jp/thumb_watch/'+nico_vid[1]+'?w=500&h=300';
//        //iframe_tag += '" frameborder="0" allowfullscreen></iframe>';
////        iframe_tag += '"></script>';
////        iframe_tag += '<noscript><a href="http://www.nicovideo.jp/watch/'+nico_vid[1]+'" target="_blank">';
////        iframe_tag += 'nicovideo で見る</a></noscript>';
//        this.iframeArea.prepend(script_tag);
//      }
//
//    // 該当なし。その他
//    } else {
//      this.iframeArea.prepend($('<iframe width="500" height="460">').attr('src', iframeURL));
	}
	StampHideFlag = 0;　//スタンプは非表示
    //this.iframeArea.attr('src', iframeURL);
  },

  _clearInputUserMessage: function () {
    this.userMessage.val('').focus();
    //this.userMessage.val().replace(/(\r\n|\n)+/g, "");
//    $.trim(this.userMessage.val());

    $('#html_image_preview').remove();
    $('#user_up_img').remove();
    $('#drop_message').show();
    //$('#message1').height(50).css({minHeight:50}); // textarea の高さを初期化
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

