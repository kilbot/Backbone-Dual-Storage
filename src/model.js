var _ = require('lodash');
var sync = require('./sync');

module.exports = function (parent){

  /**
   * ensure IDBCollection first
   */
  var DualModel = parent._extend('idb', parent).extend({

    sync: sync,

    idAttribute: 'local_id',

    remoteIdAttribute: 'id',

    url: function () {
      var remoteId = this.get(this.remoteIdAttribute),
        urlRoot  = _.result(this.collection, 'url');

      if (remoteId) {
        return '' + urlRoot + '/' + remoteId + '/';
      }
      return urlRoot;
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
      this.set({ _state: this.collection.states[method] }, { silent: true });

      if(!options.remote){
        return parent.prototype.save.apply(this, arguments);
      }

      var model = this, success = options.success, local_id;
      _.extend(options, { success: undefined, remote: false });
      if (options.patch && !options.attrs) {
        options.attrs = this.prepareRemoteJSON(attrs);
      }

      return this.sync(method, this, options)
        .then(function(resp){
          local_id = resp.local_id;
          _.extend(options, { remote: true });
          return model.sync(method, model, options);
        })
        .then(function(resp){
          resp = model.parse(resp, options);
          _.extend(resp, { local_id: local_id, _state: undefined });
          _.extend(options, { remote: false, success: success });
          return parent.prototype.save.call(model, resp, options);
        });
    },
    /* jshint +W071, +W074, +W116 */

    fetch: function(options){
      options = _.extend({parse: true}, options);

      if(!options.remote){
        return parent.prototype.fetch.call(this, options);
      }

      var model = this;

      return this.sync('read', this, options)
        .then(function (resp) {
          resp = model.parse(resp, options);
          _.extend(options, { remote: false });
          return parent.prototype.save.call(model, resp, options);
        });
    },

    hasRemoteId: function () {
      return !!this.get(this.remoteIdAttribute);
    },

    toJSON: function (options) {
      options = options || {};
      var json = parent.prototype.toJSON.apply(this, arguments);
      if (options.remote && this.name) {
        json = this.prepareRemoteJSON(json);
      }
      return json;
    },

    prepareRemoteJSON: function (json) {
      if(_.has(json, '_state')){
        delete json._state;
      }
      var nested = {};
      nested[this.name] = json;
      return nested;
    },

    parse: function (resp, options) {
      options = options || {};
      if (options.remote) {
        resp = resp && resp[this.name] ? resp[this.name] : resp;
      }
      return parent.prototype.parse.call(this, resp, options);
    }
  });

  return DualModel;

};