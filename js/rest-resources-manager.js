/* global CustomizeRestResources, JSON, wp, jQuery, console */

/**
 * Rest Resource Manager.
 *
 * @class
 * @param {object} args
 * @param {string} args.previewNonce
 * @param {string} args.previewedTheme
 * @param {string} args.restApiRoot
 */
CustomizeRestResources.RestResourcesManager = wp.customize.Class.extend({

	initialize: function ( args ) {
		var manager = this;

		/**
		 * Customizer preview nonce.
		 *
		 * @type {string}
		 */
		manager.previewNonce = args.previewNonce;

		/**
		 * Customizer previewed theme.
		 *
		 * @type {string}
		 */
		manager.previewedTheme = args.previewedTheme;

		/**
		 * REST API Root URL.
		 *
		 * @type {string}
		 */
		manager.restApiRoot = args.restApiRoot;

		if ( 'undefined' === typeof wp ) {
			throw new Error( 'wp object is not defined' );
		}
		if ( 'undefined' === typeof wp.customize ) {
			throw new Error( 'wp.customize is not defined' );
		}
		if ( 'undefined' === typeof wp.api ) {
			throw new Error( 'wp.api is not defined' );
		}
		if ( 0 === _.values( wp.api.collections ).length || 0 === _.values( wp.api.models ).length ) {
			throw new Error( 'wp.api has not been initialized yet' );
		}
		_.each( [ 'restApiRoot', 'previewNonce', 'previewedTheme' ], function( key ) {
			if ( ! manager[ key ] ) {
				throw new Error( 'Missing ' + key + ' arg' );
			}
		} );

		manager.init();
	},

	init: function() {
		var manager = this;
		jQuery.ajaxPrefilter( 'json', _.bind( manager.prefilterAjax, manager ) );
	},

	injectCollectionSync: function() {
		var manager = this;
		_.each( wp.api.collections, function( collection ) {
			manager.customizeCollection( collection );
		} );
	},

	/**
	 * Extend a WP API Backbone collection to integrate with the Customizer.
	 *
	 * @param {Backbone.Collection} collection
	 */
	customizeCollection: function ( collection ) {
		var oldInitialize = collection.prototype.initialize;
		collection.prototype.initialize = function () {
			var collection = this;
			oldInitialize.apply( collection, arguments );
			collection.on( 'add', function( model, collection, options ) {
				console.info( 'added', model );
				// @todo Make sure that
			} );

		};
	},

	/**
	 * Get query vars for Customize preview query.
	 *
	 * @see wp.customize.previewer.query
	 *
	 * @returns {{
	 *     customized: string,
	 *     nonce: string,
	 *     wp_customize: string,
	 *     theme: string
	 * }}
	 */
	getCustomizeQueryVars: function() {
		var manager = this, customized = {};
		wp.customize.each( function( setting, settingId ) {
			customized[ settingId ] = wp.customize( settingId ).get();
		} );
		return {
			wp_customize: 'on',
			theme: manager.previewedTheme,
			customized: JSON.stringify( customized ),
			nonce: manager.previewNonce
		};
	},

	/**
	 * Rewrite WP API Ajax requests to inject Customizer state.
	 *
	 * @todo This can be in base??
	 *
	 * @param {object} options
	 * @param {string} options.type
	 * @param {string} options.url
	 * @param {object} originalOptions
	 * @param {object} xhr
	 */
	prefilterAjax: function( options, originalOptions, xhr ) {
		var manager = this, restMethod;

		// Abort if not API request or Customizer preview not initialized yet.
		if ( 0 !== options.url.indexOf( manager.restApiRoot ) ) {
			return;
		}

		restMethod = options.type;

		if ( 'GET' !== options.type && 'HEAD' !== options.type && 'undefined' !== typeof console.warn ) {
			console.warn( 'Performing write request to WP API in Customizer.' );
		}

		// Customizer currently requires POST requests, so use override (force Backbone.emulateHTTP).
		if ( 'POST' !== options.type ) {
			xhr.setRequestHeader( 'X-HTTP-Method-Override', options.type );
			options.type = 'POST';
		}

		// Make sure the query vars for the REST API persist in GET (since REST API explicitly look at $_GET['filter']).
		if ( options.url.indexOf( '?' ) === -1 ) {
			options.url += '?';
		} else {
			options.url += '&';
		}
		if ( options.data && 'GET' === restMethod ) {
			/*
			 * We have to make sure the REST query vars are added as GET params
			 * when the method is GET as otherwise they won't be parsed properly.
			 * The issue lies in \WP_REST_Request::get_parameter_order() which
			 * only is looking at \WP_REST_Request::$method instead of $_SERVER['REQUEST_METHOD'].
			 * @todo Improve \WP_REST_Request::get_parameter_order() to be more aware of X-HTTP-Method-Override
			 */
			options.url += options.data;
		}

		// Include Customizer query vars in preview request POST data.
		if ( options.data ) {
			options.data += '&';
		}
		options.data += jQuery.param( manager.getCustomizeQueryVars() );
	}
} );
