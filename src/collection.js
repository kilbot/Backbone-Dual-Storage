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
        return parent.prototype.sync.call(this, method, model, options);
      }
      return IDBCollection.prototype.sync.call(this, method, model, options);
    },

    /**
     *
     */
    fetch: function (options) {
      var collection = this, success = _.get(options, 'success');
      options = _.extend({parse: true}, options, {success: undefined});
      var fetch = _.get(options, 'remote') ? this.fetchRemote : this.fetchLocal;
      collection.trigger('request:dual', collection, fetch, options);

      return fetch.call(this, options)
        .then(function (response) {
          var method = options.reset ? 'reset' : 'set';
          collection[method](response, options);
          collection.setTotals(options);
          if (success) {
            success.call(options.context, collection, response, options);
          }
          collection.trigger('sync sync:dual', collection, response, options);
          return response;
        });
    },

    /**
     *
     */
    fetchLocal: function (options) {
      var collection = this, fullSync = _.get(options, 'fullSync', this.isNew());
      _.extend(options, { remote: false });

      return this.sync('read', this, options)
        .then(function (response) {
          if(_.size(response) > 0){
            return collection.fetchReadDelayed(response);
          }
          // special case
          if(_.get(options, ['idb', 'delayed']) > 0){
            collection.set(response, options);
            collection.setTotals(options);
            return collection.fetchRemote(options);
          }
          // if fullSync sync
          if(fullSync){
            return collection.fetchRemote(options);
          }
          return response;
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
      _.extend(options, { set: false, remote: true });

      return this.sync('read', this, options)
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
          return collection.destroyLocal(null, {
            index: 'id',
            data: {
              filter: {
                not_in: _.map(response, 'id').join(',')
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
    destroyLocal: function(models, options){
      _.extend(options, {remote: false});
      return IDBCollection.prototype.destroy.call(this, models, options);
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
    },

    hasMore: function(){
      var localTotal   = _.get(this.state, ['totals', 'idb', 'total']);
      var localDelayed = _.get(this.state, ['totals', 'idb', 'delayed']);
      var remoteTotal  = _.get(this.state, ['totals', 'remote', 'total']);

      return this.length < localTotal && localDelayed === 0 ||
        localDelayed > 0 && remoteTotal !== 0;
    },

    setTotals: function(options){
      var totals = {};
      totals.idb = _.get(options, 'idb');
      if(_.has(options, 'xhr')){
        totals.remote = {
          total: parseInt( options.xhr.getResponseHeader('X-WC-Total'), 10 )
        };
      }
      _.set(this.state, ['totals'], totals);
      this.trigger('pagination:totals', totals);
    },

    getTotalRecords: function(){
      var localTotal   = _.get(this.state, ['totals', 'idb', 'total']);
      var remoteTotal  = _.get(this.state, ['totals', 'remote', 'total']);
      return _.max([this.length, localTotal, remoteTotal]);
    }

  });

  return DualCollection;
};