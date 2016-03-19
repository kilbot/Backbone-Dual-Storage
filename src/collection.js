var _ = require('lodash');

module.exports = function(IDBCollection){

  return IDBCollection.extend({

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
      options = _.extend({parse: true}, options);
      var self = this, _fetch = options.remote ? this.fetchRemote : this.fetchLocal;

      return _fetch.apply(this, arguments)
        .then(function (response) {
          var method = options.reset ? 'reset' : 'set';
          self[method](response, options);
          if (options.success) {
            options.success.call(options.context, self, response, options);
          }
          self.trigger('sync', self, response, options);
          return response;
        });
    },

    /**
     *
     */
    fetchLocal: function (options) {
      var self = this;
      options = options || {};

      return this.getBatch.call(this, null, options.data)
        .then(function (response) {
          return self.fetchDelayed(response);
        });
    },

    /**
     * Get remote data and merge with local data on id
     * returns merged data
     */
    fetchRemote: function (options) {
      var self = this, opts = _.clone(options) || {};
      opts.remote = true;
      opts.success = undefined;

      return this.sync('read', this, opts)
        .then(function (response) {
          response = self.parse(response, opts);
          return self.putBatch(response, { index: 'id' });
        })
        .then(function (keys) {
          return self.getBatch(keys);
        });
    },

    fetchRemoteIds: function (last_update, options) {
      options = options || {};
      var self = this, url = _.result(this, 'url') + '/ids';

      var opts = _.defaults(options, {
        url   : url,
        remote: true,
        data  : {
          fields: 'id',
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
                if(!local || local.updated_at < remote.updated_at){
                  local = local || remote;
                  local._state = self.states.read;
                }
                return local;
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
    },

    firstSync: function(options){
      var self = this;
      return this.fetch({ remote: true })
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

    fetchDelayed: function(response){
      var delayed = this.getDelayed('read', response);
      if(delayed){
        var ids = _.map(delayed, 'id');
        return this.fetchRemote({
            data: {
              filter: {
                'in': ids.join(',')
              }
            }
          })
          .then(function(resp){
            _.each(resp, function(attrs){
              var key = _.findKey(response, {id: attrs.id});
              if(key){
                response[key] = attrs;
              } else {
                response.push(resp);
              }
            });
            return response;
          });
      }
      return response;
    },

    getDelayed: function(state, collection){
      var delayed, _state = this.states[state];
      collection = collection || this;
      delayed = _.filter(collection, {_state: _state});
      if(!_.isEmpty(delayed)){
        return delayed;
      }
    }

  });

};