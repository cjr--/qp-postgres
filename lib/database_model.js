define(module, function(exports, require) {

  var qp = require('qp-utility');

  qp.make(exports, {

    ns: 'qp-postgres/lib/database_model',

    db: null,
    schema: null,

    info: function(model) {
      return this.schema.create(model, null, { internal: false });
    },

    id: function(data, done) {
      data.options = data.options || {};
      var schema = this.schema;
      var fields = data.options.fields || schema.fields.all;
      fields = fields.concat(schema.fields.managed);

      this.db.select({
        text: [ 'SELECT', fields.join(', '), 'FROM', schema.table.name, 'WHERE id = $1' ],
        values: [ data.id ],
        success: result => done(null, schema.create(result, null, data.options)),
        failure: done
      });
    },

    insert_definition: function(model, timestamp) {
      timestamp = timestamp || qp.now('iso');
      var fields = [], params = [], values = [];
      var count = 1;
      qp.each(this.schema.fields.all, (field, i) => {
        if (qp.defined(model[field])) {
          fields.push(field);
          params.push('$' + count);
          values.push(model[field]);
          count++;
        }
      });

      return {
        timestamp: timestamp,
        table: this.schema.table.name,
        fields: fields.concat([ 'created', 'modified' ]).join(', '),
        params: params.concat([ '$' + count, '$' + (count + 1) ]).join(', '),
        values: values.concat([ timestamp, timestamp ])
      };
    },

    insert: function(data, done) {
      var insert = this.insert_definition(data);
      this.db.insert({
        text: [ 'INSERT INTO', insert.table, '(' + insert.fields + ') VALUES (' + insert.params + ') RETURNING id' ],
        values: insert.values,
        success: result => {
          data.id = result.id;
          data.created = data.modified = insert.timestamp;
          done(null, data);
        },
        failure: done
      });
    },

    update_definition: function(model, timestamp) {
      timestamp = timestamp || qp.now('iso');
      var field_values = [], values = [];
      var count = 1;
      qp.each(this.schema.fields.all, (field) => {
        if (qp.defined(model[field])) {
          field_values.push(field + ' = $' + count);
          values.push(model[field]);
          count++;
        }
      });

      return {
        timestamp: timestamp,
        table: this.schema.table.name,
        field_values: field_values.concat([ 'modified = $' + count ]).join(', '),
        values: values.concat([ timestamp, model.id ]),
        id_index: (count + 1)
      };
    },

    update: function(data, done) {
      var update = this.update_definition(data);
      this.db.update({
        text: [ 'UPDATE', update.table, 'SET', update.field_values, 'WHERE id = $' + update.id_index ],
        values: update.values,
        success: result => {
          data.modified = update.timestamp;
          done(null, data);
        },
        failure: done
      });
    },

    upsert: function(data, done) {
      if (qp.is(data.id, 'number') && data.id > 0) {
        this.update(data, done);
      } else {
        this.insert(data, done);
      }
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
