define(module, function(exports, require) {

  var qp = require('qp-utility');
  var log = require('qp-library/log');
  var pool = require('./lib/connection_pool');
  var connection = require('./lib/connection');
  var notifier = require('./lib/event_notifier');

  var default_options = {
    log_statements: false,
    log_values: false,
    log_errors: true
  };

  exports({

    create_client: function(options) {
      return pool.create_client(options);
    },

    create_notifier: function(options) {
      return notifier.create(options);
    },

    open: function(options) {
      qp.assign_own(default_options, options);
      return pool.open(options);
    },

    connect: function(handler) {
      pool.connect((error, db_connection, close_connection) => {
        if (error) {
          if (default_options.log_errors) log(error);
          handler(error);
        } else {
          handler(null, connection.create(qp.options({ connection: db_connection }, default_options)), close_connection);
        }
      });
    },

    close: function(done) {
      pool.close(done);
    }

  });

});
