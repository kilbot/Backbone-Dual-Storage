var _ = require('lodash');

module.exports = function (parent){

  /**
   * ensure IDBCollection first
   */
  var IDBCollection  = parent._extend('idb', parent);

  var DualCollection = IDBCollection.extend({

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

    url: function(){
      return this.wc_api + this.name;
    },

    /**
     *
     */
    sync: function(method, model, options){
      if(_.get(options, 'remote')) {
        return this.syncRemote(method, model, options);
      }
      return this.syncLocal(method, model, options);
    },

    /**
     *
     */
    syncLocal: function(method, model, options){
      _.extend(options, { remote: false });
      return IDBCollection.prototype.sync.call(this, method, model, options);
    },

    /**
     *
     */
    syncRemote: function(method, model, options){
      _.extend(options, { remote: true });
      return parent.prototype.sync.call(this, method, model, options);
    },

    /**
     *
     */
    fetch: function (options) {
      var collection = this, success = _.get(options, 'success');
      options = _.extend({parse: true}, options, {success: undefined});
      var fetch = _.get(options, 'remote') ? this.fetchRemote : this.fetchLocal;

      return fetch.call(this, options)
        .then(function (response) {
          var method = options.reset ? 'reset' : 'set';
          collection[method](response, options);
          if (success) {
            success.call(options.context, collection, response, options);
          }
          collection.trigger('sync', collection, response, options);
          return response;
        });
    },

    /**
     *
     */
    fetchLocal: function (options) {
      var collection = this,
          firstSync = this.isNew(),
          fullSync = _.get(options, 'fullSync', firstSync);

      _.extend(options, { set: false });

      return this.syncLocal('read', this, options)
        .then(function (response) {
          if(_.size(response) === 0 && firstSync && fullSync) {
            return collection.fetchRemote(options);
          }
          return collection.fetchReadDelayed(response);
        })
        .then(function(response){
          if(fullSync) {
            collection.fullSync();
          }
          return response;
        });
    },

    /**
     * Get remote data and merge with local data on id
     * returns merged data
     */
    fetchRemote: function (options) {
      var collection = this;
      _.extend(options, { set: false });

      return this.syncRemote('read', this, options)
        .then(function (response) {
          response = collection.parse(response, options);
          options.index = options.index || 'id';
          return collection.saveLocal(response, options);
        });
    },

    /**
     *
     */
    fetchRemoteIds: function (last_update, options) {
      options = options || {};
      var collection = this, url = _.result(this, 'url') + '/ids';

      _.extend(options, {
        url   : url,
        data  : {
          fields: 'id',
          filter: {
            limit         : -1,
            updated_at_min: last_update
          }
        },
        index: {
          keyPath: 'id',
          merge  : function (local, remote) {
            if(!local || local.updated_at < remote.updated_at){
              local = local || remote;
              local._state = collection.states.read;
            }
            return local;
          }
        },
        success: undefined
      });

      return this.fetchRemote(options);
    },

    /**
     *
     */
    fetchUpdatedIds: function (options) {
      var collection = this;
      return this.fetchLocal({
        index    : 'updated_at',
        data     : { filter: { limit: 1, order: 'DESC' } },
        fullSync : false
      })
      .then(function (response) {
        var last_update = _.get(response, [0, 'updated_at']);
        return collection.fetchRemoteIds(last_update, options);
      });
    },

    /**
     *
     */
    fullSync: function(options){
      var collection = this;
      return this.fetchRemoteIds(null, options)
        .then(function(response){
          return collection.destroy(null, {
            index: 'id',
            data: {
              filter: {
                not_in: _.map(response, 'id')
              }
            }
          });
        });
    },

    /**
     *
     */
    fetchReadDelayed: function(response){
      var delayed = this.getDelayed('read', response);
      if(!_.isEmpty(delayed)){
        var ids = _.map(delayed, 'id');
        return this.fetchRemote({ data: { filter: { 'in': ids.join(',') } } })
          .then(function(resp){
            _.each(resp, function(attrs){
              var key = _.findKey(response, {id: attrs.id});
              if(key){ response[key] = attrs; } else { response.push(resp); }
            });
            return response;
          });
      }
      return response;
    },

    /**
     *
     */
    saveLocal: function(models, options){
      _.extend(options, {remote: false});
      return IDBCollection.prototype.save.call(this, models, options);
    },

    /**
     *
     */
    getDelayed: function(state, collection){
      var _state = this.states[state];
      collection = collection || this;
      return _.filter(collection, {_state: _state});
    },

    /**
     *
     */
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

    /**
     *
     */
    parse: function (resp, options) {
      options = options || {};
      if (options.remote) {
        resp = resp && resp[this.name] ? resp[this.name] : resp;
      }
      return IDBCollection.prototype.parse.call(this, resp, options);
    }
  });

  return DualCollection;
};