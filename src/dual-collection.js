var bb = require('backbone');
var IDBCollection = require('backbone-indexeddb/src/idb-collection');
var DualModel = require('./dual-model');
var _ = require('lodash');

module.exports = bb.DualCollection = IDBCollection.extend({

  model: DualModel,

  keyPath: 'local_id',

  indexes: [
    {name: 'id', keyPath: 'id', unique: true},
    {name: 'updated_at', keyPath: 'updated_at'},
    {name: '_state', keyPath: '_state'}
  ],

  // delayed states
  states: {
    //'patch'  : 'UPDATE_FAILED',
    'update': 'UPDATE_FAILED',
    'create': 'CREATE_FAILED',
    'delete': 'DELETE_FAILED',
    'read'  : 'READ_FAILED'
  },

  toJSON: function (options) {
    options = options || {};
    var json = IDBCollection.prototype.toJSON.apply(this, arguments);
    if (options.remote && this.name) {
      var nested = {};
      nested[this.name] = json;
      return nested;
    }
    return json;
  },

  parse: function (resp, options) {
    options = options || {};
    if (options.remote) {
      resp = resp && resp[this.name] ? resp[this.name] : resp;
    }
    return IDBCollection.prototype.parse.call(this, resp, options);
  },

  fetch: function (options) {
    var self = this, isNew = this.isNew();
    options = options || {};
    if (options.remote) {
      return this.fetchRemote(options);
    }
    return IDBCollection.prototype.fetch.call(this, options)
      .then(function (response) {
        if (isNew && _.size(response) === 0) {
          return self.firstSync();
        }
      });
  },

  firstSync: function(options){
    var self = this;
    return this.fetchRemote(options)
      .then(function () {
        return self.fullSync(options);
      });
  },

  fullSync: function(options){
    var self = this;
    return this.fetchRemoteIds(options)
      .then(function () {
        return self.count();
      });
  },

  fetchRemote: function (options) {
    options = options || {};
    var self = this;
    var opts = _.extend({}, options, {
      remove : false,
      remote : true,
      success: undefined
    });

    return this.sync('read', this, opts)
      .then(function (response) {
        response = self.parse(response, opts);
        return self.putBatch(response, {
          index: 'id'
        });
      })
      .then(function (keys) {
        return self.getBatch(keys);
      })
      .then(function (response) {
        self.set(response, {remove: false});
        if (options.success) {
          options.success.call(options.context, self, response, options);
        }
        return response;
      });
  },

  fetchRemoteIds: function (last_update, options) {
    options = options || {};
    var self = this, url = _.result(this, 'url') + '/ids';

    var opts = _.defaults(options, {
      url   : url,
      remote: true,
      data  : {
        fields: ['id', 'updated_at'],
        filter: {
          limit         : -1,
          updated_at_min: last_update
        }
      }
    });

    opts.success = undefined;

    return this.sync('read', this, opts)
      .then(function (response) {
        response = self.parse(response, opts);
        return self.putBatch(response, {
          index: {
            keyPath: 'id',
            merge  : function (local, remote) {
              var updated_at = _.has(local, 'updated_at') ? local.updated_at : undefined;
              var data = _.merge({}, local, remote);
              if (_.isUndefined(data.local_id) || updated_at !== data.updated_at) {
                data._state = self.states.read;
              }
              return data;
            }
          }
        });
      })
      .then(function (response) {
        return response;
      });
  },

  fetchUpdatedIds: function (options) {
    var self = this;
    return this.findHighestIndex('updated_at')
      .then(function (last_update) {
        return self.fetchRemoteIds(last_update, options);
      });
  }

});