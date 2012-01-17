/*!
 * jQuery Simple PubSub v0.2.1
 * https://github.com/lquixada/jquery-simple-pubsub
 *
 * Copyright 2011, Leonardo Quixada
 * Dual licensed under the MIT or GPL Version 2 licenses.
 * http://jquery.org/license
 *
 */
(function ($) {
    var subscriptions = [];

    $.publish = function ( eventName, message ) {
        $( document ).trigger( eventName, message );
    };

    $.subscribe = function ( eventName, callback ) {
        var subscription;

        $( document ).bind( eventName, callback );

        subscription = {
            callback: callback,
            unsubscribe: function () {
                $( document ).unbind( eventName, this.callback ); 
            }
        };

        subscriptions.push( subscription );

        return subscription;
    };

    $.unsubscribeAll = function () {
        for (var i = 0; i < subscriptions.length; i++) {
            subscriptions[i].unsubscribe();
        }

        subscriptions = [];
    };

})( jQuery );
