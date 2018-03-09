define(module, function(exports, require) {

  var qp = require('qp-utility');

  qp.make(exports, {

    ns: 'qp-postgres/lib/database_model',

    db: null,
    schema: null,

    info: function(model) {
      return this.schema.create(model, { internal: false });
    },

    insert: function(data, done) {
      data.created = data.modified = qp.now('iso');
      var schema = this.schema;
      var field_list = schema.fields.all.concat(['created', 'modified']);
      var fields = [];
      var params = [];
      var values = [];
      qp.each(field_list, (field, i) => {
        if (qp.defined(data[field])) {
          fields.push(field);
          params.push('$' + (i + 1));
          values.push(data[field]);
        }
      });

      this.db.insert({
        text: [ 'INSERT INTO', schema.table.name, '(' + fields.join(', ') + ') VALUES (' + params.join(', ') + ') RETURNING id' ],
        values: values,
        success: result => {
          data.id = result.id;
          done(null, data);
        },
        failure: done
      });
    },

    id: function(data, done) {
      data.options = data.options || {};
      var schema = this.schema;
      var fields = data.options.fields || schema.fields.all;
      fields = fields.concat(schema.fields.managed);

      this.db.select({
        text: [ 'SELECT', fields.join(', '), 'FROM', schema.table.name, 'WHERE id = $1' ],
        values: [ data.id ],
        success: result => done(null, schema.create(result, data.options)),
        failure: done
      });
    },

    update: function(data, done) {
      data.modified = qp.now('iso');
      var schema = this.schema;
      var field_list = schema.fields.all.concat(['modified']);
      var fields = [];
      var values = [];
      qp.each(field_list, (field, i) => {
        if (qp.defined(data[field])) {
          fields.push(field + ' = $' + (i + 1));
          values.push(data[field]);
        }
      });
      values.push(data.id);

      this.db.update({
        text: [ 'UPDATE', schema.table.name, 'SET', fields.join(', '), 'WHERE id = $' + values.length ],
        values: values,
        success: result => done(null, data),
        failure: done
      });
    },

    delete: function(data, done) {
      this.db.delete({
        text: [ 'DELETE FROM', this.schema.table.name, 'WHERE id = $1' ],
        values: [ data.id ],
        done: done
      });
    }

  });

});
