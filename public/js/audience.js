
var audience = {
  users: {},

  init: function () {
    this.audienceSpace = $( '#audienceview' );
    this.icon_img_area = $('#icon_area img');

    this.bindSubscribers();
    this.bindEvents();
  },

  add: function ( data ) {
    var divUser,
      user = new User( data ),
      /* random percentages: from 0.00 to 100.00 */
      left = Math.floor( Math.random()*10000 )/100, 
      bottom = Math.floor( Math.random()*10000 )/100;

    this.users[user.session_id] = user;

    if ( data.current_flg ) {
      this.currentUser = user;
    }

    divUser = user.render_audience();
    divUser.css({
      bottom: bottom+'%',
      left: left+'%',
      /* Perspective issue: the more far the driver is from the video,
       * the closest he is to the user */
      zIndex: -Math.floor(bottom*100)
    });

    //console.log(divUser);
    this.audienceSpace.append( divUser );
  },

  bindSubscribers: function () {
    var that = this;

    $.subscribe( 'audience:joined', function ( event, user ) {
      that.audienceSpace.empty();

      var current_flg = false;
      var max_loop = user.audience_members.length;
	//チャットルームに参加人数表示
	$('#peaple').text(max_loop);
      for (var i = 0; i < max_loop; i++) {
        //console.log('audi-sessionid---'+user.audience_members[i].session_id);
        if (user.currentUserId == user.audience_members[i].session_id) {
          current_flg = true;
        } else {
          current_flg = false;
        }
        var audience_data = {'session_id': user.audience_members[i].session_id,
          'audience_img': user.audience_members[i].audience_img,
          'current_flg': current_flg
        };
        that.add( audience_data );
      }
    } );

    $.subscribe( 'audience:left', function ( event, user ) {
      that.remove( user );
    } );

    $.subscribe( 'audience:message-received', function ( event, data ) {
      that.speak( data );
    } );

    $.subscribe('audience:click-emotion', function(event, data) {
      that.speak(data);
    });
  },

  bindEvents: function () {
    var that = this;

    this.icon_img_area.click(function(event) {
      //console.log(event);
      //console.log($(this).attr('src'));

      var click_icon_src = $(this).attr('src');

      // 自分自身(クライアント)へ描画
      var message_time = chat._getCurrentTime();
      that.speak({'userName': chat.userName, 'userId': that.currentUser.session_id,
        'userMessage': click_icon_src
      });
      // サーバーへpush して全クライアントへ配信してもらう
      $.publish('audi:click-emotion', {
        'userName': chat.userName, 'userId': that.currentUser.session_id,
        'userMessage': click_icon_src, 'user_id': chat.user_id
      });
    });
  },

  remove: function ( data ) {
    var user = this.users[data.session_id];

    // If user disconnects (ex: reloads the page) before
    // the user DOM renders, it throws an error.
    // use try ... finally instead?
    if ( user ) {
      user.remove();
    }

    if ( user == this.currentUser ) {
      delete this.currentUser;
    }

    delete this.users[data.session_id];
  },

  speak: function ( data ) {
    this.users[data.userId].name = data.userName;
    this.users[data.userId].speak( data.userMessage );
  }
};
