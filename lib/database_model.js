define(module, function(exports, require) {

  var qp = require('qp-utility');

  qp.make(exports, {

    ns: 'qp-postgres/lib/database_model',

    db: null,
    model: null,

    insert: function(data, done) {
      data.created = data.modified = qp.now('iso');
      var model = this.model;
      var field_list = model.fields.all.concat(['created', 'modified']);
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
        text: [ 'INSERT INTO', model.table.name, '(' + fields.join(', ') + ') VALUES (' + params.join(', ') + ') RETURNING id' ],
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
      var model = this.model;
      var fields = data.options.fields || model.fields.all;
      fields = fields.concat(model.fields.managed);

      this.db.select({
        text: [ 'SELECT', fields.join(', '), 'FROM', model.table.name, 'WHERE id = $1' ],
        values: [ data.id ],
        success: result => done(null, model.create(result, data.options)),
        failure: done
      });
    },

    update: function(data, done) {
      data.modified = qp.now('iso');
      var model = this.model;
      var field_list = model.fields.all.concat(['modified']);
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
        text: [ 'UPDATE', model.table.name, 'SET', fields.join(', '), 'WHERE id = $' + values.length ],
        values: values,
        success: result => done(null, data),
        failure: done
      });
    },

    delete: function(data, done) {
      this.db.delete({
        text: [ 'DELETE FROM', this.model.table.name, 'WHERE id = $1' ],
        values: [ data.id ],
        done: done
      });
    }

  });

});
