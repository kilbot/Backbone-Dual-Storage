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

      return fetch.call(this, options)
        .then(function (response) {
          var method = options.reset ? 'reset' : 'set';
          collection[method](response, options);
          collection.setTotals(options);
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
    /* jshint -W071 */
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
    /* jshint +W071 */

    /**
     * Get remote data and merge with local data on id
     * returns merged data
     * - add triggers for infinite view
     */
    fetchRemote: function (options) {
      var collection = this;
      _.extend(options, { set: false, remote: true });
      collection.trigger('request:remote', collection, null, options);

      return this.sync('read', this, options)
        .then(function (response) {
          response = collection.parse(response, options);
          options.index = options.index || 'id';
          return collection.saveLocal(response, options);
        })
        .then(function(response){
          collection.trigger('sync:remote', collection, response, options);
          return response;
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
            updated_at_min: last_update,
            order         : _.get(this.state, ['filter', 'order']),
            orderby       : _.get(this.state, ['filter', 'orderby'])
          }
        },
        index: {
          keyPath: 'id',
          merge  : function (local, remote) {
            if(!local || _.get(local, 'updated_at') < _.get(remote, 'updated_at')){
              local = local || remote;
              local._state = collection.states.read;
            }
            return local;
          }
        },
        success: undefined // no success function
      });

      return this.fetchRemote(options);
    },

    /**
     * @todo: not_in read delayed
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
      options = options || {};
      var collection = this;
      return this.destroyGarbage(options)
        .then(function(){
          return collection.fetchUpdated();
        })
        .then(function(){
          collection.trigger('sync:fullSync', collection, null, options);
          collection.setTotals(options);
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
    fetchUpdated: function(){
      var collection = this;
      return collection.fetchUpdatedIds()
        .then(function(response){
          var ids = _.intersection( _.map(response, 'id'), collection.map('id') );
          if(_.isEmpty(ids)){
            return;
          }
          return collection.fetchRemote({
            data: {
              filter: {
                limit: -1,
                'in': ids.join(',')
              }
            }
          });
        })
        .then(function(response){
          if(_.isEmpty(response)){
            return;
          }

          // update collection, note: set won't clear _state attribute
          var models = collection.set(response, { remove: false });
          _.each(models, function(model){
            model.set({ _state: undefined })
          });
        });
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
    destroyGarbage: function(options){
      options = options || {};
      var collection = this;
      return this.fetchRemoteIds(null, options)
        .then(function(response){
          return collection.destroyLocal(null, {
            wait: true,
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
      var totals = {
        idb: _.get(options, 'idb')
      };

      // remote
      if(_.has(options, 'xhr')){
        var remote = _.parseInt(options.xhr.getResponseHeader('X-WC-Total'));
        if(!_.isNaN(remote)){
          totals.remote = {
            total: remote
          };
        }
      }

      _.set(this, ['state', 'totals'], totals);
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