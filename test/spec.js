describe('Backbone.DualCollection', function () {

  it('should be in a valid state', function() {
    var collection = new Backbone.DualCollection();
    expect( collection).to.be.ok;
  });

  it('should create to local IndexedDB', function( done ){
    var collection = new Backbone.DualCollection();

    collection.create({ foo: 'bar' }, {
      wait: true,
      special: true,
      success: function( model, response, options ){
        expect( model.isNew() ).to.be.false;
        expect( model.id ).to.equal( response.local_id );
        expect( model.get('_state') ).to.equal( collection.states.create );
        expect( response.foo ).to.equal( 'bar' );
        expect( options.special ).to.be.true;

        collection.fetch({
          reset: true,
          special: true,
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
          success: function( model, response, options ){
            expect( model.get('_state') ).to.equal( collection.states.create );
            expect( model.get('foo') ).to.equal( 'baz' );
            expect( response.foo ).to.equal( 'baz' );
            expect( options.special ).to.be.true;

            collection.fetch({
              reset: true,
              special: true,
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

    // mock bb.ajax
    Backbone.ajax = function( options ){
      options = options || {};
      expect( options.type ).to.equal('POST');
      var dfd = $.Deferred();
      _.delay( function(){
        var resp = {
          foo: 'bar',
          id: 1
        };
        if( options.success ){
          options.success(resp);
        }
        dfd.resolve(resp);
      }, 50 );
      return dfd;
    };

    var collection = new Backbone.DualCollection();
    collection.url = 'test';

    collection.create({ foo: 'bar' }, {
      wait: true,
      remote: true,
      special: true,
      success: function( model, response, options ){
        expect( model.isNew() ).to.be.false;
        expect( model.get('id') ).to.equal( 1 );
        expect( model.get('_state') ).to.be.undefined;
        expect( response ).eqls( model.attributes );
        expect( options.special ).to.be.true;

        collection.fetch({
          reset: true,
          special: true,
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

  it('should update to local and remote with \'remote: true\' option', function( done ){

    // mock bb.ajax
    Backbone.ajax = function( options ){
      options = options || {};
      expect( options.type ).to.equal('PUT');
      var dfd = $.Deferred();
      _.delay( function(){
        var resp = {
          foo: 'baz',
          id: 2
        };
        if( options.success ){
          options.success(resp);
        }
        dfd.resolve(resp);
      }, 50 );
      return dfd;
    };

    var collection = new Backbone.DualCollection();
    collection.url = 'http://test';

    collection.create({ id: 2, foo: 'bar' }, {
      wait: true,
      success: function( model, response, options ){
        expect( model.isNew() ).to.be.false;
        expect( model.get('_state') ).to.equal( collection.states.update );

        model.save({ foo: 'baz' }, {
          remote: true,
          wait: true,
          special: true,
          success: function( model, response, options ){
            expect( model.get('_state') ).to.be.undefined;
            expect( model.get('foo') ).to.equal( 'baz' );
            expect( response ).to.eql( model.attributes );
            expect( options.special ).to.be.true;

            collection.fetch({
              reset: true,
              special: true,
              success: function( collection, response, options ){
                expect( collection.at(0).attributes ).to.eql( model.attributes );
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

  it('model should be compatible with nested APIs', function( done ){

    var ajaxResponse = {
      'test': { foo: 'bar' }
    };

    // mock bb.ajax
    Backbone.ajax = function( options ){
      options = options || {};
      var payload = JSON.parse( options.data );
      expect( Object.keys(payload) ).to.eql(['test'] );
      return ajaxResponse;
    };

    var collection = new Backbone.DualCollection();
    collection.url = 'http://test';

    var model = collection.add({ foo: 'bar' });
    model.name = 'test';
    model.save({}, {
      remote: true,
      special: true,
      success: function( m, response, options ){
        expect( m ).eqls( model );

        // note: response is coming from idb not ajax
        // expect( response ).eqls( ajaxResponse );

        expect( options.special ).to.be.true;
        done();
      }
    });

  });

  it('should fetch and merge a remote collection', function( done ){

    var count = 1;
    var resp1 = [
      { id: 1, foo: 'bar' },
      { id: 2, foo: 'baz' },
      { id: 3, foo: 'boo' }
    ];
    var resp2 = {
        nested: [
        { id: 1, foo: 'bar' },
        { id: 3, foo: 'baz' },
        { id: 4, foo: 'boo' }
      ]
    };

    // mock bb.ajax
    Backbone.ajax = function( options ){
      options = options || {};
      expect( options.type ).to.equal('GET');
      var dfd = $.Deferred();
      _.delay( function(){
        var resp = count === 1 ? resp1 : resp2;
        count++;
        if( options.success ){
          options.success(resp);
        }
        dfd.resolve(resp);
      }, 50 );
      return dfd;
    };

    var collection = new Backbone.DualCollection();
    collection.url = 'http://test';
    collection.name = 'nested';

    collection.fetch({
      remote: true,
      special: true,
      success: function( collection, response, options ){
        expect( collection ).to.have.length( 3 );
        expect( collection.map('local_id') ).to.not.be.empty;
        expect( _.map(response, 'id')).eqls( [1, 2, 3] );
        expect( options.special ).to.be.true;

        collection.fetch({
          remote: true,
          special: true,
          success: function( collection, response, options ){
            expect( collection ).to.have.length( 4 );
            expect( collection.map('local_id') ).to.not.be.empty;
            expect( collection.map('foo') ).eqls([ 'bar', 'baz', 'baz', 'boo' ]);
            expect( _.map(response, 'id') ).eqls( [1, 3, 4] );
            expect( options.special ).to.be.true;
            done();
          }
        });
      }
    });

  });

  it('should fetch all remote ids', function( done ){

    // mock bb.ajax
    Backbone.ajax = function( options ){
      options = options || {};
      expect( options.type ).to.equal('GET');
      var dfd = $.Deferred();
      _.delay( function(){
        var resp = {
          nested: [
            { id: 1 }, { id: 2 }, { id: 3 }
          ]
        };
        if( options.success ){
          options.success(resp);
        }
        dfd.resolve(resp);
      }, 50 );
      return dfd;
    };

    var collection = new Backbone.DualCollection();
    collection.url = 'http://test';
    collection.name = 'nested';

    collection.fetchRemoteIds(null, {
      special: true,
      success: function( collection, response, options ){
        expect( collection ).to.have.length( 3 );
        expect( collection.map('local_id') ).to.not.be.empty;
        var read = collection.states.read;
        expect( collection.map('_state') ).eqls( [read, read, read] );
        expect( _.map(response, 'id') ).eqls( [1, 2, 3] );
        expect( options.special ).to.be.true;
        done();
      }
    });

  });

  it('should fetch and merge all remote ids', function( done ){

    // mock bb.ajax
    Backbone.ajax = function( options ){
      options = options || {};
      expect( options.type ).to.equal('GET');
      var dfd = $.Deferred();
      _.delay( function(){
        var resp = {
          nested: [
            { id: 1 }, { id: 2 }, { id: 3 }
          ]
        };
        if( options.success ){
          options.success(resp);
        }
        dfd.resolve(resp);
      }, 50 );
      return dfd;
    };

    var collection = new Backbone.DualCollection();
    collection.url = 'http://test';
    collection.name = 'nested';

    collection.saveBatch([
      { id: 1, foo: 'bar' },
      { id: 2 }
    ]).then(function(){
      expect( collection ).to.have.length( 2 );

      collection.fetchUpdatedIds({
        special: true,
        success: function( collection, response, options ){
          expect( collection ).to.have.length( 3 );

          var read = collection.states.read;
          expect( collection.map('_state') ).eqls([ undefined, undefined, read ]);
          expect( options.special ).to.be.true;

          collection.fetch({
            reset: true,
            success: function( collection ){
              var model = collection.findWhere({ id: 1 });
              expect( model.get('foo') ).equals('bar');

              done();
            }
          });

        }
      });

    });

  });

  it('should fetch updated ids from the server', function( done ){

    // mock bb.ajax
    Backbone.ajax = function( options ){
      options = options || {};
      expect( options.type ).to.equal('GET');
      var dfd = $.Deferred();
      _.delay( function(){
        var resp = {
          nested: [
            { id: 2, last_updated: '2016-01-14T13:15:04Z' },
            { id: 4, last_updated: '2016-01-12T13:15:04Z' }
          ]
        };
        if( options.success ){
          options.success(resp);
        }
        dfd.resolve(resp);
      }, 50 );
      return dfd;
    };

    var collection = new Backbone.DualCollection();
    collection.url = 'http://test';
    collection.name = 'nested';

    collection.saveBatch([
      { id: 1, last_updated: '2016-01-04T13:15:04Z', foo: 'bar' },
      { id: 2, last_updated: '2016-01-11T13:15:04Z' },
      { id: 3, last_updated: '2015-01-04T13:15:04Z' }
    ]).then(function(){
      expect( collection ).to.have.length( 3 );

      collection.fetchUpdatedIds({
        special: true,
        success: function( collection, response, options ){
          expect( collection ).to.have.length( 4 );
          var read = collection.states.read;
          expect( collection.map('_state') ).eqls([ undefined, read, undefined, read ]);
          expect( _.map(response, 'id') ).eqls( [ 2, 4 ] );
          expect( options.special ).to.be.true;
          done();
        }
      });

    });

  });

  it('should remove garbage', function( done ){

    // mock bb.ajax
    Backbone.ajax = function( options ){
      options = options || {};
      expect( options.type ).to.equal('GET');
      var dfd = $.Deferred();
      _.delay( function(){
        var resp = {
          nested: [
            { id: 1 },
            { id: 4 }
          ]
        };
        if( options.success ){
          options.success(resp);
        }
        dfd.resolve(resp);
      }, 50 );
      return dfd;
    };

    var collection = new Backbone.DualCollection();
    collection.url = 'http://test';
    collection.name = 'nested';

    collection.saveBatch([
      { id: 1 },
      { id: 2, _state: 'UPDATE_FAILED' },
      { id: 3 },
      { }
    ]).then(function(){
      expect( collection ).to.have.length(4);

      collection.fetchRemoteIds(null, {
        remove: true,
        success: function(){
          expect( collection ).to.have.length( 3 );
          var create = collection.states.create;
          var read = collection.states.read;
          expect( collection.map('_state') ).eqls([ undefined, create, read ]);
          done();
        }
      });

    });

  });

  /**
   * Clear test database
   */
  afterEach(function() {
    var collection = new Backbone.DualCollection();
    collection.clear();
  });

  /**
   * Delete test database
   */
  after(function() {
    window.indexedDB.deleteDatabase('IDBWrapper-Store');
  });

});