/* timer api */

var timer = {
  init: function ( options ) {
    this.buffer.init();

    this.element = options.element;

    //this.bindEvent( 'onStateChange', 'video.stateChanged' );
    this._bindSubscribers();
  },

  bindEvent: function ( event, callback ) {
    this.element.addEventListener( event, callback );
  },

  _bindSubscribers: function () {
    var that = this;

    $.subscribe('timer:ended', function() {
      that.pause();
    });

    $.subscribe('timer:started', function () {
      that.play();
      that.buffer.stop();
    });

  },

  forceBuffer: function () {
    //Play and pause to force buffer
    this.play();
    this.pause();
  },

  loadId: function ( id, secs ) {
    if (secs > 0) {
      this.element.cueVideoById( id, secs );
    } else {
      this.element.cueVideoById( id );
    }

  },

  pause: function () {
    this.element.pauseVideo();
  },

  play: function () {
    this.element.playVideo();
  },

};

timer.buffer = {
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
    var that = this, secs = 1800; // 30min

    this.show();
    this._setSeconds( secs );

    this.countdown = setInterval( function () {
      secs--;
      that._setSeconds( secs );

      if ( secs == 0 ) {
        that.stop();
      }
    }, 1000);
  },

  stop: function () {
    clearInterval( this.timer );
    this.hide();
  },

  _setSeconds: function ( secs ) {
    this.element.html( '残り：' + secs );
  }
};
