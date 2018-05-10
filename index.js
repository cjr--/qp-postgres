define(module, function(exports, require) {

  var qp = require('qp-utility');
  var log = require('qp-library/log');
  var pool = require('./lib/connection_pool');
  var connection = require('./lib/connection');
  var notifier = require('./lib/event_notifier');

  var default_options = {
    log_all: false,
    log_statements: false,
    log_values: false,
    log_errors: false,
    log_pool: false
  };

  exports({

    create_client: function(options) {
      return pool.create_client(options);
    },

    create_notifier: function(options) {
      return notifier.create(options);
    },

    open: function(options) {
      if (options.log_all) options.log_statements = options.log_values = options.log_errors = options.log_pool = true;
      qp.assign_own(default_options, options);
      return pool.open(options);
    },

    connect: function(options, handler) {
      pool.connect((error, db_connection, close_connection) => {
        if (error) {
          if (default_options.log_errors) log(error);
          handler(error);
        } else {
          options = qp.options(options, { auto_transaction: false });
          var config = qp.options({ connection: db_connection, auto_transaction: options.auto_transaction }, default_options);
          handler(null, connection.create(config, close_connection));
        }
      });
    },

    close: function(done) {
      pool.close(done);
    }

  });

});
