describe('Backbone.DualCollection', function () {

  beforeEach(function() {
    this.server = sinon.fakeServer.create();
    this.server.autoRespond = true;
    this.server.autoRespondAfter = 400;
  });

  it('should be in a valid state', function() {
    var collection = new Backbone.DualCollection();
    expect( collection ).to.be.ok;
  });

  it('should create to local IndexedDB', function( done ){
    var collection = new Backbone.DualCollection();

    collection.create({ foo: 'bar' }, {
      wait: true,
      special: true,
      error: done,
      success: function( model, response, options ){
        expect( model.isNew() ).to.be.false;
        expect( model.id ).to.equal( response.local_id );
        expect( model.get('_state') ).to.equal( collection.states.create );
        expect( response.foo ).to.equal( 'bar' );
        expect( options.special ).to.be.true;

        collection.fetch({
          reset: true,
          special: true,
          error: done,
          success: function( collection, response, options ){
            expect( collection.at(0).attributes ).to.eql( model.attributes );
            expect( response ).to.eql( [ model.attributes ] );
            expect( options.special ).to.be.true;
            done();
          }
        });
      }
    });

  });

  it('should update to local IndexedDB', function( done ){
    var collection = new Backbone.DualCollection();

    collection.create({ foo: 'bar' }, {
      //wait: true,
      success: function( model, response, options ){
        model.save({ foo: 'baz' }, {
          special: true,
          error: done,
          success: function( model, response, options ){
            expect( model.get('_state') ).to.equal( collection.states.create );
            expect( model.get('foo') ).to.equal( 'baz' );
            expect( response.foo ).to.equal( 'baz' );
            expect( options.special ).to.be.true;

            collection.fetch({
              reset: true,
              special: true,
              error: done,
              success: function( collection, response, options ){
                expect( collection.at(0).attributes ).eqls( model.attributes );
                expect( response ).to.eql( [ model.attributes ] );
                expect( options.special ).to.be.true;
                done();
              }
            });
          }
        });
      }
    });

  });

  it('should create to local and remote with \'remote: true\' option', function( done ){

    // mock server response
    var response = JSON.stringify({ id: 1, foo: 'bar' });
    this.server.respondWith( 'POST', '/test', [200, {"Content-Type": "application/json"},
      response
    ]);

    var collection = new Backbone.DualCollection();
    collection.url = '/test';

    collection.create({ foo: 'bar' }, {
      wait: true,
      remote: true,
      special: true,
      error: done,
      success: function( model, response, options ){
        expect( collection ).to.have.length( 1 );
        expect( model.isNew() ).to.be.false;
        expect( model.get('id') ).to.equal( 1 );
        expect( model.get('_state') ).to.be.undefined;
        expect( response ).eqls( model.attributes );
        expect( options.special ).to.be.true;

        collection.db.count(function(count){
          expect(count).equals(1);
        })
        .then(function(){
          return collection.db.get( model.id );
        })
        .then(function( response ){
          expect( response ).to.eql( model.attributes );
          done();
        });
      }
    });

  });

  it('should update to local and remote with \'remote: true\' option', function( done ){

    // mock server response
    var response = JSON.stringify({ id: 2, foo: 'baz' });
    this.server.respondWith( 'PUT', '/test/2/', [200, {"Content-Type": "application/json"},
      response
    ]);

    var collection = new Backbone.DualCollection();
    collection.url = '/test';

    collection.create({ id: 2, foo: 'bar' }, {
      wait: true,
      error: done,
      success: function( model, response, options ){
        expect( model.isNew() ).to.be.false;
        expect( model.get('_state') ).to.equal( collection.states.update );

        model.save({ foo: 'baz' }, {
          remote: true,
          wait: true,
          special: true,
          error: done,
          success: function( model, response, options ){
            expect( collection ).to.have.length( 1 );
            expect( model.get('_state') ).to.be.undefined;
            expect( model.get('foo') ).to.equal( 'baz' );
            expect( response ).to.eql( model.attributes );
            expect( options.special ).to.be.true;

            collection.db.count(function(count){
              expect(count).equals(1);
            })
            .then(function(){
              return collection.db.get( model.id );
            })
            .then(function( response ){
              expect( response ).to.eql( model.attributes );
              done();
            });
          }
        });
      }
    });

  });

  it('model should be compatible with nested APIs', function( done ){

    // mock server response
    var response = JSON.stringify({ test: { id: 1, foo: 'bar' } });
    this.server.respondWith( 'POST', '/test', [200, {"Content-Type": "application/json"},
      response
    ]);

    var collection = new Backbone.DualCollection();
    collection.url = '/test';

    var model = collection.add({ foo: 'bar' });
    model.name = 'test';
    model.save({}, {
      remote: true,
      special: true,
      error: done,
      success: function( m, response, options ){
        expect( m ).eqls( model );
        expect( m.get('id') ).to.equal( 1 );

        // note: response is coming from idb not ajax
        // expect( response ).eqls( ajaxResponse );

        expect( options.special ).to.be.true;
        done();
      }
    });

  });

  it('should fetch and merge a remote collection', function( done ){

    // mock server response
    var response = JSON.stringify({
      nested: [
        { id: 1, foo: 'bar' },
        { id: 3, foo: 'baz' },
        { id: 4, foo: 'boo' }
      ]
    });
    this.server.respondWith( 'GET', '/test', [200, {"Content-Type": "application/json"},
      response
    ]);

    var collection = new Backbone.DualCollection();
    collection.url = '/test';
    collection.name = 'nested';

    collection.putBatch([
      { id: 1, foo: 'bar' },
      { id: 2, foo: 'baz' },
      { id: 3, foo: 'boo' }
    ])
    .then( function( records ) {
      collection.add(records);
      expect( collection ).to.have.length( 3 );
      expect( collection.map('local_id') ).to.not.be.empty;
      expect( _.map(records, 'id')).eqls( [1, 2, 3] );

      collection.fetch({
        remote: true,
        special: true,
        error: done,
        success: function( collection, response, options ){
          expect( collection ).to.have.length( 4 );
          expect( collection.map('local_id') ).to.not.be.empty;
          expect( collection.map('foo') ).eqls([ 'bar', 'baz', 'baz', 'boo' ]);
          expect( _.map(response, 'id') ).eqls( [1, 3, 4] );
          expect( options.special ).to.be.true;
          done();
        }
      });
    });

  });

  it('should fetch all remote ids', function( done ){

    // mock server response
    var response = JSON.stringify({ nested: [{ id: 1 }, { id: 2 }, { id: 3 }] });
    this.server.respondWith( 'GET', /^\/test\/ids\?.*$/, [200, {"Content-Type": "application/json"},
      response
    ]);

    var collection = new Backbone.DualCollection();
    collection.url = '/test';
    collection.name = 'nested';

    collection.fetchRemoteIds()
      .then(function( response ){
        expect( response ).to.have.length( 3 );
        var read = collection.states.read;
        _.each( response, function( model ){
          expect( model.local_id ).not.to.be.undefined;
          expect( model._state ).eqls( read );
        });
        done();
      });

  });

  it('should fetch and merge all remote ids', function( done ){

    // mock server response
    var response = JSON.stringify({ nested: [{ id: 1 }, { id: 2 }, { id: 3 }] });
    this.server.respondWith( 'GET', /^\/test\/ids\?.*$/, [200, {"Content-Type": "application/json"},
      response
    ]);

    var collection = new Backbone.DualCollection();
    collection.url = '/test';
    collection.name = 'nested';

    collection.putBatch([
      { id: 1, foo: 'bar' },
      { id: 2 }
    ])
    .then(function() {
      return collection.fetchRemoteIds();
    })
    .then(function( response ){
      expect( response ).to.have.length( 3 );

      var read = collection.states.read;
      expect( _.map( response, '_state') ).eqls([ undefined, undefined, read ]);

      collection.fetch({
        error: done,
        success: function( collection ){
          expect( collection ).to.have.length( 3 );

          var model = collection.findWhere({ id: 1 });
          expect( model.get('foo') ).equals('bar');

          done();
        }
      });
    });

  });

  it('should fetch updated ids from the server', function( done ){

    // mock server response
    var response = JSON.stringify({
      nested: [
        { id: 2, updated_at: '2016-01-14T13:15:04Z' },
        { id: 4, updated_at: '2016-01-12T13:15:04Z' }
      ]
    });
    this.server.respondWith( 'GET', /^\/test\/ids\?.*$/, [200, {"Content-Type": "application/json"},
      response
    ]);

    var collection = new Backbone.DualCollection();
    collection.url = '/test';
    collection.name = 'nested';

    collection.putBatch([
      { id: 1, updated_at: '2016-01-04T13:15:04Z', foo: 'bar' },
      { id: 2, updated_at: '2016-01-11T13:15:04Z' },
      { id: 3, updated_at: '2015-01-04T13:15:04Z' }
    ]).then(function( response ){
      expect( response ).to.have.length( 3 );
      return collection.fetchUpdatedIds();
    })
    .then(function( response ){
      expect( response ).to.have.length( 2 );
      var read = collection.states.read;
      expect( _.map(response, 'id') ).eqls([ 2, 4 ]);
      expect( _.map(response, '_state') ).eqls([ read, read ]);

      collection.fetch({
        error: done,
        success: function( collection ){
          expect( collection ).to.have.length( 4 );
          done();
        }
      });

    });

  });
  //
  //it('should remove garbage', function( done ){
  //
  //  // mock server response
  //  var response = JSON.stringify({ nested: [ { id: 1 }, { id: 4 } ] });
  //  this.server.respondWith( 'GET', /^\/test\/ids\?.*$/, [200, {"Content-Type": "application/json"},
  //    response
  //  ]);
  //
  //  var collection = new Backbone.DualCollection();
  //  collection.url = '/test';
  //  collection.name = 'nested';
  //
  //  collection.saveBatch([
  //    { id: 1 },
  //    { id: 2, _state: 'UPDATE_FAILED' },
  //    { id: 3 },
  //    { }
  //  ]).then(function(){
  //    expect( collection ).to.have.length(4);
  //
  //    collection.fetchRemoteIds(null, {
  //      remove: true,
  //      error: done,
  //      success: function(){
  //        expect( collection ).to.have.length( 3 );
  //        var create = collection.states.create;
  //        var read = collection.states.read;
  //        expect( collection.map('_state') ).eqls([ undefined, create, read ]);
  //        done();
  //      }
  //    });
  //
  //  });
  //
  //});

  /**
   * Clear test database
   */
  afterEach(function( done ) {
    this.server.restore();
    var collection = new Backbone.DualCollection();
    collection.clear().then( done );
  });

  /**
   * Delete test database
   */
  after(function() {
    window.indexedDB.deleteDatabase('IDBWrapper-Store');
  });

});