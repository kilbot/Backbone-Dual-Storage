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

	var bb = __webpack_require__(1);
	bb.sync = __webpack_require__(2);
	module.exports = __webpack_require__(4);

/***/ },
/* 1 */
/***/ function(module, exports) {

	module.exports = Backbone;

/***/ },
/* 2 */
/***/ function(module, exports, __webpack_require__) {

	var bb = __webpack_require__(1);
	var ajaxSync = bb.sync;
	var idbSync = __webpack_require__(3);

	module.exports = function(method, entity, options) {
	  if( !options.remote && entity.db ) {
	    return idbSync.apply(this, arguments);
	  }
	  return ajaxSync.apply(this, arguments);
	};

/***/ },
/* 3 */
/***/ function(module, exports, __webpack_require__) {

	var bb = __webpack_require__(1);

	/* jshint -W074 */
	module.exports = function(method, entity, options) {
	  options = options || {};
	  var isModel = entity instanceof bb.Model;

	  return entity.db.open()
	    .then(function () {
	      switch (method) {
	        case 'read':
	          if (isModel) {
	            return entity.db.get(entity.id);
	          }
	          return entity.db.getBatch(options.data);
	        case 'create':
	          return entity.db.add(entity.toJSON())
	            .then(function (key) {
	              return entity.db.get(key);
	            });
	        case 'update':
	          return entity.db.put(entity.toJSON())
	            .then(function (key) {
	              return entity.db.get(key);
	            });
	        case 'delete':
	          if (isModel) {
	            return entity.db.delete(entity.id);
	          }
	          return;
	      }
	    })
	    .then(function (resp) {
	      if (options.success) {
	        options.success(resp);
	      }
	    })
	    .catch(function (resp) {
	      if (options.error) {
	        options.error(resp);
	      }
	    });

	};
	/* jshint +W074 */

/***/ },
/* 4 */
/***/ function(module, exports, __webpack_require__) {

	var bb = __webpack_require__(1);
	var IDBCollection = __webpack_require__(5);
	var DualModel = __webpack_require__(9);
	var _ = __webpack_require__(7);

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

/***/ },
/* 5 */
/***/ function(module, exports, __webpack_require__) {

	var bb = __webpack_require__(1);
	var IDBAdapter = __webpack_require__(6);
	var IDBModel = __webpack_require__(8);
	var _ = __webpack_require__(7);

	var Collection = bb.Collection.extend({
	  constructor: function() {
	    bb.Collection.apply(this, arguments);
	    this._isNew = true;
	    this.once('sync', function() {
	      this._isNew = false;
	    });
	  },

	  isNew: function() {
	    return this._isNew;
	  }
	});

	// attach to Backbone
	module.exports = bb.IDBCollection = Collection.extend({

	  model: IDBModel,

	  constructor: function () {
	    var opts = {
	      storeName    : this.name,
	      storePrefix  : this.storePrefix,
	      dbVersion    : this.dbVersion,
	      keyPath      : this.keyPath,
	      autoIncrement: this.autoIncrement,
	      indexes      : this.indexes,
	      pageSize     : this.pageSize
	    };

	    this.db = new IDBAdapter(opts);

	    bb.Collection.apply(this, arguments);
	  },

	  /**
	   * Clears the IDB storage and resets the collection
	   */
	  clear: function () {
	    var self = this;
	    return this.db.open()
	      .then(function () {
	        self.reset();
	        return self.db.clear();
	      });
	  },

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
	  putBatch: function (models, options) {
	    options = options || {};
	    var self = this;
	    if (_.isEmpty(models)) {
	      models = this.getChangedModels();
	    }
	    if (!models) {
	      return;
	    }
	    return this.db.open()
	      .then(function () {
	        return self.db.putBatch(models, options);
	      });
	  },

	  /**
	   *
	   */
	  getBatch: function (keyArray, options) {
	    var self = this;
	    return this.db.open()
	      .then(function () {
	        return self.db.getBatch(keyArray, options);
	      });
	  },

	  /**
	   *
	   */
	  findHighestIndex: function (keyPath, options) {
	    var self = this;
	    return this.db.open()
	      .then(function () {
	        return self.db.findHighestIndex(keyPath, options);
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
	   *
	   */
	  removeBatch: function (models, options) {
	    options = options || {};
	    var self = this;
	    if (_.isEmpty(models)) {
	      return;
	    }
	    return this.db.open()
	      .then(function () {
	        return self.db.removeBatch(models);
	      })
	      .then(function () {
	        self.remove(models);
	        if (options.success) {
	          options.success(self, models, options);
	        }
	        return models;
	      });
	  }

	});

/***/ },
/* 6 */
/***/ function(module, exports, __webpack_require__) {

	/* jshint -W071, -W074 */
	var _ = __webpack_require__(7);
	var is_safari = window.navigator.userAgent.indexOf('Safari') !== -1 &&
	  window.navigator.userAgent.indexOf('Chrome') === -1 &&
	  window.navigator.userAgent.indexOf('Android') === -1;

	var indexedDB = window.indexedDB;

	var consts = {
	  'READ_ONLY'         : 'readonly',
	  'READ_WRITE'        : 'readwrite',
	  'VERSION_CHANGE'    : 'versionchange',
	  'NEXT'              : 'next',
	  'NEXT_NO_DUPLICATE' : 'nextunique',
	  'PREV'              : 'prev',
	  'PREV_NO_DUPLICATE' : 'prevunique'
	};

	var defaults = {
	  storeName     : 'store',
	  storePrefix   : 'Prefix_',
	  dbVersion     : 1,
	  keyPath       : 'id',
	  autoIncrement : true,
	  indexes       : [],
	  pageSize      : 10,
	  onerror       : function(options) {
	    options = options || {};
	    var err = new Error(options._error.message);
	    err.code = event.target.errorCode;
	    options._error.callback(err);
	  }
	};

	function IDBAdapter( options ){
	  this.opts = _.defaults( options, defaults );
	  this.opts.dbName = this.opts.storePrefix + this.opts.storeName;
	}

	IDBAdapter.prototype = {

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
	              if(is_safari){
	                return self.findHighestIndex();
	              }
	            })
	            .then(function (key) {
	              if(is_safari){
	                self.highestKey = key || 0;
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

	    if(!data[keyPath]){
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

	  add: function(data, options){
	    options = options || {};
	    var objectStore = options.objectStore || this.getObjectStore(consts.READ_WRITE);
	    var self = this, keyPath = this.opts.keyPath;

	    if(is_safari){
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
	    var self = this, objectStore = options.objectStore || this.getObjectStore(consts.READ_ONLY);

	    return new Promise(function (resolve, reject) {
	      var request = objectStore.get(key);

	      request.onsuccess = function (event) {
	        resolve(event.target.result);
	      };

	      request.onerror = function (event) {
	        options._error = {event: event, message: 'get error', callback: reject};
	        self.opts.onerror(options);
	      };
	    });
	  },

	  delete: function (key, options) {
	    options = options || {};
	    var self = this, objectStore = options.objectStore || this.getObjectStore(consts.READ_WRITE);

	    return new Promise(function (resolve, reject) {
	      var request = objectStore.delete(key);

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
	    var fn = function(result, data){
	      return _.merge({}, result, data);
	    };

	    if(_.isObject(options.index)){
	      keyPath = _.get(options, ['index', 'keyPath'], this.opts.keyPath);
	      if(_.isFunction(options.index.merge)){
	        fn = options.index.merge;
	      }
	    }

	    return this.getByIndex(keyPath, data[keyPath], options)
	      .then(function(result){
	        return self.put(fn(result, data));
	      });
	  },

	  getByIndex: function(keyPath, key, options){
	    options = options || {};
	    var objectStore = options.objectStore || this.getObjectStore(consts.READ_ONLY),
	        openIndex = objectStore.index(keyPath),
	        request = openIndex.get(key),
	        self = this;

	    return new Promise(function (resolve, reject) {
	      request.onsuccess = function (event) {
	        resolve(event.target.result);
	      };

	      request.onerror = function (event) {
	        options._error = {event: event, message: 'get by index error', callback: reject};
	        self.opts.onerror(options);
	      };
	    });
	  },

	  getBatch: function (keyArray, options) {
	    if(_.isArray(keyArray)){
	      options = options || {};
	      options.filter = _.merge({in: keyArray}, options.filter);
	    } else {
	      options = keyArray || {};
	    }
	    var self = this, objectStore = options.objectStore || this.getObjectStore(consts.READ_ONLY);

	    if (objectStore.getAll === undefined || this.hasGetParams(options)) {
	      if(!options.objectStore){
	        options.objectStore = objectStore;
	      }
	      return this.getAll(options);
	    }

	    var limit = _.get(options, ['filter', 'limit'], this.opts.pageSize);
	    if (limit === -1) {
	      limit = null; // firefox doesn't like -1 or Infinity
	    }

	    return new Promise(function (resolve, reject) {
	      var request = objectStore.getAll(null, limit);

	      request.onsuccess = function (event) {
	        resolve(event.target.result);
	      };

	      request.onerror = function (event) {
	        options._error = {event: event, message: 'getAll error', callback: reject};
	        self.opts.onerror(options);
	      };
	    });
	  },

	  getAll: function (options) {
	    options = options || {};
	    var objectStore = options.objectStore || this.getObjectStore(consts.READ_ONLY),
	        limit = _.get(options, ['filter', 'limit'], this.opts.pageSize),
	        offset = _.get(options, ['filter', 'offset'], 0),
	        include = _.get(options, ['filter', 'in']),
	        keyPath = options.index || this.opts.keyPath,
	        page = options.page,
	        self = this;

	    if(_.isObject(keyPath)){
	      keyPath = keyPath.keyPath;
	    }

	    if (limit === -1) {
	      limit = Infinity;
	    }

	    if(page){
	      offset = (page - 1) * limit;
	    }

	    return new Promise(function (resolve, reject) {
	      var request;
	      if(keyPath === self.opts.keyPath){
	        request = objectStore.openCursor();
	      } else {
	        var openIndex = objectStore.index(keyPath);
	        request = openIndex.openCursor();
	      }
	      var records = [];
	      var idx = 0;

	      request.onsuccess = function (event) {
	        var cursor = event.target.result;
	        if (cursor && records.length < limit) {
	          if( (!include || include.indexOf(cursor.value[keyPath]) !== -1 ) && ++idx > offset){
	            records.push(cursor.value);
	          }
	          return cursor.continue();
	        }
	        resolve(records);
	      };

	      request.onerror = function (event) {
	        options._error = {event: event, message: 'getAll error', callback: reject};
	        self.opts.onerror(options);
	      };
	    });
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

	  findHighestIndex: function (keyPath, options) {
	    options = options || {};
	    var self = this, objectStore = options.objectStore || this.getObjectStore(consts.READ_ONLY);

	    return new Promise(function (resolve, reject) {
	      var request;
	      if(keyPath){
	        var openIndex = objectStore.index(keyPath);
	        request = openIndex.openCursor(null, consts.PREV);
	      } else {
	        request = objectStore.openCursor(null, consts.PREV);
	      }

	      request.onsuccess = function (event) {
	        var value = _.get(event, ['target', 'result', 'key']);
	        resolve(value);
	      };

	      request.onerror = function (event) {
	        options._error = {event: event, message: 'find highest key error', callback: reject};
	        self.opts.onerror(options);
	      };
	    });
	  },

	  /**
	   * data: {
	   *  filter: {
	   *    limit: -1,
	   *    offset: 10,
	   *    q: 'term'
	   *    ...
	   *  },
	   *  fields: ['id', '_state'],
	   *  page: 2
	   * }
	   */
	  hasGetParams: function(options){
	    options = options || {};
	    if(options.page || options.fields || _.size(options.filter) > 1 ||
	      (_.size(options.filter) === 1 && options.filter.limit === undefined)){
	      return true;
	    }
	    return false;
	  }

	};

	module.exports = IDBAdapter;
	/* jshint +W071, +W074 */

/***/ },
/* 7 */
/***/ function(module, exports) {

	module.exports = _;

/***/ },
/* 8 */
/***/ function(module, exports, __webpack_require__) {

	var bb = __webpack_require__(1);
	var _ = __webpack_require__(7);

	// attach to Backbone
	module.exports = bb.IDBModel = bb.Model.extend({

	  // idAttribute: this.collection.db.store.keyPath

	  constructor: function( attributes, options ){
	    this.db = _.get( options, ['collection', 'db'] );
	    if( !this.db ){
	      throw Error('Model must be in an IDBCollection');
	    }

	    bb.Model.apply( this, arguments );
	  }

	});

/***/ },
/* 9 */
/***/ function(module, exports, __webpack_require__) {

	var bb = __webpack_require__(1);
	var IDBModel = __webpack_require__(8);
	var _ = __webpack_require__(7);

	module.exports = bb.DualModel = IDBModel.extend({

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

	  sync: function( method, model, options ){
	    options = options || {};
	    this.setLocalState( method );
	    if( options.remote ){
	      return this.remoteSync( method, model, options );
	    }
	    return bb.sync.call( this, method, model, options );
	  },

	  remoteSync: function( method, model, options ){
	    var self = this, opts = _.extend({}, options, {
	      remote: false,
	      success: false
	    });
	    return bb.sync.call( this, method, model, opts )
	      .then( function(){
	        var remoteMethod = self.getRemoteMethod();
	        opts.remote = true;
	        return bb.sync.call( self, remoteMethod, model, opts );
	      })
	      .then( function( resp ){
	        resp = options.parse ? model.parse(resp, options) : resp;
	        model.set( resp );
	        opts.remote = false;
	        opts.success = options.success;
	        return bb.sync.call( self, 'update', model, opts );
	      });
	  },

	  setLocalState: function( method ){
	    method = method === 'patch' ? 'update' : method;
	    if( method === 'update' && !this.hasRemoteId() ){
	      method = 'create';
	    }
	    if( method === 'create' && this.hasRemoteId() ){
	      method = 'update';
	    }
	    this.set({ _state: this.collection.states[method] });
	  },

	  getRemoteMethod: function(){
	    return _.invert( this.collection.states )[ this.get('_state') ];
	  },

	  hasRemoteId: function() {
	    return !!this.get( this.remoteIdAttribute );
	  },

	  toJSON: function( options ){
	    options = options || {};
	    var json = IDBModel.prototype.toJSON.apply( this, arguments );
	    if( options.remote && this.name ) {
	      json = this.prepareRemoteJSON(json);
	    }
	    return json;
	  },

	  prepareRemoteJSON: function(json){
	    json._state = undefined;
	    var nested = {};
	    nested[this.name] = json;
	    return nested;
	  },

	  parse: function( resp, options ) {
	    options = options || {};
	    if( options.remote ){
	      resp = resp && resp[this.name] ? resp[this.name] : resp;
	      resp._state = undefined;
	    }
	    return IDBModel.prototype.parse.call( this, resp, options );
	  }

	});

/***/ }
/******/ ]);