/**
 * extend Backbone Collection for app use
 */
var bb = require('backbone');
var extend = require('./extend');

var Collection = bb.Collection.extend({
  decorators :{
    dual: require('./src/collection'),
    idb: require('backbone-indexeddb/src/collection')
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
    dual: require('./src/model'),
    idb: require('backbone-indexeddb/src/model')
  }
});

Collection.extend = Model.extend = extend;

module.exports = {
  Collection  : Collection,
  Model       : Model
};