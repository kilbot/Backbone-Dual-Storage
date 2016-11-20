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

	var Collection = bb.Collection.extend({
	  decorators :{
	    dual: __webpack_require__(4),
	    idb: __webpack_require__(7)
	  },
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
	  }
	});

	var Model = bb.Model.extend({
	  decorators :{
	    dual: __webpack_require__(11),
	    idb: __webpack_require__(12)
	  }
	});

	Collection.extend = Model.extend = extend;

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
	  var decorators = _.get(parent, ['prototype', 'decorators']);

	  if (!_.isEmpty(decorators) && protoProps && _.has(protoProps, 'extends')) {
	    extend = _.isString(protoProps.extends) ? [protoProps.extends] : protoProps.extends;
	  }

	  // russian doll decorators
	  if(extend && _.isArray(extend)){
	    _.each(extend, function(key){
	      if(!_.includes(parent._extended, key)){
	        parent = _.has(decorators, key) ? decorators[key](parent) : parent;
	        _.isArray(parent._extended) ? parent._extended.push(key) : parent._extended = [key];
	      }
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
	var sync = __webpack_require__(5);

	module.exports = function (parent){

	  /**
	   * ensure IDBCollection first
	   */
	  var decorators = _.get(parent, ['prototype', 'decorators']);
	  if(!_.includes(parent._extended, 'idb')){
	    parent = _.has(decorators, 'idb') ? decorators['idb'](parent) : parent;
	    _.isArray(parent._extended) ? parent._extended.push('idb') : parent._extended = ['idb'];
	  }

	  var DualCollection = parent.extend({
	    sync: sync,

	    keyPath: 'local_id',

	    indexes: [
	      {name: 'id', keyPath: 'id', unique: true},
	      {name: 'updated_at', keyPath: 'updated_at'},
	      {name: '_state', keyPath: '_state'}
	    ],

	    // delayed states
	    states: {
	      'update': 'UPDATE_FAILED',
	      'create': 'CREATE_FAILED',
	      'delete': 'DELETE_FAILED',
	      'read'  : 'READ_FAILED'
	    },

	    toJSON: function (options) {
	      options = options || {};
	      var json = parent.prototype.toJSON.apply(this, arguments);
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
	      return parent.prototype.parse.call(this, resp, options);
	    },

	    /* jshint -W071, -W074 */
	    fetch: function (options) {
	      options = _.extend({parse: true}, options);
	      var collection = this, success = options.success;
	      var _fetch = options.remote ? this.fetchRemote : this.fetchLocal;
	      options.success = undefined;

	      if(this.pageSize){
	        var limit = _.get(options, ['data', 'filter', 'limit']);
	        if(!limit) { _.set(options, 'data.filter.limit', this.pageSize); }
	      }

	      return _fetch.call(this, options)
	        .then(function (response) {
	          var method = options.reset ? 'reset' : 'set';
	          collection._parseFetchOptions(options);
	          collection[method](response, options);
	          if (success) {
	            success.call(options.context, collection, response, options);
	          }
	          collection.trigger('sync', collection, response, options);
	          return response;
	        });
	    },
	    /* jshint +W071, +W074 */

	    /**
	     *
	     */
	    fetchLocal: function (options) {
	      var collection = this, isNew = this.isNew();
	      _.extend(options, {set: false});

	      return this.sync('read', this, options)
	        .then(function (response) {
	          if(options.remote === false) { return response; }
	          if(isNew && _.size(response) === 0) { return collection.fetchRemote(options); }
	          return collection.fetchReadDelayed(response);
	        })
	        .then(function(response){
	          if(isNew && options.fullSync !== false) { collection.fullSync(); }
	          return response;
	        });
	    },

	    /**
	     * Get remote data and merge with local data on id
	     * returns merged data
	     */
	    fetchRemote: function (options) {
	      var collection = this;
	      _.extend(options, { remote: true, set: false });

	      return this.sync('read', this, options)
	        .then(function (response) {
	          response = collection.parse(response, options);
	          options.index = options.index || 'id';
	          _.extend(options, { remote: false });
	          return collection.save(response, options);
	        });
	    },

	    /**
	     *
	     */
	    fetchRemoteIds: function (last_update, options) {
	      options = options || {};
	      var self = this, url = _.result(this, 'url') + '/ids';

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
	              local._state = self.states.read;
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

	    fullSync: function(options){
	      return this.fetchRemoteIds(options);
	    },

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

	    getDelayed: function(state, collection){
	      var _state = this.states[state];
	      collection = collection || this;
	      return _.filter(collection, {_state: _state});
	    },

	    _parseFetchOptions: function(options){
	      if(options.idb){
	        this._total = options.idb.total;
	        this._delayed = options.idb.delayed;
	      }
	      if(options.xhr){
	        this._total = options.xhr.getResponseHeader('X-WC-Total');
	        this._delayed = 0;
	      }
	    }

	  });

	  return DualCollection;
	};

/***/ },
/* 5 */
/***/ function(module, exports, __webpack_require__) {

	var bb = __webpack_require__(1);
	var _ = __webpack_require__(3);
	var ajaxSync = bb.sync;
	var idbSync = __webpack_require__(6);

	module.exports = function(method, entity, options) {
	  var idb = _.get(entity, ['collection', 'db'], entity.db);
	  if(!options.remote && idb) {
	    return idbSync.apply(this, arguments);
	  }
	  return ajaxSync.apply(this, arguments);
	};

/***/ },
/* 6 */
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
	    })
	    .catch(function (resp) {
	      if (options.error) { options.error(resp); }
	    });

	};
	/* jshint +W074 */

/***/ },
/* 7 */
/***/ function(module, exports, __webpack_require__) {

	var bb = __webpack_require__(1);
	var _ = __webpack_require__(3);
	var IDBAdapter = __webpack_require__(8);
	var sync = __webpack_require__(6);

	module.exports = function (parent){

	  var IDBCollection = parent.extend({

	    constructor: function(){
	      parent.apply(this, arguments);
	      this.db = new IDBAdapter({ collection: this });
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

	      return this.sync('update', this, _.extend(options, {attrsArray: attrsArray}));
	    },

	    /**
	     *
	     */
	    destroy: function(models, options){
	      if(!options && models && !_.isArray(models)){
	        options = models;
	      } else {
	        options = options || {};
	      }

	      var collection = this,
	        wait = options.wait,
	        success = options.success;

	      options.attrsArray = _.map(models, function(model){
	        return model instanceof bb.Model ? model.toJSON() : model;
	      });

	      if(options.data){
	        wait = true;
	      }

	      options.success = function(resp) {
	        if(wait && _.isEmpty(options.attrsArray) ) {
	          collection.resetNew();
	          collection.reset();
	        }
	        if(wait && !_.isEmpty(options.attrsArray)) {
	          collection.remove(options.attrsArray);
	        }
	        if (success) { success.call(options.context, collection, resp, options); }
	        collection.trigger('sync', collection, resp, options);
	      };

	      if(!wait && _.isEmpty(options.attrsArray) ) {
	        collection.reset();
	      }

	      if(!wait && !_.isEmpty(options.attrsArray)) {
	        collection.remove(options.attrsArray);
	      }

	      return this.sync('delete', this, options);
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
	    }

	  });

	  return IDBCollection;

	};

/***/ },
/* 8 */
/***/ function(module, exports, __webpack_require__) {

	/* jshint -W071, -W074 */
	var _ = __webpack_require__(3);
	var matchMaker = __webpack_require__(9);

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
	  this.opts.storeName = this.parent.name || this.default.storeName;
	  this.opts.dbName = this.opts.storePrefix + this.opts.storeName;
	}

	IDBAdapter.prototype = {

	  default: {
	    storeName    : 'store',
	    storePrefix  : 'Prefix_',
	    dbVersion    : 1,
	    keyPath      : 'id',
	    autoIncrement: true,
	    indexes      : [],
	    matchMaker   : matchMaker,
	    onerror      : function (options) {
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
	          var store = event.currentTarget.result.createObjectStore(self.opts.storeName, self.opts);

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
	        return get.call(self, resp);
	      });
	  },

	  delete: function(key, options){
	    var remove = key ? this.remove : this.removeBatch;
	    return remove.call(this, key, options);
	  },

	  getTransaction: function (access) {
	    return this.db.transaction([this.opts.storeName], access);
	  },

	  getObjectStore: function (access) {
	    return this.getTransaction(access).objectStore(this.opts.storeName);
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
	    if (options.index) {
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
	    var batch = [];

	    _.each(dataArray, function (data) {
	      batch.push(this.put(data, options));
	    }.bind(this));

	    return Promise.all(batch);
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

	    return new Promise(function (resolve, reject) {
	      var records = [], delayed = 0;
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
	          }
	          return cursor.continue();
	        }
	        _.set(options, 'idb.total', records.length);
	        _.set(options, 'idb.delayed', delayed);
	        end = limit !== -1 ? start + limit : records.length;
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
	          return self.removeBatch(options.attrsArray);
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
	    var fields = _.get(options, ['data', 'filter', 'fields'], keyPath);
	    return this.opts.matchMaker.call(this, json, query, {fields: fields});
	  }

	};

	module.exports = IDBAdapter;
	/* jshint +W071, +W074 */

/***/ },
/* 9 */
/***/ function(module, exports, __webpack_require__) {

	var _ = __webpack_require__(3);
	var match = __webpack_require__(10);

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
/* 10 */
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
/* 11 */
/***/ function(module, exports, __webpack_require__) {

	var _ = __webpack_require__(3);
	var sync = __webpack_require__(5);

	module.exports = function (parent){

	  /**
	   * ensure IDBCollection first
	   */
	  var decorators = _.get(parent, ['prototype', 'decorators']);
	  if(!_.includes(parent._extended, 'idb')){
	    parent = _.has(decorators, 'idb') ? decorators['idb'](parent) : parent;
	    _.isArray(parent._extended) ? parent._extended.push('idb') : parent._extended = ['idb'];
	  }

	  var DualModel = parent.extend({

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

/***/ },
/* 12 */
/***/ function(module, exports, __webpack_require__) {

	var sync = __webpack_require__(6);

	module.exports = function (parent){

	  var IDBModel = parent.extend({
	    sync: sync
	  });

	  return IDBModel;

	};

/***/ }
/******/ ]);