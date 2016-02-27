var bb = require('backbone');
var IDBCollection = require('../backbone-indexeddb/src/idb-collection');
var DualModel = require('./dual-model');
var _ = require('lodash');

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