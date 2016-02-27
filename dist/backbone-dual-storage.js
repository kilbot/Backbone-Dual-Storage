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
	__webpack_require__(4);

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
	  var data = entity.toJSON();

	  return entity.db.open()
	    .then(function(){
	      switch(method){
	        case 'read':
	          if( isModel ){
	            return entity.db.get( entity.id, options );
	          }
	          return entity.db.getAll( options );
	        case 'create':
	          return entity.db.put( data, options );
	        case 'update':
	          return entity.db.put( data, options );
	        case 'delete':
	          if( isModel ){
	            return entity.db.delete( entity.id, options );
	          }
	          return;
	      }
	    })
	    .then(function(resp){
	      if(options.success){
	        options.success(resp);
	      }
	    })
	    .catch(function(resp){
	      if( options.error ){
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
	    {name: 'id', keyPath: 'id', unique: true}
	  ],

	  // delayed states
	  states: {
	    //'patch'  : 'UPDATE_FAILED',
	    'update' : 'UPDATE_FAILED',
	    'create' : 'CREATE_FAILED',
	    'delete' : 'DELETE_FAILED',
	    'read'   : 'READ_FAILED'
	  },

	  toJSON: function( options ){
	    options = options || {};
	    var json = IDBCollection.prototype.toJSON.apply( this, arguments );
	    if( options.remote && this.name ) {
	      var nested = {};
	      nested[this.name] = json;
	      return nested;
	    }
	    return json;
	  },

	  parse: function( resp, options ) {
	    if( options.remote ){
	      resp = resp && resp[this.name] ? resp[this.name] : resp;
	    }
	    return IDBCollection.prototype.parse.call( this, resp, options );
	  },

	  fetch: function( options ){
	    options = options || {};
	    if(options.remote){
	      return this.fetchRemote(options);
	    }
	    return IDBCollection.prototype.fetch.call(this, options);
	  },

	  fetchRemote: function( options ){
	    options = options || {};
	    var self = this;
	    var opts = _.extend({}, options, {
	      remove: false,
	      remote: true,
	      success: undefined
	    });

	    return this.sync('read', this, opts)
	      .then( function( response ){
	        response = self.parse( response, opts );
	        return self.putBatch( response, {
	          index: 'id'
	        });
	      })
	      .then(function(response){
	        self.set(response, {remove: false});
	        if( options.success ){
	          options.success.call( options.context, self, response, options );
	        }
	        return response;
	      });
	      //.then( function( response ){
	        //if( options.remove ){
	        //  var ids = _.map( response, 'id' );
	        //  return self.removeGarbage( ids, options );
	        //}
	      //});
	  },

	  //saveBatch: function( models, options ){
	  //  options = options || {};
	  //  if( options.remote ){
	  //    return this.saveRemoteBatch( models, options );
	  //  }
	  //  return this.saveLocalBatch( models, options );
	  //},
	  //
	  //saveLocalBatch: function( models, options ){
	  //  models = _.map( models, function( model ){
	  //    if( model instanceof bb.Model ){
	  //      model = model.toJSON();
	  //    }
	  //    if( ! model[ this.getRemoteIdAttribute() ] ){
	  //      model._state = this.states.create;
	  //    }
	  //    return model;
	  //  }.bind(this));
	  //  return IDBCollection.prototype.saveBatch.call( this, models, options );
	  //},
	  //
	  //saveRemoteBatch: function(){},
	  //
	  //parse: function( resp, options ){
	  //  options = options || {};
	  //  resp = resp && resp[this.name] ? resp[this.name] : resp;
	  //  if( options.remote ){
	  //    resp = _.map( resp, function( attrs ){
	  //      return this.mergeModels( attrs, options );
	  //    }.bind(this));
	  //  }
	  //  return IDBCollection.prototype.parse.call( this, resp, options );
	  //},
	  //
	  ///* jshint -W074 */
	  //mergeModels: function( attrs, options ){
	  //  var model = this.findByRemoteId( attrs );
	  //
	  //  if( options.remoteIds ){
	  //    if( ! model || attrs.last_updated > model.get('last_updated') ){
	  //      attrs._state = this.states.read;
	  //    }
	  //  }
	  //
	  //  if( model && model.id ){
	  //    //attrs = _.extend( model.toJSON(), attrs );
	  //    attrs = _.extend( model.attributes, attrs );
	  //  }
	  //
	  //  return attrs;
	  //},
	  ///* jshint +W074 */
	  //
	  fetchRemoteIds: function( last_update, options ){
	    options = options || {};
	    var self = this, url = _.result(this, 'url') + '/ids';

	    var opts = _.defaults(options, {
	      url: url,
	      remote: true,
	      data: {
	        fields: ['id', 'updated_at'],
	        filter: {
	          limit: -1,
	          updated_at_min: last_update
	        }
	      }
	    });

	    opts.success = undefined;

	    return this.sync('read', this, opts)
	      .then( function( response ) {
	        response = self.parse(response, opts);
	        return self.putBatch(response, {
	          index: {
	            keyPath: 'id',
	            merge: function( model, id ){
	              var data = _.merge( model, id );
	              if( _.isUndefined( data.local_id ) ){
	                data._state = self.states.read;
	              }
	              return data;
	            }
	          }
	        });
	      })
	      .then(function( response ){
	        return response;
	      });
	  }
	  //
	  //fetchUpdatedIds: function( options ){
	  //  var last_update = _.compact( this.pluck('updated_at') ).sort().pop();
	  //  return this.fetchRemoteIds( last_update, options );
	  //},
	  //
	  //removeGarbage: function( remoteIds, options ){
	  //  var self = this, models,
	  //    remoteIdAttribute = this.getRemoteIdAttribute();
	  //
	  //  remoteIds = _.isArray( remoteIds ) ? remoteIds : [remoteIds];
	  //  this.fetch()
	  //    .then( function() {
	  //      models = self.filter( function( model ) {
	  //        return model.get(remoteIdAttribute) &&
	  //          ! _.includes( remoteIds, model.get(remoteIdAttribute) );
	  //      });
	  //      return self.removeBatch( models, options );
	  //    });
	  //},
	  //
	  //removeBatch: function(){
	  //  return IDBCollection.prototype.removeBatch.apply( this, arguments );
	  //},
	  //
	  //getIdAttribute: function(){
	  //  return 'local_id';
	  //},
	  //
	  //getRemoteIdAttribute: function(){
	  //  return 'id';
	  //},
	  //
	  //findByRemoteId: function( attrs ){
	  //  var attr = {};
	  //  var remoteIdAttribute = this.getRemoteIdAttribute();
	  //  attr[remoteIdAttribute] = attrs[remoteIdAttribute];
	  //  return this.findWhere(attr);
	  //}

	});

/***/ },
/* 5 */
/***/ function(module, exports, __webpack_require__) {

	var bb = __webpack_require__(1);
	var IDBAdapter = __webpack_require__(6);
	var IDBModel = __webpack_require__(8);
	var _ = __webpack_require__(7);

	// attach to Backbone
	module.exports = bb.IDBCollection = bb.Collection.extend({

	  model: IDBModel,

	  pageSize: 10,

	  constructor: function(){
	    var opts = {
	      storeName     : this.name,
	      storePrefix   : this.storePrefix,
	      dbVersion     : this.dbVersion,
	      keyPath       : this.keyPath,
	      autoIncrement : this.autoIncrement,
	      indexes       : this.indexes
	    };

	    this.db = new IDBAdapter(opts);

	    bb.Collection.apply( this, arguments );
	  },

	  /**
	   * Clears the IDB storage and resets the collection
	   */
	  clear: function(){
	    var self = this;
	    return this.db.open()
	      .then(function(){
	        self.reset();
	        return self.db.clear();
	      });
	  },

	  /**
	   *
	   */
	  count: function(){
	    var self = this;
	    return this.db.open()
	      .then(function(){
	        return self.db.count();
	      });
	  },

	  /**
	   *
	   */
	  putBatch: function( models, options ){
	    options = options || {};
	    var self = this;
	    if( _.isEmpty( models ) ){
	      models = this.getChangedModels();
	    }
	    if( ! models ){
	      return;
	    }
	    return this.db.open()
	      .then( function() {
	        return self.db.putBatch( models, options );
	      });
	  },

	  /**
	   *
	   */
	  getChangedModels: function(){
	    return this.filter(function( model ){
	      return model.isNew() || model.hasChanged();
	    });
	  },

	  /**
	   *
	   */
	  removeBatch: function( models, options ){
	    options = options || {};
	    var self = this;
	    if( _.isEmpty( models ) ){
	      return;
	    }
	    return this.db.open()
	      .then( function() {
	        return self.db.removeBatch( models );
	      })
	      .then( function(){
	        self.remove( models );
	        if( options.success ){
	          options.success( self, models, options );
	        }
	        return models;
	      });
	  }

	});

/***/ },
/* 6 */
/***/ function(module, exports, __webpack_require__) {

	var _ = __webpack_require__(7);

	var indexedDB = window.indexedDB;
	var Promise = window.Promise;

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
	  indexes       : []
	};

	function IDBAdapter( options ){
	  this.opts = _.defaults( options, defaults );
	  this.opts.dbName = this.opts.storePrefix + this.opts.storeName;
	}

	IDBAdapter.prototype = {

	  constructor: IDBAdapter,

	  open: function(){
	    if( ! this._open ){
	      var self = this;

	      this._open = new Promise(function (resolve, reject) {
	        var request = indexedDB.open(self.opts.dbName);

	        request.onsuccess = function (event) {
	          self.db = event.target.result;
	          resolve(self.db);
	        };

	        request.onerror = function (event) {
	          var err = new Error('open indexedDB error');
	          err.code = event.target.errorCode;
	          reject(err);
	        };

	        request.onupgradeneeded = function (event) {
	          var store = event.currentTarget.result
	            .createObjectStore(self.opts.storeName, self.opts);

	          self.opts.indexes.forEach(function (index) {
	            var unique = !!index.unique;
	            store.createIndex(index.name, index.keyPath, {
	              unique: unique
	            });
	          });
	        };
	      });
	    }

	    return this._open;
	  },

	  close: function(){
	    this.db.close();
	    this.db = undefined;
	    this._open = undefined;
	  },

	  getTransaction: function( access ){
	    return this.db.transaction([this.opts.storeName], access);
	    // transaction.oncomplete
	    // transaction.onabort
	    // transaction.onerror
	  },

	  getObjectStore: function( access ){
	    return this.getTransaction(access).objectStore(this.opts.storeName);
	  },

	  count: function(){
	    var objectStore = this.getObjectStore( consts.READ_ONLY );

	    return new Promise(function (resolve, reject) {
	      var request = objectStore.count();

	      request.onsuccess = function (event) {
	        resolve( event.target.result );
	      };

	      request.onerror = function (event) {
	        var err = new Error('count error');
	        err.code = event.target.errorCode;
	        reject(err);
	      };
	    });
	  },

	  put: function( data, options ){
	    options = options || {};
	    var self = this, objectStore;

	    // merge on index keyPath
	    if( options.index ){
	      return this.merge( data, options );
	    }

	    // continue an open transaction
	    if( options.objectStore ){
	      objectStore = options.objectStore;
	    } else {
	      objectStore = this.getObjectStore( consts.READ_WRITE );
	    }

	    return new Promise(function (resolve, reject) {
	      var request = objectStore.put( data );

	      request.onsuccess = function (event) {
	        self.get( event.target.result, {
	          objectStore: objectStore
	        })
	        .then( resolve )
	        .catch( reject );
	      };

	      request.onerror = function (event) {
	        var err = new Error('put error');
	        err.code = event.target.errorCode;
	        reject(err);
	      };
	    });
	  },

	  get: function( key, options ){
	    options = options || {};
	    var objectStore;

	    // continue an open transaction
	    if( options.objectStore ){
	      objectStore = options.objectStore;
	    } else {
	      objectStore = this.getObjectStore( consts.READ_ONLY );
	    }

	    return new Promise(function (resolve, reject) {
	      var request = objectStore.get( key );

	      request.onsuccess = function (event) {
	        resolve( event.target.result );
	      };

	      request.onerror = function (event) {
	        var err = new Error('get error');
	        err.code = event.target.errorCode;
	        reject(err);
	      };
	    });
	  },

	  delete: function( key, options ){
	    options = options || {};
	    var objectStore = this.getObjectStore( consts.READ_WRITE );

	    return new Promise(function (resolve, reject) {
	      var request = objectStore.delete( key );

	      request.onsuccess = function (event) {
	        resolve( event.target.result ); // undefined
	      };

	      request.onerror = function (event) {
	        var err = new Error('delete error');
	        err.code = event.target.errorCode;
	        reject(err);
	      };
	    });
	  },

	  putBatch: function( dataArray, options ){
	    options = options || {};
	    options.objectStore = this.getObjectStore( consts.READ_WRITE );
	    var batch = [];

	    _.each( dataArray, function(data){
	      batch.push( this.put(data, options) );
	    }.bind(this));

	    return Promise.all(batch);
	  },

	  merge: function( data, options ){
	    options = options || {};
	    var self = this, objectStore = this.getObjectStore( consts.READ_WRITE );
	    var keyPath = _.isString( options.index ) ? options.index :
	      _.get( options, ['index', 'keyPath'], this.opts.keyPath );
	    var key = data[keyPath];

	    return new Promise(function (resolve, reject) {
	      var objectStoreIndex = objectStore.index( keyPath );
	      var request = objectStoreIndex.get( key );

	      request.onsuccess = function (event) {
	        var fn = _.isFunction( options.index.merge ) ? options.index.merge : _.merge ;
	        self.put( fn( event.target.result, data ), { objectStore: objectStore } )
	          .then( resolve );
	      };

	      request.onerror = function (event) {
	        var err = new Error('merge error');
	        err.code = event.target.errorCode;
	        reject(err);
	      };
	    });
	  },

	  getAll: function( options ){
	    options = options || {};
	    var limit = options.limit || 10;
	    var objectStore = this.getObjectStore( consts.READ_ONLY );

	    // getAll fallback
	    if( objectStore.getAll === undefined ){
	      return this._getAll( options );
	    }

	    return new Promise(function (resolve, reject) {
	      var request = objectStore.getAll(null, limit);

	      request.onsuccess = function (event) {
	        resolve( event.target.result );
	      };

	      request.onerror = function (event) {
	        var err = new Error('getAll error');
	        err.code = event.target.errorCode;
	        reject(err);
	      };
	    });
	  },

	  _getAll: function( options ){
	    options = options || {};
	    var limit = options.limit || 10;
	    var objectStore = this.getObjectStore( consts.READ_ONLY );

	    return new Promise(function (resolve, reject) {
	      var request = objectStore.openCursor();
	      var records = [];

	      request.onsuccess = function (event) {
	        var cursor = event.target.result;
	        if( cursor && records.length < limit ){
	          records.push( cursor.value );
	          return cursor.continue();
	        }
	        resolve( records );
	      };

	      request.onerror = function (event) {
	        var err = new Error('getAll error');
	        err.code = event.target.errorCode;
	        reject(err);
	      };
	    });
	  },

	  clear: function(){
	    var objectStore = this.getObjectStore( consts.READ_WRITE );

	    return new Promise(function (resolve, reject) {
	      var request = objectStore.clear();

	      request.onsuccess = function (event) {
	        resolve( event.target.result );
	      };

	      request.onerror = function (event) {
	        var err = new Error('clear error');
	        err.code = event.target.errorCode;
	        reject(err);
	      };
	    });
	  }

	};

	module.exports = IDBAdapter;

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
	      var nested = {};
	      nested[this.name] = json;
	      return nested;
	    }
	    return json;
	  },

	  parse: function( resp, options ) {
	    if( options.remote ){
	      resp = resp && resp[this.name] ? resp[this.name] : resp;
	      resp._state = undefined;
	    }
	    return IDBModel.prototype.parse.call( this, resp, options );
	  }

	});

/***/ }
/******/ ]);