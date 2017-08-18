var _ = require('lodash');

module.exports = function (parent){

  /**
   * ensure IDBModel first
   */
  var IDBModel = parent._extend('idb', parent);

  var DualModel = IDBModel.extend({

    idAttribute: 'local_id',

    remoteIdAttribute: 'id',

    url: function(){
      var remoteId = this.get(this.remoteIdAttribute),
        urlRoot = _.result(this.collection, 'url');

      if(remoteId){
        return '' + urlRoot + '/' + remoteId + '/';
      }
      return urlRoot;
    },

    isDelayed: function(state){
      state = state || this.get('_state');
      return _.includes(this.collection.states, state);
    },

    hasRemoteId: function () {
      return !!this.get(this.remoteIdAttribute);
    },

    sync: function(method, model, options){
      if(_.get(options, 'remote')) {
        return this.syncRemote(method, model, options);
      }
      return this.syncLocal(method, model, options);
    },

    syncLocal: function(method, model, options){
      _.extend(options, { remote: false });
      return IDBModel.prototype.sync.call(this, method, model, options);
    },

    syncRemote: function(method, model, options){
      _.extend(options, { remote: true });
      return parent.prototype.sync.call(this, method, model, options);
    },

    /* jshint -W071, -W074, -W116 */
    save: function(key, val, options){
      var attrs;
      if (key == null || typeof key === 'object') {
        attrs = key;
        options = val;
      } else {
        (attrs = {})[key] = val;
      }

      options = options || {};
      var method = this.hasRemoteId() ? 'update' : 'create';
      this.set({ _state: this.collection.states[method] });

      if(_.get(options, 'remote')) {
        return this.saveRemote(attrs, options);
      }
      return this.saveLocal(attrs, options);
    },
    /* jshint +W071, +W074, +W116 */

    saveLocal: function(attrs, options){
      _.extend(options, { remote: false });
      return IDBModel.prototype.save.call(this, attrs, options);
    },

    saveRemote: function(attrs, options){
      var method = this.hasRemoteId() ? 'update' : 'create';
      var model = this, success = options.success;
      _.extend(options, { success: undefined });

      // if (options.patch && !options.attrs) {
      //   options.attrs = this.prepareRemoteJSON(attrs);
      // }

      return model.syncLocal(method, model, options)
        .then(function(){
          return model.syncRemote(method, model, options);
        })
        .then(function(resp){
          if(resp){
            resp = model.parse(resp, options);
            resp._state = undefined;
            _.extend(options, { success: success });
            return model.saveLocal(resp, options);
          }
        });
    },

    fetch: function(options){
      options = _.extend({parse: true}, options);

      if(!options.remote){
        return IDBModel.prototype.fetch.call(this, options);
      }

      var model = this;

      return this.sync('read', this, options)
        .then(function (resp) {
          resp = model.parse(resp, options);
          _.extend(options, { remote: false });
          return IDBModel.prototype.save.call(model, resp, options);
        });
    },

    // toJSON: function (options) {
    //   options = options || {};
    //   var json = IDBModel.prototype.toJSON.apply(this, arguments);
    //   if (options.remote && this.name) {
    //     json = this.prepareRemoteJSON(json);
    //   }
    //   return json;
    // },

    // prepareRemoteJSON: function (json) {
    //   if(_.has(json, '_state')){
    //     delete json._state;
    //   }
    //   var nested = {};
    //   nested[this.name] = json;
    //   return nested;
    // },

    parse: function (resp, options) {
      options = options || {};
      if (options.remote) {
        resp = resp && resp[this.name] ? resp[this.name] : resp;
      }
      return IDBModel.prototype.parse.call(this, resp, options);
    }

  });

  return DualModel;

};