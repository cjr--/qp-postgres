define(module, (exports, require) => {

  var qp = require('qp-utility');

  qp.make(exports, {

    ns: 'qp-postgres/lib/data_definition',

    execute_definition: function(cmd, done) {
      this.execute({ type: 'definition', text: cmd, done: done });
    },

    create_schema: function(data, done) {
      this.execute_definition([
        'CREATE SCHEMA IF NOT EXISTS', data.schema_name
      ], done);
    },

    drop_schema: function(data, done) {
      this.execute_definition([
        'DROP SCHEMA IF EXISTS', data.schema_name, data.cascade ? 'CASCADE' : ''
      ], done);
    },

    create_user: function(data, done) {
      this.execute_definition([
        'CREATE USER', data.user, 'WITH PASSWORD', '\'' + data.password + '\''
      ], done);
    },

    drop_user: function(data, done) {
      this.execute_definition([ 'DROP USER IF EXISTS', data.user ], done);
    },

    create_database: function(data, done) {
      this.execute_definition([
        'CREATE DATABASE', data.database.name, 'WITH OWNER', data.user
      ], done);
    },

    drop_database: function(data, done) {
      this.execute_definition([ 'DROP DATABASE IF EXISTS', data.database.name ], done);
    },

    grant_schema: function(data, done) {
      this.execute_definition([
        'GRANT ALL PRIVILEGES ON SCHEMA', data.schema_name, 'TO', data.user
      ], done);
    },

    grant_all: function(data, done) {
      this.execute_definition([
        [ 'GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA', data.schema_name, 'TO', data.user ],
        [ 'GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA', data.schema_name, 'TO', data.user ]
      ], done);
    },

    create_sequences: function(data, done) {
      var sequences = [];
      qp.each_own(data.columns, (column) => {
        if (column.sequence) {
          sequences.push([
            'CREATE SEQUENCE IF NOT EXISTS', data.table.fullname + '_' + column.name + '_seq',
            'OWNED BY', data.table.fullname + '.' + column.name
          ]);
        }
      });
      if (qp.empty(sequences)) done();
      else this.execute_definition(sequences, done);
    },

    create_sequence: function(data, done) {
      this.execute_definition([ 'CREATE SEQUENCE IF NOT EXISTS', data.sequence_name ], done);
    },

    set_sequence: function(data, done) {
      this.execute_definition([
        'SELECT setval(\'' + data.sequence_name + '\', ', data.value, ')'
      ], done);
    },

    initialise_sequence: function(data, done) {
      this.execute_definition([
        'SELECT setval(\'' + data.sequence_name + '\', max(', data.field_name || 'id', ') + 1) FROM', data.table_name
      ], done);
    },

    drop_sequence: function(data, done) {
      this.execute_definition([ 'DROP SEQUENCE IF EXISTS', data.sequence_name ], done);
    },

    create_table: function(data, done) {
      this.execute_definition([
        'CREATE TABLE IF NOT EXISTS', data.table.fullname, '(',
          qp.map(data.columns, column => {
            var def = column.name;
            if (column.primary) {
              def += ' integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY';
            } else if (column.primary_key) {
              def += ' integer PRIMARY KEY';
            } else if (column.foreign && column.constrain) {
              def += ' ' + column.type + ' REFERENCES ' + column.table_fullname;
            } else {
              def += ' ' + column.type;
              if (column.type === 'numeric') {
                def += '(' + column.size + ',' + column.scale + ')';
              } else if (column.array) {
                def += '[]';
              }
              if (column.unique) {
                def += ' CONSTRAINT ' + column.name + '_is_unique UNIQUE';
              }
            }
            return def;
          }).join(', '),
        ')'
      ], done);
    },

    drop_table: function(data, done) {
      this.execute_definition([ 'DROP TABLE IF EXISTS', data.table.fullname ], done);
    },

    rename_table: function(data, done) {
      this.execute_definition([ 'ALTER TABLE', data.table.fullname, 'RENAME TO', data.to ], done);
    },

    add_column: function(data, done) {
      this.execute_definition([
        'ALTER TABLE', data.table.fullname, 'ADD COLUMN', data.column.name, data.column.type
      ], done);
    },

    remove_column: function(data, done) {
      this.execute_definition([ 'ALTER TABLE', data.table.fullname, 'DROP COLUMN', data.column.name ], done);
    },

    change_column: function(data, done) {
      this.execute_definition([
        'ALTER TABLE', data.table.fullname, 'ALTER COLUMN', data.column.name, 'TYPE', data.column.type
      ], done);
    },

    rename_column: function(data, done) {
      this.execute_definition([
        'ALTER TABLE', data.table.fullname, 'RENAME COLUMN', data.column.name, 'TO', data.column.new_name
      ], done);
    },

    create_indexes: function(data, done) {
      var indexes = [];
      qp.each_own(data.indexes, (index) => {
        indexes.push(this.create_index_statement({ table: data.table, index: index }));
      });
      if (qp.empty(indexes)) done();
      else this.execute_definition(indexes, done);
    },

    create_index: function(data, done) {
      this.execute_definition(this.create_index_statement(data), done);
    },

    create_index_statement: function(data) {
      return [
        'CREATE' + (data.index.unique ? ' UNIQUE' : ''), 'INDEX IF NOT EXISTS', data.index.name,
        'ON', data.table.fullname,
        'USING', data.index.method,
        (data.index.expression || data.index.column),
        (data.index.desc ? 'DESC' : 'ASC')
      ];
    },

    drop_index: function(data, done) {
      this.execute_definition([ 'DROP INDEX IF EXISTS', data.index.name ], done);
    },

    drop_trigger: function(data, done) {
      this.execute_definition([
        'DROP TRIGGER IF EXISTS', data.trigger.name, 'ON', data.table.fullname, 'CASCADE'
      ], done);
    },

    create_row_modified_procedure: function(data, done) {
      this.execute_definition([
        'CREATE OR REPLACE FUNCTION notify_row_modified() RETURNS trigger AS $$',
          'DECLARE',
          '  id bigint;',
          'BEGIN',
          '  IF TG_OP = \'INSERT\' OR TG_OP = \'UPDATE\' THEN',
          '    id = NEW.id;',
          '  ELSE',
          '    id = OLD.id;',
          '  END IF;',
          '  PERFORM pg_notify(\'row_modified\', json_build_object(\'schema\', TG_TABLE_SCHEMA, \'table\', TG_TABLE_NAME, \'id\', id, \'type\', TG_OP)::text);',
          '  RETURN NEW;',
          'END;',
        '$$ LANGUAGE plpgsql;'
      ], done);
    },

    create_triggers: function(data, done) {
      var triggers = qp.map(data.triggers, (trigger) => {
        return this.create_trigger_command({ trigger: trigger, table: data.table });
      });

      if (qp.empty(triggers)) done();
      else this.execute_definition(triggers, done);
    },

    create_trigger: function(data, done) {
      this.execute_definition(this.create_trigger_command(data), done);
    },

    create_trigger_command: function(data) {
      return [
        'CREATE TRIGGER', data.trigger.name, data.trigger.sequence || 'AFTER',
          data.trigger.event, 'ON', data.table.fullname,
          'FOR EACH', data.trigger.row ? 'ROW' : 'STATEMENT',
          'EXECUTE PROCEDURE', data.trigger.procedure + '()'
      ];
    }

  });

});