var app =
/******/ (function(modules) { // webpackBootstrap
/******/ 	// The module cache
/******/ 	var installedModules = {};

/******/ 	// The require function
/******/ 	function __webpack_require__(moduleId) {

/******/ 		// Check if module is in cache
/******/ 		if(installedModules[moduleId])
/******/ 			return installedModules[moduleId].exports;

/******/ 		// Create a new module (and put it into the cache)
/******/ 		var module = installedModules[moduleId] = {
/******/ 			exports: {},
/******/ 			id: moduleId,
/******/ 			loaded: false
/******/ 		};

/******/ 		// Execute the module function
/******/ 		modules[moduleId].call(module.exports, module, module.exports, __webpack_require__);

/******/ 		// Flag the module as loaded
/******/ 		module.loaded = true;

/******/ 		// Return the exports of the module
/******/ 		return module.exports;
/******/ 	}


/******/ 	// expose the modules object (__webpack_modules__)
/******/ 	__webpack_require__.m = modules;

/******/ 	// expose the module cache
/******/ 	__webpack_require__.c = installedModules;

/******/ 	// __webpack_public_path__
/******/ 	__webpack_require__.p = "";

/******/ 	// Load entry module and return exports
/******/ 	return __webpack_require__(0);
/******/ })
/************************************************************************/
/******/ ([
/* 0 */
/***/ function(module, exports, __webpack_require__) {

	/**
	 * extend Backbone Collection for app use
	 */
	var bb = __webpack_require__(1);
	var extend = __webpack_require__(2);
	var _ = __webpack_require__(3);

	var collectionSubClasses = {
	  dual: __webpack_require__(4),
	  idb: __webpack_require__(5)
	};

	var Collection = bb.Collection.extend({
	  constructor: function () {
	    bb.Collection.apply(this, arguments);
	    this.isNew(true);
	  },
	  isNew: function(reset) {
	    if(reset){
	      this._isNew = true;
	      this.once('sync', function() {
	        this._isNew = false;
	      });
	    }
	    return this._isNew;
	  },
	  _getSubClasses: function(key){
	    if(key){
	      return _.get(collectionSubClasses, key);
	    }
	    return collectionSubClasses;
	  }
	});

	var modelSubClasses = {
	  dual: __webpack_require__(11),
	  idb: __webpack_require__(12)
	};

	var Model = bb.Model.extend({
	  _getSubClasses: function(key){
	    if(key){
	      return _.get(modelSubClasses, key);
	    }
	    return modelSubClasses;
	  }
	});

	Collection.extend = Model.extend = extend;

	Collection._extend = Model._extend = function(key, parent){
	  var subClass = parent.prototype._getSubClasses(key);
	  if(subClass && !_.includes(parent.prototype._extended, key)){
	    parent = subClass(parent);
	    parent.prototype._extended = _.union(parent.prototype._extended, [key]);
	  }
	  return parent;
	};

	module.exports = {
	  Collection  : Collection,
	  Model       : Model
	};

/***/ },
/* 1 */
/***/ function(module, exports) {

	module.exports = Backbone;

/***/ },
/* 2 */
/***/ function(module, exports, __webpack_require__) {

	var _ = __webpack_require__(3);

	module.exports = function(protoProps, staticProps){
	  var parent = this;
	  var child;
	  var extend;

	  if (protoProps && _.has(protoProps, 'extends')) {
	    extend = _.isString(protoProps.extends) ? [protoProps.extends] : protoProps.extends;
	  }

	  // russian doll subclasses
	  if(extend && _.isArray(extend)){
	    _.each(extend, function(key){
	      parent = parent._extend(key, parent);
	    });
	  }

	  if (protoProps && _.has(protoProps, 'constructor')) {
	    child = protoProps.constructor;
	  } else {
	    child = function(){ return parent.apply(this, arguments); };
	  }

	  // Add static properties to the constructor function, if supplied.
	  _.extend(child, parent, staticProps);

	  // Set the prototype chain to inherit from `parent`, without calling
	  // `parent`'s constructor function and add the prototype properties.
	  child.prototype = _.create(parent.prototype, protoProps);
	  child.prototype.constructor = child;

	  // Set a convenience property in case the parent's prototype is needed
	  // later.
	  child.__super__ = parent.prototype;
	  return child;
	};

/***/ },
/* 3 */
/***/ function(module, exports) {

	module.exports = _;

/***/ },
/* 4 */
/***/ function(module, exports, __webpack_require__) {

	var _ = __webpack_require__(3);

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
	    /* jshint -W071 */
	    fetch: function (options) {
	      var collection = this, success = _.get(options, 'success');
	      options = _.extend({parse: true}, options, {success: undefined});
	      var fetch = _.get(options, 'remote') ? this.fetchRemote : this.fetchLocal;

	      if(_.has(this.currentFetchOptions, 'xhr')){
	        this.currentFetchOptions.xhr.abort();
	      }

	      this.currentFetchOptions = options;

	      return fetch.call(this, options)
	        .then(function (response) {
	          if(_.get(options, ['xhr', 'statusText']) === 'abort'){
	            return;
	          }
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
	    /* jshint +W071 */

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
	            return collection.fetchReadDelayed(response, options);
	          }
	          // special case
	          if(_.get(options, ['idb', 'delayed']) > 0) {
	            collection.set(response, options); // needed to clear empty
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
	          var filter = _.get(options, ['data', 'filter']);
	          if(filter){
	            delete filter['in'];
	            delete filter.not_in;
	          }
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
	    fetchReadDelayed: function(response, options){
	      var delayed = this.getDelayed('read', response);
	      if(!_.isEmpty(delayed)){
	        var ids = _.map(delayed, 'id');
	        _.extend(options, {
	          data: {
	            filter: {
	              'in': ids.join(',')
	            }
	          }
	        });
	        return this.fetchRemote(options)
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
	            model.set({ _state: undefined });
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

/***/ },
/* 5 */
/***/ function(module, exports, __webpack_require__) {

	var bb = __webpack_require__(1);
	var _ = __webpack_require__(3);
	var Radio = __webpack_require__(6);
	var IDBAdapter = __webpack_require__(7);
	var sync = __webpack_require__(10);

	module.exports = function (parent){

	  var IDBCollection = parent.extend({

	    name       : 'store',

	    constructor: function(){
	      parent.apply(this, arguments);
	      this.db = new IDBAdapter({ collection: this });
	      this.versionCheck();
	    },

	    sync: sync,

	    /**
	     *
	     */
	    /* jshint -W071, -W074 */
	    save: function(models, options){
	      options = options || {};
	      var collection = this,
	        wait = options.wait,
	        success = options.success,
	        setAttrs = options.set !== false;

	      if(models === null){
	        models = this.getChangedModels();
	      }

	      var attrsArray = _.map(models, function(model){
	        return model instanceof bb.Model ? model.toJSON() : model;
	      });

	      if(!wait && setAttrs){
	        this.set(attrsArray, options);
	      }

	      options.success = function(resp) {
	        var serverAttrs = options.parse ? collection.parse(resp, options) : resp;
	        if (serverAttrs && setAttrs) { collection.set(serverAttrs, options); }
	        if (success) { success.call(options.context, collection, resp, options); }
	        collection.trigger('sync', collection, resp, options);
	      };

	      return sync('update', this, _.extend(options, {attrsArray: attrsArray}));
	    },

	    /**
	     *
	     */
	    destroy: function(models, options){
	      if(!options && models && !_.isArray(models)){
	        options = models;
	        models = undefined;
	      } else {
	        options = options || {};
	      }

	      var collection = this,
	        wait = options.wait,
	        success = options.success;

	      if(models){
	        options.attrsArray = _.map(models, function(model){
	          return model instanceof bb.Model ? model.toJSON() : model;
	        });
	      }

	      if(options.data){
	        wait = true;
	      }

	      options.success = function(resp) {
	        if(wait && !options.attrsArray) {
	          collection.reset();
	        }
	        if(wait && options.attrsArray) {
	          collection.remove(options.attrsArray);
	        }
	        if (success) { success.call(options.context, collection, resp, options); }
	        collection.trigger('sync', collection, resp, options);
	      };

	      if(!wait && !options.attrsArray) {
	        collection.reset();
	      }

	      if(!wait && options.attrsArray) {
	        collection.remove(options.attrsArray);
	      }

	      return sync('delete', this, options);
	    },
	    /* jshint +W071, +W074 */

	    /**
	     *
	     */
	    count: function () {
	      var self = this;
	      return this.db.open()
	        .then(function () {
	          return self.db.count();
	        })
	        .then(function (count) {
	          self.trigger('count', count);
	          return count;
	        });
	    },

	    /**
	     *
	     */
	    getChangedModels: function () {
	      return this.filter(function (model) {
	        return model.isNew() || model.hasChanged();
	      });
	    },

	    /**
	     * Each website will have a unique idbVersion number
	     * the version number is incremented on plugin update and some user actions
	     * this version check will compare the version numbers
	     * idb is flushed on version change
	     */
	    versionCheck: function () {
	      var name = this.name;

	      var newVersion = parseInt(Radio.request('entities', 'get', {
	          type: 'option',
	          name: 'idbVersion'
	        }), 10) || 0;
	      var oldVersion = parseInt(Radio.request('entities', 'get', {
	          type: 'localStorage',
	          name: name + '_idbVersion'
	        }), 10) || 0;

	      if (newVersion !== oldVersion) {
	        this.destroy().then(function () {
	          Radio.request('entities', 'set', {
	            type: 'localStorage',
	            name: name + '_idbVersion',
	            data: newVersion
	          });
	        });
	      }
	    }

	  });

	  return IDBCollection;

	};

/***/ },
/* 6 */
/***/ function(module, exports, __webpack_require__) {

	// Backbone.Radio v2.0.0

	(function (global, factory) {
	   true ? module.exports = factory(__webpack_require__(3), __webpack_require__(1)) :
	  typeof define === 'function' && define.amd ? define(['underscore', 'backbone'], factory) :
	  (global.Backbone = global.Backbone || {}, global.Backbone.Radio = factory(global._,global.Backbone));
	}(this, function (_,Backbone) { 'use strict';

	  _ = 'default' in _ ? _['default'] : _;
	  Backbone = 'default' in Backbone ? Backbone['default'] : Backbone;

	  var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) {
	    return typeof obj;
	  } : function (obj) {
	    return obj && typeof Symbol === "function" && obj.constructor === Symbol ? "symbol" : typeof obj;
	  };

	  var previousRadio = Backbone.Radio;

	  var Radio = Backbone.Radio = {};

	  Radio.VERSION = '2.0.0';

	  // This allows you to run multiple instances of Radio on the same
	  // webapp. After loading the new version, call `noConflict()` to
	  // get a reference to it. At the same time the old version will be
	  // returned to Backbone.Radio.
	  Radio.noConflict = function () {
	    Backbone.Radio = previousRadio;
	    return this;
	  };

	  // Whether or not we're in DEBUG mode or not. DEBUG mode helps you
	  // get around the issues of lack of warnings when events are mis-typed.
	  Radio.DEBUG = false;

	  // Format debug text.
	  Radio._debugText = function (warning, eventName, channelName) {
	    return warning + (channelName ? ' on the ' + channelName + ' channel' : '') + ': "' + eventName + '"';
	  };

	  // This is the method that's called when an unregistered event was called.
	  // By default, it logs warning to the console. By overriding this you could
	  // make it throw an Error, for instance. This would make firing a nonexistent event
	  // have the same consequence as firing a nonexistent method on an Object.
	  Radio.debugLog = function (warning, eventName, channelName) {
	    if (Radio.DEBUG && console && console.warn) {
	      console.warn(Radio._debugText(warning, eventName, channelName));
	    }
	  };

	  var eventSplitter = /\s+/;

	  // An internal method used to handle Radio's method overloading for Requests.
	  // It's borrowed from Backbone.Events. It differs from Backbone's overload
	  // API (which is used in Backbone.Events) in that it doesn't support space-separated
	  // event names.
	  Radio._eventsApi = function (obj, action, name, rest) {
	    if (!name) {
	      return false;
	    }

	    var results = {};

	    // Handle event maps.
	    if ((typeof name === 'undefined' ? 'undefined' : _typeof(name)) === 'object') {
	      for (var key in name) {
	        var result = obj[action].apply(obj, [key, name[key]].concat(rest));
	        eventSplitter.test(key) ? _.extend(results, result) : results[key] = result;
	      }
	      return results;
	    }

	    // Handle space separated event names.
	    if (eventSplitter.test(name)) {
	      var names = name.split(eventSplitter);
	      for (var i = 0, l = names.length; i < l; i++) {
	        results[names[i]] = obj[action].apply(obj, [names[i]].concat(rest));
	      }
	      return results;
	    }

	    return false;
	  };

	  // An optimized way to execute callbacks.
	  Radio._callHandler = function (callback, context, args) {
	    var a1 = args[0],
	        a2 = args[1],
	        a3 = args[2];
	    switch (args.length) {
	      case 0:
	        return callback.call(context);
	      case 1:
	        return callback.call(context, a1);
	      case 2:
	        return callback.call(context, a1, a2);
	      case 3:
	        return callback.call(context, a1, a2, a3);
	      default:
	        return callback.apply(context, args);
	    }
	  };

	  // A helper used by `off` methods to the handler from the store
	  function removeHandler(store, name, callback, context) {
	    var event = store[name];
	    if ((!callback || callback === event.callback || callback === event.callback._callback) && (!context || context === event.context)) {
	      delete store[name];
	      return true;
	    }
	  }

	  function removeHandlers(store, name, callback, context) {
	    store || (store = {});
	    var names = name ? [name] : _.keys(store);
	    var matched = false;

	    for (var i = 0, length = names.length; i < length; i++) {
	      name = names[i];

	      // If there's no event by this name, log it and continue
	      // with the loop
	      if (!store[name]) {
	        continue;
	      }

	      if (removeHandler(store, name, callback, context)) {
	        matched = true;
	      }
	    }

	    return matched;
	  }

	  /*
	   * tune-in
	   * -------
	   * Get console logs of a channel's activity
	   *
	   */

	  var _logs = {};

	  // This is to produce an identical function in both tuneIn and tuneOut,
	  // so that Backbone.Events unregisters it.
	  function _partial(channelName) {
	    return _logs[channelName] || (_logs[channelName] = _.bind(Radio.log, Radio, channelName));
	  }

	  _.extend(Radio, {

	    // Log information about the channel and event
	    log: function log(channelName, eventName) {
	      if (typeof console === 'undefined') {
	        return;
	      }
	      var args = _.toArray(arguments).slice(2);
	      console.log('[' + channelName + '] "' + eventName + '"', args);
	    },

	    // Logs all events on this channel to the console. It sets an
	    // internal value on the channel telling it we're listening,
	    // then sets a listener on the Backbone.Events
	    tuneIn: function tuneIn(channelName) {
	      var channel = Radio.channel(channelName);
	      channel._tunedIn = true;
	      channel.on('all', _partial(channelName));
	      return this;
	    },

	    // Stop logging all of the activities on this channel to the console
	    tuneOut: function tuneOut(channelName) {
	      var channel = Radio.channel(channelName);
	      channel._tunedIn = false;
	      channel.off('all', _partial(channelName));
	      delete _logs[channelName];
	      return this;
	    }
	  });

	  /*
	   * Backbone.Radio.Requests
	   * -----------------------
	   * A messaging system for requesting data.
	   *
	   */

	  function makeCallback(callback) {
	    return _.isFunction(callback) ? callback : function () {
	      return callback;
	    };
	  }

	  Radio.Requests = {

	    // Make a request
	    request: function request(name) {
	      var args = _.toArray(arguments).slice(1);
	      var results = Radio._eventsApi(this, 'request', name, args);
	      if (results) {
	        return results;
	      }
	      var channelName = this.channelName;
	      var requests = this._requests;

	      // Check if we should log the request, and if so, do it
	      if (channelName && this._tunedIn) {
	        Radio.log.apply(this, [channelName, name].concat(args));
	      }

	      // If the request isn't handled, log it in DEBUG mode and exit
	      if (requests && (requests[name] || requests['default'])) {
	        var handler = requests[name] || requests['default'];
	        args = requests[name] ? args : arguments;
	        return Radio._callHandler(handler.callback, handler.context, args);
	      } else {
	        Radio.debugLog('An unhandled request was fired', name, channelName);
	      }
	    },

	    // Set up a handler for a request
	    reply: function reply(name, callback, context) {
	      if (Radio._eventsApi(this, 'reply', name, [callback, context])) {
	        return this;
	      }

	      this._requests || (this._requests = {});

	      if (this._requests[name]) {
	        Radio.debugLog('A request was overwritten', name, this.channelName);
	      }

	      this._requests[name] = {
	        callback: makeCallback(callback),
	        context: context || this
	      };

	      return this;
	    },

	    // Set up a handler that can only be requested once
	    replyOnce: function replyOnce(name, callback, context) {
	      if (Radio._eventsApi(this, 'replyOnce', name, [callback, context])) {
	        return this;
	      }

	      var self = this;

	      var once = _.once(function () {
	        self.stopReplying(name);
	        return makeCallback(callback).apply(this, arguments);
	      });

	      return this.reply(name, once, context);
	    },

	    // Remove handler(s)
	    stopReplying: function stopReplying(name, callback, context) {
	      if (Radio._eventsApi(this, 'stopReplying', name)) {
	        return this;
	      }

	      // Remove everything if there are no arguments passed
	      if (!name && !callback && !context) {
	        delete this._requests;
	      } else if (!removeHandlers(this._requests, name, callback, context)) {
	        Radio.debugLog('Attempted to remove the unregistered request', name, this.channelName);
	      }

	      return this;
	    }
	  };

	  /*
	   * Backbone.Radio.channel
	   * ----------------------
	   * Get a reference to a channel by name.
	   *
	   */

	  Radio._channels = {};

	  Radio.channel = function (channelName) {
	    if (!channelName) {
	      throw new Error('You must provide a name for the channel.');
	    }

	    if (Radio._channels[channelName]) {
	      return Radio._channels[channelName];
	    } else {
	      return Radio._channels[channelName] = new Radio.Channel(channelName);
	    }
	  };

	  /*
	   * Backbone.Radio.Channel
	   * ----------------------
	   * A Channel is an object that extends from Backbone.Events,
	   * and Radio.Requests.
	   *
	   */

	  Radio.Channel = function (channelName) {
	    this.channelName = channelName;
	  };

	  _.extend(Radio.Channel.prototype, Backbone.Events, Radio.Requests, {

	    // Remove all handlers from the messaging systems of this channel
	    reset: function reset() {
	      this.off();
	      this.stopListening();
	      this.stopReplying();
	      return this;
	    }
	  });

	  /*
	   * Top-level API
	   * -------------
	   * Supplies the 'top-level API' for working with Channels directly
	   * from Backbone.Radio.
	   *
	   */

	  var channel;
	  var args;
	  var systems = [Backbone.Events, Radio.Requests];
	  _.each(systems, function (system) {
	    _.each(system, function (method, methodName) {
	      Radio[methodName] = function (channelName) {
	        args = _.toArray(arguments).slice(1);
	        channel = this.channel(channelName);
	        return channel[methodName].apply(channel, args);
	      };
	    });
	  });

	  Radio.reset = function (channelName) {
	    var channels = !channelName ? this._channels : [this._channels[channelName]];
	    _.each(channels, function (channel) {
	      channel.reset();
	    });
	  };

	  return Radio;

	}));
	//# sourceMappingURL=./backbone.radio.js.map

/***/ },
/* 7 */
/***/ function(module, exports, __webpack_require__) {

	/* jshint -W071, -W074 */
	var _ = __webpack_require__(3);
	var matchMaker = __webpack_require__(8);

	var is_safari = window.navigator.userAgent.indexOf('Safari') !== -1 &&
	  window.navigator.userAgent.indexOf('Chrome') === -1 &&
	  window.navigator.userAgent.indexOf('Android') === -1;

	var indexedDB = window.indexedDB;
	var IDBKeyRange = window.IDBKeyRange;

	var consts = {
	  'READ_ONLY'         : 'readonly',
	  'READ_WRITE'        : 'readwrite',
	  'VERSION_CHANGE'    : 'versionchange',
	  'NEXT'              : 'next',
	  'NEXT_NO_DUPLICATE' : 'nextunique',
	  'PREV'              : 'prev',
	  'PREV_NO_DUPLICATE' : 'prevunique'
	};

	function IDBAdapter( options ){
	  options = options || {};
	  this.parent = options.collection;
	  this.opts = _.defaults(_.pick(this.parent, _.keys(this.default)), this.default);
	  this.opts.name = this.parent.name || this.default.name;
	  this.opts.dbName = this.opts.localDBPrefix + this.opts.name;
	}

	IDBAdapter.prototype = {

	  default: {
	    name          : 'store',
	    localDBPrefix : 'Prefix_',
	    dbVersion     : 1,
	    keyPath       : 'id',
	    autoIncrement : true,
	    indexes       : [],
	    matchMaker    : matchMaker,
	    onerror       : function (options) {
	      options = options || {};
	      var err = new Error(options._error.message);
	      err.code = event.target.errorCode;
	      options._error.callback(err);
	    }
	  },

	  constructor: IDBAdapter,

	  open: function (options) {
	    options = options || {};
	    if (!this._open) {
	      var self = this;

	      this._open = new Promise(function (resolve, reject) {
	        var request = indexedDB.open(self.opts.dbName);

	        request.onsuccess = function (event) {
	          self.db = event.target.result;

	          // get count & safari hack
	          self.count()
	            .then(function () {
	              if (is_safari) {
	                return self.getBatch(null, { data: { filter: { limit: 1, order: 'DESC' } } });
	              }
	            })
	            .then(function (resp) {
	              if(is_safari){
	                self.highestKey = _.isEmpty(resp) ? 0 : resp[0][self.opts.keyPath];
	              }
	              resolve(self.db);
	            });
	        };

	        request.onerror = function (event) {
	          options._error = {event: event, message: 'open indexedDB error', callback: reject};
	          self.opts.onerror(options);
	        };

	        request.onupgradeneeded = function (event) {
	          var store = event.currentTarget.result.createObjectStore(self.opts.name, self.opts);

	          self.opts.indexes.forEach(function (index) {
	            store.createIndex(index.name, index.keyPath, {
	              unique: index.unique
	            });
	          });
	        };
	      });
	    }

	    return this._open;
	  },

	  close: function () {
	    this.db.close();
	    this.db = undefined;
	    this._open = undefined;
	  },

	  read: function(key, options){
	    var get = key ? this.get : this.getBatch;
	    return get.call(this, key, options);
	  },

	  update: function(data, options){
	    var put = _.isArray(data) ? this.putBatch : this.put;
	    var get = _.isArray(data) ? this.getBatch : this.get;
	    var self = this;
	    return put.call(this, data, options)
	      .then(function (resp) {
	        resp = resp || [];
	        options.index = undefined;
	        options.objectStore = undefined;
	        // see bug test
	        var filter = _.get(options, ['data', 'filter']);
	        if(filter){
	          delete filter['in'];
	          delete filter.not_in;
	        }
	        return get.call(self, resp, options);
	      });
	  },

	  delete: function(key, options){
	    var remove = key ? this.remove : this.removeBatch;
	    return remove.call(this, key, options);
	  },

	  getTransaction: function (access) {
	    return this.db.transaction([this.opts.name], access);
	  },

	  getObjectStore: function (access) {
	    return this.getTransaction(access).objectStore(this.opts.name);
	  },

	  count: function (options) {
	    options = options || {};
	    var self = this, objectStore = options.objectStore || this.getObjectStore(consts.READ_ONLY);

	    return new Promise(function (resolve, reject) {
	      var request = objectStore.count();

	      request.onsuccess = function (event) {
	        self.length = event.target.result || 0;
	        resolve(event.target.result);
	      };

	      request.onerror = function (event) {
	        options._error = {event: event, message: 'count error', callback: reject};
	        self.opts.onerror(options);
	      };
	    });
	  },

	  put: function (data, options) {
	    options = options || {};
	    var objectStore = options.objectStore || this.getObjectStore(consts.READ_WRITE);
	    var self = this, keyPath = this.opts.keyPath;

	    // merge on index keyPath
	    if (options.index && !options.mergeBatch) {
	      return this.merge(data, options);
	    }

	    if (!data[keyPath]) {
	      return this.add(data, options);
	    }

	    return new Promise(function (resolve, reject) {
	      var request = objectStore.put(data);

	      request.onsuccess = function (event) {
	        resolve(event.target.result);
	      };

	      request.onerror = function (event) {
	        options._error = {event: event, message: 'put error', callback: reject};
	        self.opts.onerror(options);
	      };
	    });
	  },

	  add: function (data, options) {
	    options = options || {};
	    var objectStore = options.objectStore || this.getObjectStore(consts.READ_WRITE);
	    var self = this, keyPath = this.opts.keyPath;

	    if (is_safari) {
	      data[keyPath] = ++this.highestKey;
	    }

	    return new Promise(function (resolve, reject) {
	      var request = objectStore.add(data);

	      request.onsuccess = function (event) {
	        resolve(event.target.result);
	      };

	      request.onerror = function (event) {
	        options._error = {event: event, message: 'add error', callback: reject};
	        self.opts.onerror(options);
	      };
	    });
	  },

	  get: function (key, options) {
	    options = options || {};
	    var objectStore = options.objectStore || this.getObjectStore(consts.READ_ONLY),
	      keyPath     = options.index || this.opts.keyPath,
	      self        = this;

	    if (_.isObject(keyPath)) {
	      keyPath = keyPath.keyPath;
	    }

	    return new Promise(function (resolve, reject) {
	      var request = (keyPath === self.opts.keyPath) ?
	        objectStore.get(key) : objectStore.index(keyPath).get(key);

	      request.onsuccess = function (event) {
	        resolve(event.target.result);
	      };

	      request.onerror = function (event) {
	        options._error = {event: event, message: 'get error', callback: reject};
	        self.opts.onerror(options);
	      };
	    });
	  },

	  remove: function (key, options) {
	    options = options || {};
	    var objectStore = options.objectStore || this.getObjectStore(consts.READ_WRITE),
	      keyPath     = options.index || this.opts.keyPath,
	      self        = this;

	    if(_.isObject(key)){
	      key = key[keyPath];
	    }

	    return new Promise(function (resolve, reject) {
	      var request = (keyPath === self.opts.keyPath) ?
	        objectStore.delete(key) : objectStore.index(keyPath).delete(key);

	      request.onsuccess = function (event) {
	        resolve(event.target.result); // undefined
	      };

	      request.onerror = function (event) {
	        var err = new Error('delete error');
	        err.code = event.target.errorCode;
	        reject(err);
	      };

	      request.onerror = function (event) {
	        options._error = {event: event, message: 'delete error', callback: reject};
	        self.opts.onerror(options);
	      };
	    });
	  },

	  putBatch: function (dataArray, options) {
	    options = options || {};
	    options.objectStore = options.objectStore || this.getObjectStore(consts.READ_WRITE);
	    // var put = this.put.bind(this), batch = [];
	    var batch = [];

	    // more performant batch merge
	    if (options.index && !options.mergeBatch) {
	      return this.mergeBatch(dataArray, options);
	    }

	    // all at once
	    _.each(dataArray, function (data) {
	      batch.push(this.put(data, options));
	    }.bind(this));

	    return Promise.all(batch);

	    // chain promises
	    // return dataArray.reduce(function(promise, data) {
	    //   return promise.then(function(){
	    //     return put(data, options)
	    //       .then(function(resp){
	    //         batch.push(resp);
	    //         return batch;
	    //       });
	    //   });
	    // }, Promise.resolve([]));
	  },

	  /**
	   * 4/3/2016: Chrome can do a fast merge on one transaction, but other browsers can't
	   */
	  merge: function (data, options) {
	    options = options || {};
	    var self = this, keyPath = options.index;
	    var primaryKey = this.opts.keyPath;

	    var fn = function (local, remote, keyPath) {
	      if (local) {
	        remote[keyPath] = local[keyPath];
	      }
	      return remote;
	    };

	    if (_.isObject(options.index)) {
	      keyPath = _.get(options, ['index', 'keyPath'], primaryKey);
	      if (_.isFunction(options.index.merge)) {
	        fn = options.index.merge;
	      }
	    }

	    return this.get(data[keyPath], {index: keyPath, objectStore: options.objectStore})
	      .then(function (result) {
	        return self.put(fn(result, data, primaryKey));
	      });
	  },

	  getBatch: function (keyArray, options) {
	    options = options || {};

	    var objectStore = options.objectStore || this.getObjectStore(consts.READ_ONLY),
	      include     = _.isArray(keyArray) ? keyArray : _.get(options, ['data', 'filter', 'in']),
	      exclude     = _.get(options, ['data', 'filter', 'not_in']),
	      limit       = _.get(options, ['data', 'filter', 'limit'], -1),
	      start       = _.get(options, ['data', 'filter', 'offset'], 0),
	      order       = _.get(options, ['data', 'filter', 'order'], 'ASC'),
	      orderby     = _.get(options, ['data', 'filter', 'orderby']),
	      direction   = order === 'DESC' ? consts.PREV : consts.NEXT,
	      query       = _.get(options, ['data', 'filter', 'q']),
	      keyPath     = options.index || this.opts.keyPath,
	      page        = _.get(options, ['data', 'page']),
	      self        = this,
	      range       = null,
	      end;

	    if (_.isObject(keyPath)) {
	      if(keyPath.value){
	        range = IDBKeyRange.only(keyPath.value);
	      }
	      keyPath = keyPath.keyPath;
	    }

	    if (page && limit !== -1) {
	      start = (page - 1) * limit;
	    }

	    // in & not_in can be strings eg: '1,2,3' for WC REST API
	    // make sure these are turned into an array
	    include = _.isString(include) ? _.map(include.split(','), _.parseInt) : include;
	    exclude = _.isString(exclude) ? _.map(exclude.split(','), _.parseInt) : exclude;

	    return new Promise(function (resolve, reject) {
	      var records = [], delayed = 0, excluded = 0;
	      var request = (keyPath === self.opts.keyPath) ?
	        objectStore.openCursor(range, direction) :
	        objectStore.index(keyPath).openCursor(range, direction);

	      request.onsuccess = function (event) {
	        var cursor = event.target.result;
	        if (cursor) {
	          if (cursor.value._state === 'READ_FAILED') {
	            delayed++;
	          }
	          if (
	            (!include || _.includes(include, cursor.value[keyPath])) &&
	            (!exclude || !_.includes(exclude, cursor.value[keyPath])) &&
	            (!query || self._match(query, cursor.value, keyPath, options))
	          ) {
	            records.push(cursor.value);
	          } else if (exclude && _.includes(exclude, cursor.value[keyPath])){
	            excluded++;
	          }
	          return cursor.continue();
	        }
	        _.set(options, 'idb', {
	          total: records.length + excluded,
	          delayed: delayed
	        });
	        // _.set(options, 'idb.total', records.length + excluded);
	        // _.set(options, 'idb.delayed', delayed);
	        end = limit !== -1 ? start + limit : records.length;

	        // temp fix for lodash v3 compatibility
	        records = _.isFunction(_.sortByOrder) ?
	          _.sortByOrder(records, orderby, order.toLowerCase()) :
	          _.orderBy(records, orderby, order.toLowerCase());

	        resolve(_.slice(records, start, end));
	      };

	      request.onerror = function (event) {
	        options._error = {event: event, message: 'getAll error', callback: reject};
	        self.opts.onerror(options);
	      };
	    });
	  },

	  removeBatch: function(dataArray, options) {
	    var batch = [];
	    options = options || {};
	    dataArray = dataArray || options.attrsArray;

	    if(_.isEmpty(dataArray) && !options.data){
	      return this.clear(options);
	    }

	    if(options.data){
	      var self = this;
	      return this.getBatch(null, options)
	        .then(function(response){
	          options.attrsArray = _.map(response, self.opts.keyPath);
	          if(!_.isEmpty(options.attrsArray)){
	            return self.removeBatch(options.attrsArray);
	          }
	        });
	    }

	    _.each(dataArray, function (data) {
	      batch.push(this.remove(data, options));
	    }.bind(this));

	    return Promise.all(batch);
	  },

	  clear: function (options) {
	    options = options || {};
	    var self = this, objectStore = options.objectStore || this.getObjectStore(consts.READ_WRITE);

	    return new Promise(function (resolve, reject) {
	      var request = objectStore.clear();

	      request.onsuccess = function (event) {
	        self.length = 0;
	        resolve(event.target.result);
	      };

	      request.onerror = function (event) {
	        options._error = {event: event, message: 'clear error', callback: reject};
	        self.opts.onerror(options);
	      };
	    });
	  },

	  _match: function (query, json, keyPath, options) {
	    var fields = _.get(options, ['data', 'filter', 'qFields'], keyPath);
	    return this.opts.matchMaker.call(this, json, query, {fields: fields});
	  },

	  mergeBatch: function(dataArray, options) {
	    options = options || {};
	    options.mergeBatch = true;
	    options.objectStore = undefined;

	    var keyPath = options.index || this.opts.keyPath;
	    var primaryKey = this.opts.keyPath;
	    var batch = [], putBatch = [];
	    var self = this;

	    var mergeFn = function (local, remote, keyPath) {
	      if (local) {
	        remote[keyPath] = local[keyPath];
	      }
	      return remote;
	    };

	    if (_.isObject(keyPath)) {
	      mergeFn = keyPath.merge || mergeFn;
	      keyPath = keyPath.keyPath;
	    }

	    _.each(dataArray, function (data) {
	      var key = data[keyPath];
	      batch.push(
	        this.get(key, options)
	          .then(function (local) {
	            putBatch.push(mergeFn(local, data, primaryKey));
	          })
	      );
	    }.bind(this));

	    return Promise.all(batch)
	      .then(function () {
	        return self.putBatch(putBatch, options);
	      });
	  }

	};

	module.exports = IDBAdapter;
	/* jshint +W071, +W074 */

/***/ },
/* 8 */
/***/ function(module, exports, __webpack_require__) {

	var _ = __webpack_require__(3);
	var match = __webpack_require__(9);

	var defaults = {
	  fields: ['title'] // json property to use for simple string search
	};

	var pick = function(json, props){
	  return _.chain(props)
	    .map(function (key) {
	      var attr = _.get(json, key); // allows nested get

	      // special case, eg: attributes: [{name: 'Size'}, {name: 'Color'}]
	      if(attr === undefined){
	        var keys = key.split('.');
	        attr = _.chain(json).get(keys[0]).map(keys[1]).value();
	      }

	      return attr;
	    })
	    .value();
	};

	var methods = {

	  string: function(json, filter, options) {
	    var fields = _.isArray(options.fields) ? options.fields : [options.fields];
	    var needle = filter.query ? filter.query.toLowerCase() : '';
	    var haystacks = pick(json, fields);

	    return _.some(haystacks, function (haystack) {
	      return match(haystack, needle, options);
	    });
	  },

	  prefix: function(json, filter){
	    return this.string(json, filter, {fields: filter.prefix});
	  },

	  range: function(json, filter, options){
	    var fields = _.isArray(options.fields) ? options.fields : [options.fields];
	    var haystacks = pick(json, fields);

	    return _.some(haystacks, function (haystack) {
	      return _.inRange(haystack, filter.from, filter.to);
	    });
	  },

	  prange: function(json, filter){
	    return this.range(json, filter, {fields: filter.prefix});
	  },

	  or: function(json, filter, options){
	    var self = this;
	    return _.some(filter.queries, function(query){
	      return self[query.type](json, query, options);
	    });
	  },

	  and: function(json, filter, options){
	    var self = this;
	    return _.every(filter.queries, function(query){
	      return self[query.type](json, query, options);
	    });
	  }

	};

	module.exports = function(json, filterArray, options) {
	  var opts = _.defaults({}, options, defaults);

	  if (!_.isArray(filterArray)) {
	    filterArray = [{type: 'string', query: filterArray.toString()}];
	  }

	  // logical AND
	  return _.every(filterArray, function (filter) {
	    return methods[filter.type](json, filter, opts);
	  });
	};

/***/ },
/* 9 */
/***/ function(module, exports, __webpack_require__) {

	var _ = __webpack_require__(3);

	var toType = function(obj){
	  return ({}).toString.call(obj).match(/\s([a-z|A-Z]+)/)[1].toLowerCase();
	};

	var defaults = {

	};

	var match = {
	  'string': function(str, value, options){
	    if(options.exact || _.isEmpty(value)){
	      return str.toLowerCase() === value;
	    }
	    return str.toLowerCase().indexOf( value ) !== -1;
	  },

	  'number': function(number, value, options){
	    if(options.exact){
	      return number.toString() === value;
	    }
	    return number.toString().indexOf( value ) !== -1;
	  },

	  'boolean': function(bool, value){
	    return bool.toString() === value;
	  },

	  'array': function(array, value){
	    var self = this;
	    return _.some(array, function(elem){
	      var type = toType(elem);
	      return self[type](elem, value, {exact: true});
	    });
	  },

	  'undefined': function(){
	    // console.log(arguments);
	  }
	};

	module.exports = function(haystack, needle, options){
	  var opts = _.defaults({json: haystack}, options, defaults);
	  var type = toType(haystack);
	  if(match[type]){
	    return match[type](haystack, needle, opts);
	  }
	};

/***/ },
/* 10 */
/***/ function(module, exports, __webpack_require__) {

	var bb = __webpack_require__(1);

	/* jshint -W074 */
	module.exports = function(method, entity, options) {
	  options = options || {};
	  var isModel = entity instanceof bb.Model,
	    data = options.attrsArray,
	    db = entity.db,
	    key;

	  if(isModel){
	    db = entity.collection.db;
	    key = options.index ? entity.get(options.index) : entity.id;
	    data = entity.toJSON();
	  }

	  // trigger request
	  entity.trigger('request', entity, db, options);

	  return db.open()
	    .then(function () {
	      switch (method) {
	        case 'create':
	        case 'update':
	        case 'patch':
	          return db.update(data, options);
	        case 'read':
	          return db.read(key, options);
	        case 'delete':
	          return db.delete(key, options);
	      }
	    })
	    .then(function (resp) {
	      if (options.success) { options.success(resp); }
	      return resp;
	    });

	  /**
	   * Catch handled by sync config
	   */
	  // .catch(function (resp) {
	  //   if (options.error) { options.error(resp); }
	  // });

	};
	/* jshint +W074 */

/***/ },
/* 11 */
/***/ function(module, exports, __webpack_require__) {

	var _ = __webpack_require__(3);

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

	      if (options.patch && !options.attrs) {
	        options.attrs = this.prepareRemoteJSON(attrs);
	      }

	      return model.syncLocal(method, model, options)
	        .then(function(){
	          return model.syncRemote(method, model, options);
	        })
	        .then(function(resp){
	          resp = model.parse(resp, options);
	          resp._state = undefined;
	          _.extend(options, { success: success });
	          return model.saveLocal(resp, options);
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

	    toJSON: function (options) {
	      options = options || {};
	      var json = IDBModel.prototype.toJSON.apply(this, arguments);
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
	      return IDBModel.prototype.parse.call(this, resp, options);
	    }

	  });

	  return DualModel;

	};

/***/ },
/* 12 */
/***/ function(module, exports, __webpack_require__) {

	var sync = __webpack_require__(10);

	module.exports = function (parent){

	  var IDBModel = parent.extend({
	    sync: sync
	  });

	  return IDBModel;

	};

/***/ }
/******/ ]);