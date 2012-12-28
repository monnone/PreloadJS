/*
* TagLoader for PreloadJS
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

// TODO: Add a fallback for CSS that does rule checking. No CSS complete event for CSS on Android. See spike.

	/**
	 * A preloader that loads items using a tag-based approach. HTML audio and images can use this plugin to load content
	 * cross-domain without security errors, whereas anything loaded with XHR has issues.
	 * <br />
	 * Note that for audio tags, we rely on the <code>canPlayThrough</code> event, which fires when the buffer is full
	 * enough to play the audio all the way through at the current download speed. This completely preloads most sound
	 * effects, however longer tracks like background audio will only load a portion before the event is fired. Most
	 * browsers (all excluding Chrome) will continue to preload once this is fired, so this is considered good enough
	 * for most cases.
	 * <br />
	 * There is a built-in fallback for XHR loading for tags that do not fire onload events, such as &lt;script&gt;
	 * and &lt;style&gt;. This approach is used so that a proper script or style object is returned to PreloadJS when it
	 * is loaded.
	 * @class TagLoader
	 * @constructor
	 * @extends AbstractLoader
	 * @param {Object} item The item to load. Please see the <code>PreloadJS.loadFile()</code> for information
	 *      on load items.
	 */
	var TagLoader = function (item) {
		this.init(item);
	};

	var p = TagLoader.prototype = new createjs.AbstractLoader();

// Protected
	/**
	 * The timeout that is called if nothing is loaded after a certain delay.
	 * @property _loadTimeout
	 * @type {Number}
	 * @private
	 */
	p._loadTimeout = null;

	/**
	 * A reference to a proxy function, which we need in order to properly remove the event handler when the
	 * load completes.
	 * @property _tagCompletProxy
	 * @type {Function}
	 * @private
	 */
	p._tagCompleteProxy = null;

	/**
	 * Determines if the load item is an audio tag, since there is some specific approaches we need to take to properly
	 * load audio.
	 * @property _isAudio
	 * @type {Boolean}
	 * @default false
	 */
	p._isAudio = false;

	/**
	 * The tag this loader uses to preload content.
	 * @property _tag
	 * @type {HTMLAudioElement | SoundLoader | Object}
	 * @private
	 */
	p._tag = null;

	// Overrides abstract method in AbstractLoader
	p.init = function (item) {
		this._item = item;
		this._tag = item.tag;
		this._isAudio = (window.HTMLAudioElement && item.tag instanceof HTMLAudioElement);
		this._tagCompleteProxy = createjs.PreloadJS.proxy(this._handleLoad, this);
	};

	/**
	 * Get the loaded content.
	 * @method getResult
	 * @return {HTMLAudioE} The loaded and parsed content.
	 */
	p.getResult = function() {
		return this._tag;
	};

	// Overrides abstract method in AbstractLoader
	p.cancel = function() {
		this.canceled = true;
		this._clean();
		var item = this.getItem();
		if (item != null) { item.src = null; } //LM: Do we need this? Might make sense for stopping loads of audio..
	};

	// Overrides abstract method in AbstractLoader
	p.load = function() {
		var item = this._item;
		var tag = this._tag;

		// In case we don't get any events.
		clearTimeout(this._loadTimeout); // Clear out any existing timeout
		this._loadTimeout = setTimeout(createjs.PreloadJS.proxy(this._handleTimeout, this), createjs.PreloadJS.TIMEOUT_TIME);

		if (this._isAudio) {
			tag.src = null; // Unset the source so we can set the preload type to "auto" without kicking off a load. This is only necessary for audio tags passed in by the developer.
			//tag.type = "audio/ogg"; // TODO: Set proper audio types
			tag.preload = "auto";
		}

		// Handlers for all tags
		tag.onerror = createjs.PreloadJS.proxy(this._handleError, this);
		// Note: We only get progress events in Chrome, but do not fully load tags in Chrome due to its behaviour, so we ignore progress.

		if (this._isAudio) {
			tag.onstalled = createjs.PreloadJS.proxy(this._handleStalled, this);
			// This will tell us when audio is buffered enough to play through, but not when its loaded.
			// The tag doesn't keep loading in Chrome once enough has buffered, and we have decided that behaviour is sufficient.
			tag.addEventListener("canplaythrough", this._tagCompleteProxy, false); // canplaythrough callback doesn't work in Chrome, so we use an event.
		} else {
			tag.onload = createjs.PreloadJS.proxy(this._handleLoad, this);
			tag.onreadystatechange = createjs.PreloadJS.proxy(this._handleReadyStateChange, this);
		}

		// Set the src after the events are all added.
		switch(item.type) {
			case createjs.PreloadJS.CSS:
				tag.href = item.src;
				break;
			case createjs.PreloadJS.SVG:
				tag.data = item.src;
				break;
			default:
				tag.src = item.src;
		}
		//tag[this._srcAttr] = item.src; // LM: This was failing in Chrome, so I substituted the above

		// If its SVG, it needs to be on the DOM to load (we remove it before sending complete).
		// It is important that this happens AFTER setting the src/data.
		if (item.type == createjs.PreloadJS.SVG || item.type == createjs.PreloadJS.JAVASCRIPT || item.type == createjs.PreloadJS.CSS) {
			(document.body || document.getElementsByTagName("body")[0]).appendChild(tag);
			//TODO: Move SVG off-screen.
		}

		// Note: Previous versions didn't seem to work when we called load() for OGG tags in Firefox. Seems fixed in 15.0.1
		if (tag.load != null) {
			tag.load();
		}
	};

	/**
	 * Handle an audio timeout. Newer browsers get a callback from the tags, but older ones may require a setTimeout
	 * to handle it. The setTimeout is always running until a response is handled by the browser.
	 * @method _handleTimeout
	 * @private
	 */
	p._handleTimeout = function() {
		this._clean();
		this._sendError({reason:"PRELOAD_TIMEOUT"}); //TODO: Eval reason prop
	};

	/**
	 * Handle a stalled audio event. The main place we seem to get these is with HTMLAudio in Chrome when we try and
	 * playback audio that is already in a load, but not complete.
	 * @method _handleStalled
	 * @private
	 */
	p._handleStalled = function() {
		//Ignore, let the timeout take care of it. Sometimes its not really stopped.
	};

	/**
	 * Handle an error event generated by the tag.
	 * @method _handleError
	 * @private
	 */
	p._handleError = function() {
		this._clean();
		this._sendError(); //TODO: Reason or error?
	};

	/**
	 * Handle the readyStateChange event. We sometimes need this in place of the onload event (mainly SCRIPT and LINK
	 * tags), but other cases may exist. Note that audio uses a custom "canplaythrough" event.
	 * @method _handleReadyStateChange
	 * @private
	 */
	p._handleReadyStateChange = function() {
		clearTimeout(this._loadTimeout);
		// This is strictly for tags in browsers that do not support onload.
		var tag = this.getItem().tag;
		if (tag.readyState == "loaded") {
			this._handleLoad();
		}
	};

	/**
	 * Handle a load (complete) event. This is called by tag callbacks, but also by readyState and canPlayThrough
	 * events. Once loaded, the item is dispatched to PreloadJS.
	 * @method _handleLoad
	 * @param event
	 * @private
	 */
	p._handleLoad = function(event) {
		if (this._isCanceled()) { return; }

		var item = this.getItem();
		var tag = item.tag;

		if (this.loaded || this.isAudio && tag.readyState !== 4) { return; } //LM: Not sure if we still need the audio check.
		this.loaded = true;

		// Remove from the DOM
		if (item.type == createjs.PreloadJS.SVG) { // item.type == createjs.PreloadJS.CSS) { //LM: Evaluate
			(document.body || document.getElementsByTagName("body")[0]).removeChild(tag);
		}

		this._clean();
		this._sendComplete();
	};

	/**
	 * Clean up the loader. This stops any timers and removes references to prevent errant callbacks.
	 * @method _clean
	 * @private
	 */
	p._clean = function() {
		clearTimeout(this._loadTimeout);

		// Delete handlers.
		var tag = this.getItem().tag;
		tag.onload = null;
		tag.removeEventListener && tag.removeEventListener("canplaythrough", this._tagCompleteProxy, false);
		tag.onstalled = null;
		tag.onprogress = null;
		tag.onerror = null;

		//TODO: Test this
		if (tag.parentNode) {
			tag.parentNode.removeChild(tag);
		}
	};

	p.toString = function() {
		return "[PreloadJS TagLoader]";
	}

	createjs.TagLoader = TagLoader;

}());