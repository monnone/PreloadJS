/*
* AbstractLoader for PreloadJS
* Visit http://createjs.com/ for documentation, updates and examples.
*
*
* Copyright (c) 2012 gskinner.com, inc.
*
* Permission is hereby granted, free of charge, to any person
* obtaining a copy of this software and associated documentation
* files (the "Software"), to deal in the Software without
* restriction, including without limitation the rights to use,
* copy, modify, merge, publish, distribute, sublicense, and/or sell
* copies of the Software, and to permit persons to whom the
* Software is furnished to do so, subject to the following
* conditions:
*
* The above copyright notice and this permission notice shall be
* included in all copies or substantial portions of the Software.
*
* THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
* EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES
* OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
* NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT
* HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY,
* WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
* FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR
* OTHER DEALINGS IN THE SOFTWARE.
*/

/**
 * @module PreloadJS
 */

// namespace:
this.createjs = this.createjs||{};

(function() {

	/**
	 * The base loader, which handles all callbacks. All loaders should extend this class.
	 * @class AbstractLoader
	 * @constructor
	 */
	var AbstractLoader = function () {
		this.init();
	};

	AbstractLoader.prototype = {};
	var p = AbstractLoader.prototype;
	var s = AbstractLoader;

	/**
	 * The RegExp pattern to use to parse file URIs. This supports simple file names, as well as full domain URIs with
	 * query strings. The resulting match is: protocol:$1 domain:$2 path:$3 file:$4 ext:$5 params:$6.
	 * @property FILE_PATTERN
	 * @type {RegExp}
	 * @static
	 * @protected
	 */
	s.FILE_PATTERN = /(\w+:\/{2})?((?:\w+\.){2}\w+)?(\/?[\S]+\/|\/)?([\w\-%]+)(?:\.)(\w+)?(\?\S+)?/i;

	/**
	 * Determine if this loader has completed already.
	 * @property loaded
	 * @type Boolean
	 * @default false
	 */
	p.loaded = false;

	/**
	 * Determine if a preload instance was canceled. Canceled loads will
	 * not fire complete events. Note that PreloadJS queues should be closed
	 * instead of canceled.
	 * @property canceled
	 * @type {Boolean}
	 * @default false
	 */
	p.canceled = false;

	/**
	 * The current load progress (percentage) for this item.
	 * @property progress
	 * @type Number
	 * @default 0
	 */
	p.progress = 0;

	// The manifest item we are loading
	p._item = null;

//Callbacks
	/**
	 * The callback to fire when progress changes.
	 * @event onProgress
	 */
	p.onProgress = null;

	/**
	 * The callback to fire when a load starts.
	 * @event onLoadStart
	 */
	p.onLoadStart = null;

	/**
	 * The callback to fire when a file completes.
	 * @event onFileLoad
	 */
	p.onFileLoad = null;

	/**
	 * The callback to fire when a file progress changes.
	 * @event onFileProgress
	 */
	p.onFileProgress = null;

	/**
	 * The callback to fire when all loading is complete.
	 * @event onComplete
	 */
	p.onComplete = null;

	/**
	 * The callback to fire when the loader encounters an error. If the error was encountered
	 * by a file, the event will contain the required file data, but the target will be the loader.
	 * @event onError
	 */
	p.onError = null;


	/**
	 * Get a reference to the manifest item that is loaded by this loader.
	 * @return {Object} The manifest item
	 */
	p.getItem = function() {
		return this._item;
	};

	/**
	 * Initialize the loader.
	 * @private
	 */
	p.init = function () {};

	/**
	 * Begin the load.
	 */
	p.load = function() {};

	/**
	 * Cancel the load.
	 */
	p.cancel = function() {};


//Callback proxies
	p._sendLoadStart = function(value) {
		if (this._isCanceled()) { return; }
		if (this.onLoadStart) {
			this.onLoadStart({target:this});
		}
	};

	p._sendProgress = function(value) {
		if (this._isCanceled()) { return; }
		var event;
		if (value instanceof Number) {
			this.progress = value;
			event = {loaded:this.progress, total:1};
		} else {
			event = value;
			this.progress = value.loaded / value.total;
			if (isNaN(this.progress) || this.progress == Infinity) { this.progress = 0; }
		}
		event.target = this;
		if (this.onProgress) {
			this.onProgress(event);
		}
	};

	p._sendFileProgress = function(event) {
		if (this._isCanceled()) {
			this._cleanUp();
			return;
		}
		if (this.onFileProgress) {
			event.target = this;
			this.onFileProgress(event);
		}
	};

	p._sendComplete = function() {
		if (this._isCanceled()) { return; }
		if (this.onComplete) {
			this.onComplete({target:this});
		}
	};

	p._sendFileComplete = function(event) {
		if (this._isCanceled()) { return; }
		if (this.onFileLoad) {
			event.target = this;
			this.onFileLoad(event);
		}
	};

	p._sendError = function(event) {
		if (this._isCanceled()) { return; }
		if (this.onError) {
			if (event == null) { event = {}; }
			event.target = this;
			this.onError(event);
		}
	};

	p._isCanceled = function(event) {
		if (window.createjs == null || this.canceled) {
			return true;
		} else {
		}
		return false;
	};

	p._parseURI = function(path) {
		if (!path) { return null; }

		return path.match(s.FILE_PATTERN);
	};

	p.toString = function() {
		return "[PreloadJS AbstractLoader]";
	};

	createjs.AbstractLoader = AbstractLoader;

}());