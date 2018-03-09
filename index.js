define(module, function(exports, require) {

  var qp = require('qp-utility');
  var pool = require('./lib/connection_pool');
  var connection = require('./lib/connection');
  var notifier = require('./lib/event_notifier');

  exports({

    create_client: function(options) {
      return pool.create_client(options);
    },

    create_notifier: function(options) {
      return notifier.create(options);
    },

    open: function(options) {
      return pool.open(options);
    },

    connect: function(handler) {
      pool.connect((error, db_connection, close_connection) => {
        if (error) handler(error);
        else handler(null, connection.create({ connection: db_connection }), close_connection);
      });
    },

    close: function(done) {
      pool.close(done);
    }

  });

});
