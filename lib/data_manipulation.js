define(module, (exports, require) => {

  var qp = require('qp-utility');

  qp.make(exports, {

    ns: 'qp-postgres/lib/data_definition',

    select: function(config) {
      config.type = 'select';
      this.execute(config);
    },

    select_all: function(config) {
      config.type = 'select_all';
      this.execute(config);
    },

    insert: function(config) {
      config.type = 'insert';
      this.execute(config);
    },

    update: function(config) {
      config.type = 'update';
      this.execute(config);
    },

    delete: function(config) {
      config.type = 'delete';
      this.execute(config);
    },

    begin_txn: function(config) {
      config.type = 'transaction';
      config.text = 'BEGIN TRANSACTION';
      this.execute(config);
    },

    rollback_txn: function(config) {
      config.type = 'transaction';
      config.text = 'ROLLBACK TRANSACTION';
      this.execute(config);
    },

    commit_txn: function(config) {
      config.type = 'transaction';
      config.text = 'COMMIT TRANSACTION';
      this.execute(config);
    }

  });

});
