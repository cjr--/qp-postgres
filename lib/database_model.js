define(module, function(exports, require) {

  var qp = require('qp-utility');

  qp.make(exports, {

    ns: 'qp-postgres/lib/database_model',

    db: null,
    schema: null,

    get_data: function(model, fieldlist) {
      var data = { id: model.id, created: model.created, modified: model.modified };
      qp.each(this.fieldlist(fieldlist), field => {
        var value = model[field];
        if (qp.defined(value)) data[field] = value;
      });
      return data;
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

    uuid: function(data, done) {
      data.options = data.options || {};
      var schema = this.schema;
      var fields = data.options.fields || schema.fields.all;
      fields = fields.concat(schema.fields.managed);

      this.db.select({
        text: [ 'SELECT', fields.join(', '), 'FROM', schema.table.name, 'WHERE uuid = $1' ],
        values: [ data.uuid ],
        success: result => done(null, schema.create(result, null, data.options)),
        failure: done
      });
    },

    fieldlist: function(fieldlist) {
      if (qp.is(fieldlist, 'string')) {
        var named_fieldlist = this.schema.fields[fieldlist];
        if (named_fieldlist) {
          return named_fieldlist;
        } else {
          return fieldlist.split(',');
        }
      } else if (qp.is(fieldlist, 'array')) {
        return fieldlist;
      } else {
        return this.schema.fields.public;
      }
    },

    insert_definition: function(model, fieldlist, timestamp) {
      timestamp = timestamp || qp.now('iso');
      var fields = [], params = [], values = [];
      var count = 1;
      qp.each(this.fieldlist(fieldlist), (fieldname) => {
        var column = this.schema.columns[fieldname];
        var value = model[fieldname];
        if (qp.undefined(value)) value = column.default();
        if (column.datetime) {
          if (qp.is_min_date(value)) value = '-infinity';
          else if (qp.is_max_date(value)) value = 'infinity';
        }
        fields.push(fieldname);
        params.push('$' + count);
        values.push(value);
        count++;
      });

      return {
        timestamp: timestamp,
        table: this.schema.table.name,
        fields: fields.concat([ 'created', 'modified' ]).join(', '),
        params: params.concat([ '$' + count, '$' + (count + 1) ]).join(', '),
        values: values.concat([ timestamp, timestamp ])
      };
    },

    insert: function(data, fieldlist, done) {
      if (arguments.length === 2) {
        done = fieldlist;
        fieldlist = null;
      }
      var insert = this.insert_definition(data, fieldlist);
      this.db.insert({
        text: [ 'INSERT INTO', insert.table, '(' + insert.fields + ') VALUES (' + insert.params + ') RETURNING id' ],
        values: insert.values,
        success: result => {
          data.$action = { update: false, insert: true, delete: false };
          data.id = result.id;
          data.created = data.modified = insert.timestamp;
          done(null, data);
        },
        failure: done
      });
    },

    update_definition: function(model, fieldlist, timestamp) {
      timestamp = timestamp || qp.now('iso');
      var field_values = [], values = [];
      var count = 1;
      qp.each(this.fieldlist(fieldlist), (fieldname) => {
        var column = this.schema.columns[fieldname];
        var value = model[fieldname];
        if (qp.defined(value)) {
          if (column.datetime) {
            if (qp.is_min_date(value)) value = '-infinity';
            else if (qp.is_max_date(value)) value = 'infinity';
          }
          field_values.push(fieldname + ' = $' + count);
          values.push(value);
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

    update: function(data, fieldlist, done) {
      if (arguments.length === 2) {
        done = fieldlist;
        fieldlist = null;
      }
      var update = this.update_definition(data, fieldlist);
      this.db.update({
        text: [ 'UPDATE', update.table, 'SET', update.field_values, 'WHERE id = $' + update.id_index ],
        values: update.values,
        success: result => {
          data.$action = { update: true, insert: false, delete: false };
          data.modified = update.timestamp;
          done(null, data);
        },
        failure: done
      });
    },

    upsert: function(data, fieldlist, done) {
      if (arguments.length === 2) {
        done = fieldlist;
        fieldlist = null;
      }
      if (qp.is(data.id, 'number') && data.id > 0) {
        this.update(data, fieldlist, done);
      } else {
        this.insert(data, fieldlist, done);
      }
    },

    delete: function(data, done) {
      this.db.delete({
        text: [ 'DELETE FROM', this.schema.table.name, 'WHERE id = $1' ],
        values: [ data.id ],
        success: result => {
          data.$action = { update: false, insert: false, delete: true };
          done(null, data);
        },
        failure: done
      });
    }

  });

});
