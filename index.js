/**
 * extend Backbone Collection for app use
 */
var bb = require('backbone');
var extend = require('./extend');
var _ = require('lodash');

var collectionSubClasses = {
  dual: require('./src/collection'),
  idb: require('backbone-indexeddb/src/collection')
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
  dual: require('./src/model'),
  idb: require('backbone-indexeddb/src/model')
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