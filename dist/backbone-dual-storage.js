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

	  return entity.db.open()
	    .then(function(){
	      switch(method){
	        case 'read':
	          if( isModel ){
	            return entity.db.get(entity);
	          }
	          return entity.db.getAll();
	        case 'create':
	          return entity.db.update(entity);
	        case 'update':
	          return entity.db.update(entity);
	        case 'delete':
	          if( isModel ){
	            return entity.db.destroy(entity);
	          }
	      }
	    })
	    .done(function(resp){
	      if(options.success){
	        options.success(resp);
	      }
	    })
	    .fail(function(resp){
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
	var DualModel = __webpack_require__(11);
	var _ = __webpack_require__(9);

	module.exports = bb.DualCollection = IDBCollection.extend({

	  model: DualModel,

	  keyPath: 'local_id',

	  indexes       : [
	    {name: 'local_id', keyPath: 'local_id', unique: true},
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
	        if( ! options.remove ){
	          opts.success = options.success;
	        }
	        return self.saveLocalBatch( response, opts );
	      })
	      .then( function( response ){
	        if( options.remove ){
	          var ids = _.map( response, 'id' );
	          return self.removeGarbage( ids, options );
	        }
	      });
	  },

	  saveBatch: function( models, options ){
	    options = options || {};
	    if( options.remote ){
	      return this.saveRemoteBatch( models, options );
	    }
	    return this.saveLocalBatch( models, options );
	  },

	  saveLocalBatch: function( models, options ){
	    models = _.map( models, function( model ){
	      if( model instanceof bb.Model ){
	        model = model.toJSON();
	      }
	      if( ! model[ this.getRemoteIdAttribute() ] ){
	        model._state = this.states.create;
	      }
	      return model;
	    }.bind(this));
	    return IDBCollection.prototype.saveBatch.call( this, models, options );
	  },

	  saveRemoteBatch: function(){},

	  parse: function( resp, options ){
	    options = options || {};
	    resp = resp && resp[this.name] ? resp[this.name] : resp;
	    if( options.remote ){
	      resp = _.map( resp, function( attrs ){
	        return this.mergeModels( attrs, options );
	      }.bind(this));
	    }
	    return IDBCollection.prototype.parse.call( this, resp, options );
	  },

	  /* jshint -W074 */
	  mergeModels: function( attrs, options ){
	    var model = this.findByRemoteId( attrs );

	    if( options.remoteIds ){
	      if( ! model || attrs.last_updated > model.get('last_updated') ){
	        attrs._state = this.states.read;
	      }
	    }

	    if( model && model.id ){
	      //attrs = _.extend( model.toJSON(), attrs );
	      attrs = _.extend( model.attributes, attrs );
	    }

	    return attrs;
	  },
	  /* jshint +W074 */

	  fetchRemoteIds: function( last_update, options ){
	    var url = _.result(this, 'url') + '/ids';

	    options = _.defaults(options, {
	      url: url,
	      remote: true,
	      remoteIds: true,
	      data: {
	        fields: ['id', 'updated_at'],
	        filter: {
	          limit: -1,
	          updated_at_min: last_update
	        }
	      }
	    });

	    return this.fetchRemote(options);
	  },

	  fetchUpdatedIds: function( options ){
	    var last_update = _.compact( this.pluck('updated_at') ).sort().pop();
	    return this.fetchRemoteIds( last_update, options );
	  },

	  removeGarbage: function( remoteIds, options ){
	    var self = this, models,
	      remoteIdAttribute = this.getRemoteIdAttribute();

	    remoteIds = _.isArray( remoteIds ) ? remoteIds : [remoteIds];
	    this.fetch()
	      .then( function() {
	        models = self.filter( function( model ) {
	          return model.get(remoteIdAttribute) &&
	            ! _.includes( remoteIds, model.get(remoteIdAttribute) );
	        });
	        return self.removeBatch( models, options );
	      });
	  },

	  removeBatch: function(){
	    return IDBCollection.prototype.removeBatch.apply( this, arguments );
	  },

	  getIdAttribute: function(){
	    return 'local_id';
	  },

	  getRemoteIdAttribute: function(){
	    return 'id';
	  },

	  findByRemoteId: function( attrs ){
	    var attr = {};
	    var remoteIdAttribute = this.getRemoteIdAttribute();
	    attr[remoteIdAttribute] = attrs[remoteIdAttribute];
	    return this.findWhere(attr);
	  }

	});

/***/ },
/* 5 */
/***/ function(module, exports, __webpack_require__) {

	var bb = __webpack_require__(1);
	var IndexedDB = __webpack_require__(6);
	var IDBModel = __webpack_require__(10);
	var _ = __webpack_require__(9);

	// attach to Backbone
	module.exports = bb.IDBCollection = bb.Collection.extend({

	  model: IDBModel,

	  constructor: function(){
	    var opts = {
	      storeName     : this.name,
	      storePrefix   : this.storePrefix,
	      dbVersion     : this.dbVersion,
	      keyPath       : this.keyPath,
	      autoIncrement : this.autoIncrement,
	      indexes       : this.indexes
	    };

	    this.db = new IndexedDB(opts);
	    this.db.open();

	    bb.Collection.apply( this, arguments );
	  },

	  /**
	   * Clears the IDB storage and resets the collection
	   */
	  clear: function(){
	    var self = this;
	    return this.db.open()
	      .then(function(){
	        return self.db.clear();
	      })
	      .done(function(){
	        self.reset();
	      });
	  },

	  saveBatch: function( models, options ){
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
	        return self.db.putBatch( models );
	      })
	      .then( function(){
	        self.set(models, options);
	        if( options.success ){
	          options.success( self, models, options );
	        }
	        return models;
	      });
	  },

	  getChangedModels: function(){
	    return this.filter(function( model ){
	      return model.isNew() || model.hasChanged();
	    });
	  },

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

	/**
	 * Backbone adapter for idb-wrapper api
	 */
	var IDBStore = __webpack_require__(7);
	var $ = __webpack_require__(8);
	var _ = __webpack_require__(9);
	var bb = __webpack_require__(1);

	function IndexedDB(options) {
	  options = options || {};
	  this.options = options;
	}

	var methods = {

	  /**
	   *
	   */
	  open: function () {
	    if( ! this._open ){
	      var options = this.options || {};
	      this._open = new $.Deferred();

	      options.onStoreReady = this._open.resolve;
	      options.onError = this._open.reject;

	      this.store = new IDBStore(options);
	    }

	    return this._open;
	  },

	  /**
	   * Wrapper for put, return full data
	   */
	  update: function(model) {
	    var self = this, data = this._returnAttributes(model);

	    return this.put(data)
	      .then(function(key){
	        return self.get(key);
	      });
	  },

	  /**
	   * Wrapper for remove, return full data
	   */
	  destroy: function(model) {
	    var data = this._returnAttributes(model);
	    var key = this._returnKey( data );

	    return this.remove(key)
	      .then(function(){
	        return data;
	      });
	  },

	  /**
	   *
	   */
	  put: function (data) {
	    var deferred = new $.Deferred();
	    this.store.put(data, deferred.resolve, deferred.reject);
	    return deferred.promise();
	  },

	  /**
	   *
	   */
	  get: function (key) {
	    key = this._returnKey(key);
	    var deferred = new $.Deferred();
	    try {
	      this.store.get(key, deferred.resolve, deferred.reject);
	    } catch(error) {
	      deferred.reject(error);
	    }
	    return deferred.promise();
	  },

	  /**
	   *
	   */
	  remove: function(key){
	    var deferred = new $.Deferred();
	    this.store.remove(key, deferred.resolve, deferred.reject);
	    return deferred.promise();
	  },

	  /**
	   *
	   */
	  getAll: function(){
	    var deferred = new $.Deferred();
	    this.store.getAll(deferred.resolve, deferred.reject);
	    return deferred.promise();
	  },

	  /**
	   * Iterates over the store using the given options and calling onItem
	   * for each entry matching the options.
	   */
	  iterate: function(options) {
	    options = options || {};
	    var deferred = new $.Deferred();
	    options.onEnd = deferred.resolve;
	    options.onError = deferred.reject;
	    var onItem = deferred.notify;
	    this.store.iterate(onItem, options);
	    return deferred.promise();
	  },

	  /**
	   * Creates a key range using specified options. This key range can be
	   * handed over to the count() and iterate() methods.
	   *
	   * Note: You must provide at least one or both of "lower" or "upper" value.
	   */
	  makeKeyRange: function(options) {
	    return this.store.makeKeyRange(options);
	  },

	  /**
	   * Perform a batch operation to save and/or remove models in the current
	   * collection to indexedDB. This is a proxy to the idbstore `batch` method
	   */
	  batch: function(dataArray) {
	    var deferred = new $.Deferred();
	    dataArray = this._returnArrayOfAttributes( dataArray );
	    this.store.batch(dataArray, deferred.resolve, deferred.reject);
	    return deferred.promise();
	  },

	  /**
	   * Perform a batch put operation to save models to indexedDB. This is a
	   * proxy to the idbstore `putBatch` method
	   */
	  putBatch: function(dataArray) {
	    if( !_.isArray(dataArray) ){
	      return this.put(dataArray);
	    }

	    var deferred = new $.Deferred();
	    dataArray = this._returnArrayOfAttributes( dataArray );
	    this.store.putBatch(dataArray, deferred.resolve, deferred.reject);
	    return deferred.promise();
	  },

	  /**
	   *
	   */
	  upsertBatch: function(dataArray, options){
	    if( !_.isArray(dataArray) ){
	      return this.put(dataArray);
	    }

	    var dfd = new $.Deferred();
	    dataArray = this._returnArrayOfAttributes( dataArray );
	    this.store.upsertBatch(dataArray, options, dfd.resolve, dfd.reject);
	    return dfd.promise();
	  },

	  /**
	   * Perform a batch operation to remove models from indexedDB. This is a
	   * proxy to the idbstore `removeBatch` method
	   */
	  removeBatch: function(keyArray) {
	    if( !_.isArray(keyArray) ){
	      return this.remove(keyArray);
	    }
	    var deferred = new $.Deferred();
	    keyArray = this._returnArrayOfKeys( keyArray );
	    this.store.removeBatch(keyArray, deferred.resolve, deferred.reject);
	    return deferred.promise();
	  },

	  /**
	   * Clears all content from the current indexedDB for this collection
	   */
	  clear: function() {
	    var deferred = new $.Deferred();
	    this.store.clear(deferred.resolve, deferred.reject);
	    return deferred.promise();
	  },

	  /**
	   *
	   */
	  query: function(index, keyRange){
	    var deferred = new $.Deferred();

	    this.store.query(deferred.resolve, {
	      index: index,
	      keyRange: keyRange,
	      onError: deferred.reject
	    });

	    return deferred.promise();
	  },

	  /**
	   * convert models to json
	   */
	  _returnAttributes: function(model){
	    if(model instanceof bb.Model){
	      return model.toJSON();
	    }
	    return model;
	  },

	  /**
	   * convert collections to json
	   */
	  _returnArrayOfAttributes: function(models){
	    return _.map( models, function( model ){
	      return this._returnAttributes(model);
	    }.bind(this));
	  },

	  /**
	   * convert model to keyPath id
	   */
	  _returnKey: function(key){
	    key = this._returnAttributes(key);
	    if( _.isObject(key) && _.has(key, this.store.keyPath) ) {
	      key = key[this.store.keyPath];
	    }
	    return key;
	  },

	  /**
	   * convert collection to keyPath ids
	   */
	  _returnArrayOfKeys: function(keys){
	    return _.map( keys, function( key ){
	      return this._returnKey(key);
	    }.bind(this));
	  }

	};

	_.extend(IndexedDB.prototype, methods);
	module.exports = IndexedDB;

/***/ },
/* 7 */
/***/ function(module, exports) {

	module.exports = IDBStore;

/***/ },
/* 8 */
/***/ function(module, exports) {

	module.exports = jQuery;

/***/ },
/* 9 */
/***/ function(module, exports) {

	module.exports = _;

/***/ },
/* 10 */
/***/ function(module, exports, __webpack_require__) {

	var bb = __webpack_require__(1);
	var _ = __webpack_require__(9);

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
/* 11 */
/***/ function(module, exports, __webpack_require__) {

	var bb = __webpack_require__(1);
	var IDBModel = __webpack_require__(10);
	var _ = __webpack_require__(9);

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
	      .then( function( resp ){
	        resp = options.parse ? model.parse(resp, options) : resp;
	        model.set( resp );
	        var remoteMethod = self.getRemoteMethod();
	        opts.remote = true;
	        return bb.sync.call( self, remoteMethod, model, opts );
	      })
	      .then( function( resp ){
	        resp = options.parse ? model.parse(resp, options) : resp;
	        resp = _.extend( {}, resp, { _state: undefined } );
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
	    resp = resp && resp[this.name] ? resp[this.name] : resp;
	    return IDBModel.prototype.parse.call( this, resp, options );
	  }

	});

/***/ }
/******/ ]);