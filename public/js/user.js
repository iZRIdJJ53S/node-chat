function User( options ) {
  this.session_id = options.session_id;
  this.name = options.name;
  this.avatar_img = options.avatar_img;
  this.audience_img = options.audience_img;
}

User.prototype = {
  speak: function ( message ) {
    var balloon = this.element.find( 'span.audience-balloon' );

    var icon_2 = $('<img>').attr('src', message);
    //$(balloon).bubbletip(icon_2);
    balloon.html( '<strong>'+this.name+'</strong> ').append(icon_2).show();

    clearTimeout( this.timer );

    this.timer = setTimeout( function () {
      balloon.hide();
    }, 1000 )
  },

  render: function () {
    this.element = $( [
        '<img id="'+this.session_id+'" src="'+this.avatar_img+'">'
        //'<li><img id="'+this.session_id+'" src="'+this.avatar_img+'"></li>'
    ].join( '' ) );

    return this.element;
  },

  render_audience: function () {
    this.element = $( [
      '<img id="'+this.session_id+'" class="audience-avatar" src="'+this.audience_img+'">',
      //'<div id="audience-'+this.session_id+'" class="audience" style="">',
      //  '<span class="audience-balloon" style="display:none;"></span>',
      //  '<img class="audience-avatar" src="'+this.audience_img+'">',
      //'</div>'
    ].join( '' ) );

    return this.element;
  },

  remove: function () {
    this.element.remove();
  }
};
