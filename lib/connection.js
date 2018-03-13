define(module, (exports, require) => {

  var qp = require('qp-utility');
  var log = require('qp-library/log');

  qp.make(exports, {

    ns: 'qp-postgres/lib/connection',

    mixin: [
      require('./data_definition'),
      require('./data_manipulation')
    ],

    connection: null,
    log_errors: true,
    log_statements: false,
    log_values: false,

    execute: function(config) {
      if (arguments.length > 1) {
        if (arguments.length === 3) {
          config = { text: config, values: arguments[1], done: arguments[2] };
        } else if (arguments.length === 2) {
          config = { text: config, done: arguments[1] };
        }
      }
      this.execute_command(
        this.prepare_command(config),
        { success: config.success, failure: config.failure, done: config.done }
      );
    },

    close: function() {
      this.connection.release();
      this.connection = null;
    },

    prepare_command: function(config) {
      var text = config.text;
      if (qp.is(config.text, 'array')) {
        if (qp.is(config.text[0], 'array')) {
          text = qp.map(config.text, cmd => cmd.join(' ') + ';').join(qp.eol());
        } else {
          text = config.text.join(' ');
        }
      }
      if (!config.type) config.type = qp.lower(config.text.slice(0, 6));
      var cmd = { type: config.type, text: text, values: config.values || [] };
      if (config.name) cmd.name = config.name;
      cmd[cmd.type] = true;
      cmd.non_query = cmd.insert || cmd.update || cmd.delete;
      if (cmd.select_all) cmd.select = true;
      return cmd;
    },

    execute_command: function(cmd, handlers) {
      this.connection.query(cmd, (error, pg_result) => {
        if ((cmd.select && !cmd.select_all) && pg_result && pg_result.rowCount > 1) {
          error = new Error('Select cannot return multiple rows');
        }
        if (this.log_statements) log(cmd.text);
        if (this.log_values) log(cmd.values);

        if (error) {
          if (this.log_errors) log.error(error);
          qp.call(handlers.failure, error);
          qp.call(handlers.done, error);
        } else if (cmd.definition || cmd.transaction) {
          qp.call(handlers.success, true);
          qp.call(handlers.done, null, true);
        } else if (cmd.non_query) {
          let result = { row_count: pg_result.rowCount, rows: pg_result.rows };
          if (cmd.insert && result.rows[0]) result.id = result.rows[0].id;
          if (cmd.delete) result.count = result.rows[0].count;
          qp.call(handlers.success, result);
          qp.call(handlers.done, null, result);
        } else if (cmd.select) {
          let result = cmd.select_all ? pg_result.rows : (pg_result.rows[0] || null);
          qp.call(handlers.success, result);
          qp.call(handlers.done, null, result);
        }
      });
    }

  });

});
