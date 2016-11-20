module.exports = function(grunt) {

  grunt.initConfig({

    watch: {
      js: {
        files: ['src/*.js'],
        tasks: ['webpack', 'jshint']
      },
      test: {
        files: ['tests/*.spec.js'],
        tasks: ['jshint']
      }
    },

    jshint: {
      options: {
        jshintrc: true,
        reporter: require('jshint-stylish'),
        verbose: true
      },
      files: ['src/*.js']
    },

    webpack: {
      options: {
        entry: {
          'backbone-dual-storage': './index.js'
        },
        resolve: {
          alias: {
            underscore: 'lodash'
          },
          modulesDirectories: ['node_modules']
        },
        externals: {
          jquery: 'jQuery',
          lodash: '_',
          underscore: '_',
          backbone: 'Backbone'
        },
        cache: true,
        watch: true
      },
      build: {
        output: {
          path: './dist',
          filename: '[name].js',
          library: 'app'
        }
      }
    },

    karma: {
      unit: {
        configFile: 'karma.conf.js'
      }
    }

  });

  require('load-grunt-tasks')(grunt);
  grunt.registerTask('test', ['webpack', 'jshint', 'karma']);
  grunt.registerTask('dev', ['webpack', 'jshint', 'watch']);
  grunt.registerTask('default', ['test']);

}