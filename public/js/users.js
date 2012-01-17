
var users = {
  users: {},

  init: function () {
    this.userSpace = $( '#users_view' );

    this.bindSubscribers();
  },

  add: function ( data ) {
    var divUser
      , user = new User( data )
      ;

    this.users[user.session_id] = user;

    if ( data.currentUser ) {
      this.currentUser = user;
    }

    divUser = user.render();

    this.userSpace.append( divUser );
  },

  bindSubscribers: function () {
    var that = this;

    $.subscribe( 'user:joined', function ( event, user ) {
      that.userSpace.empty();
      console.log(user);
      var max_loop = user.avatar_members.length;
      for (var i = 0; i < max_loop; i++) {
        var user_data = {'session_id': user.avatar_members[i].session_id,
          'avatar_img': user.avatar_members[i].avatar_img
        };
        that.add( user_data );
        //that.add( user );
      }
    } );

    $.subscribe( 'user:left', function ( event, user ) {
      that.remove( user );
    } );

  },

  remove: function ( data ) {
    var user = this.users[data.id];

    // If user disconnects (ex: reloads the page) before
    // the user DOM renders, it throws an error.
    // use try ... finally instead?
    if ( user ) {
      user.remove();
    }

    if ( user == this.currentUser ) {
      delete this.currentUser;
    }

    delete this.users[data.id];
  }

};
