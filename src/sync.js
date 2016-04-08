var bb = require('backbone');
var _ = require('lodash');
var ajaxSync = bb.sync;
var idbSync = require('backbone-indexeddb/src/sync');

module.exports = function(method, entity, options) {
  var idb = _.get(entity, ['collection', 'db'], entity.db);
  if(!options.remote && idb) {
    return idbSync.apply(this, arguments);
  }
  return ajaxSync.apply(this, arguments);
};