var bb = require('backbone');

var createIDBModel = require('backbone-indexeddb/src/model');
var createIDBCollection = require('backbone-indexeddb/src/collection');

var createDualModel = require('./src/model');
var createDualCollection = require('./src/collection');

var IDBModel = createIDBModel(bb.Model);
var IDBCollection = createIDBCollection(bb.Collection);

bb.sync = require('./src/sync');
bb.DualModel = createDualModel(IDBModel);
bb.DualCollection = createDualCollection(IDBCollection);
bb.DualCollection.prototype.model = bb.DualModel;