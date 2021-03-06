describe('Dual Collections', function () {

  var DualModel = app.Model.extend({
    extends: ['dual'],
    special: true
  });

  var DualCollection = app.Collection.extend({
    extends: ['dual', 'idb'],
    model: DualModel
  });

  beforeEach(function () {
    this.server = sinon.fakeServer.create();
    this.server.autoRespond = true;
    this.server.autoRespondAfter = 400;
  });

  it('should be in a valid state', function () {
    var collection = new DualCollection();
    expect(collection).to.be.ok;

    // check model
    var model = collection.add({});
    expect(model.special).to.be.true;
  });

  it('should create to local IndexedDB', function (done) {
    var collection = new DualCollection();

    collection.create({foo: 'bar'}, {
      wait   : true,
      special: true,
      error  : done,
      success: function (model, response, options) {
        expect(model.isNew()).to.be.false;
        expect(model.id).to.equal(response.local_id);
        expect(model.get('_state')).to.equal(collection.states.create);
        expect(response.foo).to.equal('bar');
        expect(options.special).to.be.true;
        done();
      }
    });

  });

  it('should update to local IndexedDB', function (done) {
    var collection = new DualCollection();

    collection.create({foo: 'bar'}, {
      //wait: true,
      success: function (model, response, options) {
        model.save({foo: 'baz'}, {
          special: true,
          error  : done,
          success: function (model, response, options) {
            expect(model.get('_state')).to.equal(collection.states.create);
            expect(model.get('foo')).to.equal('baz');
            expect(response.foo).to.equal('baz');
            expect(options.special).to.be.true;
            done();
          }
        });
      }
    });

  });

  it('should create to local and remote with \'remote: true\' option', function (done) {

    // mock server response
    var response = JSON.stringify({id: 1, foo: 'bar'});
    this.server.respondWith('POST', '/test', [200, {"Content-Type": "application/json"},
      response
    ]);

    var collection = new DualCollection();
    collection.url = '/test';

    collection.create({foo: 'bar'}, {
      wait   : true,
      remote : true,
      special: true,
      error  : done,
      success: function (model, response, options) {
        expect(collection).to.have.length(1);
        expect(model.isNew()).to.be.false;
        expect(model.get('id')).to.equal(1);
        expect(model.get('_state')).to.be.undefined;
        expect(response).eqls(model.attributes);
        expect(options.special).to.be.true;

        collection.db.count(function (count) {
          expect(count).equals(1);
        })
          .then(function () {
            return collection.db.get(model.id);
          })
          .then(function (response) {
            expect(response).to.eql(model.attributes);
            done();
          });
      }
    });

  });

  it('should update to local and remote with \'remote: true\' option', function (done) {

    // mock server response
    var response = JSON.stringify({id: 2, foo: 'baz'});
    this.server.respondWith('PUT', '/test/2/', [200, {"Content-Type": "application/json"},
      response
    ]);

    var collection = new DualCollection();
    collection.url = '/test';

    collection.create({id: 2, foo: 'bar'}, {
      wait   : true,
      error  : done,
      success: function (model, response, options) {
        expect(model.isNew()).to.be.false;
        expect(model.get('_state')).to.equal(collection.states.update);

        model.save({foo: 'baz'}, {
          remote : true,
          wait   : true,
          special: true,
          error  : done,
          success: function (model, response, options) {
            expect(collection).to.have.length(1);
            expect(model.get('_state')).to.be.undefined;
            expect(model.get('foo')).to.equal('baz');
            expect(response).to.eql(model.attributes);
            expect(options.special).to.be.true;

            collection.db.count(function (count) {
              expect(count).equals(1);
            })
              .then(function () {
                return collection.db.get(model.id);
              })
              .then(function (response) {
                expect(response).to.eql(model.attributes);
                done();
              })
              .catch(done);
          }
        });
      }
    });

  });

  it('model should be compatible with nested APIs', function (done) {

    // mock server response
    var response = JSON.stringify({test: {id: 1, foo: 'bar'}});
    var server = this.server;
    server.respondWith('POST', '/test', [200, {"Content-Type": "application/json"},
      response
    ]);

    var collection = new DualCollection();
    collection.url = '/test';

    var model = collection.add({foo: 'bar'});
    model.name = 'test';
    model.save({}, {
      remote : true,
      special: true,
      error  : done,
      success: function (m, response, options) {
        expect(m).eqls(model);
        expect(m.get('id')).to.equal(1);

        //
        var request = server.requests[0];
        var postData = JSON.parse(request.requestBody);
        expect(postData).eqls({test: {foo: 'bar'}});

        // note: response is coming from idb not ajax
        // expect( response ).eqls( ajaxResponse );

        expect(options.special).to.be.true;
        done();
      }
    })
    .catch(done);

  });

  it('should fetch and merge a remote collection', function (done) {

    // mock server response
    var response = JSON.stringify({
      nested: [
        {id: 1, foo: 'bar'},
        {id: 3, foo: 'baz'},
        {id: 4, foo: 'boo'}
      ]
    });
    var server = this.server;
    server.respondWith('GET', '/test', [200, {"Content-Type": "application/json"},
      response
    ]);

    var collection = new DualCollection();
    collection.url = '/test';
    collection.name = 'nested';

    collection.save([
      {id: 1, foo: 'bar'},
      {id: 2, foo: 'baz'},
      {id: 3, foo: 'boo'}
    ])
      .then(function () {
        expect(collection).to.have.length(3);
        return collection.fetch({
          remote : true,
          remove : false,
          special: true,
          error  : done,
          success: function (collection, response, options) {
            expect(response).to.have.length(3);
            expect(collection).to.have.length(4);
            expect(collection.map('local_id')).to.not.be.empty;
            expect(collection.map('foo')).eqls(['bar', 'baz', 'baz', 'boo']);
            expect(options.special).to.be.true;
            done();
          }
        });
      })
      .catch(done);

  });

  it('should fetch all remote ids', function (done) {

    // mock server response
    var response = JSON.stringify({nested: [{id: 1}, {id: 2}, {id: 3}]});
    this.server.respondWith('GET', /^\/test\/ids\?.*$/, [200, {"Content-Type": "application/json"},
      response
    ]);

    var collection = new DualCollection();
    collection.url = '/test';
    collection.name = 'nested';

    collection.fetchRemoteIds()
      .then(function (response) {
        expect(response).to.have.length(3);
        expect(collection).to.have.length(0);

        var read = collection.states.read;
        _.each(response, function (model) {
          expect(model.local_id).not.to.be.undefined;
          expect(model._state).eqls(read);
        });

        done();
      })
      .catch(done);

  });

  it('should fetch and merge all remote ids', function (done) {

    // mock server response
    var response = JSON.stringify({nested: [{id: 1}, {id: 2}, {id: 3}]});
    this.server.respondWith('GET', /^\/test\/ids\?.*$/, [200, {"Content-Type": "application/json"},
      response
    ]);

    var collection = new DualCollection();
    collection.url = '/test';
    collection.name = 'nested';

    collection.save([
      {id: 1, foo: 'bar'},
      {id: 2}
    ])
      .then(function () {
        return collection.fetchRemoteIds();
      })
      .then(function (response) {
        expect(response).to.have.length(3);

        var read = collection.states.read;
        expect(_.map(response, '_state')).eqls([undefined, undefined, read]);

        var model = _.find(response, {id: 1});
        expect(model.foo).equals('bar');

        done();
      })
      .catch(done);

  });

  it('should fetch updated ids from the server', function (done) {

    // mock server response
    var response = JSON.stringify({
      nested: [
        {id: 2, updated_at: '2016-01-14T13:15:04Z'},
        {id: 4, updated_at: '2016-01-12T13:15:04Z'}
      ]
    });
    this.server.respondWith('GET', /^\/test\/ids\?.*$/, [200, {"Content-Type": "application/json"},
      response
    ]);

    var collection = new DualCollection();
    collection.url = '/test';
    collection.name = 'nested';

    collection.save([
      {id: 1, updated_at: '2016-01-04T13:15:04Z', foo: 'bar'},
      {id: 2, updated_at: '2016-01-11T13:15:04Z'},
      {id: 3, updated_at: '2015-01-04T13:15:04Z'}
    ])
      .then(function (response) {
        expect(response).to.have.length(3);
        return collection.fetchUpdatedIds();
      })
      .then(function (response) {
        expect(response).to.have.length(2);
        expect(collection).to.have.length(3);

        var read = collection.states.read;
        expect(_.map(response, '_state')).eqls([read, read]);

        done();
      })
      .catch(done);

  });

  it('should fetch read delayed models', function(done){

    // mock server response
    var response = JSON.stringify({
      nested: [
        {id: 2, foo: 'bam'},
        {id: 3, foo: 'bap'}
      ]
    });
    this.server.respondWith('GET', /^\/test\?.*$/, [200, {"Content-Type": "application/json"},
      response
    ]);

    // tools for checking the url query params
    var server = this.server;
    var parse = function(url){
      var parser = /([^=?&]+)=([^&]*)/g
        , result = {}
        , part;

      for (;
        part = parser.exec(url);
        result[decodeURIComponent(part[1])] = decodeURIComponent(part[2])
      );

      return result;
    };

    var collection = new DualCollection();
    collection.url = '/test';
    collection.name = 'nested';

    collection.save([
      {id: 1, foo: 'bar'},
      {id: 2, foo: 'baz', _state: 'READ_FAILED'},
      {id: 3, foo: 'boo', _state: 'READ_FAILED'}
    ], { set: false })
      .then(function (response) {
        expect(response).to.have.length(3);
        collection.fetch({
          special: true,
          success: function(collection, response, options){
            var query = parse( server.requests[0].url );
            expect(query['filter[in]']).eqls('2,3');

            expect(response).to.have.length(3);
            expect(collection).to.have.length(3);
            expect(collection.map('foo')).eqls(['bar', 'bam', 'bap']);
            expect(collection.map('_state')).eqls([undefined, undefined, undefined]);
            expect(options.special).to.be.true;

            done();
          }
        });
      })
      .catch(done);

  });

  it('should return the total number of records for local fetch', function(done){

    var collection = new DualCollection();

    collection.save([
      {id: 1, foo: 'bar'},
      {id: 2, foo: 'baz'},
      {id: 3, foo: 'boo'}
    ], { set: false })
      .then(function (response) {
        expect(response).to.have.length(3);
        collection.fetch({
          special: true,
          error: done,
          success: function(collection, response, options){
            expect(_.get(options, ['idb', 'total'])).eqls(3);
            done();
          }
        });
      })
      .catch(done);
  });

  it('should patch a model to the remote server', function(done){

    // mock server response
    var response = JSON.stringify({ nest: { id: 1, foo: 'baz', boo: 'bat' } });
    var server = this.server;
    server.respondWith('PUT', '/test/1/', [200, {"Content-Type": "application/json"},
      response
    ]);

    var Model = DualModel.extend({
      name: 'nest'
    });

    //
    var collection = new DualCollection();
    collection.url = '/test';
    collection.model = Model;

    collection.create({id: 1, foo: 'bar', boo: 'bat'}, {
      wait: true,
      error: done,
      success: function(model, response, options){
        model.save({ foo: 'baz' }, {
          remote: true,
          patch: true,
          special: true,
          error: done,
          success: function(model, response, options){
            var request = server.requests[0];
            var postData = JSON.parse(request.requestBody);
            expect(postData).eqls({ nest: {foo: 'baz'} });

            expect(model.get('foo')).eqls('baz');
            expect(model.get('_state')).to.be.undefined;
            expect(options.special).to.be.true;

            done();
          }
        })
          .catch(done);
      }
    });

  });

  it('should automatically do a full sync on first fetch', function(done){
    var server = this.server;

    // first server response
    server.respondWith('GET', '/test', [200, {"Content-Type": "application/json"},
      JSON.stringify([ {id: 1, foo: 'bar'}, {id: 2, foo: 'baz', updated_at: '2016-12-10' } ])
    ]);

    // mock server response
    server.respondWith( 'GET', /test\/ids\?.*$/, function(xhr){
      var response;
      var updated_at_min = _.get( Qs.parse(xhr.url) , ['filter', 'updated_at_min'] );
      if(_.isEmpty(updated_at_min)){
        response = JSON.stringify([ { id: 1 }, { id: 2 }, { id: 3 }, { id: 4 } ]);
      } else {
        response = JSON.stringify([]);
      }
      xhr.respond(200, {'Content-Type': 'application/json'}, response);
    });


    var collection = new DualCollection();
    collection.url = '/test';

    collection.fetch()
      .then(function(response){
        expect(response).to.have.length(2);
        expect(collection).to.have.length(2);

        // full id sync happens in background
        collection.on('sync:fullSync', function(){
          collection.db.count()
            .then(function(count){
              expect(count).equals(4);
              done();
            })
            .catch(done);
        });

      })
      .catch(done);

  });

  it('should disable full sync on first sync with { fullSync: false }', function(done){

    var server = this.server;

    var collection = new DualCollection();

    collection.fetch({ fullSync: false })
      .then(function(response){
        expect(response).to.have.length(0);
        expect(collection).to.have.length(0);
        expect(server.requests).to.have.length(0);
        done();
      })
      .catch(done);

  });

  it('should set the correct local state after fetch with filter[limit]', function(done){
    var collection = new DualCollection();

    var data = [
      {id: 1, foo: 'bar'},
      {id: 2, foo: 'baz'},
      {id: 3, _state: 'READ_FAILED'}
    ];

    collection.save(data, { set: false })
    .then(function (response) {
      expect(response).to.have.length(3);
      collection.fetch({
        data: {
          filter: {
            limit: 1
          }
        },
        special: true,
        error: done,
        success: function(collection, response, options){
          expect(collection.length).eqls(1);
          var idb = _.get(collection, ['state', 'totals', 'idb']);
          expect(idb.total).eqls(3);
          expect(idb.delayed).eqls(1);
          done();
        }
      });
    })
    .catch(done);
  });

  it('should set the correct local state after fetch with filter[q]', function(done){
    var collection = new DualCollection();

    var data = [
      {id: 1, foo: 'bar'},
      {id: 2, foo: 'baz'},
      {id: 3, _state: 'READ_FAILED'}
    ];

    collection.save(data, { set: false })
      .then(function (response) {
        expect(response).to.have.length(3);
        collection.fetch({
          data: {
            filter: {
              limit: 1,
              q: 'ba',
              qFields: 'foo'
            }
          },
          special: true,
          error: done,
          success: function(collection, response, options){
            expect(collection.length).eqls(1);
            var idb = _.get(collection, ['state', 'totals', 'idb']);
            expect(idb.total).eqls(2);
            expect(idb.delayed).eqls(1);
            done();
          }
        });
      })
      .catch(done);

  });

  //
  it('should remove garbage on fullSync', function( done ){

   // mock server response
   var response = JSON.stringify({ nested: [ { id: 1 }, { id: 4 } ] });
   this.server.respondWith( 'GET', /^\/test\/ids\?.*$/, [200, {"Content-Type": "application/json"},
     response
   ]);

    // mock server response
    this.server.respondWith( 'GET', /test\/ids\?.*$/, function(xhr){
      var response;
      var updated_at_min = _.get( Qs.parse(xhr.url) , ['filter', 'updated_at_min'] );
      if(_.isEmpty(updated_at_min)){
        response = JSON.stringify({ nested: [ { id: 1 }, { id: 4 } ] });
      } else {
        response = JSON.stringify({ nested: [] });
      }
      xhr.respond(200, {'Content-Type': 'application/json'}, response);
    });

   var collection = new DualCollection();
   collection.url = '/test';
   collection.name = 'nested';

   collection.save([
     { id: 1, updated_at: '2016-12-10' },
     { id: 2, _state: 'UPDATE_FAILED' }, // garbage
     { id: 3 }, // garbage
     { _state: 'CREATE_FAILED' }
   ]).then(function(){
     expect( collection ).to.have.length(4);
     return collection.fullSync();
   })
   .then(function(){
     expect( collection ).to.have.length( 2 );
     expect( collection.map('id') ).eqls([ 1, undefined ]);
     var create = collection.states.create;
     expect( collection.map('_state') ).eqls([ undefined, create ]);
     return collection.count();
   })
   .then(function(count){
     expect( count ).eqls( 3 );
     done();
   })
   .catch(done);

  });

  //
  it('should fetch updated records on fullSync', function( done ){

    // mock server response
    this.server.respondWith( 'GET', /test\/ids\?.*$/, function(xhr){
      var response;
      var updated_at_min = _.get( Qs.parse(xhr.url) , ['filter', 'updated_at_min'] );
      if(_.isEmpty(updated_at_min)){
        response = JSON.stringify([ { id: 1 }, { id: 2 } ]);
      } else {
        response = JSON.stringify([ { id: 1, updated_at: '2016-12-10' }, { id: 2, updated_at: '2016-12-10' } ]);
      }
      xhr.respond(200, {'Content-Type': 'application/json'}, response);
    });

    var response = JSON.stringify({
      nested: [
        { id: 1, title: 'noo', updated_at: '2016-12-10' },
        { id: 2, title: 'nar', updated_at: '2016-12-10' }
      ]
    });
    this.server.respondWith( 'GET', /test\?.*$/, [200, {"Content-Type": "application/json"},
      response
    ]);

    var collection = new DualCollection();
    collection.url = '/test';
    collection.name = 'nested';

    collection.save([
      { id: 1, title: 'foo', updated_at: '2016-12-09' },
      { id: 2, title: 'bar', _state: collection.states.update, updated_at: '2016-12-09' }, // data collision
      { id: 3, title: 'baz', updated_at: '2016-12-09' }, // garbage
      { title: 'boo', _state: collection.states.create }
    ]).then(function(){
      expect( collection ).to.have.length(4);
      return collection.fullSync();
    })
    .then(function(){
      expect( collection ).to.have.length( 3 );
      expect( collection.map('id') ).eqls([ 1, 2, undefined ]);
      expect( collection.map('_state') ).eqls([ undefined, undefined, collection.states.create ]);
      expect( collection.map('title') ).eqls([ 'noo', 'nar', 'boo' ]);
      return collection.count();
    })
    .then(function(count){
      expect( count ).eqls( 3 );
      done();
    })
    .catch(done);

  });

  /**
   *
   */
  it('should set the right totals on initial fetch', function(done){

    var server = this.server;

    var data = [
      { id: 11, title: 'Foo', updated_at: '2016-12-11' },
      { id: 36, title: 'Bar', updated_at: '2016-11-11' },
      { id: 45, title: 'Baz', updated_at: '2016-10-11' },
      { id: 68, title: 'Noo', updated_at: '2016-12-01' },
      { id: 99, title: 'Nar', updated_at: '2016-12-11' }
    ];

    // fetch records
    server.respondWith( 'GET', /^\/test\?.*$/, function(xhr){
      var response;
      var headers = {'Content-Type': 'application/json'};
      response = JSON.stringify( _.slice(data, 0, 2) );
      _.set(headers, 'X-WC-Total', '5');
      xhr.respond(200, headers, response);
    });

    // fetch ids response
    server.respondWith( 'GET', /test\/ids\?.*$/, function(xhr){
      var response;
      var headers = {'Content-Type': 'application/json'};
      var updated_at_min = _.get( Qs.parse(xhr.url) , ['filter', 'updated_at_min'] );
      if(_.isEmpty(updated_at_min)){
        response = JSON.stringify( _.map(data, function(obj){ return {id: obj.id} }) ); // all ids
        _.set(headers, 'X-WC-Total', '5');
      } else {
        response = JSON.stringify([]); // updated ids
        _.set(headers, 'X-WC-Total', '0');
      }
      xhr.respond(200, headers, response);
    });

    var collection = new DualCollection();
    collection.url = '/test';

    collection.fetch({
      data: {
        filter: {
          limit: 2
        }
      }
    })
    .then(function(){
      var totals = _.get(collection, ['state', 'totals']);
      // post fullSync finish
      var idb = _.get(collection, ['state', 'totals', 'idb']);
      expect(idb.total).eqls(2);
      expect(idb.delayed).eqls(0);

      // remote still valid
      var remote = _.get(collection, ['state', 'totals', 'remote']);
      expect(remote.total).eqls(5);

      // fullSync finished
      collection.on('pagination:totals', function(){

        // post fullSync finish
        var idb = _.get(collection, ['state', 'totals', 'idb']);
        expect(idb.total).eqls(5);
        expect(idb.delayed).eqls(3);

        // remote still valid
        var remote = _.get(collection, ['state', 'totals', 'remote']);
        expect(remote.total).eqls(5);

        expect(collection.hasMore()).to.be.true;

        done();
      });
    })
    .catch(done);

  });

  /**
   *
   */
  it('should set the right totals on after filtered fetch', function(done){

    var server = this.server;

    var data = [
      { id: 1, title: 'Foo', updated_at: '2016-12-11' },
      { id: 3, title: 'Bar', updated_at: '2016-11-11' },
      { id: 4, title: 'Baz', updated_at: '2016-10-11' },
      { id: 6, title: 'Noo', updated_at: '2016-12-01' },
      { id: 9, title: 'Nar', updated_at: '2016-12-11' }
    ];

    // fetch records
    server.respondWith( 'GET', /^\/test\?.*$/, function(xhr){
      var response;
      var headers = {'Content-Type': 'application/json'};
      var not_in = _.get( Qs.parse(xhr.url) , ['filter', 'not_in'] );
      if(_.includes(not_in, 4)){
        response = JSON.stringify([]);
        _.set(headers, 'X-WC-Total', '0');
      } else {
        response = JSON.stringify([{ id: 4, title: 'Baz', updated_at: '2016-10-11' }]);
        _.set(headers, 'X-WC-Total', '1');
      }
      xhr.respond(200, headers, response);
    });

    var collection = new DualCollection();
    collection.url = '/test';

    // save a collection after first fetch
    collection.save([
      { id: 1, title: 'Foo', updated_at: '2016-12-11' },
      { id: 3, title: 'Bar', updated_at: '2016-11-11' },
      { id: 4, _state: collection.states.read },
      { id: 6, _state: collection.states.read },
      { id: 9, _state: collection.states.read }
    ])
    .then(function(response){
      expect(collection.isNew()).to.be.false;
      expect(response).to.have.length(5);
      expect(collection).to.have.length(5);

      // remove read delayed
      collection.remove( collection.where({ _state: collection.states.read }) );
      expect(collection).to.have.length(2);

      return collection.fetch({
        data: {
          filter: {
            limit: 2,
            q: 'ba',
            qFields: 'title'
          }
        }
      });
    })
    .then(function(response){
      expect(response).to.have.length(1);
      expect(collection).to.have.length(1);

      var idb = _.get(collection, ['state', 'totals', 'idb']);
      expect(idb.total).eqls(1);
      expect(idb.delayed).eqls(3);

      expect(collection.hasMore()).to.be.true;

      // infinite view collection.appendNextPage()
      return collection.fetch({
        index: 'id',
        remove: false,
        data: {
          filter: {
            limit: 2,
            q: [{
              type: 'string',
              query: 'ba'
            }],
            qFields: ['title'],
            not_in: '3'
          }
        }
      });
    })
    .then(function(response){
      expect(response).to.have.length(1);
      expect(collection).to.have.length(2);
      expect(collection.map('id')).eqls([3, 4]);

      return collection.fetch({
        index: 'id',
        remove: false,
        data: {
          filter: {
            limit: 2,
            q: [{
              type: 'string',
              query: 'ba'
            }],
            qFields: ['title'],
            not_in: '3, 4'
          }
        }
      });
    })
    .then(function(response){
      expect(response).to.have.length(0);

      var idb = _.get(collection, ['state', 'totals', 'idb']);
      expect(idb.total).eqls(0);
      expect(idb.delayed).eqls(2);

      var remote = _.get(collection, ['state', 'totals', 'remote']);
      expect(remote.total).eqls(0);

      expect(collection.hasMore()).to.be.false;

      done();
    })
    .catch(done);

  });

  it('should be performant with large databases', function(done){
    this.timeout(9000);

    var server = this.server;
    var largeDB = [];
    for(var i = 1; i <= 10000; i++ ){
      largeDB.push({ id: i });
    }

    // first server response
    server.respondWith('GET', '/test', [200, {"Content-Type": "application/json"},
      JSON.stringify([ {id: 1, foo: 'bar'}, {id: 2, foo: 'baz', updated_at: '2017-01-08' } ])
    ]);

    // mock server response
    server.respondWith( 'GET', /test\/ids\?.*$/, function(xhr){
      var response;
      var updated_at_min = _.get( Qs.parse(xhr.url) , ['filter', 'updated_at_min'] );
      if(_.isEmpty(updated_at_min)){
        response = JSON.stringify(largeDB);
      } else {
        response = JSON.stringify([]);
      }
      xhr.respond(200, {'Content-Type': 'application/json'}, response);
    });


    var collection = new DualCollection();
    collection.url = '/test';

    var start = Date.now();

    collection.fetch()
      .then(function(response){
        expect(response).to.have.length(2);
        expect(collection).to.have.length(2);

        // full id sync happens in background
        collection.on('sync:fullSync', function(){
          var time = Date.now() - start;
          console.log(time);

          collection.db.count()
            .then(function(count){
              expect(count).equals(largeDB.length);
              done();
            })
            .catch(done);
        });

      })
      .catch(done);
  });

  /**
   * Clear test database
   */
  afterEach(function (done) {
    this.server.restore();
    var collection = new DualCollection();
    collection.destroy().then(done);
  });

  /**
   * Delete test database
   */
  after(function () {
    var collection = new DualCollection();
    window.indexedDB.deleteDatabase(collection.db.opts.dbName);
  });

});