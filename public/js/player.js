/* player is a wrapper around youtube player's javascript api */

var player = {
  init: function ( options ) {
      this.mute = false;

      this.buffer.init();

      //this.element = options.element;
      this.element = $("#myytplayer").get(0);
      this.element.setVolume(100);
      this.bindEvent( 'onStateChange', 'onytplayerStateChange' );
      this._bindSubscribers();
      this._bindEvents();
  },

  bindEvent: function ( event, callback ) {
      this.element.addEventListener( event, callback );
  },

  _bindEvents: function () {
    var that = this;
    var startElm = $('#video-start');
    var playElm  = $('#video-play');
    var pauseElm = $('#video-pause');
    var stopElm  = $('#video-stop');

    startElm.click(function (event) {
      //player.loadId('hGqaPJulQHA');
      // video_id を取得する
      var play_vid = $('#play_video_id').attr('value');
      if (!play_vid) {return false;}

      // サーバーへpush して全クライアントへ配信してもらう
      $.publish('video:start-c2s', {
        'video_id': play_vid, 'seek_time': 0
        //'video_id': 'lkHlnWFnA0c', 'seek_time': 0
      });
    });

    playElm.click(function (event) {
      //player.play();

      // 現在の時間を取得する
      //var seek_time = player.getCurrentTime();

      // サーバーへpush して全クライアントへ配信してもらう
      $.publish('video:play-c2s', {
      });
    });

    pauseElm.click(function (event) {
      //player.pause();

      // サーバーへpush して全クライアントへ配信してもらう
      $.publish('video:pause-c2s', {
      });
    });
  },

    _bindSubscribers: function () {
        var that = this;

        $.subscribe('video:pause', function() {
            that.pause();
        });

        $.subscribe('video:started', function () {
            that.play();
            that.buffer.stop();
        });

        $.subscribe('video:play', function () {
            that.play();
            that.buffer.stop();
        });

        $.subscribe('video:next', function ( event, video ) {
            that.loadId( video.id );
            that.forceBuffer();
            that.buffer.start();
        });

        $.subscribe('video:forward', function (event, data) {
            player.loadId( data.video_id, data.seek_time );
            player.seekTo( data.seek_time );
            player.play();
            //player.forceBuffer();
        });
    },

    forceBuffer: function () {
        //Play and pause to force buffer
        this.play();
        this.pause();
    },

    loadId: function ( id, secs ) {
        if (secs > 0) {
            this.element.loadVideoById( id, secs );
        } else {
            this.element.loadVideoById( id );
        }

        if (this.mute) {
            this.element.mute();
        }
    },

    pause: function () {
        this.element.pauseVideo();
    },
    
    play: function () {
        this.element.playVideo();
    },

    getCurrentTime: function () {
      return this.element.getCurrentTime();
    },

    seekTo: function ( seconds ) {
        this.element.seekTo( seconds, true );
    },

    toggleMute: function () {
        if (this.mute) {
            this.mute = false;
            this.element.unMute();
        } else {
            this.mute = true;
            this.element.mute();
        }
    }
};

player.buffer = {
    init: function () {
        this.element = $( '#buffer-overlay' );
        this.hide();
    },

    hide: function () {
        this.element.hide();
    },
    
    show: function () {
        this.element.show();
    },

    start: function () {
        var that = this, secs = 10;

        this.show();
        this._setSeconds( secs );

        this.timer = setInterval( function () {
            secs--;
            that._setSeconds( secs );

            if ( secs == 0 ) {
                that.stop();
            }
        }, 0);
        //}, 1000);
    },

    stop: function () {
        clearInterval( this.timer );
        this.hide();
    },

    _setSeconds: function ( secs ) {
        this.element.html( '<h3>' + secs + '</h3><p>Waiting</p>' );
    }
};
